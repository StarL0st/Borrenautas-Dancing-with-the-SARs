"""Read NISAR L2 GCOV HDF5 granules: identification metadata and downsampled backscatter grids."""

import re
from dataclasses import dataclass
from pathlib import Path

import h5py
import numpy as np
from pyproj import Transformer

# shortcut: paths follow the GCOV product spec layout; verify against a real granule at kickoff (docs/03).
IDENT = "/science/LSAR/identification"
GRIDS = "/science/LSAR/GCOV/grids/frequencyA"
MAX_PX = 2048  # docs/02 overlay budget


@dataclass(frozen=True)
class Granule:
    path: Path
    granule_id: str
    product: str
    start_time: str
    track: int
    frame: int
    pass_direction: str
    terms: tuple[str, ...]  # diagonal covariance terms, e.g. ("HHHH", "HVHV")
    epsg: int
    bounds: tuple[float, float, float, float]  # WGS84 [west, south, east, north]
    maturity: str
    synthetic: bool

    @property
    def date(self) -> str:
        return self.start_time[:10]


def _text(v) -> str:
    v = v.item() if isinstance(v, np.ndarray) else v
    return v.decode() if isinstance(v, bytes) else str(v)


def _maturity(granule_id: str) -> str:
    # shortcut: maturity guessed from the granule ID; take it from the collection name once fetch exists.
    return next((m for m in ("PROVISIONAL", "BETA") if m in granule_id.upper()), "OTHER")


def _diagonal_terms(grids: h5py.Group) -> tuple[str, ...]:
    names = (
        [_text(t) for t in grids["listOfCovarianceTerms"][()]]
        if "listOfCovarianceTerms" in grids
        else list(grids)
    )
    # Only diagonal terms (HHHH, HVHV, ...) are real-valued backscatter power.
    return tuple(t for t in names if re.fullmatch(r"([HV]{2})\1", t) and t in grids)


def _wgs84_bounds(epsg: int, x: np.ndarray, y: np.ndarray) -> tuple[float, ...]:
    # Coordinates are pixel centers; widen by half a pixel to get the outer edges.
    dx, dy = abs(x[1] - x[0]) / 2, abs(y[1] - y[0]) / 2
    t = Transformer.from_crs(epsg, 4326, always_xy=True)
    edges = t.transform_bounds(x.min() - dx, y.min() - dy, x.max() + dx, y.max() + dy)
    return tuple(round(float(v), 6) for v in edges)


def open_granule(path) -> Granule:
    with h5py.File(path, "r") as f:
        ident, grids = f[IDENT], f[GRIDS]
        epsg = int(grids["projection"].attrs["epsg_code"])
        granule_id = _text(ident["granuleId"][()])
        return Granule(
            path=Path(path),
            granule_id=granule_id,
            product=_text(ident["productType"][()]),
            start_time=_text(ident["zeroDopplerStartTime"][()]),
            track=int(ident["trackNumber"][()]),
            frame=int(ident["frameNumber"][()]),
            pass_direction=_text(ident["orbitPassDirection"][()]),
            terms=_diagonal_terms(grids),
            epsg=epsg,
            bounds=_wgs84_bounds(epsg, grids["xCoordinates"][()], grids["yCoordinates"][()]),
            maturity=_maturity(granule_id),
            synthetic=bool(f.attrs.get("synthetic", False)),
        )


def read_db(path, term: str, max_px: int = MAX_PX) -> tuple[np.ndarray, int]:
    """Return (backscatter in dB with NaN as nodata, decimation step)."""
    with h5py.File(path, "r") as f:
        ds = f[GRIDS][term]
        step = max(1, -(-max(ds.shape) // max_px))
        # shortcut: plain decimation, not multilooking; add a box-average when speckle matters (F02 rule 4).
        power = ds[::step, ::step].astype("float32")
    with np.errstate(divide="ignore", invalid="ignore"):
        # GCOV diagonal terms are linear power; confirm scaling in the product spec (docs/03 VERIFY).
        return np.where(power > 0, 10 * np.log10(power), np.nan).astype("float32"), step
