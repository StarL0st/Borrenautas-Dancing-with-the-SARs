"""Live disaster feeds (prototype): what is happening now, next to what NISAR measured.

Polls public event feeds, turns each into the same flat GeoJSON point feature, and writes
`live.geojson` to the data root, where the API (and the static export) serve it. These are not
NISAR detections: every feature names its source and carries that source's credit line.

| id      | Feed                                    | Run by                              | Key           |
|---------|-----------------------------------------|-------------------------------------|---------------|
| usgs    | Earthquakes M2.5+ and other shaking     | USGS Earthquake Hazards Program     | none          |
|         | (landslides, collapses...), last 24 h   |                                     |               |
| gdacs   | Cyclones, floods, volcanoes, drought,   | UN OCHA and European Commission JRC | none          |
|         | fires (earthquakes come from USGS)      |                                     |               |
| eonet   | EONET v3 open natural events            | NASA Earth Observatory (GSFC)       | none          |
| nws     | US weather alerts in force              | NOAA National Weather Service       | none          |
| volcano | US volcanoes with a raised alert level  | USGS Volcano Hazards Program        | none          |
| nhc     | Active tropical cyclones                | NOAA National Hurricane Center      | none          |
| firms   | VIIRS fire detections, last 24 h, in    | NASA FIRMS (LANCE); NOAA-20/21      | FIRMS_MAP_KEY |
|         | `FIRMS_BBOX` (default Mexico)           | satellites                          |               |

Same rules as the app's own collector (frontend/src/livefeeds.ts), so the globe shows the same
events whether it reads this file or asks the sources itself; this file adds the two sources a web
page cannot ask (nhc, firms). An event stays while it is under 24 hours old or its source still
lists it as going on (`active`).

A feed that fails or has no key is listed with `ok: false` and its reason; the others still load.
"""

import csv
import io
import json
import logging
import os
import re
import time
import urllib.request
from collections.abc import Callable
from datetime import UTC, datetime, timedelta
from pathlib import Path

log = logging.getLogger(__name__)

FILE = "live.geojson"
USER_AGENT = "sars-pipeline live feeds (NASA Space Apps 2026 prototype)"
MEXICO_BBOX = (-118.5, 14.0, -86.0, 33.0)
GDACS_PAGE = 100  # the most GDACS returns per request
GDACS_FIRE_PAGES = 3  # newest 300 fires at most
LIVE_HOURS = 24  # events older than this are dropped, unless still active at the source
NWS_MOST = 40  # weather alerts kept at most: each one needs its zone looked up once

# Frontend filter ids (frontend/src/filters.ts). "storms" is new with this feed.
EONET_CATEGORIES = {
    "wildfires": "wildfires",
    "volcanoes": "volcanoes",
    "floods": "floods",
    "landslides": "landslides",
    "drought": "drought",
    "earthquakes": "earthquakes",
    "seaLakeIce": "sea-ice",
    "severeStorms": "storms",
    "waterColor": "marine",
    "dustHaze": "dust",
    "snow": "cold",
    "tempExtremes": "heat",
    "manmade": "industrial",
}
TROPICAL_WORDS = ("hurricane", "typhoon", "cyclone", "tropical storm", "tropical depression")
GDACS_CATEGORIES = {
    "TC": "hurricanes",
    "FL": "floods",
    "VO": "volcanoes",
    "DR": "drought",
    "WF": "wildfires",
    "EQ": "earthquakes",
}

SOURCES = {
    "eonet": {
        "name": "EONET (Earth Observatory Natural Event Tracker)",
        "owner": "NASA Earth Observatory, Goddard Space Flight Center",
        "url": "https://eonet.gsfc.nasa.gov/api/v3/events?status=open&days=7",
        "credit": "NASA EONET, https://eonet.gsfc.nasa.gov/ (each event credits its own source)",
    },
    "usgs": {
        "name": "USGS earthquakes (magnitude 2.5+) and other shaking, last 24 h",
        "owner": "U.S. Geological Survey, Earthquake Hazards Program (ANSS)",
        "url": "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson",
        "credit": "U.S. Geological Survey, Earthquake Hazards Program, ANSS ComCat",
    },
    "gdacs": {
        "name": "GDACS disaster alerts",
        "owner": "United Nations OCHA and European Commission JRC",
        "url": "https://www.gdacs.org/gdacsapi/api/events/geteventlist/SEARCH",
        "credit": "Global Disaster Alert and Coordination System (GDACS), https://www.gdacs.org/",
    },
    "nws": {
        "name": "US weather alerts in force",
        "owner": "NOAA National Weather Service",
        "url": "https://api.weather.gov/alerts/active?status=actual&message_type=alert",
        "credit": "NOAA National Weather Service, https://www.weather.gov/ (United States only)",
    },
    "volcano": {
        "name": "US volcanoes with a raised alert level",
        "owner": "U.S. Geological Survey, Volcano Hazards Program",
        "url": "https://volcanoes.usgs.gov/vsc/api/volcanoApi/geojson",
        "credit": "U.S. Geological Survey, Volcano Hazards Program, "
        "https://www.usgs.gov/programs/VHP (United States only)",
    },
    "nhc": {
        "name": "Active tropical cyclones",
        "owner": "NOAA National Hurricane Center",
        "url": "https://www.nhc.noaa.gov/CurrentStorms.json",
        "credit": "NOAA National Hurricane Center, https://www.nhc.noaa.gov/",
    },
    "firms": {
        "name": "FIRMS VIIRS fire detections, last 24 h",
        "owner": "NASA FIRMS (LANCE); VIIRS on NOAA-20 and NOAA-21",
        "url": "https://firms.modaps.eosdis.nasa.gov/api/area/csv/",
        "credit": "NASA FIRMS, VIIRS 375 m active fire detections (NOAA-20, NOAA-21), "
        "https://firms.modaps.eosdis.nasa.gov/",
    },
}


def feature(source: str, uid, category: str, title: str, date: str, lon, lat, **extra) -> dict:
    """One live event as a GeoJSON point with flat properties (MapLibre reads them directly)."""
    lon, lat = round(float(lon), 5), round(float(lat), 5)
    return {
        "type": "Feature",
        "geometry": {"type": "Point", "coordinates": [lon, lat]},
        "properties": {
            "id": f"{source}-{uid}",
            "source": source,
            "source_name": SOURCES[source]["owner"],
            "credit": SOURCES[source]["credit"],
            "category": category,
            "title": title,  # what is happening
            "place": extra.get("place", ""),  # where, in words; "" when the feed gives none
            "date": date,
            "detail": extra.get("detail", ""),
            "url": extra.get("url", ""),
            "severity": extra.get("severity", 1),  # 0 minor .. 3 most dangerous
            "lon": lon,
            "lat": lat,
            # its source still lists it as going on: it stays past 24 hours
            **({"active": True} if extra.get("active") else {}),
        },
    }


def place_from_title(title: str) -> str:
    """EONET titles carry the place: "Flood in Guatemala", "Wildfire Red Hill, Perry, Texas"."""
    if " in " in title:
        return title.split(" in ", 1)[1].strip()
    if ", " in title:
        return title.split(", ", 1)[1].strip()
    return ""


def eonet_category(cid: str, title: str) -> str:
    """EONET lumps tropical cyclones in with other storms, cold with heat, and every human-made
    event together; the title tells them apart."""
    low = title.lower()
    if cid == "severeStorms" and any(w in low for w in TROPICAL_WORDS):
        return "hurricanes"
    if cid == "tempExtremes" and any(w in low for w in ("cold", "freez", "frost", "snow")):
        return "cold"
    if cid == "manmade" and any(w in low for w in ("oil", "spill")):
        return "oil-spills"
    return EONET_CATEGORIES.get(cid, "other")


def countries(p: dict, most: int = 3) -> str:
    """GDACS affected countries as words: "Mexico, Guatemala and 4 more"."""
    names = [
        c.get("countryname", "") for c in p.get("affectedcountries") or [] if c.get("countryname")
    ]
    if not names:
        return p.get("country") or ""
    more = len(names) - most
    return ", ".join(names[:most]) + (f" and {more} more" if more > 0 else "")


NHC_BASINS = {"AT": "Atlantic Ocean", "EP": "Eastern Pacific", "CP": "Central Pacific"}


def _point(geometry: dict) -> tuple[float, float] | None:
    """A representative point of a Point or Polygon geometry (first ring's mean)."""
    coords = geometry.get("coordinates")
    if geometry.get("type") == "Point":
        return coords[0], coords[1]
    if geometry.get("type") == "Polygon" and coords and coords[0]:
        ring = coords[0]
        return sum(p[0] for p in ring) / len(ring), sum(p[1] for p in ring) / len(ring)
    return None


def parse_eonet(data: dict, skip_sources: set[str] = frozenset()) -> list[dict]:
    """EONET events, latest position each. Events whose only sources are in `skip_sources` are
    dropped (they come in directly from that feed)."""
    out = []
    for e in data.get("events", []):
        sources = {s["id"] for s in e.get("sources", [])}
        if sources and sources <= skip_sources:
            continue
        cats = [eonet_category(c["id"], e["title"]) for c in e.get("categories", [])]
        geoms = sorted(e.get("geometry", []), key=lambda g: g.get("date", ""))
        if not geoms or not (p := _point(geoms[-1])):
            continue
        g = geoms[-1]
        detail = f"Reported by {', '.join(sorted(sources))}"
        if g.get("magnitudeValue") is not None:
            size = f"{g['magnitudeValue']:g} {g.get('magnitudeUnit', '')}".strip()
            detail = f"{size} · {detail}"
        url = next((s["url"] for s in e.get("sources", []) if s.get("url")), e.get("link", ""))
        out.append(
            feature(
                "eonet",
                e["id"],
                cats[0] if cats else "other",
                e["title"],
                g.get("date", "")[:10],
                *p,
                detail=detail,
                url=url,
                place=place_from_title(e["title"]),
                severity=2 if "hurricane" in e["title"].lower() else 1,
                active=not e.get("closed"),  # NASA has not closed it
            )
        )
    return out


def quake_severity(mag, tsunami=0) -> int:
    """Magnitude 7+ is a major quake; a tsunami flag is always at least serious."""
    m = float(mag or 0)
    level = 3 if m >= 7 else 2 if m >= 6 else 1 if m >= 5 else 0
    return max(level, 2) if tsunami else level


# The USGS feed also carries what its seismometers hear besides earthquakes.
USGS_TYPES = [
    (r"landslide|rock ?slide|avalanche", "landslides", "Landslide"),
    (r"volcan", "volcanoes", "Volcanic eruption"),
    (r"ice quake", "glaciers", "Ice quake"),
    (r"collapse|sinkhole", "sinkholes", "Ground collapse"),
    (
        r"induced|triggered|quarry|mine|mining|explosion|blast|rock ?burst",
        "induced-seismicity",
        "Shaking caused by people",
    ),
]


def parse_usgs(data: dict) -> list[dict]:
    """Earthquakes under magnitude 2.5 are left out (too many, rarely felt); every other kind
    that USGS_TYPES names is kept."""
    out = []
    for f in data.get("features", []):
        p, (lon, lat, *rest) = f["properties"], f["geometry"]["coordinates"]
        kind, mag = p.get("type") or "earthquake", p.get("mag")
        other = None
        if kind != "earthquake":
            other = next((t for t in USGS_TYPES if re.search(t[0], kind)), None)
        if not other and (kind != "earthquake" or not (mag or 0) >= 2.5):
            continue
        when = datetime.fromtimestamp(p["time"] / 1000, UTC).strftime("%Y-%m-%dT%H:%MZ")
        depth = f", depth {rest[0]:.0f} km" if rest and rest[0] is not None else ""
        tsunami = " · Tsunami possible: see NOAA tsunami.gov" if p.get("tsunami") else ""
        out.append(
            feature(
                "usgs",
                f["id"],
                other[1] if other else "earthquakes",
                f"{other[2]} ({kind}), magnitude {mag}" if other else f"Magnitude {mag} earthquake",
                when,
                lon,
                lat,
                detail=f"Magnitude {mag}{depth}{tsunami}",
                url=p.get("url", ""),
                place=p.get("place") or "",
                severity=0 if other else quake_severity(mag, p.get("tsunami")),
            )
        )
    return out


def gdacs_updated(p: dict, now: datetime | None = None) -> str:
    """When GDACS last changed an event: datemodified or todate, the latest that is not in the
    future (GDACS sets the todate of an ongoing event days ahead), else the start."""
    now = now or datetime.now(UTC)
    stamps = [f"{str(s)[:16]}Z" for s in (p.get("datemodified"), p.get("todate")) if s]
    past = sorted(s for s in stamps if datetime.fromisoformat(s.replace("Z", "+00:00")) <= now)
    return past[-1] if past else (f"{str(p['fromdate'])[:16]}Z" if p.get("fromdate") else "")


def parse_gdacs(data: dict, skip_types: set[str] = frozenset({"EQ"})) -> list[dict]:
    out = []
    for f in data.get("features", []):
        p = f["properties"]
        if p.get("eventtype") in skip_types or not (pt := _point(f.get("geometry") or {})):
            continue
        sev = p.get("severitydata") or {}
        severity = sev.get("severitytext", "") if sev.get("severity") else ""  # "Magnitude 0"
        start, last = (p.get("fromdate") or "")[:10], (p.get("todate") or "")[:10]
        detail = " · ".join(
            x
            for x in (f"{p.get('alertlevel', '')} alert", severity, last and f"since {start}")
            if x and x != " alert"
        )
        out.append(
            feature(
                "gdacs",
                f"{p['eventtype']}{p['eventid']}",
                GDACS_CATEGORIES.get(p["eventtype"], "other"),
                p.get("name") or p.get("description", ""),
                gdacs_updated(p),  # latest real update, never in the future
                *pt,
                detail=detail,
                url=(p.get("url") or {}).get("report", ""),
                place=countries(p),
                severity={"Red": 3, "Orange": 2}.get(p.get("alertlevel"), 1),
                # Floods, droughts, cyclones and eruptions last for days: GDACS says which
                # still go on. Fires are too many for that and follow the 24-hour rule.
                active=p["eventtype"] != "WF" and str(p.get("iscurrent")).lower() == "true",
            )
        )
    return out


# US weather alerts by filter type. First match wins; alerts that match nothing are left out
# (fog, small-craft and gale advisories: routine, and far too many).
NWS_TYPES = [
    (r"watch$", "forecast"),  # a watch says the hazard is possible, not yet happening
    (r"tsunami|high surf|storm surge", "marine"),
    (r"hurricane|typhoon|tropical", "hurricanes"),
    (r"flood", "floods"),
    (r"dust", "dust"),
    (r"heat", "heat"),
    (r"winter|blizzard|ice storm|freeze|frost|cold|wind chill|snow", "cold"),
    (r"red flag|fire", "wildfires"),
    (r"tornado|thunderstorm|high wind warning|extreme wind", "storms"),
]
# Sea zones are large files; the alerts kept are on land or the coast anyway.
SEA_ZONES = re.compile(r"/(AM|AN|GM|LC|LE|LH|LM|LO|LS|PH|PK|PM|PS|PZ|SL)Z\d+$")
NWS_SEVERITY = {"Extreme": 3, "Severe": 2, "Moderate": 1}


def nws_type(event: str) -> str | None:
    return next((cat for pattern, cat in NWS_TYPES if re.search(pattern, event.lower())), None)


def _minute(iso: str) -> str:
    """Any ISO time as UTC to the minute, the form every dated feature uses."""
    return datetime.fromisoformat(iso).astimezone(UTC).strftime("%Y-%m-%dT%H:%MZ")


def parse_nws(data: dict, where: Callable[[str], tuple[float, float] | None]) -> list[dict]:
    """Weather alerts in force, newest first. `where` finds the middle of an alert's first zone."""
    wanted = []
    for f in data.get("features", []):
        p = f["properties"]
        land = [z for z in p.get("affectedZones") or [] if not SEA_ZONES.search(z)]
        if land and p.get("sent") and nws_type(p.get("event") or ""):
            wanted.append((p, land[0]))
    wanted.sort(key=lambda w: datetime.fromisoformat(w[0]["sent"]), reverse=True)
    out = []
    for p, zone in wanted[:NWS_MOST]:
        try:
            at = where(zone)
        except Exception:  # noqa: BLE001 (one zone that does not answer must not drop the rest)
            at = None
        if at:
            out.append(
                feature(
                    "nws",
                    p["id"],
                    nws_type(p["event"]),
                    p["event"],
                    _minute(p["sent"]),
                    *at,
                    detail=p.get("headline") or "",
                    url="https://www.weather.gov/alerts",
                    place=", ".join((p.get("areaDesc") or "").split("; ")[:3]),
                    severity=NWS_SEVERITY.get(p.get("severity"), 0),
                    active=True,
                )
            )
    return out


VOLCANO_LEVELS = {"ADVISORY": 1, "WATCH": 2, "WARNING": 3}  # USGS alert scale


def parse_volcanoes(data: dict, today: str = "") -> list[dict]:
    """US volcanoes whose alert level is raised."""
    out = []
    for f in data.get("features", []):
        p, (lon, lat, *_) = f["properties"], f["geometry"]["coordinates"]
        if p.get("alertLevel") not in VOLCANO_LEVELS:
            continue
        sent = re.search(r"\d{4}-\d\d-\d\d", p.get("noticeId") or "")  # the id carries its date
        out.append(
            feature(
                "volcano",
                p["vnum"],
                "volcanoes",
                f"{p['volcanoName']} volcano: alert level {p['alertLevel']}",
                sent.group() if sent else today,
                lon,
                lat,
                detail=re.sub(r"<[^>]*>", "", p.get("noticeSynopsis") or "")[:300],
                url=p.get("noticeUrl") or p.get("volcanoUrl") or "",
                place=p.get("region") or "",
                severity=VOLCANO_LEVELS[p["alertLevel"]],
                active=True,
            )
        )
    return out


def parse_nhc(data: dict) -> list[dict]:
    out = []
    for s in data.get("activeStorms", []):
        try:
            lat, lon = float(s["latitudeNumeric"]), float(s["longitudeNumeric"])
        except (KeyError, TypeError, ValueError):
            continue
        kind = {"HU": "Hurricane", "TS": "Tropical storm", "TD": "Tropical depression"}.get(
            s.get("classification", ""), "Tropical cyclone"
        )
        wind = f", winds {s['intensity']} kt" if s.get("intensity") else ""
        out.append(
            feature(
                "nhc",
                s.get("id", s.get("name", "")),
                "hurricanes",
                f"{kind} {s.get('name', '')}".strip(),
                (s.get("lastUpdate") or "")[:16],
                lon,
                lat,
                detail=f"{kind}{wind}",
                url=(s.get("publicAdvisory") or {}).get("url", ""),
                place=NHC_BASINS.get(str(s.get("binNumber", ""))[:2], ""),
                severity=2 if s.get("classification") == "HU" else 1,
                active=True,  # the center lists only storms that exist now
            )
        )
    return out


def parse_firms(text: str, source: str) -> list[dict]:
    out = []
    for r in csv.DictReader(io.StringIO(text)):
        if not (r.get("latitude") and r.get("longitude")):
            continue
        t = (r.get("acq_time") or "").zfill(4)
        when = f"{r.get('acq_date', '')}T{t[:2]}:{t[2:]}Z"
        conf = {"h": "high", "n": "nominal", "l": "low"}.get(
            r.get("confidence", ""), r.get("confidence", "")
        )
        out.append(
            feature(
                "firms",
                f"{source}-{r['latitude']}-{r['longitude']}-{when}",
                "wildfires",
                "Fire or hot spot detected",
                when,
                r["longitude"],
                r["latitude"],
                detail=f"VIIRS {source.split('_')[1]}, confidence {conf}. Can also be a crop burn "
                "or a gas flare.",
            )
        )
    return out


def _get(url: str, timeout: float = 40) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.read()


_ZONES: dict[str, tuple[float, float] | None] = {}  # weather zone URL -> its middle


def recent(features: list[dict], now: datetime, hours: float = LIVE_HOURS) -> list[dict]:
    """The events updated within the last `hours`, plus those their source still lists as going
    on. A date without a clock time counts as the end of that day."""
    floor = (now - timedelta(hours=hours)).strftime("%Y-%m-%dT%H:%MZ")

    def when(date: str) -> str:
        return date if "T" in date else f"{date}T23:59Z"

    return [
        f
        for f in features
        if f["properties"].get("active") or when(f["properties"]["date"]) >= floor
    ]


def _bbox_env() -> tuple:
    raw = os.environ.get("FIRMS_BBOX")
    return tuple(float(v) for v in raw.split(",")) if raw else MEXICO_BBOX


def fetchers(get: Callable[[str], bytes] = _get) -> dict[str, Callable[[], list[dict]]]:
    today = datetime.now(UTC).date()

    def gdacs():
        # GDACS answers at most GDACS_PAGE events per request. Fires are many, so they get their
        # own pages; otherwise they crowd out cyclones, floods and droughts (seen 2026-11-14).
        seen, out = set(), []
        for types, pages, days in (("TC;FL;VO;DR", 5, 7), ("WF", GDACS_FIRE_PAGES, 2)):
            for page in range(1, pages + 1):
                q = (
                    f"?eventlist={types}&fromDate={today - timedelta(days=days)}&toDate={today}"
                    f"&alertlevel=Green;Orange;Red&pagesize={GDACS_PAGE}&pagenumber={page}"
                )
                got = json.loads(get(SOURCES["gdacs"]["url"] + q)).get("features", [])
                fresh = [
                    f for f in parse_gdacs({"features": got}) if f["properties"]["id"] not in seen
                ]
                seen.update(f["properties"]["id"] for f in fresh)
                out += fresh
                if len(got) < GDACS_PAGE or not fresh:
                    break
        return out

    def zone_middle(url: str) -> tuple[float, float] | None:
        """The middle of a weather zone. Zones do not move: each is asked once per process."""
        if url not in _ZONES:
            g = json.loads(get(url)).get("geometry") or {}
            if g.get("type") == "MultiPolygon":
                g = {"type": "Polygon", "coordinates": g["coordinates"][0]}
            _ZONES[url] = _point(g)
        return _ZONES[url]

    def firms():
        key = os.environ.get("FIRMS_MAP_KEY")
        if not key:
            raise RuntimeError(
                "no FIRMS_MAP_KEY set (free key: firms.modaps.eosdis.nasa.gov/api/map_key/)"
            )
        bbox = ",".join(f"{v:g}" for v in _bbox_env())
        # FIRMS counts days by UTC date: "1 day" is only today, so it is empty after 00:00 UTC
        # (seen 2026-11-15: 0 fires at 00:45 UTC, 1041 the day before). Ask 2, keep 24 hours.
        since = (datetime.now(UTC) - timedelta(hours=24)).strftime("%Y-%m-%dT%H:%MZ")
        out = []
        for src in ("VIIRS_NOAA20_NRT", "VIIRS_NOAA21_NRT"):
            out += parse_firms(get(f"{SOURCES['firms']['url']}{key}/{src}/{bbox}/2").decode(), src)
        return [f for f in out if f["properties"]["date"] >= since]

    return {
        "usgs": lambda: parse_usgs(json.loads(get(SOURCES["usgs"]["url"]))),
        "gdacs": gdacs,
        # GDACS events reach EONET too; take them from GDACS only.
        "eonet": lambda: parse_eonet(json.loads(get(SOURCES["eonet"]["url"])), {"GDACS"}),
        "nws": lambda: parse_nws(json.loads(get(SOURCES["nws"]["url"])), zone_middle),
        "volcano": lambda: parse_volcanoes(
            json.loads(get(SOURCES["volcano"]["url"])), today.isoformat()
        ),
        "nhc": lambda: parse_nhc(json.loads(get(SOURCES["nhc"]["url"]))),
        "firms": firms,
    }


def collect(
    feeds: dict[str, Callable[[], list[dict]]] | None = None,
    minutes: float | None = None,
    now: datetime | None = None,
) -> dict:
    """Run every feed; one failing feed never stops the others. `minutes`: how often the caller
    refreshes, written as `refresh_minutes` so the app can say it. Only events that are recent
    or still going on are kept (`recent`); `count` per source is what was kept."""
    now = now or datetime.now(UTC)
    feeds = feeds if feeds is not None else fetchers()
    features, status = [], []
    for sid, fetch in feeds.items():
        meta = {"id": sid, **SOURCES[sid]}
        try:
            got = recent(fetch(), now)
            features += got
            status.append({**meta, "ok": True, "count": len(got)})
        except Exception as err:  # noqa: BLE001 (network, format change, missing key)
            log.warning("live feed %s: %s", sid, err)
            status.append({**meta, "ok": False, "count": 0, "error": str(err)[:200]})
    features.sort(key=lambda f: f["properties"]["date"], reverse=True)
    return {
        "type": "FeatureCollection",
        "generated_at": datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "note": "Live context from public feeds, not NISAR detections. Each feature names its source.",
        **({"refresh_minutes": minutes} if minutes else {}),
        "sources": status,
        "features": features,
    }


def write(data_dir: Path, feeds=None, minutes: float | None = None, now=None) -> dict:
    doc = collect(feeds, minutes, now)
    path = Path(data_dir) / FILE
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".tmp")
    tmp.write_text(json.dumps(doc), encoding="utf-8")
    tmp.replace(path)  # readers never see half a file
    return doc


def poll(data_dir: Path, minutes: float) -> None:
    """Refresh live.geojson forever (run in a daemon thread by `serve --live-minutes`)."""
    while True:
        try:
            doc = write(data_dir, minutes=minutes)
            log.info("live feeds: %d events", len(doc["features"]))
        except Exception:
            log.exception("live feeds failed")
        time.sleep(minutes * 60)
