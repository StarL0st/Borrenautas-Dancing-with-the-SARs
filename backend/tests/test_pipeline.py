import json

import numpy as np
import pytest
from fastapi.testclient import TestClient
from PIL import Image

from sars_pipeline.export import ingest, load_manifest
from sars_pipeline.granule import open_granule
from sars_pipeline.server import create_app, scan_inbox
from sars_pipeline.synthetic import write_synthetic

# Required fields from docs/04 (C1 manifest, Area, C2 layer, C3 provenance, C4 time series).
MANIFEST = {"contract_version", "generated_at", "git_commit", "synthetic", "areas"}
AREA = {
    "id",
    "title",
    "summary",
    "change_types",
    "bbox",
    "center",
    "zoom_default",
    "layers",
    "credits",
}
LAYER = {
    "id",
    "title",
    "description",
    "kind",
    "url",
    "bounds",
    "product",
    "polarization",
    "maturity",
    "units",
    "value_range",
    "colormap",
    "synthetic",
    "provenance",
}
PROVENANCE = {"source_granules", "steps", "params", "software", "attribution"}
SERIES = {
    "area_id",
    "series_id",
    "title",
    "units",
    "polarization",
    "statistic",
    "region",
    "points",
    "maturity",
    "synthetic",
}


@pytest.fixture
def granules(tmp_path):
    return [
        write_synthetic(tmp_path / "in" / "b.h5", "2026-01-13", growth=1.0),
        write_synthetic(tmp_path / "in" / "a.h5", "2026-01-01"),
    ]


def test_open_granule_reads_metadata(granules):
    g = open_granule(granules[1])
    assert (g.product, g.date, g.track, g.frame) == ("GCOV", "2026-01-01", 1, 1)
    assert g.terms == ("HHHH", "HVHV")
    assert g.synthetic and g.maturity == "OTHER"
    w, s, e, n = g.bounds
    assert -180 < w < e < 180 and -90 < s < n < 90


def test_ingest_writes_contract_files(granules, tmp_path):
    out = tmp_path / "out"
    for path in granules:
        ingest(path, out)
    manifest = load_manifest(out)
    assert MANIFEST <= manifest.keys() and manifest["synthetic"] is True
    [area] = manifest["areas"]
    assert AREA <= area.keys()
    assert [layer["id"] for layer in area["layers"]] == [
        "hh-2026-01-01",
        "hv-2026-01-01",
        "hh-2026-01-13",
        "hv-2026-01-13",
    ]
    for layer in area["layers"]:
        assert LAYER <= layer.keys() and PROVENANCE <= layer["provenance"].keys()
        png = Image.open(out / layer["url"])
        assert png.mode == "LA" and max(png.size) <= 2048
        assert np.asarray(png)[0, 0, 1] == 0  # nodata corner is transparent

    series = json.loads((out / area["timeseries"][0]["url"]).read_text())
    assert SERIES <= series.keys()
    assert [p["date"] for p in series["points"]] == ["2026-01-01", "2026-01-13"]
    assert series["points"][1]["value"] > series["points"][0]["value"]  # blob grew: brighter mean

    ingest(granules[0], out)  # re-ingest replaces, never duplicates
    assert len(load_manifest(out)["areas"][0]["layers"]) == 4


def test_scan_inbox_ingests_once_and_skips_bad_files(granules, tmp_path):
    inbox, out, failed = granules[0].parent, tmp_path / "out", {}
    (inbox / "broken.h5").write_bytes(b"not hdf5")
    assert len(scan_inbox(inbox, out, failed)) == 4
    assert "broken.h5" in failed
    assert scan_inbox(inbox, out, failed) == []


def test_server_serves_contract_files(granules, tmp_path):
    out = tmp_path / "out"
    ingest(granules[1], out)
    with TestClient(create_app(out, poll_seconds=60)) as client:
        assert client.get("/health").json() == {"ok": True}
        res = client.get("/manifest.json", headers={"Origin": "http://localhost:5173"})
        assert res.status_code == 200 and res.json()["areas"][0]["id"] == "t001-f001-a"
        assert res.headers["access-control-allow-origin"] == "*"
        assert client.get("/areas/t001-f001-a/layers/hh-2026-01-01.png").status_code == 200
        assert client.get("/../pyproject.toml").status_code == 404
