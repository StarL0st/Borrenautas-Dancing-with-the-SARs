"""Turn granules into contract files (docs/04): layer PNGs, time series JSON, manifest.json."""

import json
import math
import os
import subprocess
from datetime import UTC, datetime
from functools import cache
from importlib.metadata import version
from pathlib import Path

import numpy as np
from PIL import Image

from .granule import Granule, open_granule, read_db

CONTRACT_VERSION = "0.1.0"
# shortcut: provisional credit line; replace with ASF's official NISAR citation (docs/03 VERIFY).
ATTRIBUTION = "NISAR data: NASA/JPL-Caltech and ISRO, distributed by ASF DAAC"
MATURITY_WORST_FIRST = ["OTHER", "BETA", "PROVISIONAL"]


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
        commit = "unknown"
    return {"name": "sars-pipeline", "version": version("sars-pipeline"), "commit": commit}


def _write_json(path: Path, obj) -> None:
    # Write then rename so the server never serves a half-written file.
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_name(path.name + ".tmp")
    tmp.write_text(json.dumps(obj, indent=2), encoding="utf-8")
    os.replace(tmp, path)


def _write_png(path: Path, db: np.ndarray, lo: float, hi: float) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    gray = np.clip((np.nan_to_num(db, nan=lo) - lo) / ((hi - lo) or 1) * 255, 0, 255)
    alpha = np.isfinite(db) * 255
    Image.fromarray(np.dstack([gray, alpha]).astype("uint8")).save(path)


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
    # One area per track/frame/pass: same viewing geometry, so its dates are comparable (F02 edge cases).
    area_id = f"t{g.track:03d}-f{g.frame:03d}-{g.pass_direction[:1].lower()}"
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
        "credits": [ATTRIBUTION],
    }
    manifest["areas"].append(area)
    return area


def _layer(g: Granule, term: str, data_dir: Path, area_id: str) -> dict:
    db, step = read_db(g.path, term)
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
        "bounds": list(g.bounds),
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
                f"read {term} from the frequency A grid",
                f"kept every {step}th pixel",
                "converted linear power to dB",
                "stretched between the 2nd and 98th percentile",
            ],
            "params": {"term": term, "decimation": step, "stretch_percentiles": [2, 98]},
            "software": _software(),
            "attribution": ATTRIBUTION,
        },
        # Extra field (contracts allow unknown fields): feeds the time series.
        "stats": {
            "mean_db": round(float(10 * np.log10(np.mean(10 ** (valid / 10)))), 3),
            "n_pixels": int(valid.size),
        },
    }


def _refresh_area(area: dict, data_dir: Path) -> None:
    area["layers"].sort(key=lambda layer: (layer["date"], layer["id"]))
    bounds = [layer["bounds"] for layer in area["layers"]]
    w, s = min(b[0] for b in bounds), min(b[1] for b in bounds)
    e, n = max(b[2] for b in bounds), max(b[3] for b in bounds)
    area["bbox"] = [w, s, e, n]
    area["center"] = [round((w + e) / 2, 6), round((s + n) / 2, 6)]
    area["zoom_default"] = max(0, min(14, round(math.log2(360 / max(e - w, n - s, 1e-6)))))
    area["timeseries"] = []
    for pol in sorted({layer["polarization"] for layer in area["layers"]}):
        layers = [layer for layer in area["layers"] if layer["polarization"] == pol]
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
    manifest.update(
        contract_version=CONTRACT_VERSION,
        generated_at=datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ"),
        git_commit=_software()["commit"],
        synthetic=any(layer["synthetic"] for a in manifest["areas"] for layer in a["layers"]),
    )
    _write_json(data_dir / "manifest.json", manifest)
    return sorted(ids)
