import json

from sars_pipeline import livefeeds as lf

EONET = {
    "events": [
        {
            "id": "EONET_1",
            "title": "Wildfire Red Hill",
            "link": "https://eonet.gsfc.nasa.gov/api/v3/events/EONET_1",
            "categories": [{"id": "wildfires"}],
            "sources": [{"id": "IRWIN", "url": "https://irwin.example/1"}],
            "geometry": [
                {"date": "2026-11-10T00:00:00Z", "type": "Point", "coordinates": [-89.0, 31.0]},
                {
                    "date": "2026-11-12T00:00:00Z",
                    "type": "Point",
                    "coordinates": [-89.1, 31.1],
                    "magnitudeValue": 519.0,
                    "magnitudeUnit": "acres",
                },
            ],
        },
        {
            "id": "EONET_2",
            "title": "Flood in Guatemala",
            "categories": [{"id": "floods"}],
            "sources": [{"id": "GDACS"}],
            "geometry": [{"date": "2026-10-17", "type": "Point", "coordinates": [-90, 15]}],
        },
        {
            "id": "EONET_3",
            "title": "Hurricane X",
            "categories": [{"id": "severeStorms"}],
            "sources": [{"id": "NOAA_NHC"}],
            "geometry": [
                {
                    "date": "2026-10-30",
                    "type": "Polygon",
                    "coordinates": [[[0, 0], [2, 0], [2, 2], [0, 2]]],
                }
            ],
        },
    ]
}

USGS = {
    "features": [
        {
            "id": "us7000abcd",
            "properties": {
                "mag": 5.2,
                "time": 1763100000000,
                "title": "M 5.2 - Oaxaca",
                "url": "u",
            },
            "geometry": {"type": "Point", "coordinates": [-96.7, 16.1, 35.0]},
        }
    ]
}

GDACS = {
    "features": [
        {
            "properties": {
                "eventtype": "EQ",
                "eventid": 1,
                "name": "Earthquake",
                "fromdate": "2026-11-14T18:04",
            },
            "geometry": {"type": "Point", "coordinates": [0, 0]},
        },
        {
            "properties": {
                "eventtype": "TC",
                "eventid": 7,
                "severitydata": {"severity": 2, "severitytext": "Category 2"},
                "name": "Tropical Cyclone Y",
                "fromdate": "2026-11-13T00:00:00",
                "alertlevel": "Orange",
                "url": {"report": "https://www.gdacs.org/report.aspx?eventid=7"},
            },
            "geometry": {"type": "Point", "coordinates": [-105.0, 18.0]},
        },
    ]
}

FIRMS = (
    "latitude,longitude,bright_ti4,scan,track,acq_date,acq_time,satellite,confidence\n"
    "19.5,-99.1,330.1,0.4,0.4,2026-11-14,0815,N20,n\n"
)


def test_eonet_latest_position_and_skips_gdacs_only():
    out = lf.parse_eonet(EONET, {"GDACS"})
    assert [f["properties"]["id"] for f in out] == ["eonet-EONET_1", "eonet-EONET_3"]
    fire = out[0]["properties"]
    assert fire["category"] == "wildfires"
    assert (fire["lon"], fire["lat"], fire["date"]) == (-89.1, 31.1, "2026-11-12")
    assert (
        fire["detail"] == "519 acres · Reported by IRWIN"
        and fire["url"] == "https://irwin.example/1"
    )
    storm = out[1]
    assert storm["properties"]["category"] == "storms"
    assert storm["geometry"]["coordinates"] == [1.0, 1.0]  # polygon -> its mean point


def test_usgs():
    (f,) = lf.parse_usgs(USGS)
    p = f["properties"]
    assert p["category"] == "earthquakes" and p["title"] == "M 5.2 - Oaxaca"
    assert "depth 35 km" in p["detail"] and p["date"].endswith("Z")
    assert f["geometry"]["coordinates"] == [-96.7, 16.1]  # depth dropped


def test_gdacs_leaves_earthquakes_to_usgs():
    (f,) = lf.parse_gdacs(GDACS)
    p = f["properties"]
    assert (p["category"], p["date"]) == ("storms", "2026-11-13")
    assert p["detail"] == "Orange alert · Category 2"


def test_gdacs_uses_latest_update_and_drops_empty_severity():
    data = {
        "features": [
            {
                "properties": {
                    "eventtype": "FL",
                    "eventid": 3,
                    "name": "Flood in Mexico",
                    "fromdate": "2026-08-17T00:00:00",
                    "todate": "2026-11-12T00:00:00",
                    "alertlevel": "Green",
                    "severitydata": {"severity": 0, "severitytext": "Magnitude 0"},
                },
                "geometry": {"type": "Point", "coordinates": [-97, 19]},
            }
        ]
    }
    (f,) = lf.parse_gdacs(data)
    assert f["properties"]["date"] == "2026-11-12"
    assert f["properties"]["detail"] == "Green alert · since 2026-08-17"


def test_nhc():
    data = {
        "activeStorms": [
            {
                "id": "ep132026",
                "name": "Vance",
                "classification": "HU",
                "intensity": "85",
                "latitudeNumeric": 17.5,
                "longitudeNumeric": -104.2,
                "lastUpdate": "2026-10-30T15:00:00.000Z",
            },
            {"id": "bad"},  # no position: skipped
        ]
    }
    (f,) = lf.parse_nhc(data)
    assert f["properties"]["title"] == "Hurricane Vance"
    assert f["properties"]["detail"] == "Hurricane, winds 85 kt"


def test_firms():
    (f,) = lf.parse_firms(FIRMS, "VIIRS_NOAA20_NRT")
    p = f["properties"]
    assert p["date"] == "2026-11-14T08:15Z" and "NOAA20" in p["detail"]
    assert "nominal" in p["detail"]


def test_collect_keeps_going_when_a_feed_fails(tmp_path, monkeypatch):
    monkeypatch.delenv("FIRMS_MAP_KEY", raising=False)
    payloads = {
        lf.SOURCES["usgs"]["url"]: json.dumps(USGS).encode(),
        lf.SOURCES["eonet"]["url"]: json.dumps(EONET).encode(),
        lf.SOURCES["nhc"]["url"]: b'{"activeStorms": []}',
    }

    def get(url):
        if url not in payloads:
            raise OSError("offline")
        return payloads[url]

    doc = lf.write(tmp_path, lf.fetchers(get))
    status = {s["id"]: s for s in doc["sources"]}
    assert status["usgs"]["ok"] and status["usgs"]["count"] == 1
    assert not status["gdacs"]["ok"] and "offline" in status["gdacs"]["error"]
    assert not status["firms"]["ok"] and "FIRMS_MAP_KEY" in status["firms"]["error"]
    assert status["eonet"]["count"] == 2
    dates = [f["properties"]["date"] for f in doc["features"]]
    assert dates == sorted(dates, reverse=True)
    on_disk = json.loads((tmp_path / "live.geojson").read_text())
    assert on_disk["type"] == "FeatureCollection" and len(on_disk["features"]) == 3
    assert all(f["properties"]["credit"] for f in on_disk["features"])


def test_gdacs_fires_get_their_own_pages():
    """Fires alone fill a page; cyclones and floods must still come through."""

    def page(kind, start, n):
        return [
            {
                "properties": {"eventtype": kind, "eventid": start + i, "name": f"{kind} {i}"},
                "geometry": {"type": "Point", "coordinates": [0, 0]},
            }
            for i in range(n)
        ]

    asked = []

    def get(url):
        asked.append(url)
        if "eventlist=WF" in url:
            n = int(url.split("pagenumber=")[1])
            return json.dumps({"features": page("WF", 1000 * n, 100 if n < 3 else 7)}).encode()
        return json.dumps({"features": page("TC", 0, 5) + page("FL", 100, 31)}).encode()

    out = lf.fetchers(get)["gdacs"]()
    cats = [f["properties"]["category"] for f in out]
    assert cats.count("storms") == 5 and cats.count("floods") == 31
    assert cats.count("wildfires") == 207
    assert sum("eventlist=WF" in u for u in asked) == 3
