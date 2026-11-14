"""Pick the granules for a site: one asf_search query, grouped by viewing geometry and maturity."""

import json
from collections import defaultdict
from datetime import UTC, datetime, timedelta
from pathlib import Path

from .granule import maturity_from_collection

MATURITY_RANK = {"OTHER": 0, "BETA": 1, "PROVISIONAL": 2, "VALIDATED": 3}


def search(bbox, start: str, end: str) -> list[dict]:
    """Every GCOV granule over the bbox [w, s, e, n] between two dates, as plain rows."""
    import asf_search as asf  # slow import; only needed when searching

    w, s, e, n = bbox
    wkt = f"POLYGON(({w} {s},{e} {s},{e} {n},{w} {n},{w} {s}))"
    results = asf.search(
        dataset="NISAR", processingLevel="GCOV", intersectsWith=wkt, start=start, end=end
    )
    return [
        {
            "id": p.properties["fileID"],
            "date": p.properties["startTime"][:10],
            "track": int(p.properties["pathNumber"]),
            "frame": int(p.properties["frameNumber"]),
            "direction": p.properties["flightDirection"].upper(),
            "collection": p.properties["collectionName"],
            "maturity": maturity_from_collection(p.properties["collectionName"]),
            "url": p.properties["url"],
            "bytes": p.properties.get("bytes"),
        }
        for p in results
    ]


def choose(rows: list[dict], max_dates: int = 6) -> dict:
    """The track/frame/direction group with the best same-maturity time series.

    Never mixes maturities (docs/03). Prefers groups with at least two dates (needed for change),
    then the higher maturity, then more dates. Keeps the latest `max_dates` dates.
    """
    groups: dict[tuple, dict[str, dict]] = defaultdict(dict)
    for row in rows:
        key = (row["track"], row["frame"], row["direction"], row["maturity"])
        best = groups[key].get(row["date"])
        # Reprocessed granules share a date; the higher ID (later CRID/version) wins.
        if best is None or row["id"] > best["id"]:
            groups[key][row["date"]] = row
    if not groups:
        raise ValueError("no GCOV granules found for this site and window")
    key, dates = max(
        groups.items(),
        key=lambda kv: (len(kv[1]) >= 2, MATURITY_RANK[kv[0][3]], len(kv[1])),
    )
    track, frame, direction, maturity = key
    granules = [dates[d] for d in sorted(dates)][-max_dates:]
    return {
        "track": track,
        "frame": frame,
        "direction": direction,
        "maturity": maturity,
        "granules": granules,
    }


def select_site(site_id: str, site: dict, out: Path, days: int = 120) -> dict:
    end = datetime.now(UTC)
    start = end - timedelta(days=days)
    rows = search(site["bbox"], start.strftime("%Y-%m-%d"), end.strftime("%Y-%m-%d"))
    picked = {
        "site": site_id,
        "bbox": site["bbox"],
        "window": [start.strftime("%Y-%m-%d"), end.strftime("%Y-%m-%d")],
        "searched": len(rows),
        **choose(rows),
    }
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(picked, indent=2), encoding="utf-8")
    return picked
