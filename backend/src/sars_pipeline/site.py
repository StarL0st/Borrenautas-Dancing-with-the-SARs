"""Run the pipeline for one site: select -> read (streamed, cached) -> change -> classify -> export."""

import json
import logging
import math
from dataclasses import asdict
from pathlib import Path

import numpy as np
from pyproj import Transformer

from . import classify
from .export import (
    ATTRIBUTION,
    _area,
    _refresh_area,
    _software,
    backscatter_layer,
    load_manifest,
    write_events,
    write_manifest,
    write_rgba,
)
from .granule import Granule, Window, read_meta, read_window, to_db

log = logging.getLogger(__name__)

SITES = Path(__file__).resolve().parents[2] / "sites.json"


def load_sites(path: Path = SITES) -> dict:
    return json.loads(Path(path).read_text(encoding="utf-8"))


# C1 change_types (docs/04).
CHANGE_TYPES = {
    "flood_wetland",
    "forest_loss",
    "wildfire",
    "agriculture",
    "soil_moisture",
    "glacier_ice",
    "deformation",
    "other",
}


def bbox_around(lon: float, lat: float, km: float) -> list[float]:
    """A km x km box centered on a point, in degrees."""
    dlat = km / 2 / 111.32
    dlon = dlat / math.cos(math.radians(lat))
    return [round(v, 5) for v in (lon - dlon, lat - dlat, lon + dlon, lat + dlat)]


def add_site(site_id: str, site: dict, path: Path = SITES, force: bool = False) -> dict:
    """Validate a site and write it into sites.json."""
    w, s, e, n = site["bbox"]
    if not (-180 <= w < e <= 180 and -90 <= s < n <= 90):
        raise ValueError(f"bbox must be west,south,east,north in degrees, got {site['bbox']}")
    if (e - w) * (n - s) > 1:
        # shortcut: site windows are read at 10 m in one piece; bigger areas need tiling first.
        raise ValueError("bbox is over 1 square degree; keep sites to about 20-50 km")
    bad = set(site["change_types"]) - CHANGE_TYPES
    if bad:
        raise ValueError(f"unknown change_types {sorted(bad)}; use {sorted(CHANGE_TYPES)}")
    sites = load_sites(path)
    if site_id in sites and not force:
        raise ValueError(f"site {site_id!r} exists; pass --force to replace it")
    sites[site_id] = site
    Path(path).write_text(json.dumps(sites, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    return site


def cached_window(row: dict, bbox, looks: int, interim: Path) -> Window:
    """Stream the site window of one granule, or load it from data/interim/ if read before."""
    path = interim / f"{row['id']}_{looks}x.npz"
    if path.exists():
        z = np.load(path, allow_pickle=False)
        meta = json.loads(str(z["meta"]))
        g = Granule(**{**meta, "bounds": tuple(meta["bounds"]), "terms": tuple(meta["terms"])})
        power = {t: z[t] for t in g.terms}
        if json.loads(str(z["bbox"])) == list(bbox):
            return Window(g, power, z["x"], z["y"], looks)
    from .remote import open_remote

    log.info("streaming %s", row["id"])
    with open_remote(row["url"]) as f:
        g = read_meta(f, row["url"], row["maturity"])
        w = read_window(f, g, bbox, looks)
    path.parent.mkdir(parents=True, exist_ok=True)
    np.savez_compressed(
        path,
        meta=json.dumps(asdict(g)),
        bbox=json.dumps(list(bbox)),
        x=w.x,
        y=w.y,
        **w.power,
    )
    return w


def _align(windows: list[Window]) -> list[Window]:
    """Crop every window to the shared shape. Same track/frame means the same snapped grid."""
    h = min(w.y.size for w in windows)
    wd = min(w.x.size for w in windows)
    ref = windows[0]
    for w in windows[1:]:
        # shortcut: assumes the grids line up (true for one track/frame); resample if this fires.
        if abs(w.x[0] - ref.x[0]) > 1 or abs(w.y[0] - ref.y[0]) > 1:
            raise ValueError(f"{w.granule.granule_id}: grid offset from {ref.granule.granule_id}")
    return [
        Window(w.granule, {t: p[:h, :wd] for t, p in w.power.items()}, w.x[:wd], w.y[:h], w.looks)
        for w in windows
    ]


def _diverging(d: np.ndarray, limit: float) -> np.ndarray:
    """Red where the radar got darker, blue where brighter; stronger change is more opaque."""
    v = np.clip(np.nan_to_num(d) / limit, -1, 1)
    rgba = np.zeros((*d.shape, 4), dtype="float32")
    rgba[..., 0] = np.where(v < 0, 215, 40)
    rgba[..., 1] = np.where(v < 0, 48, 110)
    rgba[..., 2] = np.where(v < 0, 39, 220)
    rgba[..., 3] = np.abs(v) * 255 * np.isfinite(d)
    return rgba


CLASS_COLORS = {
    classify.FLOOD: (33, 113, 181, 230),
    classify.FOREST: (230, 85, 13, 230),
    classify.OTHER: (150, 150, 150, 200),
}


def _class_rgba(cls: np.ndarray) -> np.ndarray:
    rgba = np.zeros((*cls.shape, 4), dtype="uint8")
    for code, color in CLASS_COLORS.items():
        rgba[cls == code] = color
    return rgba


def _change_layer(layer_id, title, description, url, bounds, pair, pol, maturity, extra) -> dict:
    a, b = pair
    return {
        "id": layer_id,
        "title": title,
        "description": description,
        "kind": "image_overlay",
        "url": url,
        "bounds": list(bounds),
        "date_range": [a.granule.date, b.granule.date],
        "product": "derived",
        "polarization": pol,
        "maturity": maturity,
        "synthetic": a.granule.synthetic or b.granule.synthetic,
        "role": "change",
        "provenance": {
            "source_granules": [a.granule.granule_id, b.granule.granule_id],
            "software": _software(),
            "attribution": ATTRIBUTION,
            **extra,
        },
    }


def _event_geometry(w: Window, rows, cols) -> tuple[dict, list[float], float]:
    """Polygon of the region's pixel box in WGS84, its bbox, and the region's pixel size in km2."""
    dx, dy = abs(w.x[1] - w.x[0]), abs(w.y[1] - w.y[0])
    x0, x1 = w.x[cols[0]] - dx / 2, w.x[cols[1] - 1] + dx / 2
    y0, y1 = w.y[rows[0]] + dy / 2, w.y[rows[1] - 1] - dy / 2  # y runs north to south
    t = Transformer.from_crs(w.granule.epsg, 4326, always_xy=True)
    ring = [t.transform(x, y) for x, y in ((x0, y0), (x1, y0), (x1, y1), (x0, y1), (x0, y0))]
    ring = [[round(lon, 6), round(lat, 6)] for lon, lat in ring]
    lons, lats = [p[0] for p in ring], [p[1] for p in ring]
    # shortcut: event geometry is the region's bounding box, not its outline; the class layer shows
    # the exact pixels. Trace outlines (rasterio.features.shapes) when /query needs pixel accuracy.
    return (
        {"type": "Polygon", "coordinates": [ring]},
        [min(lons), min(lats), max(lons), max(lats)],
        dx * dy / 1e6,
    )


CONFIDENCE_STEP = (
    "confidence = 0.5 * min(1, mean dB past threshold / threshold)"
    " + 0.5 * min(1, pixels / (10 * min_pixels))"
)

LABELS = {
    "flood_wetland": (
        "Possible flooding or new open water",
        (
            "HH and HV both turned much darker, and HH is now as dark as open water, which "
            "reflects radar away like a mirror."
        ),
    ),
    "forest_loss": (
        "Possible vegetation or forest loss",
        (
            "HV, which comes mostly from leaves and branches, dropped much more than HH. That is "
            "what clearing, burning, or harvest looks like to radar."
        ),
    ),
    "other": (
        "Strong surface change",
        (
            "The radar signal changed strongly but matches none of our specific patterns. "
            "Construction, soil moisture, or crops are possible causes."
        ),
    ),
}


def run_site(site_id: str, site: dict, data_dir: Path, interim: Path, selection: dict) -> dict:
    cfg = {**classify.DEFAULTS, **site.get("thresholds", {})}
    looks = site.get("looks", 4)
    windows = _align(
        [cached_window(row, site["bbox"], looks, interim) for row in selection["granules"]]
    )
    maturity = selection["maturity"]
    manifest = load_manifest(data_dir)
    area = _area(manifest, windows[0].granule)
    area.update(
        title=site["title"],
        summary=site["summary"],
        change_types=site["change_types"],
        site=site_id,
    )
    area["layers"] = []  # a site run rebuilds its area from scratch
    steps = [
        "streamed the site window over HTTPS",
        f"averaged {looks}x{looks} pixels in linear power",
    ]
    params = {"looks": looks, "bbox": site["bbox"]}

    db = []
    for w in windows:
        db.append({t[:2]: to_db(p) for t, p in w.power.items()})
        for term in w.power:
            area["layers"].append(
                backscatter_layer(
                    w.granule, term, db[-1][term[:2]], w.bounds, data_dir, area["id"], steps, params
                )
            )

    events = []
    if len(windows) >= 2:
        a, b = windows[-2], windows[-1]
        cls, d_hh, d_hv = classify.class_map(
            db[-2]["HH"], db[-2]["HV"], db[-1]["HH"], db[-1]["HV"], cfg
        )
        span = f"{a.granule.date}-{b.granule.date}"
        diff_steps = [
            *steps,
            "converted to dB",
            f"after minus before, {cfg['smooth_px']}px box mean",
        ]
        for pol, d in (("HH", d_hh), ("HV", d_hv)):
            url = f"areas/{area['id']}/layers/change-{pol.lower()}-{span}.png"
            write_rgba(data_dir / url, _diverging(d, 6.0))
            area["layers"].append(
                _change_layer(
                    f"change-{pol.lower()}-{span}",
                    f"{pol} change, {a.granule.date} to {b.granule.date}",
                    f"How much the {pol} radar signal changed. Red: the surface got darker to the "
                    "radar. Blue: it got brighter. Stronger color means bigger change.",
                    url,
                    b.bounds,
                    (a, b),
                    pol,
                    maturity,
                    {"steps": diff_steps, "params": {**params, "smooth_px": cfg["smooth_px"]}},
                )
                | {"units": "dB difference", "value_range": [-6, 6], "colormap": "rdbu"}
            )
        class_id = f"classes-{span}"
        url = f"areas/{area['id']}/layers/{class_id}.png"
        write_rgba(data_dir / url, _class_rgba(cls))
        rule_steps = [*diff_steps, "applied the F03 rules (flood, forest loss, other)"]
        area["layers"].append(
            _change_layer(
                class_id,
                f"Detected change, {a.granule.date} to {b.granule.date}",
                "Where our rules found change. Blue: possible flooding or open water. Orange: "
                "possible vegetation loss. Gray: other strong change.",
                url,
                b.bounds,
                (a, b),
                "HH/HV",
                maturity,
                {"steps": rule_steps, "params": {**params, **cfg}},
            )
            | {"units": "class", "colormap": "classes"}
        )
        for i, r in enumerate(classify.regions(cls, d_hh, d_hv, cfg)):
            geometry, bbox, px_km2 = _event_geometry(b, r["rows"], r["cols"])
            title, why = LABELS[r["type"]]
            events.append(
                {
                    "id": f"{area['id']}-{span}-{i:03d}",
                    "area_id": area["id"],
                    "type": r["type"],
                    "title": title,
                    "summary": f"Between {a.granule.date} and {b.granule.date}, HH changed "
                    f"{r['mean_d_hh']:+.1f} dB and HV {r['mean_d_hv']:+.1f} dB over "
                    f"{r['n_pixels'] * px_km2:.2f} km2. {why} This is a hypothesis from radar "
                    f"alone ({maturity} data).",
                    "date_range": [a.granule.date, b.granule.date],
                    "geometry": geometry,
                    "bbox": bbox,
                    "area_km2": round(r["n_pixels"] * px_km2, 3),
                    "confidence": r["confidence"],
                    "method": "rules",
                    "polarization": "HH/HV",
                    "maturity": maturity,
                    "layer_ids": [class_id, f"change-hh-{span}", f"change-hv-{span}"],
                    "synthetic": a.granule.synthetic or b.granule.synthetic,
                    "provenance": {
                        "source_granules": [a.granule.granule_id, b.granule.granule_id],
                        "steps": [
                            *rule_steps,
                            "grouped touching pixels of one class into a region",
                            CONFIDENCE_STEP,
                        ],
                        "params": {**params, **cfg},
                        "software": _software(),
                        "attribution": ATTRIBUTION,
                        "stats": {k: r[k] for k in ("n_pixels", "mean_d_hh", "mean_d_hv")},
                    },
                }
            )

    _refresh_area(area, data_dir)
    write_manifest(data_dir, manifest)
    write_events(data_dir, area["id"], events)
    return {"area_id": area["id"], "layers": len(area["layers"]), "events": len(events)}
