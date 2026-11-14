"""NASA FIRMS active-fire detections (optional context for the wildfire category).

Needs a free FIRMS map key in FIRMS_MAP_KEY (https://firms.modaps.eosdis.nasa.gov/api/map_key/).
Without it, burned forest is reported as deforestation and the evidence says no fire data was
checked.
"""

import csv
import io
import json
import logging
import os
import urllib.request
from datetime import date, timedelta
from pathlib import Path

log = logging.getLogger(__name__)
API = "https://firms.modaps.eosdis.nasa.gov/api/area/csv/{key}/{source}/{bbox}/{days}/{start}"
# Standard (SP) for older dates, near-real-time (NRT) for the last weeks; both VIIRS on Suomi NPP.
SOURCES = ("VIIRS_SNPP_SP", "VIIRS_SNPP_NRT")


def parse(text: str) -> list[dict]:
    rows = csv.DictReader(io.StringIO(text))
    return [
        {"lat": float(r["latitude"]), "lon": float(r["longitude"]), "date": r["acq_date"]}
        for r in rows
        if r.get("latitude") and r.get("longitude")
    ]


def hotspots(bbox, start: str, end: str, cache: Path) -> list[dict] | None:
    """Fire detections in bbox between two dates, or None when no key is configured."""
    key = os.environ.get("FIRMS_MAP_KEY")
    if not key:
        return None
    path = cache / f"firms_{'_'.join(f'{v:.4f}' for v in bbox)}_{start}_{end}.json"
    if path.exists():
        return json.loads(path.read_text(encoding="utf-8"))
    found: dict[tuple, dict] = {}
    day, stop = date.fromisoformat(start), date.fromisoformat(end)
    while day <= stop:
        days = min(10, (stop - day).days + 1)  # the API serves at most 10 days per request
        for source in SOURCES:
            url = API.format(
                key=key,
                source=source,
                bbox=",".join(f"{v:.5f}" for v in bbox),
                days=days,
                start=day.isoformat(),
            )
            try:
                with urllib.request.urlopen(url, timeout=60) as resp:
                    for h in parse(resp.read().decode()):
                        found[(h["lat"], h["lon"], h["date"])] = h
            except OSError as err:  # FIRMS is context only; never fail a run over it
                log.warning("FIRMS %s %s: %s", source, day, err)
        day += timedelta(days=days)
    out = sorted(found.values(), key=lambda h: (h["date"], h["lat"], h["lon"]))
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(out), encoding="utf-8")
    return out


def count_in(spots: list[dict], bbox, margin_deg: float = 0.005) -> int:
    w, s, e, n = bbox
    return sum(
        w - margin_deg <= h["lon"] <= e + margin_deg
        and s - margin_deg <= h["lat"] <= n + margin_deg
        for h in spots
    )
