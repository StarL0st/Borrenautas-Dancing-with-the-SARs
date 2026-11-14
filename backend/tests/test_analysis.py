import json
from contextlib import contextmanager

import h5py
import numpy as np
import pytest
from fastapi.testclient import TestClient

from sars_pipeline import classify, remote
from sars_pipeline.granule import GRIDS, open_granule, read_window, to_db
from sars_pipeline.selection import choose
from sars_pipeline.server import contains, create_app
from sars_pipeline.site import run_site
from sars_pipeline.synthetic import write_synthetic

# Required C7 fields (docs/04).
EVENT = {
    "id",
    "area_id",
    "type",
    "title",
    "summary",
    "date_range",
    "geometry",
    "bbox",
    "area_km2",
    "confidence",
    "method",
    "polarization",
    "maturity",
    "layer_ids",
    "synthetic",
    "provenance",
}
CFG = classify.DEFAULTS
LAND_HH, LAND_HV = -8.0, -14.0  # dB: vegetated land


def _pair(patch_hh: float, patch_hv: float):
    """Two 64x64 dB scenes of land; the second has a 16x16 patch set to the given values."""
    rng = np.random.default_rng(0)
    hh0 = LAND_HH + rng.normal(0, 0.5, (64, 64)).astype("float32")
    hv0 = LAND_HV + rng.normal(0, 0.5, (64, 64)).astype("float32")
    hh1, hv1 = hh0.copy(), hv0.copy()
    hh1[20:36, 30:46], hv1[20:36, 30:46] = patch_hh, patch_hv
    return hh0, hv0, hh1, hv1


def test_flood_patch_is_one_flood_event():
    cls, d_hh, d_hv = classify.class_map(*_pair(-25.0, -30.0), CFG)
    [r] = classify.regions(cls, d_hh, d_hv, CFG)
    assert r["type"] == "flood_wetland"
    # The 3px smoothing may shave a pixel off the edge; the patch must be covered.
    assert r["rows"][0] <= 21 and r["rows"][1] >= 35 and r["cols"][0] <= 31 and r["cols"][1] >= 45
    assert 0 < r["confidence"] <= 1


def test_hv_only_drop_is_forest_loss():
    [r] = classify.regions(*classify.class_map(*_pair(LAND_HH - 1, LAND_HV - 6), CFG), CFG)
    assert r["type"] == "forest_loss"


def test_unchanged_pair_has_no_events():
    hh0, hv0, _, _ = _pair(0, 0)
    assert classify.regions(*classify.class_map(hh0, hv0, hh0, hv0, CFG), CFG) == []


def test_choose_never_mixes_maturity_and_prefers_pairs():
    def row(date, maturity, frame=1, version="001"):
        return {
            "id": f"G_{frame}_{date}_{version}",
            "date": date,
            "track": 1,
            "frame": frame,
            "direction": "ASCENDING",
            "maturity": maturity,
        }

    rows = [
        row("2026-10-21", "VALIDATED"),  # best maturity, but a single date
        row("2026-09-27", "PROVISIONAL"),
        row("2026-10-09", "PROVISIONAL"),
        row("2026-10-09", "PROVISIONAL", version="002"),  # reprocessed: newer wins
        row("2026-10-09", "BETA", frame=2),
    ]
    pick = choose(rows)
    assert pick["maturity"] == "PROVISIONAL" and pick["frame"] == 1
    assert [g["id"] for g in pick["granules"]] == ["G_1_2026-09-27_001", "G_1_2026-10-09_002"]


def test_read_window_crops_and_multilooks(tmp_path):
    path = write_synthetic(tmp_path / "g.h5", "2026-01-01")
    g = open_granule(path)
    w_, s, e, n = g.bounds
    half = [w_, s, (w_ + e) / 2, n]  # west half of the grid
    with h5py.File(path) as f:
        win = read_window(f, g, half, looks=2)
    assert win.power["HHHH"].shape == (32, 16)
    assert win.bounds[2] < e


@pytest.fixture
def flood_site(tmp_path, monkeypatch):
    """Two synthetic granules on one grid; the second floods a 16x16 patch."""
    rows = []
    for i, date in enumerate(["2026-01-01", "2026-01-13"]):
        path = write_synthetic(tmp_path / f"{date}.h5", date)
        with h5py.File(path, "r+") as f:
            grids = f[GRIDS]
            hh = np.full((64, 64), 10 ** (LAND_HH / 10), "float32")
            hv = np.full((64, 64), 10 ** (LAND_HV / 10), "float32")
            if i:
                hh[20:36, 30:46], hv[20:36, 30:46] = 10**-2.5, 10**-3.0
            grids["HHHH"][...], grids["HVHV"][...] = hh, hv
        g = open_granule(path)
        rows.append({"id": g.granule_id, "url": str(path), "maturity": "OTHER", "date": date})

    @contextmanager
    def open_local(url):
        with h5py.File(url) as f:
            yield f

    monkeypatch.setattr(remote, "open_remote", open_local)
    site = {
        "title": "Synthetic flood",
        "summary": "Synthetic test site.",
        "bbox": list(g.bounds),
        "change_types": ["flood_wetland"],
        "looks": 1,
    }
    out = tmp_path / "out"
    result = run_site(
        "synth", site, out, tmp_path / "interim", {"maturity": "OTHER", "granules": rows}
    )
    return out, result


def test_run_site_writes_flood_event(flood_site):
    out, result = flood_site
    assert result["events"] == 1
    [event] = json.loads((out / "events.json").read_text())["events"]
    assert EVENT <= event.keys() and event["type"] == "flood_wetland" and event["synthetic"]
    manifest = json.loads((out / "manifest.json").read_text())
    layer_ids = {layer["id"] for layer in manifest["areas"][0]["layers"]}
    assert set(event["layer_ids"]) <= layer_ids
    for layer in manifest["areas"][0]["layers"]:
        assert (out / layer["url"]).exists()


def test_query_finds_event_at_point_and_in_box(flood_site):
    out, _ = flood_site
    [event] = json.loads((out / "events.json").read_text())["events"]
    w, s, e, n = event["bbox"]
    lon, lat = (w + e) / 2, (s + n) / 2
    assert contains(event["geometry"], lon, lat) and not contains(event["geometry"], e + 1, lat)
    with TestClient(create_app(out, poll_seconds=60)) as client:
        hit = client.get("/query", params={"lat": lat, "lon": lon}).json()
        assert [x["id"] for x in hit["events"]] == [event["id"]] and hit["area_ids"]
        assert client.get("/query", params={"lat": lat, "lon": e + 1}).json()["events"] == []
        box = client.get("/query", params={"bbox": f"{w},{s},{e},{n}", "type": "forest_loss"})
        assert box.json()["events"] == []
        assert client.get("/query", params={"bbox": "1,2"}).status_code == 400
        assert client.get("/events.json").json()["events"][0]["id"] == event["id"]


def test_to_db_marks_nodata():
    assert np.isnan(to_db(np.array([0.0, np.nan], "float32"))).all()
