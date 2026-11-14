"""Pick the granules for a site, per product: one asf_search query each.

- GCOV (backscatter): one track/frame/direction group (same viewing geometry), one maturity.
- GUNW (interferograms): the longest chain of consecutive pairs in one group, one maturity.
- SME2 (soil moisture): any track (the EASE grid is shared), one maturity.

Maturities are never mixed within a product (docs/03).
"""

import json
from collections import defaultdict
from datetime import UTC, datetime, timedelta
from pathlib import Path

from .granule import maturity_from_collection
from .gunw import chain, pair_dates

MATURITY_RANK = {"OTHER": 0, "BETA": 1, "PROVISIONAL": 2, "VALIDATED": 3}
PRODUCTS = ("GCOV", "GUNW", "SME2")


def search(bbox, start: str, end: str, product: str = "GCOV") -> list[dict]:
    """Every granule of one product over the bbox [w, s, e, n] between two dates, as plain rows."""
    import asf_search as asf  # slow import; only needed when searching

    w, s, e, n = bbox
    wkt = f"POLYGON(({w} {s},{e} {s},{e} {n},{w} {n},{w} {s}))"
    results = asf.search(
        dataset="NISAR", processingLevel=product, intersectsWith=wkt, start=start, end=end
    )
    rows = []
    for p in results:
        row = {
            "id": p.properties["fileID"],
            "date": p.properties["startTime"][:10],
            "track": int(p.properties["pathNumber"]),
            "frame": int(p.properties["frameNumber"]),
            "direction": p.properties["flightDirection"].upper(),
            "collection": p.properties["collectionName"],
            "maturity": maturity_from_collection(p.properties["collectionName"]),
            "url": p.properties["url"],
        }
        if product == "GUNW":
            row["ref_date"], row["date"] = pair_dates(row["id"])
            row["sec_date"] = row["date"]
        rows.append(row)
    return rows


def _dedupe(rows: list[dict]) -> dict[str, dict]:
    """One row per date. Reprocessed granules share a date; the higher ID (later version) wins.
    For pairs, the shortest one (latest reference date) wins: 12-day pairs are the cleanest."""
    out: dict[str, dict] = {}
    for row in rows:
        best = out.get(row["date"])
        key = (row.get("ref_date", ""), row["id"])
        if best is None or key > (best.get("ref_date", ""), best["id"]):
            out[row["date"]] = row
    return out


def choose(rows: list[dict], max_dates: int = 6, min_dates: int = 4, product: str = "GCOV"):
    """The best same-maturity series for one product, or None if nothing was found.

    Prefers groups with at least `min_dates` dates (time-series rules need them), then at least
    two (change needs a pair), then the higher maturity, then more dates.
    """
    groups: dict[tuple, list] = defaultdict(list)
    for row in rows:
        geometry = () if product == "SME2" else (row["track"], row["frame"], row["direction"])
        groups[(*geometry, row["maturity"])].append(row)
    if not groups:
        return None
    series = {}
    for key, members in groups.items():
        dates = _dedupe(members)
        series[key] = (
            chain(list(dates.values())) if product == "GUNW" else [dates[d] for d in sorted(dates)]
        )
    key, picked = max(
        series.items(),
        key=lambda kv: (
            len(kv[1]) >= min_dates,
            len(kv[1]) >= 2,
            MATURITY_RANK[kv[0][-1]],
            len(kv[1]),
        ),
    )
    out = {"maturity": key[-1], "granules": picked[-max_dates:]}
    if product != "SME2":
        out.update(track=key[0], frame=key[1], direction=key[2])
    return out


def select_site(site_id: str, site: dict, out: Path, days: int = 180) -> dict:
    end = datetime.now(UTC)
    start = end - timedelta(days=days)
    window = (start.strftime("%Y-%m-%d"), end.strftime("%Y-%m-%d"))
    limits = {"GCOV": 6, "GUNW": 12, "SME2": 12}
    picked = {"site": site_id, "bbox": site["bbox"], "window": list(window), "products": {}}
    for product in site.get("products", PRODUCTS):
        # GUNW is read over the site plus its stable reference area.
        bbox = analysis_bbox(site) if product == "GUNW" else site["bbox"]
        rows = search(bbox, *window, product=product)
        choice = choose(rows, max_dates=limits[product], product=product)
        if choice:
            picked["products"][product] = {"searched": len(rows), **choice}
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(picked, indent=2), encoding="utf-8")
    return picked


def analysis_bbox(site: dict) -> list[float]:
    """Site bbox grown to include the GUNW reference area, if one is set."""
    ref = site.get("reference_bbox")
    if not ref:
        return list(site["bbox"])
    w, s, e, n = site["bbox"]
    return [min(w, ref[0]), min(s, ref[1]), max(e, ref[2]), max(n, ref[3])]


def granule_ids(selection: dict) -> set[str]:
    return {g["id"] for p in selection.get("products", {}).values() for g in p["granules"]}
