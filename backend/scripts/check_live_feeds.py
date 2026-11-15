"""Check the top 3 live feeds against real, current events (network needed).

    cd backend && uv run python scripts/check_live_feeds.py [--out report.json]

For USGS, NASA EONET and GDACS it:
1. fetches the raw feed (HTTP time, size),
2. runs it through livefeeds.py and checks every feature (coordinates, ids, categories, dates,
   credit), and that nothing was lost except on purpose (EONET items only from GDACS, GDACS
   earthquakes),
3. measures freshness (age of the newest and median event),
4. lists events over Mexico and Central America,
5. opens a few source links,
6. cross-checks USGS earthquakes against GDACS earthquakes (same quake: within 2 min and 50 km),
7. serves the result through the API (`GET /live.geojson`) like the app reads it.

Prints a summary and writes everything to JSON. Read-only: it writes only to `--out` and a
temporary directory.
"""

import argparse
import json
import math
import statistics
import sys
import tempfile
import time
import urllib.request
from datetime import UTC, datetime, timedelta
from pathlib import Path

from sars_pipeline import livefeeds as lf

REGION = (-118.5, 5.0, -77.0, 33.0)  # Mexico and Central America
KNOWN = {
    "earthquakes",
    "volcanoes",
    "landslides",
    "floods",
    "storms",
    "forecast",
    "sinkholes",
    "wildfires",
    "drought",
    "marine",
    "glaciers",
    "ice-sheets",
    "sea-ice",
    "permafrost",
    "glacial-lakes",
    "induced-seismicity",
    "oil-spills",
    "groundwater",
    "subsidence",
    "logging",
    "coastal-loss",
    "reservoirs",
    "deforestation",
    "urban",
    "agriculture",
    "other",
}  # frontend/src/filters.ts plus "other"


def fetch(url: str) -> tuple[bytes, float, int]:
    req = urllib.request.Request(url, headers={"User-Agent": lf.USER_AGENT})
    t0 = time.monotonic()
    with urllib.request.urlopen(req, timeout=60) as resp:
        body = resp.read()
        return body, time.monotonic() - t0, resp.status


def link_status(url: str) -> int | str:
    try:
        req = urllib.request.Request(url, headers={"User-Agent": lf.USER_AGENT})
        with urllib.request.urlopen(req, timeout=30) as resp:
            return resp.status
    except Exception as err:  # noqa: BLE001 (report, do not stop)
        return getattr(err, "code", None) or type(err).__name__


def when(date: str) -> datetime | None:
    s = date.replace("Z", "+00:00")
    for fmt in (None, "%Y-%m-%d"):
        try:
            d = datetime.fromisoformat(s) if fmt is None else datetime.strptime(s, fmt)
            return d if d.tzinfo else d.replace(tzinfo=UTC)
        except ValueError:
            continue
    return None


def km(a, b) -> float:
    (lon1, lat1), (lon2, lat2) = ((math.radians(p[0]), math.radians(p[1])) for p in (a, b))
    h = (
        math.sin((lat2 - lat1) / 2) ** 2
        + math.cos(lat1) * math.cos(lat2) * math.sin((lon2 - lon1) / 2) ** 2
    )
    return 6371 * 2 * math.asin(math.sqrt(h))


def validate(features: list[dict]) -> list[str]:
    problems, ids = [], set()
    for f in features:
        p = f["properties"]
        lon, lat = f["geometry"]["coordinates"]
        if not (-180 <= lon <= 180 and -90 <= lat <= 90):
            problems.append(f"{p['id']}: coordinates out of range {lon},{lat}")
        if p["id"] in ids:
            problems.append(f"{p['id']}: duplicate id")
        ids.add(p["id"])
        if p["category"] not in KNOWN:
            problems.append(f"{p['id']}: unknown category {p['category']}")
        if not when(p["date"]):
            problems.append(f"{p['id']}: unreadable date {p['date']!r}")
        if not (p["title"] and p["credit"]):
            problems.append(f"{p['id']}: missing title or credit")
    return problems


def summarize(features: list[dict], now: datetime) -> dict:
    ages = sorted(
        (now - d).total_seconds() / 3600 for f in features if (d := when(f["properties"]["date"]))
    )
    cats: dict[str, int] = {}
    for f in features:
        cats[f["properties"]["category"]] = cats.get(f["properties"]["category"], 0) + 1
    w, s, e, n = REGION
    region = [
        {k: f["properties"][k] for k in ("title", "date", "category", "detail", "url")}
        for f in features
        if w <= f["properties"]["lon"] <= e and s <= f["properties"]["lat"] <= n
    ]
    return {
        "count": len(features),
        "categories": dict(sorted(cats.items(), key=lambda kv: -kv[1])),
        "newest_age_h": round(ages[0], 1) if ages else None,
        "median_age_h": round(statistics.median(ages), 1) if ages else None,
        "region_count": len(region),
        "region_events": region[:8],
    }


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", type=Path, default=Path("live-feeds-check.json"))
    args = ap.parse_args()
    now = datetime.now(UTC)
    report: dict = {"checked_at": now.strftime("%Y-%m-%dT%H:%M:%SZ"), "feeds": {}}
    raw: dict[str, dict] = {}

    # 1-2. Fetch raw, parse, validate.
    today = now.date()
    urls = {"usgs": lf.SOURCES["usgs"]["url"], "eonet": lf.SOURCES["eonet"]["url"], "gdacs": ""}
    for sid, url in urls.items():
        entry: dict = {"url": url or lf.SOURCES[sid]["url"]}
        pages: list[tuple[bytes, float, int]] = []

        def get(u: str, pages=pages) -> bytes:
            pages.append(fetch(u))
            return pages[-1][0]

        try:
            if sid == "gdacs":  # exactly as livefeeds.py asks (paged, fires apart)
                feats = lf.fetchers(get)["gdacs"]()
            else:
                raw[sid] = json.loads(get(url))
        except Exception as err:  # noqa: BLE001
            entry["error"] = str(err)
            report["feeds"][sid] = entry
            continue
        entry.update(
            http=sorted({st for _, _, st in pages}),
            requests=len(pages),
            seconds=round(sum(sec for _, sec, _ in pages), 2),
            kb=round(sum(len(b) for b, _, _ in pages) / 1024, 1),
        )
        if sid == "usgs":
            n_raw = len(raw[sid]["features"])
            feats = lf.parse_usgs(raw[sid])
            dropped_on_purpose = 0
        elif sid == "eonet":
            n_raw = len(raw[sid]["events"])
            feats = lf.parse_eonet(raw[sid], {"GDACS"})
            dropped_on_purpose = sum(
                1
                for e in raw[sid]["events"]
                if {s["id"] for s in e.get("sources", [])}
                and {s["id"] for s in e["sources"]} <= {"GDACS"}
            )
        else:
            got = [f for b, _, _ in pages for f in json.loads(b).get("features", [])]
            n_raw = len(got)
            unique = {(f["properties"]["eventtype"], f["properties"]["eventid"]) for f in got}
            dropped_on_purpose = n_raw - len(unique)  # repeated across pages
            # Earthquakes, only for the cross-check below (the app takes them from USGS).
            q = (
                f"?eventlist=EQ&fromDate={today - timedelta(days=14)}&toDate={today}"
                "&alertlevel=Green;Orange;Red&pagesize=100"
            )
            raw["gdacs"] = json.loads(fetch(lf.SOURCES["gdacs"]["url"] + q)[0])
        entry.update(
            raw_items=n_raw,
            dropped_on_purpose=dropped_on_purpose,
            lost=n_raw - dropped_on_purpose - len(feats),
            problems=validate(feats),
            **summarize(feats, now),
        )
        # 5. A few source links.
        entry["links"] = {
            f["properties"]["url"]: link_status(f["properties"]["url"])
            for f in feats[:3]
            if f["properties"]["url"].startswith("http")
        }
        entry["_features"] = feats
        report["feeds"][sid] = entry

    # 6. USGS vs GDACS earthquakes.
    if "usgs" in raw and "gdacs" in raw:
        usgs = [
            (
                f["geometry"]["coordinates"][:2],
                f["properties"]["time"] / 1000,
                f["properties"]["mag"],
            )
            for f in raw["usgs"]["features"]
        ]
        gq = [f for f in raw["gdacs"]["features"] if f["properties"]["eventtype"] == "EQ"]
        matched = []
        for f in gq:
            t = when(f["properties"]["fromdate"] + "Z")
            if not t:
                continue
            for pos, ts, mag in usgs:
                if abs(ts - t.timestamp()) <= 120 and km(pos, f["geometry"]["coordinates"]) <= 50:
                    matched.append(
                        {
                            "gdacs": f["properties"]["name"],
                            "usgs_mag": mag,
                            "gdacs_mag": (f["properties"].get("severitydata") or {}).get(
                                "severity"
                            ),
                        }
                    )
                    break
        report["cross_check"] = {
            "gdacs_earthquakes": len(gq),
            "also_in_usgs": len(matched),
            "examples": matched[:5],
            "note": "GDACS lists earthquakes from M4.5 too; USGS feed here is the last 7 days only.",
        }

    # 7. Through the API, as the app reads it.
    from fastapi.testclient import TestClient

    from sars_pipeline.server import create_app

    feeds = {
        sid: (lambda e=e: e["_features"]) for sid, e in report["feeds"].items() if "_features" in e
    }
    with tempfile.TemporaryDirectory() as tmp:
        lf.write(Path(tmp), feeds)
        res = TestClient(create_app(tmp)).get("/live.geojson")
        doc = res.json()
        report["api"] = {
            "status": res.status_code,
            "content_type": res.headers.get("content-type"),
            "features": len(doc["features"]),
            "sources_ok": [s["id"] for s in doc["sources"] if s["ok"]],
        }

    for e in report["feeds"].values():
        e.pop("_features", None)
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")

    print(f"checked {report['checked_at']}")
    for sid, e in report["feeds"].items():
        if "error" in e:
            print(f"{sid:6} ERROR {e['error']}")
            continue
        print(
            f"{sid:6} http {e['http']} {e['seconds']}s {e['kb']} kB | raw {e['raw_items']} -> "
            f"{e['count']} (dropped on purpose {e['dropped_on_purpose']}, lost {e['lost']}) | "
            f"problems {len(e['problems'])} | newest {e['newest_age_h']} h, median {e['median_age_h']} h | "
            f"region {e['region_count']} | links {list(e['links'].values())}"
        )
    print("cross-check", json.dumps(report.get("cross_check", {}))[:300])
    print("api", report["api"])
    bad = any("error" in e or e["problems"] or e["lost"] for e in report["feeds"].values())
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
