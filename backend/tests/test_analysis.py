import json
from contextlib import contextmanager

import h5py
import numpy as np
import pytest
from fastapi.testclient import TestClient

from sars_pipeline import categorize, classify, firms, gunw, live, remote
from sars_pipeline.granule import GRIDS, IDENT, open_granule, read_window, to_db
from sars_pipeline.selection import choose
from sars_pipeline.server import contains, create_app
from sars_pipeline.site import run_site
from sars_pipeline.sites import add_site, bbox_around, load_sites
from sars_pipeline.sme2 import GRIDS as SM_GRIDS
from sars_pipeline.sme2 import read_sm
from sars_pipeline.synthetic import write_synthetic

# Required C7 fields (docs/04), including the 0.3.0 additions.
EVENT = {
    "id",
    "area_id",
    "type",
    "categories",
    "signature",
    "title",
    "summary",
    "date_range",
    "geometry",
    "bbox",
    "centroid",
    "area_km2",
    "confidence",
    "method",
    "polarization",
    "maturity",
    "layer_ids",
    "evidence",
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


def test_flood_patch_is_one_darkening_region():
    sig, d_hh, d_hv = classify.signature_map(*_pair(-25.0, -30.0), CFG)
    [r] = classify.regions(sig, d_hh, d_hv, CFG)
    assert r["signature"] == "darkening_both"
    rows, cols = np.nonzero(r["mask"])
    # The 3px smoothing may shave a pixel off the edge; the patch must be covered.
    assert rows.min() <= 21 and rows.max() >= 34 and cols.min() <= 31 and cols.max() >= 44
    assert 0 < r["confidence"] <= 1


def test_hv_only_drop_and_brightening():
    [r] = classify.regions(*classify.signature_map(*_pair(LAND_HH - 1, LAND_HV - 6), CFG), CFG)
    assert r["signature"] == "hv_drop"
    [r] = classify.regions(*classify.signature_map(*_pair(LAND_HH + 8, LAND_HV + 1), CFG), CFG)
    assert r["signature"] == "brightening"


def test_unchanged_pair_has_no_regions():
    hh0, hv0, _, _ = _pair(0, 0)
    assert classify.regions(*classify.signature_map(hh0, hv0, hh0, hv0, CFG), CFG) == []


def test_decision_table():
    V, B, U, W = categorize.VEGETATION, categorize.BARE, categorize.URBAN, categorize.WATER
    assert categorize.decide("darkening_both", V, W) == ["floods"]
    assert categorize.decide("darkening_both", W, W) == []  # water stays water: no flood
    assert categorize.decide("hv_drop", V, B) == ["deforestation"]
    assert categorize.decide("hv_drop", V, B, fires=3) == ["wildfires", "deforestation"]
    assert categorize.decide("hv_drop", B, B) == ["agriculture"]
    assert categorize.decide("brightening", B, U) == ["urban"]
    assert categorize.decide("sinking", U, U) == ["subsidence", "groundwater"]
    assert categorize.decide("soil_drying", 0, 0) == ["drought"]
    assert categorize.decide("strong_change", V, V) == ["other"]


def test_cover_map_classes():
    hh = np.array([[-25.0, -5.0, -9.0, -12.0]])
    hv = np.array([[-30.0, -14.0, -15.0, -22.0]])
    assert categorize.cover_map(hh, hv, CFG).tolist() == [
        [categorize.WATER, categorize.URBAN, categorize.VEGETATION, categorize.BARE]
    ]


def test_outline_is_real_shape_with_centroid_inside():
    mask = np.zeros((20, 20), bool)
    mask[2:10, 2:6] = True
    mask[6:10, 2:16] = True  # an L shape: its bbox center is outside it
    x = 500_000 + 40 * np.arange(20) + 20.0
    y = 2_000_000 - 40 * np.arange(20) - 20.0
    o = categorize.outline(mask, x, y, 32614)
    assert o["geometry"]["type"] == "Polygon"
    assert len(o["geometry"]["coordinates"][0]) > 5  # not a box
    assert contains(o["geometry"], *o["centroid"])
    assert abs(o["area_km2"] - mask.sum() * 0.04 * 0.04) < 1e-3  # rounded to 3 decimals


def test_choose_never_mixes_maturity_and_prefers_series():
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
        row("2026-10-21", "VALIDATED"),
        row("2026-10-09", "VALIDATED"),  # best maturity, but only two dates
        *(row(f"2026-0{m}-01", "PROVISIONAL") for m in (6, 7, 8)),
        row("2026-09-27", "PROVISIONAL"),
        row("2026-09-27", "PROVISIONAL", version="002"),  # reprocessed: newer wins
        row("2026-10-09", "BETA", frame=2),
    ]
    pick = choose(rows)
    assert pick["maturity"] == "PROVISIONAL" and pick["frame"] == 1
    assert [g["id"] for g in pick["granules"]][-1] == "G_1_2026-09-27_002"
    assert choose(rows, min_dates=2)["maturity"] == "VALIDATED"
    assert choose([]) is None


def test_gunw_pair_dates_mask_and_chain():
    gid = "NISAR_L2_PR_GUNW_032_113_D_079_033_4000_SH_20261008T011329_20261008T011403_20261020T011329_20261020T011403_P05023_N_F_J_001"
    assert gunw.pair_dates(gid) == ("2026-10-08", "2026-10-20")
    valid, water = gunw.valid_mask(np.array([111, 11, 101, 255, 11 | (5 << 8)], "uint32"))
    assert valid.tolist() == [True, True, False, False, True]
    assert water.tolist() == [True, False, True, False, False]
    pairs = [
        {"ref_date": "2026-09-14", "sec_date": "2026-09-26"},
        {"ref_date": "2026-09-26", "sec_date": "2026-10-08"},
        {"ref_date": "2026-10-08", "sec_date": "2026-10-20"},
        {"ref_date": "2026-08-01", "sec_date": "2026-08-13"},  # not connected
    ]
    assert [p["sec_date"] for p in gunw.chain(pairs)] == ["2026-09-26", "2026-10-08", "2026-10-20"]


def test_gunw_reference_keeps_main_component():
    class P:
        los_m = np.array([[1.0, 2.0, 50.0], [1.0, 3.0, 50.0]], "float32")
        component = np.array([[1, 1, 2], [1, 1, 2]])

    ref = np.array([[True, False, False], [True, False, False]])
    out = gunw.reference(P, ref)
    assert out[0, 0] == 0 and out[0, 1] == 1 and np.isnan(out[0, 2])


def _write_sme2(path, date, value):
    with h5py.File(path, "w") as f:
        ident = f.create_group(IDENT)
        ident["granuleId"] = f"SYNTHETIC_SME2_{date}"
        ident["zeroDopplerStartTime"] = f"{date}T00:00:00"
        g = f.create_group(SM_GRIDS)
        sm = np.full((10, 10), value, "float32")
        sm[0, 0] = -9999.0
        flag = np.zeros((10, 10), "int16")
        flag[1, 1] = 1  # not recommended
        g["soilMoisture"], g["retrievalQualityFlag"] = sm, flag
        g["projection"] = np.uint32(6933)
        g["projection"].attrs["epsg_code"] = 6933
        g["xCoordinates"] = -9_000_000 + 200.0 * np.arange(10) + 100
        g["yCoordinates"] = 2_000_000 - 200.0 * np.arange(10) - 100


def test_read_sm_masks_fill_and_not_recommended(tmp_path):
    _write_sme2(tmp_path / "s.h5", "2026-10-01", 0.3)
    with h5py.File(tmp_path / "s.h5") as f:
        sm = read_sm(f, [-180, -90, 180, 90], "PROVISIONAL")
    assert sm.date == "2026-10-01" and np.isnan(sm.sm[0, 0]) and np.isnan(sm.sm[1, 1])
    assert np.nanmean(sm.sm) == pytest.approx(0.3)


def test_firms_parse_and_count():
    spots = firms.parse("latitude,longitude,acq_date\n19.4,-99.1,2026-10-01\n10,10,2026-10-01\n")
    assert len(spots) == 2 and firms.count_in(spots, [-99.2, 19.3, -99.0, 19.5]) == 1


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
    sel = {"products": {"GCOV": {"maturity": "OTHER", "granules": rows}}}
    result = run_site("synth", site, out, tmp_path / "interim", sel)
    return out, result


def test_run_site_writes_flood_event_and_geojson(flood_site):
    out, result = flood_site
    assert result["events"] == 1 and result["categories"] == {"floods": 1}
    [event] = json.loads((out / "events.json").read_text())["events"]
    assert EVENT <= event.keys() and event["categories"] == ["floods"]
    assert event["synthetic"] and event["evidence"]["surface_before"] == "vegetation"
    assert [p["date"] for p in event["series"]["HH"]] == ["2026-01-01", "2026-01-13"]
    manifest = json.loads((out / "manifest.json").read_text())
    [area] = manifest["areas"]
    assert area["id"] == "synth" and area["categories"] == ["floods"] and manifest["synthetic"]
    assert set(event["layer_ids"]) <= {layer["id"] for layer in area["layers"]}
    for layer in area["layers"]:
        assert (out / layer["url"]).exists() and layer["group"]
    geo = json.loads((out / "events.geojson").read_text())
    [feature] = geo["features"]
    assert feature["properties"]["category"] == "floods"
    assert feature["properties"]["lon"] == event["centroid"][0]


def test_query_finds_event_at_point_and_by_category(flood_site):
    out, _ = flood_site
    [event] = json.loads((out / "events.json").read_text())["events"]
    lon, lat = event["centroid"]
    e = event["bbox"][2]
    with TestClient(create_app(out, poll_seconds=60)) as client:
        hit = client.get("/query", params={"lat": lat, "lon": lon}).json()
        assert [x["id"] for x in hit["events"]] == [event["id"]] and hit["area_ids"] == ["synth"]
        assert client.get("/query", params={"lat": lat, "lon": e + 1}).json()["events"] == []
        box = ",".join(map(str, event["bbox"]))
        assert client.get("/query", params={"bbox": box, "category": "floods"}).json()["events"]
        assert (
            client.get("/query", params={"bbox": box, "category": "urban"}).json()["events"] == []
        )
        assert client.get("/query", params={"bbox": "1,2"}).status_code == 400
        assert client.get("/events.geojson").status_code == 200
        assert client.get("/sites").status_code == 404  # read-only without --jobs


def test_sites_api_queues_and_processes(tmp_path):
    done = []

    def fake_refresh(site_id, site, data, force):
        done.append((site_id, site["bbox"]))
        return {"site": site_id, "status": "updated"}

    jobs = live.Jobs(tmp_path, refresh=fake_refresh)
    with TestClient(create_app(tmp_path / "processed", jobs=jobs, admin_token="s3cret")) as c:
        assert c.post("/sites", json={"lat": 19.43, "lon": -99.13}).status_code == 401
        auth = {"Authorization": "Bearer s3cret"}
        res = c.post("/sites", json={"lat": 19.43, "lon": -99.13, "km": 10}, headers=auth)
        assert res.status_code == 202
        site_id = res.json()["id"]
        assert jobs.wait_idle()
        assert done and done[0][0] == site_id
        sites = {s["id"]: s for s in c.get("/sites").json()["sites"]}
        assert sites[site_id]["status"] == "done" and sites[site_id]["requested"]
        too_big = c.post("/sites", json={"lat": 0, "lon": 0, "km": 500}, headers=auth)
        assert too_big.status_code == 422
        assert c.post("/sites/nope/refresh", headers=auth).status_code == 404


def test_refresh_skips_when_nothing_new(tmp_path, monkeypatch):
    sel = {"products": {"GCOV": {"granules": [{"id": "A"}]}}}
    (tmp_path / "selected").mkdir()
    (tmp_path / "selected" / "x.json").write_text(json.dumps(sel))
    (tmp_path / "processed").mkdir()
    (tmp_path / "processed" / "manifest.json").write_text(json.dumps({"areas": [{"id": "x"}]}))
    monkeypatch.setattr(live, "select_site", lambda *a: sel)
    assert live.refresh_site("x", {}, tmp_path)["status"] == "unchanged"


def test_add_site_validates_and_writes(tmp_path):
    path = tmp_path / "sites.json"
    bbox = bbox_around(-99.13, 19.43, 20)
    assert bbox[0] < -99.13 < bbox[2] and abs((bbox[3] - bbox[1]) * 111.32 - 20) < 0.01
    site = {"title": "T", "summary": "", "bbox": bbox, "change_types": ["other"], "looks": 4}
    add_site("x", site, path)
    assert load_sites(path, requested=None)["x"]["bbox"] == bbox
    with pytest.raises(ValueError, match="exists"):
        add_site("x", site, path)
    with pytest.raises(ValueError, match="change_types"):
        add_site("y", {**site, "change_types": ["volcano"]}, path)
    with pytest.raises(ValueError, match="west,south"):
        add_site("y", {**site, "bbox": [1, 2, 0, 3]}, path)
    with pytest.raises(ValueError, match="products"):
        add_site("y", {**site, "products": ["XYZ"]}, path)


def test_to_db_marks_nodata():
    assert np.isnan(to_db(np.array([0.0, np.nan], "float32"))).all()
