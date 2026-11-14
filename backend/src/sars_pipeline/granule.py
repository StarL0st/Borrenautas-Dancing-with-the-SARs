"""Read NISAR L2 GCOV HDF5 granules: identification metadata and backscatter grids.

Works on local paths and on already-open `h5py.File`s (remote granules streamed with `remote.py`).
"""

import re
import warnings
from dataclasses import dataclass
from pathlib import Path

import h5py
import numpy as np
from pyproj import Transformer

# Layout verified on a real granule and the product spec (docs/03).
IDENT = "/science/LSAR/identification"
GRIDS = "/science/LSAR/GCOV/grids/frequencyA"
MAX_PX = 2048  # docs/02 overlay budget


@dataclass(frozen=True)
class Granule:
    path: Path | str
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

    @property
    def area_id(self) -> str:
        # One area per track/frame/pass: same viewing geometry, so its dates are comparable.
        return f"t{self.track:03d}-f{self.frame:03d}-{self.pass_direction[:1].lower()}"


def _text(v) -> str:
    v = v.item() if isinstance(v, np.ndarray) else v
    return v.decode() if isinstance(v, bytes) else str(v)


def maturity_from_collection(collection: str) -> str:
    """Maturity lives only in the collection name (docs/03): *_BETA_V1, *_PROVISIONAL_V1, *_V1."""
    c = collection.upper()
    if "BETA" in c:
        return "BETA"
    if "PROVISIONAL" in c:
        return "PROVISIONAL"
    if c.startswith("NISAR_L2_") and c.endswith("_V1"):
        return "VALIDATED"
    return "OTHER"  # Urgent Response and anything unknown


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


def read_meta(f: h5py.File, path="", maturity: str | None = None) -> Granule:
    ident, grids = f[IDENT], f[GRIDS]
    epsg = int(grids["projection"].attrs["epsg_code"])
    return Granule(
        path=path,
        granule_id=_text(ident["granuleId"][()]),
        product=_text(ident["productType"][()]),
        start_time=_text(ident["zeroDopplerStartTime"][()]),
        track=int(ident["trackNumber"][()]),
        frame=int(ident["frameNumber"][()]),
        pass_direction=_text(ident["orbitPassDirection"][()]),
        terms=_diagonal_terms(grids),
        epsg=epsg,
        bounds=_wgs84_bounds(epsg, grids["xCoordinates"][()], grids["yCoordinates"][()]),
        maturity=maturity or "OTHER",
        synthetic=bool(f.attrs.get("synthetic", False)),
    )


def open_granule(path, maturity: str | None = None) -> Granule:
    with h5py.File(path, "r") as f:
        return read_meta(f, Path(path), maturity)


def to_db(power: np.ndarray) -> np.ndarray:
    # GCOV diagonal terms are linear gamma0 power (docs/03); average in linear units before this.
    with np.errstate(divide="ignore", invalid="ignore"):
        return np.where(power > 0, 10 * np.log10(power), np.nan).astype("float32")


def read_db(path, term: str, max_px: int = MAX_PX) -> tuple[np.ndarray, int]:
    """Return (backscatter in dB with NaN as nodata, decimation step) for a whole local grid."""
    with h5py.File(path, "r") as f:
        ds = f[GRIDS][term]
        step = max(1, -(-max(ds.shape) // max_px))
        # shortcut: plain decimation, not multilooking; fine for small local files only.
        power = ds[::step, ::step].astype("float32")
    return to_db(power), step


def multilook(power: np.ndarray, looks: int) -> np.ndarray:
    """Box-average linear power over looks x looks blocks, ignoring NaN (speckle reduction)."""
    if looks <= 1:
        return power.astype("float32")
    h, w = (s // looks * looks for s in power.shape)
    blocks = power[:h, :w].reshape(h // looks, looks, w // looks, looks)
    with warnings.catch_warnings():
        warnings.simplefilter("ignore", RuntimeWarning)  # all-NaN blocks stay NaN
        return np.nanmean(blocks, axis=(1, 3)).astype("float32")


@dataclass(frozen=True)
class Window:
    """A multilooked window of one granule: linear power per term on a UTM grid."""

    granule: Granule
    power: dict[str, np.ndarray]
    x: np.ndarray  # pixel-center x after multilook (meters, granule EPSG)
    y: np.ndarray
    looks: int

    @property
    def bounds(self) -> tuple[float, ...]:
        return _wgs84_bounds(self.granule.epsg, self.x, self.y)


def read_window(f: h5py.File, g: Granule, bbox, looks: int = 4, terms=None) -> Window:
    """Read only the pixels inside a WGS84 bbox [w, s, e, n], then multilook.

    Only the HDF5 chunks under the window are fetched, so this is cheap on streamed granules.
    """
    grids = f[GRIDS]
    x, y = grids["xCoordinates"][()], grids["yCoordinates"][()]
    t = Transformer.from_crs(4326, g.epsg, always_xy=True)
    x0, y0, x1, y1 = t.transform_bounds(*bbox)
    cols = np.flatnonzero((x >= x0) & (x <= x1))
    rows = np.flatnonzero((y >= y0) & (y <= y1))
    if cols.size == 0 or rows.size == 0:
        raise ValueError(f"{g.granule_id}: bbox {bbox} does not overlap the granule grid")
    r, c = slice(rows[0], rows[-1] + 1), slice(cols[0], cols[-1] + 1)
    power = {
        term: multilook(grids[term][r, c].astype("float32"), looks) for term in (terms or g.terms)
    }
    h, w = next(iter(power.values())).shape
    # Centers of each looks x looks block.
    xs = x[c][: w * looks].reshape(w, looks).mean(axis=1)
    ys = y[r][: h * looks].reshape(h, looks).mean(axis=1)
    return Window(g, power, xs, ys, looks)
