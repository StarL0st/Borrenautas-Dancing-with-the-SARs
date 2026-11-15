"""Read NISAR L3 SME2 (soil moisture) windows.

SME2 sits on the global EASE-Grid 2.0 (EPSG 6933, about 200 m), the same grid for every track, so
dates from different passes can be compared directly.
"""

from dataclasses import dataclass

import h5py
import numpy as np

from .granule import IDENT, _text, window_slices

GRIDS = "/science/LSAR/SME2/grids"
FILL = -9999.0


@dataclass(frozen=True)
class SoilMoisture:
    granule_id: str
    date: str
    maturity: str
    epsg: int
    x: np.ndarray
    y: np.ndarray
    sm: np.ndarray  # m3/m3, NaN where missing or not recommended


def read_sm(f: h5py.File, bbox, maturity: str) -> SoilMoisture:
    g = f[GRIDS]
    granule_id = _text(f[IDENT]["granuleId"][()])
    epsg = int(g["projection"].attrs["epsg_code"])
    x, y = g["xCoordinates"][()], g["yCoordinates"][()]
    r, c = window_slices(x, y, epsg, bbox, granule_id)
    sm = g["soilMoisture"][r, c].astype("float32")
    flag = g["retrievalQualityFlag"][r, c]
    # Least significant bit 0 = recommended retrieval (product attribute text).
    ok = (sm != FILL) & (flag != -9999) & ((flag & 1) == 0) & (sm >= 0)
    return SoilMoisture(
        granule_id=granule_id,
        date=_text(f[IDENT]["zeroDopplerStartTime"][()])[:10],
        maturity=maturity,
        epsg=epsg,
        x=x[c],
        y=y[r],
        sm=np.where(ok, sm, np.nan).astype("float32"),
    )
