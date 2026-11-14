"""Write small synthetic HDF5 files shaped like NISAR GCOV, for tests and frontend development.

They are marked synthetic (root attribute and granule ID) and sit over open ocean, so they never
resemble a real area (docs/04 validation rules).
"""

from pathlib import Path

import h5py
import numpy as np

from .granule import GRIDS, IDENT

EPSG = 32601  # UTM zone 1N, open Pacific


def write_synthetic(
    path, date: str, growth: float = 0.0, size: int = 64, track: int = 1, frame: int = 1
) -> Path:
    """A bright Gaussian blob whose radius grows with `growth`, plus a nodata corner."""
    rng = np.random.default_rng(int(date.replace("-", "")))
    yy, xx = np.mgrid[:size, :size] - size / 2
    blob = np.exp(-(xx**2 + yy**2) / (2 * (size / 8 * (1 + growth)) ** 2))
    hh = (0.01 + 0.2 * blob) * rng.gamma(4, 1 / 4, (size, size))  # speckle-like noise
    hh[:4, :4] = np.nan
    x = 500_000 + 20 * np.arange(size) + 10.0
    y = 1_000_000 - 20 * np.arange(size) - 10.0

    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    with h5py.File(path, "w") as f:
        f.attrs["synthetic"] = True
        ident = f.create_group(IDENT)
        ident["granuleId"] = f"SYNTHETIC_GCOV_T{track:03d}_F{frame:03d}_{date.replace('-', '')}"
        ident["productType"] = "GCOV"
        ident["zeroDopplerStartTime"] = f"{date}T00:00:00.000000"
        ident["trackNumber"] = track
        ident["frameNumber"] = frame
        ident["orbitPassDirection"] = "Ascending"
        grids = f.create_group(GRIDS)
        grids["HHHH"] = hh.astype("float32")
        grids["HVHV"] = (hh * 0.2).astype("float32")
        grids["xCoordinates"] = x
        grids["yCoordinates"] = y
        grids["projection"] = np.int32(EPSG)
        grids["projection"].attrs["epsg_code"] = EPSG
        grids["listOfCovarianceTerms"] = np.array([b"HHHH", b"HVHV"])
    return path
