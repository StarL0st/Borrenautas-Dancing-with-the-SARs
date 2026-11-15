"""History: everything known about an area in time order (areas/<id>/history.json, GET /history).

Pure bookkeeping over the manifest area, its events (C7) and its series files (C4): which layers,
events and series values belong to each date. Nothing here detects anything.
"""

import json
from pathlib import Path

# Event fields kept in a history; outlines, evidence and provenance stay in events.json.
EVENT_FIELDS = (
    "id",
    "type",
    "categories",
    "signature",
    "title",
    "date_range",
    "centroid",
    "bbox",
    "area_km2",
    "confidence",
    "maturity",
    "product",
    "layer_ids",
)
LAYER_FIELDS = ("id", "title", "group", "role", "product", "maturity", "date", "date_range", "url")


def _span(item: dict) -> tuple[str, str]:
    """(first, last) date of a layer or event; undated layers (surface type) have none."""
    if item.get("date_range"):
        return item["date_range"][0], item["date_range"][1]
    return (item["date"], item["date"]) if item.get("date") else ("", "")


def build(
    area: dict, events: list[dict], data_dir: Path, from_: str | None = None, to: str | None = None
) -> dict:
    """The area's history, cut to [from_, to] (ISO dates, both optional, both inclusive).

    A layer or event sits on the timeline at its last date: the pass on which it became visible.
    """

    def within(first: str, last: str) -> bool:
        return bool(last) and (from_ is None or last >= from_) and (to is None or first <= to)

    layers = [x for x in area["layers"] if within(*_span(x))]
    events = sorted((e for e in events if within(*_span(e))), key=lambda e: (_span(e)[1], e["id"]))
    days: dict[str, dict] = {}

    def day(date: str) -> dict:
        return days.setdefault(date, {"date": date, "layer_ids": [], "event_ids": [], "values": {}})

    for layer in layers:
        day(_span(layer)[1])["layer_ids"].append(layer["id"])
    for event in events:
        day(_span(event)[1])["event_ids"].append(event["id"])
    series = []
    for ref in area.get("timeseries", []):
        path = Path(data_dir) / ref["url"]
        if not path.exists():
            continue
        doc = json.loads(path.read_text(encoding="utf-8"))
        points = [
            p for p in doc["points"] if p.get("value") is not None and within(p["date"], p["date"])
        ]
        if not points:
            continue
        series.append(
            {
                "series_id": doc["series_id"],
                "title": doc["title"],
                "units": doc["units"],
                "maturity": doc.get("maturity"),
                "url": ref["url"],
            }
        )
        for p in points:
            day(p["date"])["values"][doc["series_id"]] = p["value"]
    # One period per maturity level: values from different levels must not be compared (docs/03).
    periods: dict[str, list[str]] = {}
    for item in [*layers, *events]:
        first, last = _span(item)
        seen = periods.setdefault(item["maturity"], [first, last])
        seen[0], seen[1] = min(seen[0], first), max(seen[1], last)
    timeline = [days[d] for d in sorted(days)]
    return {
        "area_id": area["id"],
        "title": area["title"],
        "from": from_ or (timeline[0]["date"] if timeline else None),
        "to": to or (timeline[-1]["date"] if timeline else None),
        "periods": [
            {"maturity": m, "from": a, "to": b}
            for m, (a, b) in sorted(periods.items(), key=lambda x: x[1])
        ],
        "timeline": timeline,
        "events": [{k: e[k] for k in EVENT_FIELDS if k in e} for e in events],
        "layers": [{k: x[k] for k in LAYER_FIELDS if k in x} for x in layers],
        "series": series,
    }
