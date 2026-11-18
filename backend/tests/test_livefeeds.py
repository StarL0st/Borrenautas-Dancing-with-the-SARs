import json
from datetime import UTC, datetime, timedelta

from sars_pipeline import livefeeds as lf

EONET = {
    "events": [
        {
            "id": "EONET_1",
            "title": "Wildfire Red Hill, Perry, Mississippi",
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
                "place": "15 km S of Oaxaca, Mexico",
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
    assert fire["place"] == "Perry, Mississippi"
    storm = out[1]
    assert storm["properties"]["category"] == "hurricanes"  # told apart by its title
    assert storm["properties"]["active"] and storm["properties"]["severity"] == 2
    assert storm["geometry"]["coordinates"] == [1.0, 1.0]  # polygon -> its mean point


def test_usgs():
    (f,) = lf.parse_usgs(USGS)
    p = f["properties"]
    assert p["category"] == "earthquakes" and p["title"] == "Magnitude 5.2 earthquake"
    assert p["place"] == "15 km S of Oaxaca, Mexico"
    assert "depth 35 km" in p["detail"] and p["date"].endswith("Z")
    assert f["geometry"]["coordinates"] == [-96.7, 16.1]  # depth dropped


def test_gdacs_leaves_earthquakes_to_usgs():
    (f,) = lf.parse_gdacs(GDACS)
    p = f["properties"]
    assert (p["category"], p["date"]) == ("hurricanes", "2026-11-13T00:00Z")
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
    assert f["properties"]["date"] == "2026-11-12T00:00Z"
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

    # An hour after the test earthquake: it is recent; the open EONET events stay as active.
    now = datetime.fromtimestamp(USGS["features"][0]["properties"]["time"] / 1000 + 3600, UTC)
    doc = lf.write(tmp_path, lf.fetchers(get), now=now)
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
    assert cats.count("hurricanes") == 5 and cats.count("floods") == 31
    assert cats.count("wildfires") == 207
    assert sum("eventlist=WF" in u for u in asked) == 3


def test_every_event_says_where():
    assert lf.place_from_title("Flood in Guatemala") == "Guatemala"
    assert lf.place_from_title("Wildfire Red Hill, Perry, Mississippi") == "Perry, Mississippi"
    assert lf.place_from_title("Iceberg A23A") == ""
    names = [{"countryname": n} for n in ("Mexico", "Guatemala", "Belize", "Honduras", "Cuba")]
    assert lf.countries({"affectedcountries": names}) == "Mexico, Guatemala, Belize and 2 more"
    assert lf.countries({"country": "Mexico"}) == "Mexico"
    (storm,) = lf.parse_nhc(
        {
            "activeStorms": [
                {
                    "id": "al01",
                    "name": "A",
                    "binNumber": "AT1",
                    "latitudeNumeric": 20,
                    "longitudeNumeric": -90,
                }
            ]
        }
    )
    assert storm["properties"]["place"] == "Atlantic Ocean"
    (fire,) = lf.parse_firms(FIRMS, "VIIRS_NOAA20_NRT")
    assert fire["properties"]["place"] == ""  # the app shows coordinates instead


def test_firms_keeps_the_last_24_hours_across_the_utc_day_change(monkeypatch):
    now = datetime.now(UTC)
    rows = "latitude,longitude,acq_date,acq_time,confidence\n" + "".join(
        f"20.{i},-103.{i},{t:%Y-%m-%d},{t:%H%M},n\n"
        for i, t in enumerate((now - timedelta(hours=2), now - timedelta(hours=30)))
    )
    asked = []

    def get(url):
        asked.append(url)
        return rows.encode()

    monkeypatch.setenv("FIRMS_MAP_KEY", "k")
    got = lf.fetchers(get)["firms"]()
    assert len(got) == 2  # the 2-hour-old fire from each satellite; the 30-hour-old ones dropped
    assert all(u.endswith("/2") for u in asked)  # 2 UTC days, never only "today"
    assert lf.collect({}, minutes=5)["refresh_minutes"] == 5


def test_usgs_keeps_felt_quakes_and_other_kinds():
    def row(i, kind, mag, tsunami=0):
        props = {"type": kind, "mag": mag, "time": 1_794_000_000_000, "tsunami": tsunami}
        return {"id": f"u{i}", "properties": props, "geometry": {"coordinates": [0, 0, 10]}}

    rows = [
        row(1, "earthquake", 1.9),  # too small: left out
        row(2, "earthquake", 6.1, tsunami=1),
        row(3, "quarry blast", 1.5),
        row(4, "sonic boom", 2.0),  # a kind with no filter type: left out
    ]
    quake, blast = (f["properties"] for f in lf.parse_usgs({"features": rows}))
    assert (quake["category"], quake["severity"]) == ("earthquakes", 2)
    assert "Tsunami possible" in quake["detail"]
    assert (blast["category"], blast["severity"]) == ("induced-seismicity", 0)
    assert lf.quake_severity(7.2) == 3 and lf.quake_severity(5.0, 1) == 2


def test_nws_alerts_get_a_type_a_place_and_stay_while_in_force():
    def alert(i, event, zone, sent="2026-11-14T10:00:00-06:00"):
        props = {"id": f"a{i}", "event": event, "sent": sent, "severity": "Severe"}
        props |= {"affectedZones": [zone], "areaDesc": "A; B; C; D", "headline": "h"}
        return {"properties": props}

    land = "https://api.weather.gov/zones/forecast/TXZ001"
    data = {
        "features": [
            alert(1, "Freeze Warning", land),
            alert(2, "Dense Fog Advisory", land),  # routine: no type
            alert(3, "Gale Warning", "https://api.weather.gov/zones/forecast/GMZ001"),  # at sea
            alert(4, "Tornado Watch", land, "2026-11-14T11:00:00-06:00"),
        ]
    }
    watch, freeze = (f["properties"] for f in lf.parse_nws(data, lambda zone: (-100.0, 30.0)))
    assert (watch["category"], freeze["category"]) == ("forecast", "cold")  # newest first
    assert freeze["date"] == "2026-11-14T16:00Z" and freeze["place"] == "A, B, C"
    assert freeze["severity"] == 2 and freeze["active"]
    assert lf.parse_nws(data, lambda zone: None) == []  # zone not found: no point, no event


def test_volcanoes_only_with_a_raised_level():
    def volcano(name, level, notice=""):
        props = {"vnum": name, "volcanoName": name, "alertLevel": level, "noticeId": notice}
        props |= {"noticeSynopsis": "<p>Lava</p>", "region": "Hawaii"}
        return {"properties": props, "geometry": {"coordinates": [-155.3, 19.4]}}

    data = {
        "features": [volcano("Kilauea", "WATCH", "DOI-2026-11-13T10"), volcano("Baker", "NORMAL")]
    }
    (v,) = lf.parse_volcanoes(data, "2026-11-15")
    p = v["properties"]
    assert (p["severity"], p["date"], p["detail"], p["active"]) == (2, "2026-11-13", "Lava", True)


def test_recent_keeps_a_day_and_what_is_still_going_on():
    now = datetime(2026, 11, 15, 12, 0, tzinfo=UTC)
    old = lf.feature("usgs", 1, "earthquakes", "t", "2026-11-14T11:00Z", 0, 0)
    new = lf.feature("usgs", 2, "earthquakes", "t", "2026-11-14T13:00Z", 0, 0)
    day = lf.feature("gdacs", 3, "wildfires", "t", "2026-11-14", 0, 0)  # no time: end of that day
    going = lf.feature("gdacs", 4, "floods", "t", "2026-10-01", 0, 0, active=True)
    ids = [f["properties"]["id"] for f in lf.recent([old, new, day, going], now)]
    assert ids == ["usgs-2", "gdacs-3", "gdacs-4"]


def test_gdacs_never_dates_an_event_in_the_future():
    # The real record of 2026-11-18: an ongoing flood whose todate GDACS had set two days ahead.
    p = {"fromdate": "2026-10-24T01:00:00", "todate": "2026-11-20T01:00:00", "datemodified": "2026-11-18T12:18:03"}
    now = lf.datetime(2026, 11, 18, 18, 0, tzinfo=lf.UTC)
    assert lf.gdacs_updated(p, now) == "2026-11-18T12:18Z"
    assert lf.gdacs_updated({"fromdate": "2026-10-24T01:00:00", "todate": "2026-11-20T01:00:00"}, now) == "2026-10-24T01:00Z"
    assert lf.gdacs_updated({"fromdate": "2026-11-01T00:00:00", "todate": "2026-11-10T06:00:00"}, now) == "2026-11-10T06:00Z"
