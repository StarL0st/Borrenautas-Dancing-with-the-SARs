# Live feeds: top 3 tested against real events

Date: 2026-11-14, 19:43 UTC. Branch `live-events`. Code: `src/sars_pipeline/livefeeds.py`. Check script: `scripts/check_live_feeds.py`.

## Why these three

Of the five feeds in `livefeeds.py`, these three were picked to test now:

| Rank | Feed | Run by | Why |
|---|---|---|---|
| 1 | USGS earthquakes, M4.5+, last 7 days | U.S. Geological Survey, Earthquake Hazards Program (ANSS); US government data | Fastest (minutes after a quake), exact locations, no key, fills the empty `earthquakes` filter |
| 2 | NASA EONET v3, open events, last 30 days | NASA Earth Observatory, Goddard Space Flight Center | NASA (team rule: prefer NASA), no key, many categories at once (fires, storms, sea ice, volcanoes, floods, landslides) |
| 3 | GDACS alerts, last 14 days | UN OCHA and European Commission JRC | Global floods, droughts, tropical cyclones and fires with alert levels, no key; covers storms when NOAA has none active |

Not picked: **NOAA National Hurricane Center** (no active Atlantic or Pacific storms on the test date, so nothing real to test; GDACS covers cyclones worldwide) and **NASA FIRMS** (needs a free `FIRMS_MAP_KEY`, not set on this machine).

## What the check does

`uv run python scripts/check_live_feeds.py --out report.json` (network needed, read-only):

1. Fetches each feed exactly as the app does (GDACS: paged, see below) and times it.
2. Runs the answers through `livefeeds.py` and checks every event: coordinates in range, unique ids, a known filter category, a readable date, a title and a credit line. Counts what was dropped on purpose and what was lost.
3. Measures freshness: age of the newest event and the median event.
4. Lists events in a box around Mexico and Central America (lon -118.5 to -77, lat 5 to 33; this box also takes in the US Gulf coast).
5. Opens the first three source links of each feed.
6. Cross-checks earthquakes: each GDACS earthquake against the USGS feed (same quake = within 2 minutes and 50 km).
7. Serves the result through the API (`GET /live.geojson`), as the web app reads it.

It exits with 1 if a feed fails, an event has a problem, or an event is lost.

## Results

| Feed | HTTP | Requests | Time | Size | Raw | Shown | Dropped on purpose | Lost | Problems | Newest | Median age | Near Mexico | Links |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| USGS | 200 | 1 | 0.35 s | 83 kB | 122 | 122 | 0 | 0 | 0 | 1.7 h | 80 h | 6 | 3 of 3 open (200) |
| EONET | 200 | 1 | 1.3 s | 118 kB | 38 | 38 | 0 | 0 | 0 | 44 h | 404 h | 6 | 3 of 3 open (200) |
| GDACS | 200 | 4 | 10.6 s | 471 kB | 349 | 331 | 18 (repeated across pages) | 0 | 0 | 20 h | 68 h | 2 | 3 of 3 open (200) |

- **Categories shown:** USGS 122 earthquakes. EONET 25 wildfires, 11 sea ice, 2 storms. GDACS 282 wildfires, 31 floods, 13 droughts, 5 tropical cyclones.
- **Cross-check:** 99 of 100 GDACS earthquakes (last 14 days, M4.5+) are in the USGS feed with the same magnitude. The one left over is most likely older than the USGS feed's 7 days.
- **API:** `GET /live.geojson` answered 200, `application/geo+json`, 491 events, all three sources `ok`.
- **Web app:** the globe showed the events as rings with source popups (checked in the browser earlier the same day, 260 events before the GDACS fix).

### Real events in the test (near Mexico and Central America)

| Date (UTC) | Feed | Event | Detail |
|---|---|---|---|
| 2026-11-13 21:19 | USGS | M 4.6, 33 km SSW of La Libertad, El Salvador | depth 59 km |
| 2026-11-13 08:01 | USGS | M 4.6, 18 km WNW of Río Grande, Panama | depth 10 km |
| 2026-11-10 14:54 | USGS | M 5.5, 40 km S of Puerto San José, Guatemala | depth 60 km |
| 2026-11-12 | EONET | Wildfire Red Hill, Perry, Mississippi | 519 acres, reported by IRWIN (US interagency fire system) |
| 2026-11-12 | GDACS | Drought in Mexico, Central America, the Caribbean and the US | Orange alert, medium impact for agricultural drought over 977,982 km² |
| 2026-11-08 | GDACS | Flood in Mexico | Green alert, since 2026-08-17 |

No M4.5+ earthquake hit Mexico itself in the 7 days, and no NOAA storm was active. Elsewhere, GDACS listed tropical cyclones Murasu (Red alert, India), In-Fa, Cempaka, Pena and one in the southwest Indian Ocean.

## Problems the real test found, and fixes

| # | Problem | Effect | Fix |
|---|---|---|---|
| 1 | GDACS returns at most 100 events per request. Wildfires filled them | Only 2 floods and **no cyclones or droughts** were shown, while GDACS had 31 floods, 13 droughts and 5 cyclones | Cyclones, floods, volcanoes and droughts are asked for apart from fires, page by page (`GDACS_PAGE`, `GDACS_FIRE_PAGES = 3`); repeats across pages are dropped. Test: `test_gdacs_fires_get_their_own_pages` |
| 2 | GDACS events were dated by when they started | A flood still active today showed as August | The date is now the latest update (`todate`); the start is in the detail ("since 2026-08-17"). Test: `test_gdacs_uses_latest_update_and_drops_empty_severity` |
| 3 | GDACS floods carry "Magnitude 0" | Meaningless text in the popup | Severity is shown only when it is above 0 |
| 4 | EONET text read "Reported by 519 acres · IRWIN" | Garbled popup text | Now "519 acres · Reported by IRWIN" |
| 5 | The API served `.geojson` as `application/octet-stream` | Works in the app, but wrong for other clients | Registered `application/geo+json` in `server.py` |

## Known limits (not fixed)

- **Freshness differs by feed.** USGS updates within minutes. EONET and GDACS list ongoing events, so their median age is days to weeks; the date shown is the latest update.
- **The same event can come from two feeds** (for example a cyclone from both NOAA and GDACS). Only GDACS-only EONET items and GDACS earthquakes are dropped.
- **GDACS fires are capped at 300** (3 pages) to keep the file small.
- **EONET wildfires are mostly US** (they come from IRWIN, the US fire system). Mexico's fires need NASA FIRMS (key) or a Mexican source.
- **Licenses:** USGS (US government), NASA EONET (open) and GDACS (credit by name, per its terms) are cited in every event's `credit`. They still need entries in `docs/09-references.md`, and `live.geojson` needs a `contract-change` PR for `docs/04`.

## Rerun

```
cd backend
uv run pytest tests/test_livefeeds.py      # offline tests with recorded shapes
uv run python scripts/check_live_feeds.py --out live-feeds-check.json   # real feeds
```
