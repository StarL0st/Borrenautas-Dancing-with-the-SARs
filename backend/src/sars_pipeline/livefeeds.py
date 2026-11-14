"""Live disaster feeds (prototype): what is happening now, next to what NISAR measured.

Polls public event feeds, turns each into the same flat GeoJSON point feature, and writes
`live.geojson` to the data root, where the API (and the static export) serve it. These are not
NISAR detections: every feature names its source and carries that source's credit line.

| id    | Feed                                   | Run by                              | Key            |
|-------|----------------------------------------|-------------------------------------|----------------|
| eonet | EONET v3 natural events                | NASA Earth Observatory (GSFC)       | none           |
| usgs  | Earthquakes M2.5+ of the last 7 days   | USGS Earthquake Hazards Program     | none           |
| gdacs | Cyclones, floods, volcanoes, drought,  | UN OCHA and European Commission JRC | none           |
|       | fires (earthquakes come from USGS)     |                                     |                |
| nhc   | Active tropical cyclones               | NOAA National Hurricane Center      | none           |
| firms | VIIRS fire detections, last 24 h, in   | NASA FIRMS (LANCE); NOAA-20/21      | FIRMS_MAP_KEY  |
|       | `FIRMS_BBOX` (default Mexico)          | satellites                          |                |

A feed that fails or has no key is listed with `ok: false` and its reason; the others still load.

Scope (jopa-testing): live events are worldwide and from the last day. `write` keeps events whose
latest update is within `LIVE_HOURS` (default 24) and, if `LIVE_REGION` is set ("w,s,e,n", or
"mexico" for Mexico and its seas), only those inside it. `poll` records `refresh_minutes`.
Every event carries `severity` 0-3 (3 = most dangerous) so the app can rank what matters most.
"""

import csv
import io
import json
import logging
import os
import time
import urllib.request
from collections.abc import Callable
from datetime import UTC, datetime, timedelta
from pathlib import Path

log = logging.getLogger(__name__)

FILE = "live.geojson"
USER_AGENT = "sars-pipeline live feeds (NASA Space Apps 2026 prototype)"
MEXICO_BBOX = (-118.5, 14.0, -86.0, 33.0)
WORLD_BBOX = (-180.0, -90.0, 180.0, 90.0)
FIRMS_MAX = 1500  # worldwide, one day of fire detections is tens of thousands: keep the newest
                  # high-confidence ones so the map and the list stay usable
# Mexico plus the Eastern Pacific, Gulf of Mexico and western Caribbean, where the storms that hit
# it form and travel. Live events outside are left out (the app is about Mexico).
REGION_BBOX = (-125.0, 8.0, -78.0, 34.0)
GDACS_PAGE = 100  # the most GDACS returns per request
GDACS_FIRE_PAGES = 3  # newest 300 fires at most

# Frontend filter ids (frontend/src/filters.ts). Weather types (jopa-testing): "hurricanes"
# (tropical cyclones of any strength), "storms" (other severe storms), "heat", "cold", "dust".
EONET_CATEGORIES = {
    "wildfires": "wildfires",
    "volcanoes": "volcanoes",
    "floods": "floods",
    "landslides": "landslides",
    "drought": "drought",
    "earthquakes": "earthquakes",
    "seaLakeIce": "sea-ice",
    "severeStorms": "storms",  # refined by title in eonet_category
    "waterColor": "marine",
    "dustHaze": "dust",
    "snow": "cold",
    "tempExtremes": "heat",  # refined by title in eonet_category
    "manmade": "industrial",  # refined by title in eonet_category
}
TROPICAL_WORDS = ("hurricane", "typhoon", "cyclone", "tropical storm", "tropical depression")


def eonet_category(eonet_id: str, title: str) -> str:
    """EONET lumps tropical cyclones in with other storms, cold with heat, and every human-made
    event together; the title tells them apart."""
    low = title.lower()
    if eonet_id == "severeStorms" and any(w in low for w in TROPICAL_WORDS):
        return "hurricanes"
    if eonet_id == "tempExtremes" and any(w in low for w in ("cold", "freez", "frost", "snow")):
        return "cold"
    if eonet_id == "manmade" and any(w in low for w in ("oil", "spill")):
        return "oil-spills"
    return EONET_CATEGORIES.get(eonet_id, "other")


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
        "url": "https://eonet.gsfc.nasa.gov/api/v3/events?status=open&days=2",
        "credit": "NASA EONET, https://eonet.gsfc.nasa.gov/ (each event credits its own source)",
    },
    "usgs": {
        "name": "USGS earthquakes, magnitude 2.5+, past day",
        "owner": "U.S. Geological Survey, Earthquake Hazards Program (ANSS)",
        "url": "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson",
        "credit": "U.S. Geological Survey, Earthquake Hazards Program, ANSS ComCat",
    },
    "gdacs": {
        "name": "GDACS disaster alerts",
        "owner": "United Nations OCHA and European Commission JRC",
        "url": "https://www.gdacs.org/gdacsapi/api/events/geteventlist/SEARCH",
        "credit": "Global Disaster Alert and Coordination System (GDACS), https://www.gdacs.org/",
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
            "severity": int(extra.get("severity", 1)),  # 0 minor .. 3 most dangerous
            "lon": lon,
            "lat": lat,
        },
    }


def place_from_title(title: str) -> str:
    """EONET titles carry the place: "Flood in Guatemala", "Wildfire Red Hill, Perry, Texas"."""
    if " in " in title:
        return title.split(" in ", 1)[1].strip()
    if ", " in title:
        return title.split(", ", 1)[1].strip()
    return ""


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
        cats = [eonet_category(c["id"], e.get("title", "")) for c in e.get("categories", [])]
        geoms = sorted(e.get("geometry", []), key=lambda g: g.get("date", ""))
        if not geoms or not (p := _point(geoms[-1])):
            continue
        g = geoms[-1]
        detail = f"Reported by {', '.join(sorted(sources))}"
        if g.get("magnitudeValue") is not None:
            size = f"{g['magnitudeValue']:g} {g.get('magnitudeUnit', '')}".strip()
            detail = f"{size} · {detail}"
        url = next((s["url"] for s in e.get("sources", []) if s.get("url")), e.get("link", ""))
        category = cats[0] if cats else "other"
        out.append(
            feature(
                "eonet",
                e["id"],
                category,
                e["title"],
                g.get("date", "")[:10],
                *p,
                detail=detail,
                url=url,
                place=place_from_title(e["title"]),
                severity=2 if "hurricane" in e["title"].lower() else 1,
            )
        )
    return out


def quake_severity(mag, tsunami=0) -> int:
    """Magnitude 7+ is a major quake; a tsunami flag is always at least serious."""
    m = float(mag or 0)
    level = 3 if m >= 7 else 2 if m >= 6 else 1 if m >= 5 else 0
    return max(level, 2) if tsunami else level


def parse_usgs(data: dict) -> list[dict]:
    out = []
    for f in data.get("features", []):
        p, (lon, lat, *rest) = f["properties"], f["geometry"]["coordinates"]
        when = datetime.fromtimestamp(p["time"] / 1000, UTC).strftime("%Y-%m-%dT%H:%MZ")
        depth = f", depth {rest[0]:.0f} km" if rest else ""
        tsunami = " · Tsunami possible: see NOAA tsunami.gov" if p.get("tsunami") else ""
        out.append(
            feature(
                "usgs",
                f["id"],
                "earthquakes",
                f"Magnitude {p.get('mag')} earthquake",
                when,
                lon,
                lat,
                detail=f"Magnitude {p.get('mag')}{depth}{tsunami}",
                url=p.get("url", ""),
                place=p.get("place") or "",
                severity=quake_severity(p.get("mag"), p.get("tsunami")),
            )
        )
    return out


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
                last or start,  # latest update: a live map shows what is current
                *pt,
                detail=detail,
                url=(p.get("url") or {}).get("report", ""),
                place=countries(p),
                severity={"Red": 3, "Orange": 2}.get(p.get("alertlevel", ""), 1),
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
        try:
            knots = float(s.get("intensity") or 0)
        except (TypeError, ValueError):
            knots = 0
        # 96 kt and up is a major hurricane (Category 3+ on the Saffir-Simpson scale).
        level = {"HU": 3 if knots >= 96 else 2, "TS": 1}.get(s.get("classification", ""), 0)
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
                severity=level,
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
                severity=0,
            )
        )
    return out


def _get(url: str, timeout: float = 40) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.read()


def _bbox_env() -> tuple:
    raw = os.environ.get("FIRMS_BBOX")
    return tuple(float(v) for v in raw.split(",")) if raw else WORLD_BBOX


def fetchers(get: Callable[[str], bytes] = _get) -> dict[str, Callable[[], list[dict]]]:
    today = datetime.now(UTC).date()

    def gdacs():
        # GDACS answers at most GDACS_PAGE events per request. Fires are many, so they get their
        # own pages; otherwise they crowd out cyclones, floods and droughts (seen 2026-11-14).
        seen, out = set(), []
        for types, pages in (("TC;FL;VO;DR", 5), ("WF", GDACS_FIRE_PAGES)):
            for page in range(1, pages + 1):
                q = (
                    f"?eventlist={types}&fromDate={today - timedelta(days=2)}&toDate={today}"
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

    def firms():
        key = os.environ.get("FIRMS_MAP_KEY")
        if not key:
            raise RuntimeError(
                "no FIRMS_MAP_KEY set (free key: firms.modaps.eosdis.nasa.gov/api/map_key/)"
            )
        bbox = ",".join(f"{v:g}" for v in _bbox_env())
        out = []
        for src in ("VIIRS_NOAA20_NRT", "VIIRS_NOAA21_NRT"):
            out += parse_firms(get(f"{SOURCES['firms']['url']}{key}/{src}/{bbox}/1").decode(), src)
        sure = [f for f in out if "confidence high" in f["properties"]["detail"]]
        return sorted(sure, key=lambda f: f["properties"]["date"], reverse=True)[:FIRMS_MAX]

    return {
        "usgs": lambda: parse_usgs(json.loads(get(SOURCES["usgs"]["url"]))),
        "gdacs": gdacs,
        # GDACS events reach EONET too; take them from GDACS only.
        "eonet": lambda: parse_eonet(json.loads(get(SOURCES["eonet"]["url"])), {"GDACS"}),
        "nhc": lambda: parse_nhc(json.loads(get(SOURCES["nhc"]["url"]))),
        "firms": firms,
    }


def collect(feeds: dict[str, Callable[[], list[dict]]] | None = None) -> dict:
    """Run every feed; one failing feed never stops the others."""
    feeds = feeds if feeds is not None else fetchers()
    features, status = [], []
    for sid, fetch in feeds.items():
        meta = {"id": sid, **SOURCES[sid]}
        try:
            got = fetch()
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
        "sources": status,
        "features": features,
    }


def _region_env() -> tuple | None:
    raw = os.environ.get("LIVE_REGION", "").strip().lower()
    if raw in ("", "world"):
        return None  # worldwide (default)
    if raw == "mexico":
        return REGION_BBOX
    return tuple(float(v) for v in raw.split(","))


def _hours_env() -> float | None:
    raw = os.environ.get("LIVE_HOURS", "24").strip().lower()
    return None if raw in ("", "all", "0") else float(raw)


def _when(date: str) -> datetime | None:
    """A feed date as UTC. A date without a time counts as the end of that day, so an event the
    feed dates "today" is not dropped just because it has no clock time."""
    try:
        if "T" in date:
            return datetime.fromisoformat(date.replace("Z", "+00:00")).astimezone(UTC)
        return datetime.fromisoformat(date).replace(tzinfo=UTC) + timedelta(hours=23, minutes=59)
    except ValueError:
        return None


def recent(doc: dict, hours: float | None, now: datetime | None = None) -> dict:
    """Keep events updated within the last `hours`; None keeps everything."""
    if hours is None:
        return doc
    cut = (now or datetime.now(UTC)) - timedelta(hours=hours)
    kept = [f for f in doc["features"] if (t := _when(f["properties"]["date"])) and t >= cut]
    return {**doc, "features": kept, "hours": hours}


def in_region(doc: dict, region: tuple | None) -> dict:
    """Keep the events inside `region` (west, south, east, north); None keeps everything."""
    if region is None:
        return doc
    w, s, e, n = region
    kept = [
        f for f in doc["features"]
        if w <= f["properties"]["lon"] <= e and s <= f["properties"]["lat"] <= n
    ]
    return {**doc, "features": kept, "region": list(region)}


def write(
    data_dir: Path, feeds=None, region: tuple | None | str = "env", hours: float | None | str = "env",
    refresh_minutes: float | None = None,
) -> dict:
    doc = in_region(collect(feeds), _region_env() if region == "env" else region)
    doc = recent(doc, _hours_env() if hours == "env" else hours)
    if refresh_minutes:
        doc["refresh_minutes"] = refresh_minutes  # the page says how often it is refreshed
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
            doc = write(data_dir, refresh_minutes=minutes)
            log.info("live feeds: %d events", len(doc["features"]))
        except Exception:
            log.exception("live feeds failed")
        time.sleep(minutes * 60)
