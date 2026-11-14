"""Change detection and rule-based classification (specs/F03 rules 9-10).

Inputs are multilooked dB grids for two dates on the same grid. Rules are deliberately simple and
documented, so every event can be explained: "HH and HV both dropped by more than 3 dB" etc.
"""

import numpy as np
from scipy import ndimage

# Thresholds in dB (F03 rule 4: in config, not buried in code). Override per site in sites.json.
DEFAULTS = {
    "smooth_px": 3,  # extra box filter on the dB difference, after multilooking
    "flood_drop_db": 3.0,  # HH and HV both drop at least this much...
    "water_db": -18.0,  # ...and HH ends up this dark (open water is a mirror for radar)
    "forest_hv_drop_db": 3.0,  # HV (volume scattering from canopy) drops at least this much...
    "forest_margin_db": 1.5,  # ...and by this much more than HH...
    "vegetation_hv_db": -18.0,  # ...from at least this bright before (volume scattering present)
    "other_db": 5.0,  # any other change this large in HH or HV
    "min_pixels": 12,  # smaller connected regions are dropped as noise
}

# Class codes in the class map; also the precedence order of the rules.
NONE, FLOOD, FOREST, OTHER, NODATA = 0, 1, 2, 3, 255
TYPES = {FLOOD: "flood_wetland", FOREST: "forest_loss", OTHER: "other"}


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


def class_map(hh0, hv0, hh1, hv1, cfg: dict) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Return (class map, HH difference, HV difference). Rules applied in precedence order."""
    d_hh = difference(hh0, hh1, cfg["smooth_px"])
    d_hv = difference(hv0, hv1, cfg["smooth_px"])
    valid = np.isfinite(d_hh) & np.isfinite(d_hv) & np.isfinite(hh1)
    with np.errstate(invalid="ignore"):
        flood = (d_hh < -cfg["flood_drop_db"]) & (d_hv < -cfg["flood_drop_db"])
        flood &= hh1 < cfg["water_db"]
        forest = (d_hv < -cfg["forest_hv_drop_db"]) & (d_hv - d_hh < -cfg["forest_margin_db"])
        forest &= hv0 > cfg["vegetation_hv_db"]
        other = (np.abs(d_hh) > cfg["other_db"]) | (np.abs(d_hv) > cfg["other_db"])
        # Water on either date: ships, wind and sidelobe streaks change it all the time, so only the
        # flood rule may fire there.
        other &= (hh0 >= cfg["water_db"]) & (hh1 >= cfg["water_db"])
    cls = np.full(d_hh.shape, NONE, dtype="uint8")
    cls[other] = OTHER
    cls[forest] = FOREST
    cls[flood] = FLOOD
    # Smoothing blurs a flood or forest edge into a ring of weaker change; that ring is the same
    # event, not an "other" one.
    halo = ndimage.binary_dilation(flood | forest, iterations=cfg["smooth_px"] // 2 + 1)
    cls[(cls == OTHER) & halo] = NONE
    cls[~valid] = NODATA
    return cls, d_hh, d_hv


def _excess(code: int, d_hh, d_hv, cfg) -> np.ndarray:
    """How far past its threshold each pixel is, in dB (feeds confidence)."""
    if code == FLOOD:
        return np.minimum(-d_hh, -d_hv) - cfg["flood_drop_db"]
    if code == FOREST:
        return -d_hv - cfg["forest_hv_drop_db"]
    return np.maximum(np.abs(d_hh), np.abs(d_hv)) - cfg["other_db"]


def _threshold(code: int, cfg) -> float:
    return {FLOOD: cfg["flood_drop_db"], FOREST: cfg["forest_hv_drop_db"]}.get(
        code, cfg["other_db"]
    )


def regions(cls: np.ndarray, d_hh: np.ndarray, d_hv: np.ndarray, cfg: dict) -> list[dict]:
    """Connected regions per class, largest first, with stats and a 0-1 confidence.

    confidence = 0.5 * min(1, mean excess / threshold) + 0.5 * min(1, pixels / (10 * min_pixels)):
    half from how strongly the rule fired, half from how big the region is.
    """
    out = []
    for code, kind in TYPES.items():
        labels, _ = ndimage.label(cls == code, structure=np.ones((3, 3)))
        for i, sl in enumerate(ndimage.find_objects(labels), start=1):
            mask = labels[sl] == i
            n = int(mask.sum())
            if n < cfg["min_pixels"]:
                continue
            excess = float(np.mean(_excess(code, d_hh[sl], d_hv[sl], cfg)[mask]))
            conf = 0.5 * min(1.0, excess / _threshold(code, cfg)) + 0.5 * min(
                1.0, n / (10 * cfg["min_pixels"])
            )
            out.append(
                {
                    "type": kind,
                    "rows": (sl[0].start, sl[0].stop),
                    "cols": (sl[1].start, sl[1].stop),
                    "n_pixels": n,
                    "mean_d_hh": round(float(np.mean(d_hh[sl][mask])), 2),
                    "mean_d_hv": round(float(np.mean(d_hv[sl][mask])), 2),
                    "confidence": round(max(0.0, conf), 2),
                }
            )
    return sorted(out, key=lambda r: (-r["n_pixels"], r["rows"], r["cols"]))
