"""Turn radar signatures into the frontend's categories: signature x context -> category.

Context comes from NISAR itself (a rough surface type from backscatter levels) and, optionally,
NASA FIRMS fire detections. Categories use the frontend filter ids (frontend/src/filters.ts), so
the filter panel maps 1:1 to events. Each event keeps its evidence, so the app can say why.
"""

import numpy as np
import shapely
from pyproj import Transformer
from rasterio import features
from rasterio.transform import Affine
from shapely.geometry import mapping, shape
from shapely.ops import unary_union

# Surface types (NISAR-derived, from the mean of all dates). Rough, documented thresholds.
WATER, URBAN, VEGETATION, BARE = 1, 2, 3, 4
COVER_NAMES = {WATER: "water", URBAN: "built-up", VEGETATION: "vegetation", BARE: "bare or low"}
COVER_COLORS = {
    WATER: (33, 113, 181, 170),
    URBAN: (200, 60, 60, 170),
    VEGETATION: (49, 163, 84, 170),
    BARE: (217, 180, 120, 170),
}


def cover_map(hh_db: np.ndarray, hv_db: np.ndarray, cfg: dict) -> np.ndarray:
    """Water: HH darker than water_db. Built-up: HH bright and much brighter than HV (walls and
    ground act as corner reflectors). Vegetation: HV bright (leaves and branches scatter). Else bare.
    """
    cover = np.full(hh_db.shape, BARE, dtype="uint8")
    with np.errstate(invalid="ignore"):
        cover[hv_db > cfg["vegetation_hv_db"]] = VEGETATION
        cover[(hh_db > -8.0) & (hh_db - hv_db > 7.0)] = URBAN
        cover[hh_db < cfg["water_db"]] = WATER
    cover[~(np.isfinite(hh_db) & np.isfinite(hv_db))] = 0
    return cover


def majority(cover: np.ndarray, mask: np.ndarray) -> int:
    values = cover[mask & (cover > 0)]
    return int(np.bincount(values).argmax()) if values.size else 0


# category (frontend filter id) -> C1 change type (docs/04)
CHANGE_TYPE = {
    "floods": "flood_wetland",
    "deforestation": "forest_loss",
    "logging": "forest_loss",
    "wildfires": "wildfire",
    "agriculture": "agriculture",
    "urban": "other",
    "subsidence": "deformation",
    "groundwater": "deformation",
    "volcanoes": "deformation",
    "drought": "soil_moisture",
    "other": "other",
}


def decide(signature: str, before: int, after: int, fires: int = 0) -> list[str]:
    """The decision table (docs/04 C7, backend/README). First category is the primary one."""
    if signature == "darkening_both":
        return ["floods"] if before != WATER else []  # water that stays water is not a flood
    if signature == "hv_drop":
        if before == VEGETATION:
            return ["wildfires", "deforestation"] if fires else ["deforestation"]
        if before == BARE:
            return ["agriculture"]  # harvest or ploughing
        return ["other"]
    if signature == "brightening":
        return ["urban"] if after == URBAN or before == BARE else ["other"]
    if signature == "seasonal_cycle":
        return ["agriculture"]
    if signature == "sinking":
        return ["subsidence", "groundwater"] if before == URBAN else ["subsidence"]
    if signature == "soil_drying":
        return ["drought"]
    return ["other"]


def grid_transform(x: np.ndarray, y: np.ndarray) -> Affine:
    """Affine transform of a grid given its pixel-center coordinates."""
    dx, dy = x[1] - x[0], y[1] - y[0]
    return Affine.translation(x[0] - dx / 2, y[0] - dy / 2) * Affine.scale(dx, dy)


def outline(mask: np.ndarray, x: np.ndarray, y: np.ndarray, epsg: int) -> dict:
    """Region outline in WGS84, simplified to half a pixel, plus bbox, centroid and area."""
    tf = grid_transform(x, y)
    polys = [
        shape(geom)
        for geom, v in features.shapes(mask.astype("uint8"), mask=mask, transform=tf)
        if v == 1
    ]
    merged = unary_union(polys)
    area_km2 = merged.area / 1e6
    px = abs(x[1] - x[0])
    # A point inside the outline (a centroid can fall outside an L shape); shrunk by a quarter
    # pixel first so it never sits on an edge.
    inner = merged.buffer(-px / 4)
    point = (inner if not inner.is_empty else merged).representative_point()
    merged = merged.simplify(px / 2, preserve_topology=True)
    to_wgs = Transformer.from_crs(epsg, 4326, always_xy=True).transform
    geo = shapely.transform(merged, lambda xs, ys: to_wgs(xs, ys), interleaved=False)
    point = shapely.transform(point, lambda xs, ys: to_wgs(xs, ys), interleaved=False)
    return {
        "geometry": _rounded(mapping(geo)),
        "bbox": [round(v, 6) for v in geo.bounds],
        "centroid": [round(point.x, 6), round(point.y, 6)],
        "area_km2": round(area_km2, 3),
    }


def _rounded(geom: dict) -> dict:
    def r(c):
        return [round(v, 6) for v in c] if isinstance(c[0], float) else [r(i) for i in c]

    return {"type": geom["type"], "coordinates": r(geom["coordinates"])}


def lonlat_of(mask: np.ndarray, x: np.ndarray, y: np.ndarray, epsg: int, step: int = 1):
    """Lon/lat of the pixels in a mask (every `step`th), for sampling other grids."""
    rows, cols = np.nonzero(mask)
    rows, cols = rows[::step], cols[::step]
    return Transformer.from_crs(epsg, 4326, always_xy=True).transform(x[cols], y[rows])


def sample(grid: np.ndarray, x: np.ndarray, y: np.ndarray, epsg: int, lon, lat) -> np.ndarray:
    """Nearest-pixel values of a grid at lon/lat points; 0 outside the grid."""
    px, py = Transformer.from_crs(4326, epsg, always_xy=True).transform(lon, lat)
    ci = np.rint((np.asarray(px) - x[0]) / (x[1] - x[0])).astype(int)
    ri = np.rint((np.asarray(py) - y[0]) / (y[1] - y[0])).astype(int)
    inside = (ci >= 0) & (ci < x.size) & (ri >= 0) & (ri < y.size)
    out = np.zeros(ci.shape, grid.dtype)
    out[inside] = grid[ri[inside], ci[inside]]
    return out
