"""Friendly mode: an area's events as a few plain-language cards (areas/<id>/friendly.json).

Same detections as events.json, summed per category and graded 0 to 3, for people who do not read
radar. Pure bookkeeping: nothing here detects anything.
"""

from .categorize import CHANGE_TYPE

# category -> (label, what a level above 0 means, what level 0 means)
TEXT = {
    "floods": (
        "Flooding",
        "Radar sees water where there was land or plants before.",
        "No new water showed up between the radar passes.",
    ),
    "deforestation": (
        "Forest loss",
        "Places that looked like forest to the radar now look cleared or thinned.",
        "The forest looks the same in every radar pass.",
    ),
    "wildfires": (
        "Wildfire",
        "Fires were detected here from space; radar shows how the burned ground looks since.",
        "No burned ground was found.",
    ),
    "agriculture": (
        "Farming",
        "Fields changed the way crops do: growing, harvest, ploughing or irrigation.",
        "No field activity stood out.",
    ),
    "urban": (
        "Building",
        "Something new and hard-edged reflects the radar: possibly new structures.",
        "No new structures stood out.",
    ),
    "subsidence": (
        "Sinking ground",
        "The ground is moving away from the satellite, a few centimeters at a time.",
        "The ground stayed level, as far as the radar can tell.",
    ),
    "groundwater": (
        "Groundwater",
        "Ground sinking under a city often means water is being pumped out from below.",
        "No sinking linked to groundwater was found.",
    ),
    "drought": (
        "Drying soil",
        "The top layer of soil holds less water than in earlier passes.",
        "Soil moisture held steady.",
    ),
    "other": (
        "Other change",
        "The radar signal changed strongly, but not in a pattern we can name.",
        "Nothing else stood out.",
    ),
}
STATUS = ("calm", "calm", "watch", "alert")  # by highest card level
# Level thresholds: share of the area inside the events of one category, in percent.
SHARE_LEVEL_2, SHARE_LEVEL_3 = 1.0, 5.0
MIN_CONFIDENCE = 0.4  # below this the best event is too weak for more than level 1
MATURITY_ORDER = ["OTHER", "BETA", "PROVISIONAL", "VALIDATED"]
MATURITY_NOTE = {
    "BETA": "Early (beta) NISAR data: not yet checked by NASA, may contain errors.",
    "PROVISIONAL": "Provisional NISAR data: partly checked by NASA, still being improved.",
    "VALIDATED": "Validated NISAR data.",
    "OTHER": "Test data, not real measurements.",
}


def level(share_percent: float, confidence: float) -> int:
    if confidence < MIN_CONFIDENCE or share_percent < SHARE_LEVEL_2:
        return 1
    return 2 if share_percent < SHARE_LEVEL_3 else 3


def cards(area: dict, events: list[dict], area_km2: float) -> dict:
    by_category: dict[str, list[dict]] = {}
    for event in events:
        for category in event["categories"]:
            by_category.setdefault(category, []).append(event)
    # What the site is watched for, even when nothing was found: "no change" is a result too.
    expected = {c for c, t in CHANGE_TYPE.items() if t in area["change_types"] and c != "other"}
    out = []
    for category in sorted(set(by_category) | expected):
        label, found, quiet = TEXT[category]
        mine = sorted(by_category.get(category, []), key=lambda e: -e["area_km2"])
        if not mine:
            out.append({"category": category, "label": label, "level": 0, "headline": quiet})
            continue
        km2 = sum(e["area_km2"] for e in mine)
        share = min(100.0, 100 * km2 / area_km2)
        confidence = max(e["confidence"] for e in mine)
        out.append(
            {
                "category": category,
                "label": label,
                "level": level(share, confidence),
                "headline": found,
                "number": {"value": round(km2, 1), "unit": "km2", "label": "area affected"},
                "share_percent": round(share, 2),
                "places": len(mine),
                "from": min(e["date_range"][0] for e in mine),
                "to": max(e["date_range"][1] for e in mine),
                "confidence": confidence,
                "maturity": min((e["maturity"] for e in mine), key=MATURITY_ORDER.index),
                "event_ids": [e["id"] for e in mine[:5]],  # largest first
                "layer_id": mine[0]["layer_ids"][0] if mine[0]["layer_ids"] else None,
            }
        )
    out.sort(key=lambda c: (-c["level"], -c.get("share_percent", 0), c["category"]))
    top = out[0] if out and out[0]["level"] else None
    maturities = sorted({layer["maturity"] for layer in area["layers"]}, key=MATURITY_ORDER.index)
    return {
        "area_id": area["id"],
        "title": area["title"],
        "status": STATUS[top["level"]] if top else "calm",
        "headline": f"Biggest signal: {top['label'].lower()}." if top else "No change detected.",
        "cards": out,
        "data_notes": [
            *(MATURITY_NOTE[m] for m in maturities),
            "Every card is a hypothesis from satellite data, not a confirmed event on the ground.",
        ],
    }
