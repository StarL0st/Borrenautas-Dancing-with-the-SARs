"""Read NISAR L2 GUNW (geocoded unwrapped interferogram) windows as line-of-sight ground motion.

One GUNW is a pair of passes (reference, secondary) on one track and frame, 80 m grid, UTM.
Unwrapped phase only means something relative to another pixel, so every pair is referenced to a
stable area (the site's `reference_bbox`) before pairs are summed into a time series.
"""

import re
from dataclasses import dataclass

import h5py
import numpy as np

from .granule import IDENT, _text, window_slices

GRP = "/science/LSAR/GUNW/grids/frequencyA/unwrappedInterferogram"
FREQ = "/science/LSAR/GUNW/grids/frequencyA/centerFrequency"
SPEED_OF_LIGHT = 299_792_458.0

# GUNW file IDs carry both acquisitions: ..._<refStart>_<refEnd>_<secStart>_<secEnd>_...
PAIR_DATES = re.compile(r"_(\d{8})T\d{6}_\d{8}T\d{6}_(\d{8})T\d{6}_\d{8}T\d{6}_")


def pair_dates(granule_id: str) -> tuple[str, str]:
    m = PAIR_DATES.search(granule_id)
    if not m:
        raise ValueError(f"no pair dates in {granule_id}")
    return tuple(f"{d[:4]}-{d[4:6]}-{d[6:]}" for d in m.groups())


@dataclass(frozen=True)
class Pair:
    granule_id: str
    track: int
    frame: int
    pass_direction: str
    ref_date: str
    sec_date: str
    maturity: str
    epsg: int
    x: np.ndarray  # pixel centers, meters
    y: np.ndarray
    los_m: np.ndarray  # line-of-sight motion in meters, NaN where unusable; not yet referenced
    coherence: np.ndarray
    component: np.ndarray  # connected component id (0 = unusable)


def valid_mask(mask: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """Decode the GUNW mask: (valid in both passes, water). Low byte is 3 decimal digits:
    water flag (1 = water), reference subswath, secondary subswath; a 0 subswath means invalid.
    """
    low = (mask & 0xFF).astype("int32")
    valid = (mask != 255) & ((low // 10) % 10 > 0) & (low % 10 > 0)
    water = (mask != 255) & (low // 100 == 1)
    return valid, water


def read_pair(f: h5py.File, bbox, maturity: str, pol: str = "HH", min_coherence: float = 0.3):
    ident, grp = f[IDENT], f[GRP]
    granule_id = _text(ident["granuleId"][()])
    epsg = int(grp["projection"].attrs["epsg_code"])
    x, y = grp["xCoordinates"][()], grp["yCoordinates"][()]
    r, c = window_slices(x, y, epsg, bbox, granule_id)
    phase = grp[f"{pol}/unwrappedPhase"][r, c].astype("float64")
    iono = grp[f"{pol}/ionospherePhaseScreen"][r, c].astype("float64")
    coh = grp[f"{pol}/coherenceMagnitude"][r, c]
    comp = grp[f"{pol}/connectedComponents"][r, c].astype("int32")
    valid, water = valid_mask(grp["mask"][r, c])
    wavelength = SPEED_OF_LIGHT / float(f[FREQ][()])
    usable = valid & ~water & (coh >= min_coherence) & (comp > 0) & (comp != 65535)
    usable &= np.isfinite(phase) & np.isfinite(iono)
    # Range change = phase * lambda / (4 pi); positive = the ground moved away from the satellite
    # (for example, sinking). The product spec (JPL D-102272 Rev E) does not state the sign; this is
    # the ISCE/ARIA convention, and it makes Mexico City's documented subsidence bowl read as
    # sinking (checked 2026-11-14). The ionosphere screen is "not applied ... by default", so it is
    # subtracted here.
    los = np.where(usable, (phase - iono) * wavelength / (4 * np.pi), np.nan)
    ref_date, sec_date = pair_dates(granule_id)
    return Pair(
        granule_id=granule_id,
        track=int(ident["trackNumber"][()]),
        frame=int(ident["frameNumber"][()]),
        pass_direction=_text(ident["orbitPassDirection"][()]),
        ref_date=ref_date,
        sec_date=sec_date,
        maturity=maturity,
        epsg=epsg,
        x=x[c],
        y=y[r],
        los_m=los.astype("float32"),
        coherence=coh.astype("float32"),
        component=np.where(usable, comp, 0),
    )


def reference(p: Pair, ref_mask: np.ndarray) -> np.ndarray:
    """Motion relative to the median of the stable reference area.

    Phase ambiguities differ between connected components, so only the component that covers most
    of the reference area is kept.
    """
    comps = p.component[ref_mask & (p.component > 0)]
    if comps.size == 0:
        return np.full(p.los_m.shape, np.nan, "float32")
    main = np.bincount(comps).argmax()
    keep = p.component == main
    offset = np.nanmedian(p.los_m[ref_mask & keep])
    return np.where(keep, p.los_m - offset, np.nan).astype("float32")


def chain(pairs: list) -> list:
    """Longest run of consecutive pairs (each secondary date is the next reference date), latest
    first preferred. Summing a chain gives motion since the first reference date."""
    by_sec = {p["sec_date"]: p for p in pairs}
    best: list = []
    for start in sorted(by_sec, reverse=True):
        run, cur = [], by_sec[start]
        while cur:
            run.append(cur)
            cur = by_sec.get(cur["ref_date"])
        if len(run) > len(best):
            best = run
    return best[::-1]
