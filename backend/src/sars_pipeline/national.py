"""Country-wide view (site "kind": "mosaic"): NISAR soil moisture of the two latest 12-day cycles,
mosaicked at about 2 km, their difference, and NASA FIRMS fire detections of the last 10 days.

Every SME2 granule sits on the same global EASE-Grid 2.0 (EPSG 6933), so granules are averaged
into coarse cells by grid index, with no resampling between passes.
"""

import json
import logging
import math
from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, date, datetime, timedelta
from pathlib import Path

import numpy as np
import shapely
from pyproj import Transformer
from scipy import ndimage

from . import classify, firms, site
from .categorize import decide, outline
from .export import write_rgba, write_timeseries
from .selection import search
from .sme2 import read_sm

log = logging.getLogger(__name__)

EPSG = 6933
# EASE-Grid 2.0: the 36 km global grid split 180 times (about 200.18 m), times 10 per coarse cell.
CELL = 36032.220840584 / 180 * 10
CYCLE_DAYS = 12  # NISAR repeat cycle: one cycle covers the country once per direction
DEFAULTS = {"drying_drop": 0.05, "min_cells": 250, "max_events": 12, "min_fine_pixels": 30}
FIRE_DAYS = 10
BORDERS = Path(__file__).parent / "borders"  # country outlines (Natural Earth, public domain)


def border(name: str):
    """A country outline in degrees, grown by about one mosaic cell so coastal cells stay in."""
    feature = json.loads((BORDERS / f"{name}.geojson").read_text(encoding="utf-8"))
    return shapely.geometry.shape(feature["geometry"]).buffer(0.02)


def select(site_id: str, cfg: dict, out: Path, days: int = 75) -> dict:
    """Every SME2 granule of the two latest cycles over the bbox, one maturity (docs/03)."""
    end = datetime.now(UTC)
    window = [(end - timedelta(days=days)).strftime("%Y-%m-%d"), end.strftime("%Y-%m-%d")]
    rows = search(cfg["bbox"], *window, product="SME2")
    picked = {"site": site_id, "bbox": cfg["bbox"], "window": window, "products": {}}
    if rows:
        newest = max(rows, key=lambda r: r["date"])
        last = date.fromisoformat(newest["date"])
        cuts = [(last - timedelta(days=CYCLE_DAYS * k)).isoformat() for k in (2, 1, 0)]
        keep = {
            r["id"]: r
            for r in rows
            if r["maturity"] == newest["maturity"] and cuts[0] < r["date"] <= cuts[2]
        }
        picked["products"]["SME2"] = {
            "searched": len(rows),
            "maturity": newest["maturity"],
            # Each cycle: dates after the first value, up to and including the second.
            "cycles": [[cuts[0], cuts[1]], [cuts[1], cuts[2]]],
            "granules": sorted(keep.values(), key=lambda r: (r["date"], r["id"])),
        }
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(picked, indent=2), encoding="utf-8")
    return picked


def coarsen(x, y, sm, min_fine: int):
    """Mean of the valid 200 m pixels in each coarse cell. Returns (first row, first col, grid);
    rows count southward from the equator line of the grid, columns eastward."""
    rows, cols = np.floor(-y / CELL).astype(int), np.floor(x / CELL).astype(int)
    r0, c0 = rows.min(), cols.min()
    shape = (rows.max() - r0 + 1, cols.max() - c0 + 1)
    index = (np.broadcast_to((rows - r0)[:, None], sm.shape), np.broadcast_to(cols - c0, sm.shape))
    ok = np.isfinite(sm)
    total, count = np.zeros(shape), np.zeros(shape)
    np.add.at(total, index, np.where(ok, sm, 0))
    np.add.at(count, index, ok)
    with np.errstate(invalid="ignore"):
        return int(r0), int(c0), np.where(count >= min_fine, total / count, np.nan)


def cached_coarse(row: dict, bbox, interim: Path, min_fine: int):
    path = interim / "mosaic" / f"{row['id']}.npz"
    if path.exists():
        z = np.load(path)
        return int(z["r0"]), int(z["c0"]), z["sm"]
    log.info("streaming %s", row["id"])
    with site._open(row["url"]) as f:
        d = read_sm(f, bbox, row["maturity"])
    r0, c0, sm = coarsen(d.x, d.y, d.sm, min_fine)
    path.parent.mkdir(parents=True, exist_ok=True)
    np.savez_compressed(path, r0=r0, c0=c0, sm=sm.astype("float32"))
    return r0, c0, sm


def paste(tiles, r_top: int, c_left: int, shape) -> np.ndarray:
    """Mean of overlapping tiles on the mosaic grid; NaN where no tile has data."""
    total, count = np.zeros(shape), np.zeros(shape)
    for r0, c0, sm in tiles:
        r, c = r0 - r_top, c0 - c_left
        rs, cs = max(r, 0), max(c, 0)
        re, ce = min(r + sm.shape[0], shape[0]), min(c + sm.shape[1], shape[1])
        if rs >= re or cs >= ce:
            continue
        part = sm[rs - r : re - r, cs - c : ce - c]
        ok = np.isfinite(part)
        total[rs:re, cs:ce] += np.where(ok, part, 0)
        count[rs:re, cs:ce] += ok
    with np.errstate(invalid="ignore"):
        return np.where(count > 0, total / count, np.nan)


def mercator_rows(south: float, north: float, n: int, r_top: int) -> np.ndarray:
    """For n image rows evenly spaced in Web Mercator between two latitudes, the mosaic row under
    each. Map libraries stretch an image evenly in Mercator; the EASE grid is equal-area, so at
    country scale rows would otherwise sit up to tens of km off."""

    def merc(lat):
        return math.log(math.tan(math.pi / 4 + math.radians(lat) / 2))

    my = np.linspace(merc(north), merc(south), 2 * n + 1)[1::2]  # row centers
    lat = np.degrees(2 * np.arctan(np.exp(my)) - np.pi / 2)
    _, y = Transformer.from_crs(4326, EPSG, always_xy=True).transform(np.zeros(n), lat)
    return np.floor(-y / CELL).astype(int) - r_top


def run_mosaic(run, sel: dict, cfg: dict) -> None:
    cfg = {**DEFAULTS, **run.site.get("thresholds_sme2", {})}
    maturity, bbox = sel["maturity"], run.site["bbox"]
    to_grid = Transformer.from_crs(4326, EPSG, always_xy=True)
    (x_w, x_e), (y_s, y_n) = to_grid.transform([bbox[0], bbox[2]], [bbox[1], bbox[3]])
    c_left, c_right = math.floor(x_w / CELL), math.floor(x_e / CELL)
    r_top, r_bottom = math.floor(-y_n / CELL), math.floor(-y_s / CELL)
    shape = (r_bottom - r_top + 1, c_right - c_left + 1)
    # Image bounds: the outer edges of the mosaic cells.
    (west, east), (south, north) = Transformer.from_crs(EPSG, 4326, always_xy=True).transform(
        [c_left * CELL, (c_right + 1) * CELL], [-(r_bottom + 1) * CELL, -r_top * CELL]
    )
    bounds = [round(v, 5) for v in (west, south, east, north)]
    rows = mercator_rows(south, north, shape[0], r_top).clip(0, shape[0] - 1)
    # Site field "clip": keep only cells whose center is inside the named country outline.
    land = border(run.site["clip"]) if run.site.get("clip") else None
    inside = np.ones(shape, bool)
    if land is not None:
        # The grid is cylindrical: longitude depends on the column only, latitude on the row only.
        to_deg = Transformer.from_crs(EPSG, 4326, always_xy=True)
        lon, _ = to_deg.transform((c_left + np.arange(shape[1]) + 0.5) * CELL, np.zeros(shape[1]))
        _, lat = to_deg.transform(np.zeros(shape[0]), -(r_top + np.arange(shape[0]) + 0.5) * CELL)
        inside = shapely.contains_xy(land, *np.meshgrid(lon, lat))

    def load(row):
        try:
            return cached_coarse(row, bbox, run.interim, cfg["min_fine_pixels"])
        except (OSError, ValueError, KeyError) as err:  # a bad granule leaves a gap only
            log.warning("skipped %s: %s", row["id"], err)

    with ThreadPoolExecutor(8) as pool:
        tiles = list(pool.map(load, sel["granules"]))

    steps = [
        "streamed every SME2 granule over the area (EASE-Grid 2.0, about 200 m)",
        "kept recommended retrievals only (quality flag bit 0)",
        (
            f"mean per 10 x 10 pixel cell (about 2 km) with at least {cfg['min_fine_pixels']} "
            "valid pixels"
        ),
        "mean of all passes in the 12-day cycle",
        *([f"kept cells inside the {run.site['clip']} border (Natural Earth)"] if land else []),
    ]
    mosaics, points = [], []
    for start, end in sel["cycles"]:
        members = [
            (g, t)
            for g, t in zip(sel["granules"], tiles, strict=True)
            if t is not None and start < g["date"] <= end
        ]
        if not members:
            continue
        sm = np.where(inside, paste([t for _, t in members], r_top, c_left, shape), np.nan)
        ids = [g["id"] for g, _ in members]
        mean, n = site._stats(sm)
        first = min(g["date"] for g, _ in members)
        mosaics.append((first, end, sm, ids))
        points.append(
            {"date": end, "value": round(mean, 4) if n else None, "n_pixels": n, "granule": ids[-1]}
        )
        lid = f"soil-moisture-{end}"
        write_rgba(
            run.data_dir / run.url(lid),
            site._ramp(sm[rows], 0.0, 0.5, (166, 97, 26), (1, 133, 113)),
        )
        site._layer(
            run,
            "SME2",
            maturity,
            id=lid,
            group="Soil moisture",
            role="soil_moisture",
            title=f"Soil moisture, {first} to {end}",
            description="Water in the top few centimeters of soil, from every NISAR pass in "
            "12 days, averaged to about 2 km. Brown: dry. Green-blue: wet. Gaps: no pass, or no "
            "reliable reading (dense forest, cities, steep slopes, water).",
            url=run.url(lid),
            bounds=bounds,
            date_range=[first, end],
            polarization="HH/HV",
            units="m3/m3",
            value_range=[0.0, 0.5],
            colormap="brbg",
            provenance={
                "source_granules": ids,
                "steps": steps,
                "params": {"bbox": bbox, "cell_m": round(CELL, 1)},
            },
        )
    if not mosaics:
        raise ValueError("no SME2 granule could be read")
    run.series.append(
        write_timeseries(
            run.data_dir,
            run.site_id,
            {
                "series_id": "soil-moisture",
                "title": "Mean soil moisture over the area, per 12-day cycle",
                "units": "m3/m3",
                "polarization": "HH/HV",
                "statistic": "mean",
                "region": site._bbox_polygon(bbox),
                "points": points,
                "maturity": maturity,
                "synthetic": run.synthetic,
            },
        )
    )
    if len(mosaics) == 2:
        drying(run, mosaics, (r_top, c_left), bounds, rows, maturity, steps, cfg)
    fires(run, bounds, rows, shape, (r_top, c_left), maturity, land)


def drying(run, mosaics, origin, bounds, rows, maturity, steps, cfg) -> None:
    (from_, _, before, ids0), (_, to, after, ids1) = mosaics
    change = after - before
    lid = "soil-moisture-change"
    write_rgba(run.data_dir / run.url(lid), site._diverging(change[rows], 0.15))
    steps = [*steps, "latest cycle minus the cycle before"]
    params = {"bbox": run.site["bbox"], "cell_m": round(CELL, 1), **cfg}
    site._layer(
        run,
        "SME2",
        maturity,
        id=lid,
        group="Soil moisture change",
        role="change",
        title=f"Soil moisture change, {from_} to {to}",
        description="Latest 12 days of soil moisture minus the 12 days before. Red: drier. "
        "Blue: wetter. Rain just before a pass shows as blue; the end of the rainy season shows "
        "as wide red areas.",
        url=run.url(lid),
        bounds=bounds,
        date_range=[from_, to],
        polarization="HH/HV",
        units="m3/m3 difference",
        value_range=[-0.15, 0.15],
        colormap="rdbu",
        provenance={"source_granules": ids0 + ids1, "steps": steps, "params": params},
    )
    r_top, c_left = origin
    x = (c_left + np.arange(change.shape[1]) + 0.5) * CELL
    y = -(r_top + np.arange(change.shape[0]) + 0.5) * CELL
    with np.errstate(invalid="ignore"):
        dry = ndimage.binary_opening(change < -cfg["drying_drop"])  # drop single-cell speckle
    for i, m in enumerate(classify.components(dry, cfg["min_cells"])[: cfg["max_events"]]):
        drop = -float(np.mean(change[m]))
        run.event(
            "SME2",
            i,
            categories=decide("soil_drying", 0, 0),
            signature="soil_drying",
            date_range=(from_, to),
            region=outline(m, x, y, EPSG),
            maturity=maturity,
            confidence=classify.confidence(
                drop - cfg["drying_drop"], cfg["drying_drop"], int(m.sum()), cfg["min_cells"]
            ),
            polarization="HH/HV",
            layer_ids=[lid, f"soil-moisture-{to}"],
            # shortcut: the cycle's granules, not only those over the region (ids carry no shape).
            granules=ids0 + ids1,
            steps=[
                *steps,
                (
                    f"cells drier by more than {cfg['drying_drop']} m3/m3, joined into regions of at "
                    f"least {cfg['min_cells']} cells"
                ),
                classify.CONFIDENCE_STEP,
            ],
            params=params,
            evidence={
                "signature": "soil_drying",
                "drop_m3_m3": round(drop, 3),
                "latest": round(float(np.mean(after[m])), 3),
                "n_pixels": int(m.sum()),
            },
            series={
                "soil_moisture_m3_m3": [
                    {"date": mosaics[0][1], "value": round(float(np.mean(before[m])), 4)},
                    {"date": to, "value": round(float(np.mean(after[m])), 4)},
                ]
            },
            extra_summary="Two 12-day periods cannot separate drought from the normal end of the "
            "rainy season; that needs a longer record and rainfall data.",
        )


def fires(run, bounds, rows, shape, origin, maturity, land=None) -> None:
    """Context layer: NASA FIRMS detections of the last days. Not radar, and not events."""
    end = datetime.now(UTC).date()
    start = end - timedelta(days=FIRE_DAYS - 1)
    spots = firms.hotspots(
        run.site["bbox"], start.isoformat(), end.isoformat(), run.interim / "firms"
    )
    if land is not None and spots:
        spots = [h for h in spots if shapely.contains_xy(land, h["lon"], h["lat"])]
    if not spots:
        return
    run.credits.append(firms.CREDIT)
    lon, lat = [h["lon"] for h in spots], [h["lat"] for h in spots]
    x, y = Transformer.from_crs(4326, EPSG, always_xy=True).transform(lon, lat)
    r = np.floor(-np.asarray(y) / CELL).astype(int) - origin[0]
    c = np.floor(np.asarray(x) / CELL).astype(int) - origin[1]
    ok = (r >= 0) & (r < shape[0]) & (c >= 0) & (c < shape[1])
    hit = np.zeros(shape, bool)
    hit[r[ok], c[ok]] = True
    hit = ndimage.binary_dilation(hit)  # one 2 km cell is too small to see at country zoom
    colors = np.zeros((*shape, 4), "uint8")
    colors[hit] = (230, 85, 13, 230)
    write_rgba(run.data_dir / run.url("fire-detections"), colors[rows])
    site._layer(
        run,
        "SME2",
        maturity,
        id="fire-detections",
        group="Fire detections",
        role="context",
        title=f"Fire detections, {start} to {end} (NASA FIRMS)",
        description="Where NASA's VIIRS satellite instrument detected active fires in the last "
        f"{FIRE_DAYS} days ({len(spots)} detections), drawn larger than life so they show at "
        "country scale. Not radar: context for the soil moisture maps.",
        url=run.url("fire-detections"),
        bounds=bounds,
        date_range=[start.isoformat(), end.isoformat()],
        polarization="none",
        units="class",
        colormap="classes",
        provenance={
            "source_granules": [],
            "steps": [
                "NASA FIRMS VIIRS NOAA-20 detections",
                "marked on the 2 km grid, grown 1 cell",
            ],
            "params": {"days": FIRE_DAYS, "detections": len(spots)},
            "attribution": firms.CREDIT,
        },
    )
