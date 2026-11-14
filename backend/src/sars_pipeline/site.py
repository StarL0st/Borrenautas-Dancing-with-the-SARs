"""Run the pipeline for one site: GCOV, GUNW and SME2 -> layers, time series, categorized events.

One site = one area (docs/04). Every product keeps its own viewing geometry and maturity; layers
and events say which granules, product, and maturity they come from.
"""

import hashlib
import json
import logging
import math
from dataclasses import asdict, dataclass, field
from datetime import date
from pathlib import Path

import numpy as np

from . import categorize, classify, firms
from .categorize import COVER_COLORS, COVER_NAMES, decide, outline
from .export import (
    _software,
    attribution,
    backscatter_layer,
    load_events,
    load_manifest,
    write_events,
    write_manifest,
    write_rgba,
    write_timeseries,
)
from .granule import Granule, Window, read_meta, read_window, to_db, wgs84_bounds
from .gunw import read_pair, reference
from .selection import analysis_bbox
from .sme2 import read_sm

log = logging.getLogger(__name__)

GUNW_DEFAULTS = {"sinking_cm_yr": 5.0, "min_valid_fraction": 0.6, "min_pixels": 20}
SME2_DEFAULTS = {"drying_drop": 0.05, "min_dates": 4}


# ---------------------------------------------------------------- reading (streamed, cached)


def _key(bbox) -> str:
    return hashlib.md5(json.dumps([round(v, 6) for v in bbox]).encode()).hexdigest()[:8]


def _open(url):
    from .remote import open_remote  # imported late so tests can swap it

    return open_remote(url)


def cached_window(row: dict, bbox, looks: int, interim: Path) -> Window:
    """GCOV: stream the site window of one granule, or load it from data/interim/."""
    path = interim / f"{row['id']}_{looks}x_{_key(bbox)}.npz"
    if path.exists():
        z = np.load(path, allow_pickle=False)
        meta = json.loads(str(z["meta"]))
        g = Granule(**{**meta, "bounds": tuple(meta["bounds"]), "terms": tuple(meta["terms"])})
        return Window(g, {t: z[t] for t in g.terms}, z["x"], z["y"], looks)
    log.info("streaming %s", row["id"])
    with _open(row["url"]) as f:
        g = read_meta(f, row["url"], row["maturity"])
        w = read_window(f, g, bbox, looks)
    path.parent.mkdir(parents=True, exist_ok=True)
    np.savez_compressed(path, meta=json.dumps(asdict(g), default=str), x=w.x, y=w.y, **w.power)
    return w


def _cached_arrays(path: Path, load, arrays: tuple[str, ...]):
    """Generic cache for GUNW/SME2 dataclasses: arrays in npz, the rest as JSON meta."""
    if path.exists():
        z = np.load(path, allow_pickle=False)
        return json.loads(str(z["meta"])), {k: z[k] for k in arrays}
    obj = load()
    meta = {k: v for k, v in asdict(obj).items() if k not in arrays}
    data = {k: getattr(obj, k) for k in arrays}
    path.parent.mkdir(parents=True, exist_ok=True)
    np.savez_compressed(path, meta=json.dumps(meta), **data)
    return meta, data


def cached_pair(row: dict, bbox, interim: Path):
    def load():
        log.info("streaming %s", row["id"])
        with _open(row["url"]) as f:
            return read_pair(f, bbox, row["maturity"])

    path = interim / f"{row['id']}_{_key(bbox)}.npz"
    return _cached_arrays(path, load, ("x", "y", "los_m", "coherence", "component"))


def cached_sm(row: dict, bbox, interim: Path):
    def load():
        log.info("streaming %s", row["id"])
        with _open(row["url"]) as f:
            return read_sm(f, bbox, row["maturity"])

    return _cached_arrays(interim / f"{row['id']}_{_key(bbox)}.npz", load, ("x", "y", "sm"))


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


# ---------------------------------------------------------------- images


def _diverging(d: np.ndarray, limit: float) -> np.ndarray:
    """Red for negative, blue for positive; stronger change is more opaque."""
    v = np.clip(np.nan_to_num(d) / limit, -1, 1)
    rgba = np.zeros((*d.shape, 4), dtype="float32")
    rgba[..., 0] = np.where(v < 0, 215, 40)
    rgba[..., 1] = np.where(v < 0, 48, 110)
    rgba[..., 2] = np.where(v < 0, 39, 220)
    rgba[..., 3] = np.abs(v) * 255 * np.isfinite(d)
    return rgba


def _palette(codes: np.ndarray, colors: dict) -> np.ndarray:
    rgba = np.zeros((*codes.shape, 4), dtype="uint8")
    for code, color in colors.items():
        rgba[codes == code] = color
    return rgba


def _ramp(v: np.ndarray, lo: float, hi: float, c0, c1) -> np.ndarray:
    """Linear color ramp between two RGB colors, transparent where NaN."""
    t = np.clip((np.nan_to_num(v, nan=lo) - lo) / (hi - lo), 0, 1)[..., None]
    rgb = np.array(c0) * (1 - t) + np.array(c1) * t
    alpha = np.isfinite(v)[..., None] * 220
    return np.concatenate([rgb, alpha], axis=-1)


SIGNATURE_COLORS = {
    classify.DARKENING: (33, 113, 181, 230),
    classify.HV_DROP: (230, 85, 13, 230),
    classify.BRIGHTENING: (200, 60, 160, 230),
    classify.STRONG: (150, 150, 150, 200),
}


# ---------------------------------------------------------------- events

TITLES = {
    "floods": "Possible flooding or new open water",
    "deforestation": "Possible forest or vegetation loss",
    "wildfires": "Possible burned forest",
    "agriculture": "Farmland activity",
    "urban": "New or changed structures",
    "subsidence": "Ground sinking",
    "drought": "Soil drying",
    "other": "Strong surface change",
}
WHY = {
    "darkening_both": "HH and HV both turned much darker, and HH is now as dark as open water, "
    "which reflects radar away like a mirror.",
    "hv_drop": "HV, which comes mostly from leaves and branches, dropped much more than HH.",
    "brightening": "HH got much brighter: new walls and roofs bounce radar straight back.",
    "strong_change": "The radar signal changed strongly but matches none of our specific patterns.",
    "seasonal_cycle": "HV rose and fell across the passes, the pattern of crops growing and "
    "being harvested.",
    "sinking": "The ground moved steadily away from the satellite across the interferogram "
    "pairs (line of sight, so mostly sinking).",
    "soil_drying": "Soil moisture in the latest pass is well below the earlier passes.",
}


@dataclass
class Run:
    site_id: str
    site: dict
    data_dir: Path
    interim: Path
    layers: list = field(default_factory=list)
    series: list = field(default_factory=list)
    events: list = field(default_factory=list)
    credits: list = field(default_factory=list)
    cover: tuple | None = None  # (grid, x, y, epsg) from GCOV, for other products
    synthetic: bool = False  # set from the granules; synthetic data is never shown as real

    def url(self, name: str) -> str:
        return f"areas/{self.site_id}/layers/{name}.png"

    def credit(self, product: str, maturity: str) -> str:
        line = attribution(maturity, product)
        if line not in self.credits:
            self.credits.append(line)
        return line

    def event(
        self,
        product: str,
        i: int,
        *,
        categories,
        signature,
        date_range,
        region,
        maturity,
        confidence,
        polarization,
        layer_ids,
        granules,
        steps,
        params,
        evidence,
        series,
        extra_summary="",
    ):
        primary = categories[0]
        cover = evidence.get("surface_before")
        summary = " ".join(
            s
            for s in (
                f"Between {date_range[0]} and {date_range[1]}, over {region['area_km2']:.2f} km2.",
                WHY[signature],
                extra_summary,
                f"Surface before: {cover}." if cover else "",
                f"This is a hypothesis from radar alone ({maturity} NISAR data).",
            )
            if s
        )
        self.events.append(
            {
                "id": f"{self.site_id}-{product.lower()}-{date_range[0]}-{date_range[1]}-{i:03d}",
                "area_id": self.site_id,
                "type": categorize.CHANGE_TYPE[primary],
                "categories": categories,
                "signature": signature,
                "title": TITLES[primary],
                "summary": summary,
                "date_range": list(date_range),
                **region,
                "confidence": confidence,
                "method": "rules",
                "product": product,
                "polarization": polarization,
                "maturity": maturity,
                "layer_ids": layer_ids,
                "evidence": evidence,
                "series": series,
                "synthetic": self.synthetic,
                "provenance": {
                    "source_granules": granules,
                    "steps": steps,
                    "params": params,
                    "software": _software(),
                    "attribution": self.credit(product, maturity),
                },
            }
        )


def _layer(run: Run, product: str, maturity: str, **fields) -> dict:
    """A derived (non-backscatter) C2 layer record."""
    layer = {
        "kind": "image_overlay",
        "product": "derived",
        "maturity": maturity,
        "synthetic": run.synthetic,
        **fields,
    }
    layer["provenance"] = {
        "software": _software(),
        "attribution": run.credit(product, maturity),
        **layer["provenance"],
    }
    run.layers.append(layer)
    return layer


def _stats(arr: np.ndarray, mask: np.ndarray | None = None) -> tuple[float, int]:
    v = arr[mask] if mask is not None else arr
    v = v[np.isfinite(v)]
    return (float(np.mean(v)) if v.size else float("nan")), int(v.size)


def _mean_db(power: np.ndarray, mask=None) -> float:
    """Mean of linear power, in dB (averaging in dB would bias it)."""
    m, n = _stats(power, mask)
    return round(10 * math.log10(m), 2) if n and m > 0 else None


# ---------------------------------------------------------------- GCOV


def run_gcov(run: Run, sel: dict, cfg: dict) -> None:
    looks = run.site.get("looks", 4)
    bbox = run.site["bbox"]
    maturity = sel["maturity"]
    windows = _align([cached_window(row, bbox, looks, run.interim) for row in sel["granules"]])
    dates = [w.granule.date for w in windows]
    run.synthetic = run.synthetic or any(w.granule.synthetic for w in windows)
    steps = ["streamed the site window over HTTPS", f"averaged {looks}x{looks} pixels (linear)"]
    params = {"looks": looks, "bbox": bbox}
    run.credit("GCOV", maturity)

    db = [{t[:2]: to_db(p) for t, p in w.power.items()} for w in windows]
    for w, d in zip(windows, db, strict=True):
        for term in w.power:
            layer = backscatter_layer(
                w.granule, term, d[term[:2]], w.bounds, run.data_dir, run.site_id, steps, params
            )
            layer["group"] = f"{term[:2]} backscatter"
            layer["provenance"]["attribution"] = attribution(maturity, "GCOV")
            run.layers.append(layer)

    # Surface type from the mean of all dates (linear), used as context for every product.
    mean_db = {
        pol: to_db(np.nanmean(np.stack([w.power[pol * 2] for w in windows]), axis=0))
        for pol in ("HH", "HV")
    }
    cover = categorize.cover_map(mean_db["HH"], mean_db["HV"], cfg)
    ref = windows[-1]
    run.cover = (cover, ref.x, ref.y, ref.granule.epsg)
    write_rgba(run.data_dir / run.url("surface-type"), _palette(cover, COVER_COLORS))
    _layer(
        run,
        "GCOV",
        maturity,
        id="surface-type",
        group="Surface type",
        role="context",
        title="Surface type (from radar)",
        description="Rough surface type read from the radar itself: blue water, red built-up, "
        "green vegetation, tan bare or low ground. Used to interpret the changes.",
        url=run.url("surface-type"),
        bounds=list(ref.bounds),
        date_range=[dates[0], dates[-1]],
        polarization="HH/HV",
        units="class",
        colormap="classes",
        provenance={
            "source_granules": [w.granule.granule_id for w in windows],
            "steps": [*steps, "mean of all dates in linear power", "thresholds on HH, HV, HH-HV"],
            "params": {
                **params,
                "water_db": cfg["water_db"],
                "vegetation_hv_db": cfg["vegetation_hv_db"],
                "urban": "HH > -8 dB and HH - HV > 7 dB",
            },
        },
    )

    # Site-wide backscatter time series (C4).
    for pol in ("HH", "HV"):
        run.series.append(
            write_timeseries(
                run.data_dir,
                run.site_id,
                {
                    "series_id": f"{pol.lower()}-backscatter",
                    "title": f"Mean {pol} backscatter over the site",
                    "units": "dB",
                    "polarization": pol,
                    "statistic": "mean",
                    "region": _bbox_polygon(bbox),
                    "points": [
                        {
                            "date": w.granule.date,
                            "value": _mean_db(w.power[pol * 2]),
                            "n_pixels": _stats(w.power[pol * 2])[1],
                            "granule": w.granule.granule_id,
                        }
                        for w in windows
                    ],
                    "maturity": maturity,
                    "synthetic": run.synthetic,
                },
            )
        )

    def region_series(mask):
        return {
            pol: [
                {"date": w.granule.date, "value": _mean_db(w.power[pol * 2], mask)} for w in windows
            ]
            for pol in ("HH", "HV")
        }

    spots_cache = run.interim / "firms"
    for k in range(1, len(windows)):
        a, b = windows[k - 1], windows[k]
        span = f"{a.granule.date}-{b.granule.date}"
        sig, d_hh, d_hv = classify.signature_map(
            db[k - 1]["HH"], db[k - 1]["HV"], db[k]["HH"], db[k]["HV"], cfg
        )
        diff_steps = [*steps, "converted to dB", f"after minus before, {cfg['smooth_px']}px mean"]
        pair_prov = {
            "source_granules": [a.granule.granule_id, b.granule.granule_id],
            "steps": diff_steps,
            "params": {**params, "smooth_px": cfg["smooth_px"]},
        }
        for pol, d in (("HH", d_hh), ("HV", d_hv)):
            write_rgba(run.data_dir / run.url(f"change-{pol.lower()}-{span}"), _diverging(d, 6.0))
            _layer(
                run,
                "GCOV",
                maturity,
                id=f"change-{pol.lower()}-{span}",
                group=f"{pol} change",
                role="change",
                title=f"{pol} change, {a.granule.date} to {b.granule.date}",
                description=f"How much the {pol} radar signal changed. Red: the surface got darker"
                " to the radar. Blue: brighter. Stronger color means bigger change.",
                url=run.url(f"change-{pol.lower()}-{span}"),
                bounds=list(b.bounds),
                date_range=[a.granule.date, b.granule.date],
                polarization=pol,
                units="dB difference",
                value_range=[-6, 6],
                colormap="rdbu",
                provenance=pair_prov,
            )
        sig_id = f"signatures-{span}"
        write_rgba(run.data_dir / run.url(sig_id), _palette(sig, SIGNATURE_COLORS))
        rule_steps = [
            *diff_steps,
            "applied the signature rules (F03)",
            "categorized with surface type and fire data (decision table)",
        ]
        _layer(
            run,
            "GCOV",
            maturity,
            id=sig_id,
            group="Detected change",
            role="change",
            title=f"Detected change, {a.granule.date} to {b.granule.date}",
            description="What kind of change the radar saw. Blue: turned dark like water. Orange: "
            "vegetation signal dropped. Pink: much brighter (new structures). Gray: other strong "
            "change.",
            url=run.url(sig_id),
            bounds=list(b.bounds),
            date_range=[a.granule.date, b.granule.date],
            polarization="HH/HV",
            units="class",
            colormap="classes",
            provenance={**pair_prov, "steps": rule_steps, "params": {**params, **cfg}},
        )
        spots = firms.hotspots(bbox, a.granule.date, b.granule.date, spots_cache)
        cover_a = categorize.cover_map(db[k - 1]["HH"], db[k - 1]["HV"], cfg)
        cover_b = categorize.cover_map(db[k]["HH"], db[k]["HV"], cfg)
        for i, r in enumerate(classify.regions(sig, d_hh, d_hv, cfg)):
            before = categorize.majority(cover_a, r["mask"])
            after = categorize.majority(cover_b, r["mask"])
            shape = outline(r["mask"], b.x, b.y, b.granule.epsg)
            fires = firms.count_in(spots, shape["bbox"]) if spots is not None else None
            cats = decide(r["signature"], before, after, fires or 0)
            if not cats or (cats == ["other"] and r["confidence"] < cfg["other_min_confidence"]):
                continue
            run.event(
                "GCOV",
                i,
                categories=cats,
                signature=r["signature"],
                date_range=(a.granule.date, b.granule.date),
                region=shape,
                maturity=maturity,
                confidence=r["confidence"],
                polarization="HH/HV",
                layer_ids=[sig_id, f"change-hh-{span}", f"change-hv-{span}", "surface-type"],
                granules=[a.granule.granule_id, b.granule.granule_id],
                steps=[
                    *rule_steps,
                    "grouped touching pixels into a region",
                    classify.CONFIDENCE_STEP,
                ],
                params={**params, **cfg},
                evidence={
                    "signature": r["signature"],
                    "mean_d_hh_db": r["mean_d_hh"],
                    "mean_d_hv_db": r["mean_d_hv"],
                    "surface_before": COVER_NAMES.get(before),
                    "surface_after": COVER_NAMES.get(after),
                    "fire_detections": fires,  # None: no FIRMS key configured, not checked
                    "n_pixels": r["n_pixels"],
                },
                series=region_series(r["mask"]),
                extra_summary=(f"NASA FIRMS saw {fires} fire detections there." if fires else ""),
            )

    # Crops: HV swinging across all dates (needs a real time series).
    if len(windows) >= 4:
        hv = np.stack([d["HV"] for d in db])
        hh = np.stack([d["HH"] for d in db])
        mask = classify.seasonal_mask(hv, hh, cfg) & np.isin(
            cover, [categorize.VEGETATION, categorize.BARE]
        )
        std = np.nanstd(hv, axis=0)
        for i, m in enumerate(classify.components(mask, cfg["min_pixels"] * 4)):
            n = int(m.sum())
            excess = float(np.nanmean(std[m])) - cfg["seasonal_std_db"]
            shape = outline(m, ref.x, ref.y, ref.granule.epsg)
            run.event(
                "GCOV",
                500 + i,
                categories=decide("seasonal_cycle", categorize.majority(cover, m), 0),
                signature="seasonal_cycle",
                date_range=(dates[0], dates[-1]),
                region=shape,
                maturity=maturity,
                confidence=classify.confidence(
                    excess, cfg["seasonal_std_db"], n, cfg["min_pixels"] * 4
                ),
                polarization="HV",
                layer_ids=["surface-type"],
                granules=[w.granule.granule_id for w in windows],
                steps=[
                    *steps,
                    "converted to dB",
                    "HV standard deviation across all dates",
                    (
                        f"kept vegetation or bare pixels with std > {cfg['seasonal_std_db']} dB,"
                        " never water"
                    ),
                ],
                params={**params, **cfg},
                evidence={
                    "signature": "seasonal_cycle",
                    "hv_std_db": round(float(np.nanmean(std[m])), 2),
                    "surface_before": COVER_NAMES.get(categorize.majority(cover, m)),
                    "n_pixels": n,
                },
                series=region_series(m),
            )


# ---------------------------------------------------------------- GUNW


def run_gunw(run: Run, sel: dict, cfg: dict) -> None:
    cfg = {**GUNW_DEFAULTS, **cfg}
    maturity = sel["maturity"]
    bbox = analysis_bbox(run.site)
    loaded = [cached_pair(row, bbox, run.interim) for row in sel["granules"]]
    h = min(d["los_m"].shape[0] for _, d in loaded)
    w = min(d["los_m"].shape[1] for _, d in loaded)
    meta0, d0 = loaded[0]
    x, y, epsg = d0["x"][:w], d0["y"][:h], meta0["epsg"]
    X, Y = np.meshgrid(x, y)

    def inside(b):
        from pyproj import Transformer

        x0, y0, x1, y1 = Transformer.from_crs(4326, epsg, always_xy=True).transform_bounds(*b)
        return (X >= x0) & (X <= x1) & (Y >= y0) & (Y <= y1)

    ref_bbox = run.site.get("reference_bbox")
    ref_mask = inside(ref_bbox) if ref_bbox else np.ones((h, w), bool)
    site_mask = inside(run.site["bbox"])

    class P:  # minimal view of a cached pair for gunw.reference
        def __init__(self, meta, d):
            self.los_m = d["los_m"][:h, :w]
            self.component = d["component"][:h, :w]

    inc = np.stack([reference(P(m, d), ref_mask) for m, d in loaded])  # meters per pair
    days = np.array(
        [
            (date.fromisoformat(m["sec_date"]) - date.fromisoformat(m["ref_date"])).days
            for m, _ in loaded
        ],
        dtype="float64",
    )
    valid = np.isfinite(inc)
    frac = valid.mean(axis=0)
    years = (valid * days[:, None, None]).sum(axis=0) / 365.25
    with np.errstate(invalid="ignore", divide="ignore"):
        rate = np.where(frac >= cfg["min_valid_fraction"], np.nansum(inc, 0) / years, np.nan)
    rate_cm = classify._smooth((rate * 100).astype("float32"), 3)  # cm/yr, away from satellite
    first, last = loaded[0][0]["ref_date"], loaded[-1][0]["sec_date"]
    granules = [m["granule_id"] for m, _ in loaded]
    steps = [
        "streamed the site and reference windows over HTTPS (80 m grid)",
        "removed the ionosphere phase screen",
        "masked water, invalid samples, coherence < 0.3",
        "converted phase to line-of-sight motion: phase x wavelength / (4 pi)",
        "referenced each pair to the median of the stable reference area"
        if ref_bbox
        else "referenced each pair to the median of the window (no reference area set)",
        "rate = sum of motion over valid pairs / their total time",
        f"kept pixels valid in at least {cfg['min_valid_fraction']:.0%} of pairs",
        "3 px smoothing",
    ]
    params = {"bbox": bbox, "reference_bbox": ref_bbox, "pairs": len(loaded), **cfg}
    limit = (
        max(5.0, float(np.nanpercentile(np.abs(rate_cm), 98)))
        if np.isfinite(rate_cm).any()
        else 5.0
    )
    # Red = moving away from the satellite (sinking) - same red-means-loss reading as change maps.
    write_rgba(run.data_dir / run.url("ground-motion"), _diverging(-rate_cm, limit))
    bounds = list(wgs84_bounds(epsg, x, y))
    _layer(
        run,
        "GUNW",
        maturity,
        id="ground-motion",
        group="Ground motion",
        role="motion",
        title=f"Ground motion, {first} to {last}",
        description="How fast the ground moves along the radar's line of sight. Red: moving away "
        "from the satellite (mostly sinking). Blue: moving toward it. Relative to the stable "
        "reference area.",
        url=run.url("ground-motion"),
        bounds=bounds,
        date_range=[first, last],
        polarization="HH",
        units="cm/yr (line of sight)",
        value_range=[-round(limit, 1), round(limit, 1)],
        colormap="rdbu",
        provenance={"source_granules": granules, "steps": steps, "params": params},
    )

    sinking = (rate_cm > cfg["sinking_cm_yr"]) & site_mask
    for i, m in enumerate(classify.components(sinking, cfg["min_pixels"])):
        n = int(m.sum())
        mean_rate = float(np.nanmean(rate_cm[m]))
        before = 0
        if run.cover:
            grid, cx, cy, cepsg = run.cover
            lon, lat = categorize.lonlat_of(m, x, y, epsg, step=max(1, n // 400))
            before = int(np.bincount(categorize.sample(grid, cx, cy, cepsg, lon, lat)).argmax())
        cum, points = 0.0, [{"date": first, "value": 0.0}]
        for (meta, _), d in zip(loaded, inc, strict=True):
            step_cm = float(np.nanmean(d[m])) * 100 if np.isfinite(d[m]).any() else 0.0
            cum += step_cm
            points.append({"date": meta["sec_date"], "value": round(cum, 2)})
        run.event(
            "GUNW",
            i,
            categories=decide("sinking", before, before),
            signature="sinking",
            date_range=(first, last),
            region=outline(m, x, y, epsg),
            maturity=maturity,
            confidence=classify.confidence(
                mean_rate - cfg["sinking_cm_yr"], cfg["sinking_cm_yr"], n, cfg["min_pixels"]
            ),
            polarization="HH",
            layer_ids=["ground-motion"],
            granules=granules,
            steps=steps,
            params=params,
            evidence={
                "signature": "sinking",
                "rate_cm_yr_line_of_sight": round(mean_rate, 1),
                "surface_before": COVER_NAMES.get(before),
                "n_pixels": n,
            },
            series={"line_of_sight_cm": points},
            extra_summary=f"About {mean_rate:.0f} cm/yr along the line of sight.",
        )


# ---------------------------------------------------------------- SME2


def run_sme2(run: Run, sel: dict, cfg: dict) -> None:
    cfg = {**SME2_DEFAULTS, **cfg}
    maturity = sel["maturity"]
    bbox = run.site["bbox"]
    loaded = sorted(
        (cached_sm(row, bbox, run.interim) for row in sel["granules"]), key=lambda md: md[0]["date"]
    )
    h = min(d["sm"].shape[0] for _, d in loaded)
    w = min(d["sm"].shape[1] for _, d in loaded)
    steps = [
        "streamed the site window over HTTPS (EASE-Grid 2.0, about 200 m)",
        "kept recommended retrievals only (quality flag bit 0)",
    ]
    points = []
    for meta, d in loaded:
        sm = d["sm"][:h, :w]
        mean, n = _stats(sm)
        points.append(
            {
                "date": meta["date"],
                "value": round(mean, 4) if n else None,
                "n_pixels": n,
                "granule": meta["granule_id"],
            }
        )
        lid = f"soil-moisture-{meta['date']}"
        write_rgba(run.data_dir / run.url(lid), _ramp(sm, 0.0, 0.5, (166, 97, 26), (1, 133, 113)))
        _layer(
            run,
            "SME2",
            maturity,
            id=lid,
            group="Soil moisture",
            role="soil_moisture",
            title=f"Soil moisture, {meta['date']}",
            description="Water in the top few centimeters of soil, from NISAR. Brown: dry. "
            "Green-blue: wet.",
            url=run.url(lid),
            bounds=list(wgs84_bounds(meta["epsg"], d["x"][:w], d["y"][:h])),
            date=meta["date"],
            polarization="HH/HV",
            units="m3/m3",
            value_range=[0.0, 0.5],
            colormap="brbg",
            provenance={
                "source_granules": [meta["granule_id"]],
                "steps": steps,
                "params": {"bbox": bbox},
            },
        )
    run.series.append(
        write_timeseries(
            run.data_dir,
            run.site_id,
            {
                "series_id": "soil-moisture",
                "title": "Mean soil moisture over the site",
                "units": "m3/m3",
                "polarization": "HH/HV",
                "statistic": "mean",
                "region": _bbox_polygon(bbox),
                "points": points,
                "maturity": maturity,
                "synthetic": run.synthetic,
            },
        )
    )
    values = [p["value"] for p in points if p["value"] is not None]
    if len(values) >= cfg["min_dates"]:
        drop = float(np.mean(values[:-1])) - values[-1]
        if drop > cfg["drying_drop"]:
            region = {
                "geometry": _bbox_polygon(bbox),
                "bbox": list(bbox),
                "centroid": [(bbox[0] + bbox[2]) / 2, (bbox[1] + bbox[3]) / 2],
                "area_km2": round(_bbox_km2(bbox), 1),
            }
            run.event(
                "SME2",
                0,
                categories=decide("soil_drying", 0, 0),
                signature="soil_drying",
                date_range=(points[0]["date"], points[-1]["date"]),
                region=region,
                maturity=maturity,
                confidence=classify.confidence(
                    drop - cfg["drying_drop"],
                    cfg["drying_drop"],
                    len(values),
                    cfg["min_dates"] // 2,
                ),
                polarization="HH/HV",
                layer_ids=[f"soil-moisture-{points[-1]['date']}"],
                granules=[p["granule"] for p in points],
                steps=[*steps, "site mean per date", "latest mean vs mean of earlier dates"],
                params={"bbox": bbox, **cfg},
                evidence={
                    "signature": "soil_drying",
                    "drop_m3_m3": round(drop, 3),
                    "latest": values[-1],
                },
                series={
                    "soil_moisture_m3_m3": [
                        {"date": p["date"], "value": p["value"]} for p in points
                    ]
                },
                extra_summary="Drier soil is not a drought declaration; it needs a longer "
                "record and rainfall data to confirm.",
            )


# ---------------------------------------------------------------- site


def _bbox_polygon(b) -> dict:
    w, s, e, n = b
    return {"type": "Polygon", "coordinates": [[[w, s], [e, s], [e, n], [w, n], [w, s]]]}


def _bbox_km2(b) -> float:
    w, s, e, n = b
    return (e - w) * 111.32 * math.cos(math.radians((s + n) / 2)) * (n - s) * 111.32


def run_site(site_id: str, site: dict, data_dir: Path, interim: Path, selection: dict) -> dict:
    data_dir, interim = Path(data_dir), Path(interim)
    cfg = {**classify.DEFAULTS, **site.get("thresholds", {})}
    run = Run(site_id, site, data_dir, interim)
    products = selection.get("products", {})
    errors = {}
    for name, fn in (("GCOV", run_gcov), ("GUNW", run_gunw), ("SME2", run_sme2)):
        if name in products and products[name]["granules"]:
            try:
                fn(run, products[name], cfg)
            except Exception as err:  # one product failing must not hide the others
                log.exception("%s %s failed", site_id, name)
                errors[name] = str(err)

    w, s, e, n = site["bbox"]
    counts: dict[str, int] = {}
    for ev in run.events:
        for c in ev["categories"]:
            counts[c] = counts.get(c, 0) + 1
    area = {
        "id": site_id,
        "title": site["title"],
        "summary": site["summary"],
        "change_types": sorted({ev["type"] for ev in run.events} | set(site["change_types"])),
        "categories": sorted(counts, key=lambda c: -counts[c]),
        "bbox": [w, s, e, n],
        "center": [round((w + e) / 2, 6), round((s + n) / 2, 6)],
        "zoom_default": max(0, min(14, round(math.log2(360 / max(e - w, n - s))))),
        "layers": sorted(
            run.layers, key=lambda layer: (layer.get("date") or layer["date_range"][1], layer["id"])
        ),
        "timeseries": run.series,
        "credits": run.credits,
        "site": site_id,
        "products": {
            k: {kk: v[kk] for kk in ("maturity", "track", "frame", "direction") if kk in v}
            for k, v in products.items()
        },
        "errors": errors,
    }
    manifest = load_manifest(data_dir)
    old = {a["id"] for a in manifest["areas"] if a.get("site") == site_id or a["id"] == site_id}
    manifest["areas"] = [a for a in manifest["areas"] if a["id"] not in old] + [area]
    write_manifest(data_dir, manifest)
    # Drop events of areas this site replaced (older runs used track/frame area ids).
    stale = [ev for ev in load_events(data_dir)["events"] if ev["area_id"] in old - {site_id}]
    for ev in stale:
        write_events(data_dir, ev["area_id"], [])
    write_events(data_dir, site_id, run.events)
    return {
        "area_id": site_id,
        "layers": len(run.layers),
        "events": len(run.events),
        "categories": counts,
        "errors": errors,
    }
