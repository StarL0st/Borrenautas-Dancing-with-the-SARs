"""Turn granules into contract files (docs/04): layer PNGs, time series JSON, manifest.json."""

import json
import math
import os
import subprocess
import time
from datetime import UTC, datetime
from functools import cache
from importlib.metadata import version
from pathlib import Path

import numpy as np
from PIL import Image

from .granule import Granule, open_granule, read_db

CONTRACT_VERSION = "0.3.0"
ATTRIBUTION = "NISAR data: NASA/JPL/NISAR, distributed by NASA ASF DAAC"
# Collection titles and DOIs (Earthdata catalog / CMR; each DOI checked to resolve on doi.org).
# CMR lists GUNW as 10.5067/NIL1GUNW-P1, which does not resolve; the DOI inside the granules,
# 10.5067/NIL2GUNW-P1, does (docs/09-references.md).
PRODUCT_TITLES = {
    "GCOV": "Geocoded Polarimetric Covariance Product",
    "GUNW": "Geocoded Unwrapped Interferogram Product",
    "SME2": "Soil Moisture",
}
CITATIONS = {
    ("GCOV", "BETA"): "10.5067/NIL2GCOV-B1",
    ("GCOV", "PROVISIONAL"): "10.5067/NIL2GCOV-P1",
    ("GCOV", "VALIDATED"): "10.5067/NIL2GCOV-V1",
    ("GUNW", "PROVISIONAL"): "10.5067/NIL2GUNW-P1",
    ("SME2", "PROVISIONAL"): "10.5067/NIL3SME2-P1",
}


def attribution(maturity: str, product: str = "GCOV") -> str:
    """Credit line for data of one product and maturity; generic for synthetic or other data."""
    doi = CITATIONS.get((product, maturity))
    if not doi:
        return ATTRIBUTION
    return (
        f"NASA/JPL/NISAR (2026). NISAR {maturity.title()} {PRODUCT_TITLES[product]} "
        f"(Version 1). NASA Alaska Satellite Facility DAAC. https://doi.org/{doi}"
    )


MATURITY_WORST_FIRST = ["OTHER", "BETA", "PROVISIONAL", "VALIDATED"]


@cache
def _software() -> dict:
    try:
        commit = subprocess.run(
            ["git", "rev-parse", "HEAD"],
            cwd=Path(__file__).parent,
            capture_output=True,
            text=True,
            check=True,
        ).stdout.strip()
    except (OSError, subprocess.CalledProcessError):
        commit = os.environ.get("GIT_COMMIT", "unknown")  # container images have no .git
    return {"name": "sars-pipeline", "version": version("sars-pipeline"), "commit": commit}


def _write_json(path: Path, obj) -> None:
    # Write then rename so the server never serves a half-written file.
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_name(path.name + ".tmp")
    tmp.write_text(json.dumps(obj, indent=2), encoding="utf-8")
    os.replace(tmp, path)


def _save_image(image: Image.Image, path: Path) -> None:
    """Write then rename, so a running server never serves a half-written PNG."""
    tmp = path.with_name(path.name + ".tmp")
    image.save(tmp, format="PNG")
    for attempt in range(20):
        try:
            os.replace(tmp, path)
            return
        except PermissionError:
            # Windows refuses to replace a file another process (the server) has open; wait.
            if attempt == 19:
                raise
            time.sleep(0.25)


def _write_png(path: Path, db: np.ndarray, lo: float, hi: float) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    gray = np.clip((np.nan_to_num(db, nan=lo) - lo) / ((hi - lo) or 1) * 255, 0, 255)
    alpha = np.isfinite(db) * 255
    _save_image(Image.fromarray(np.dstack([gray, alpha]).astype("uint8")), path)


def write_rgba(path: Path, rgba: np.ndarray) -> None:
    """Colors baked in: the frontend shows overlay images as they are."""
    path.parent.mkdir(parents=True, exist_ok=True)
    _save_image(Image.fromarray(rgba.astype("uint8"), "RGBA"), path)


def load_events(data_dir: Path) -> dict:
    path = Path(data_dir) / "events.json"
    if path.exists():
        return json.loads(path.read_text(encoding="utf-8"))
    return {"contract_version": CONTRACT_VERSION, "events": []}


def write_events(data_dir: Path, area_id: str, events: list[dict]) -> None:
    """Replace this area's events (C7), keep every other area's. Also writes events.geojson, the
    same events as a GeoJSON FeatureCollection that MapLibre can load directly."""
    doc = load_events(data_dir)
    doc["contract_version"] = CONTRACT_VERSION
    doc["events"] = [e for e in doc["events"] if e["area_id"] != area_id] + events
    _write_json(Path(data_dir) / "events.json", doc)
    features = [
        {
            "type": "Feature",
            "id": i,
            "geometry": e["geometry"],
            # MapLibre feature properties must be flat; the full record stays in events.json.
            "properties": {
                "id": e["id"],
                "area_id": e["area_id"],
                "category": e.get("categories", ["other"])[0],
                "categories": ",".join(e.get("categories", [])),
                "title": e["title"],
                "summary": e["summary"],
                "from": e["date_range"][0],
                "to": e["date_range"][1],
                "confidence": e["confidence"],
                "area_km2": e["area_km2"],
                "maturity": e["maturity"],
                "lon": e.get("centroid", [None, None])[0],
                "lat": e.get("centroid", [None, None])[1],
            },
        }
        for i, e in enumerate(doc["events"])
    ]
    _write_json(
        Path(data_dir) / "events.geojson", {"type": "FeatureCollection", "features": features}
    )


def write_timeseries(data_dir: Path, area_id: str, series: dict) -> dict:
    """Write one C4 time series; return its manifest reference {id, title, url}."""
    url = f"areas/{area_id}/timeseries/{series['series_id']}.json"
    _write_json(Path(data_dir) / url, {"area_id": area_id, **series})
    return {"id": series["series_id"], "title": series["title"], "url": url}


def load_manifest(data_dir: Path) -> dict:
    path = Path(data_dir) / "manifest.json"
    if path.exists():
        return json.loads(path.read_text(encoding="utf-8"))
    return {"contract_version": CONTRACT_VERSION, "areas": []}


def ingested_ids(data_dir: Path) -> set[str]:
    return {
        gid
        for area in load_manifest(data_dir)["areas"]
        for layer in area["layers"]
        for gid in layer["provenance"]["source_granules"]
    }


def _area(manifest: dict, g: Granule) -> dict:
    area_id = g.area_id
    for area in manifest["areas"]:
        if area["id"] == area_id:
            return area
    area = {
        "id": area_id,
        "title": f"Track {g.track}, frame {g.frame} ({g.pass_direction.lower()})",
        "summary": "NISAR radar backscatter over one track and frame. Every date shares the "
        "same viewing geometry, so dates can be compared.",
        "change_types": ["other"],
        "layers": [],
        "credits": [attribution(g.maturity)],
    }
    manifest["areas"].append(area)
    return area


def _layer(g: Granule, term: str, data_dir: Path, area_id: str) -> dict:
    db, step = read_db(g.path, term)
    return backscatter_layer(
        g,
        term,
        db,
        g.bounds,
        data_dir,
        area_id,
        steps=[f"read {term} from the frequency A grid", f"kept every {step}th pixel"],
        params={"decimation": step},
    )


def backscatter_layer(
    g: Granule, term, db, bounds, data_dir: Path, area_id: str, steps: list, params: dict
) -> dict:
    """Write one dB grid as a gray PNG and return its C2 layer record."""
    valid = db[np.isfinite(db)]
    if valid.size == 0:
        raise ValueError(f"{g.granule_id} {term}: no valid pixels")
    pol = term[:2]
    layer_id = f"{pol.lower()}-{g.date}"
    lo, hi = (round(float(v), 2) for v in np.percentile(valid, [2, 98]))
    url = f"areas/{area_id}/layers/{layer_id}.png"
    _write_png(data_dir / url, db, lo, hi)
    return {
        "id": layer_id,
        "title": f"{pol} backscatter, {g.date}",
        "description": f"Radar brightness in {pol} polarization on {g.date}. Brighter areas "
        "scatter more radar energy back to the satellite.",
        "kind": "image_overlay",
        "url": url,
        "bounds": list(bounds),
        "date": g.date,
        "product": g.product,
        "polarization": pol,
        "maturity": g.maturity,
        "units": "dB",
        "value_range": [lo, hi],
        "colormap": "gray",
        "synthetic": g.synthetic,
        "provenance": {
            "source_granules": [g.granule_id],
            "steps": [
                *steps,
                "converted linear power to dB",
                "stretched between the 2nd and 98th percentile",
            ],
            "params": {"term": term, **params, "stretch_percentiles": [2, 98]},
            "software": _software(),
            "attribution": attribution(g.maturity),
        },
        # Extra fields (contracts allow unknown fields): role separates backscatter from change
        # layers; stats feeds the time series.
        "role": "backscatter",
        "stats": {
            "mean_db": round(float(10 * np.log10(np.mean(10 ** (valid / 10)))), 3),
            "n_pixels": int(valid.size),
        },
    }


def _refresh_area(area: dict, data_dir: Path) -> None:
    area["layers"].sort(
        key=lambda layer: (layer.get("date") or layer["date_range"][1], layer["id"])
    )
    bounds = [layer["bounds"] for layer in area["layers"]]
    w, s = min(b[0] for b in bounds), min(b[1] for b in bounds)
    e, n = max(b[2] for b in bounds), max(b[3] for b in bounds)
    area["bbox"] = [w, s, e, n]
    area["center"] = [round((w + e) / 2, 6), round((s + n) / 2, 6)]
    area["zoom_default"] = max(0, min(14, round(math.log2(360 / max(e - w, n - s, 1e-6)))))
    area["timeseries"] = []
    backscatter = [layer for layer in area["layers"] if "stats" in layer]  # not change layers
    for pol in sorted({layer["polarization"] for layer in backscatter}):
        layers = [layer for layer in backscatter if layer["polarization"] == pol]
        title = f"Mean {pol} backscatter over the frame"
        url = f"areas/{area['id']}/timeseries/{pol.lower()}.json"
        _write_json(
            data_dir / url,
            {
                "area_id": area["id"],
                "series_id": pol.lower(),
                "title": title,
                "units": "dB",
                "polarization": pol,
                "statistic": "mean",
                "region": {
                    "type": "Polygon",
                    "coordinates": [[[w, s], [e, s], [e, n], [w, n], [w, s]]],
                },
                "points": [
                    {
                        "date": layer["date"],
                        "value": layer["stats"]["mean_db"],
                        "n_pixels": layer["stats"]["n_pixels"],
                        "granule": layer["provenance"]["source_granules"][0],
                    }
                    for layer in layers
                ],
                "maturity": min(
                    (layer["maturity"] for layer in layers), key=MATURITY_WORST_FIRST.index
                ),
                "synthetic": any(layer["synthetic"] for layer in layers),
            },
        )
        area["timeseries"].append({"id": pol.lower(), "title": title, "url": url})


def write_manifest(data_dir: Path, manifest: dict) -> None:
    manifest.update(
        contract_version=CONTRACT_VERSION,
        generated_at=datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ"),
        git_commit=_software()["commit"],
        synthetic=any(layer["synthetic"] for a in manifest["areas"] for layer in a["layers"]),
    )
    _write_json(Path(data_dir) / "manifest.json", manifest)


def ingest(path, data_dir) -> list[str]:
    """Parse one GCOV granule into layers, time series and manifest. Re-ingesting replaces its layers."""
    data_dir = Path(data_dir)
    g = open_granule(path)
    if not g.terms:
        raise ValueError(f"{g.granule_id}: no diagonal covariance terms found")
    manifest = load_manifest(data_dir)
    area = _area(manifest, g)
    new = [_layer(g, term, data_dir, area["id"]) for term in g.terms]
    ids = {layer["id"] for layer in new}
    area["layers"] = [layer for layer in area["layers"] if layer["id"] not in ids] + new
    _refresh_area(area, data_dir)
    write_manifest(data_dir, manifest)
    return sorted(ids)
