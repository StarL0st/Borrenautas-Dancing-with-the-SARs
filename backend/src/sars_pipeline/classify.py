"""Change signatures: what the radar saw, before any interpretation (specs/F03 rules 9-10).

Inputs are multilooked dB grids for two dates on the same grid. Each pixel gets one signature;
`categorize.py` turns a signature plus context (surface type, fires) into a category. Rules are
deliberately simple, so every event can be explained: "HH and HV both dropped by more than 3 dB".
"""

import numpy as np
from scipy import ndimage

# Thresholds in dB (F03 rule 4: in config, not buried in code). Override per site in sites.json.
DEFAULTS = {
    "smooth_px": 3,  # extra box filter on the dB difference, after multilooking
    "flood_drop_db": 3.0,  # darkening: HH and HV both drop at least this much...
    "water_db": -18.0,  # ...and HH ends up this dark (open water is a mirror for radar)
    "forest_hv_drop_db": 3.0,  # HV drop: HV (volume scattering) drops at least this much...
    "forest_margin_db": 1.5,  # ...and by this much more than HH...
    "vegetation_hv_db": -18.0,  # ...from at least this bright before (volume scattering present)
    "brighten_db": 4.0,  # brightening: HH rises this much (new walls, roofs, cleared and built)
    "other_db": 5.0,  # strong change: any other change this large in HH or HV
    "min_pixels": 12,  # smaller connected regions are dropped as noise
    "seasonal_std_db": 2.0,  # seasonal cycle: HV swings with at least this std across dates
    "other_min_confidence": 0.5,  # weaker "other" events are not published
}

# Signature codes in the signature map; also the precedence order (highest code wins).
NONE, STRONG, BRIGHTENING, HV_DROP, DARKENING, NODATA = 0, 1, 2, 3, 4, 255
SIGNATURES = {
    DARKENING: "darkening_both",
    HV_DROP: "hv_drop",
    BRIGHTENING: "brightening",
    STRONG: "strong_change",
}


def _smooth(d: np.ndarray, size: int) -> np.ndarray:
    """NaN-aware box mean."""
    if size <= 1:
        return d
    valid = np.isfinite(d)
    num = ndimage.uniform_filter(np.where(valid, d, 0.0), size)
    den = ndimage.uniform_filter(valid.astype("float32"), size)
    with np.errstate(invalid="ignore", divide="ignore"):
        return np.where(valid, num / den, np.nan).astype("float32")


def difference(before_db: np.ndarray, after_db: np.ndarray, smooth_px: int) -> np.ndarray:
    """after - before in dB, smoothed. Negative = surface got darker to the radar."""
    return _smooth(after_db - before_db, smooth_px)


def signature_map(hh0, hv0, hh1, hv1, cfg: dict) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Return (signature map, HH difference, HV difference)."""
    d_hh = difference(hh0, hh1, cfg["smooth_px"])
    d_hv = difference(hv0, hv1, cfg["smooth_px"])
    valid = np.isfinite(d_hh) & np.isfinite(d_hv) & np.isfinite(hh1)
    land = (hh0 >= cfg["water_db"]) & (hh1 >= cfg["water_db"])
    with np.errstate(invalid="ignore"):
        dark = (d_hh < -cfg["flood_drop_db"]) & (d_hv < -cfg["flood_drop_db"])
        dark &= hh1 < cfg["water_db"]
        hv_drop = (d_hv < -cfg["forest_hv_drop_db"]) & (d_hv - d_hh < -cfg["forest_margin_db"])
        hv_drop &= hv0 > cfg["vegetation_hv_db"]
        bright = (d_hh > cfg["brighten_db"]) & land
        strong = (np.abs(d_hh) > cfg["other_db"]) | (np.abs(d_hv) > cfg["other_db"])
        # Water on either date: ships, wind and sidelobe streaks change it all the time, so only
        # the darkening rule may fire there.
        strong &= land
    sig = np.full(d_hh.shape, NONE, dtype="uint8")
    sig[strong] = STRONG
    sig[bright] = BRIGHTENING
    sig[hv_drop] = HV_DROP
    sig[dark] = DARKENING
    # Smoothing blurs an edge into a ring of weaker change; that ring is the same event.
    halo = ndimage.binary_dilation(dark | hv_drop | bright, iterations=cfg["smooth_px"] // 2 + 1)
    sig[(sig == STRONG) & halo] = NONE
    sig[~valid] = NODATA
    return sig, d_hh, d_hv


def _excess(code: int, d_hh, d_hv, cfg) -> np.ndarray:
    """How far past its threshold each pixel is, in dB (feeds confidence)."""
    if code == DARKENING:
        return np.minimum(-d_hh, -d_hv) - cfg["flood_drop_db"]
    if code == HV_DROP:
        return -d_hv - cfg["forest_hv_drop_db"]
    if code == BRIGHTENING:
        return d_hh - cfg["brighten_db"]
    return np.maximum(np.abs(d_hh), np.abs(d_hv)) - cfg["other_db"]


def _threshold(code: int, cfg) -> float:
    return {
        DARKENING: cfg["flood_drop_db"],
        HV_DROP: cfg["forest_hv_drop_db"],
        BRIGHTENING: cfg["brighten_db"],
    }.get(code, cfg["other_db"])


def confidence(excess: float, threshold: float, n: int, min_pixels: int) -> float:
    """Half from how strongly the rule fired, half from how big the region is (0 to 1)."""
    conf = 0.5 * min(1.0, excess / threshold) + 0.5 * min(1.0, n / (10 * min_pixels))
    return round(max(0.0, conf), 2)


CONFIDENCE_STEP = (
    "confidence = 0.5 * min(1, mean past threshold / threshold)"
    " + 0.5 * min(1, pixels / (10 * min_pixels))"
)


def components(mask: np.ndarray, min_pixels: int) -> list[np.ndarray]:
    """Connected regions (8-neighbour) of a boolean mask as full-size masks, largest first."""
    labels, n = ndimage.label(mask, structure=np.ones((3, 3)))
    if n == 0:
        return []
    sizes = np.bincount(labels.ravel())[1:]
    keep = [i + 1 for i in np.argsort(-sizes, kind="stable") if sizes[i] >= min_pixels]
    return [labels == i for i in keep]


def regions(sig: np.ndarray, d_hh: np.ndarray, d_hv: np.ndarray, cfg: dict) -> list[dict]:
    """Connected regions per signature, largest first, with stats and a 0-1 confidence."""
    out = []
    for code, name in SIGNATURES.items():
        for mask in components(sig == code, cfg["min_pixels"]):
            n = int(mask.sum())
            excess = float(np.mean(_excess(code, d_hh, d_hv, cfg)[mask]))
            out.append(
                {
                    "signature": name,
                    "mask": mask,
                    "n_pixels": n,
                    "mean_d_hh": round(float(np.mean(d_hh[mask])), 2),
                    "mean_d_hv": round(float(np.mean(d_hv[mask])), 2),
                    "confidence": confidence(excess, _threshold(code, cfg), n, cfg["min_pixels"]),
                }
            )
    return sorted(out, key=lambda r: -r["n_pixels"])


def seasonal_mask(hv_stack_db: np.ndarray, hh_stack_db: np.ndarray, cfg: dict) -> np.ndarray:
    """Pixels whose HV swings across dates (crops growing and being cut), never water."""
    with np.errstate(invalid="ignore"), np.errstate(all="ignore"):
        std = np.nanstd(_stack_smooth(hv_stack_db, cfg["smooth_px"]), axis=0)
        ever_water = np.nanmin(hh_stack_db, axis=0) < cfg["water_db"]
    return (std > cfg["seasonal_std_db"]) & ~ever_water


def _stack_smooth(stack: np.ndarray, size: int) -> np.ndarray:
    return np.stack([_smooth(layer, size) for layer in stack])
