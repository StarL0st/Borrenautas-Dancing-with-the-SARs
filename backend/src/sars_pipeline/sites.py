"""Site configuration: curated sites (backend/sites.json, in git) plus sites requested at runtime
through the API (<data root>/sites.json, never in git)."""

import json
import math
import os
from pathlib import Path

BACKEND = Path(__file__).resolve().parents[2]
SITES = BACKEND / "sites.json"
DATA = Path(os.environ.get("SARS_DATA_ROOT", BACKEND.parent / "data"))
REQUESTED = DATA / "sites.json"

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
PRODUCTS = {"GCOV", "GUNW", "SME2"}


def _read(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8")) if Path(path).exists() else {}


def load_sites(path: Path = SITES, requested: Path | None = REQUESTED) -> dict:
    """Curated sites, then requested ones (a requested id never replaces a curated one)."""
    sites = _read(path)
    if requested:
        for site_id, site in _read(requested).items():
            sites.setdefault(site_id, {**site, "requested": True})
    return sites


def bbox_around(lon: float, lat: float, km: float) -> list[float]:
    """A km x km box centered on a point, in degrees."""
    dlat = km / 2 / 111.32
    dlon = dlat / math.cos(math.radians(lat))
    return [round(v, 5) for v in (lon - dlon, lat - dlat, lon + dlon, lat + dlat)]


def validate(site: dict, max_sq_deg: float = 1.0) -> None:
    w, s, e, n = site["bbox"]
    if not (-180 <= w < e <= 180 and -90 <= s < n <= 90):
        raise ValueError(f"bbox must be west,south,east,north in degrees, got {site['bbox']}")
    if (e - w) * (n - s) > max_sq_deg:
        # shortcut: site windows are read at 10 m in one piece; bigger areas need tiling first.
        raise ValueError(f"bbox is over {max_sq_deg} square degrees; keep sites to about 20-50 km")
    bad = set(site["change_types"]) - CHANGE_TYPES
    if bad:
        raise ValueError(f"unknown change_types {sorted(bad)}; use {sorted(CHANGE_TYPES)}")
    bad = set(site.get("products", PRODUCTS)) - PRODUCTS
    if bad:
        raise ValueError(f"unknown products {sorted(bad)}; use {sorted(PRODUCTS)}")


def add_site(site_id: str, site: dict, path: Path = SITES, force: bool = False, **limits) -> dict:
    """Validate a site and write it into a sites file."""
    validate(site, **limits)
    sites = _read(path)
    if site_id in sites and not force:
        raise ValueError(f"site {site_id!r} exists; pass --force to replace it")
    sites[site_id] = site
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(sites, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    return site
