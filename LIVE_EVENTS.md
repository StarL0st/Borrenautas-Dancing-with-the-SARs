# Live events: "Happening now"

Branch `testing-live-events`, built on `testing` (2026-11-14). Status: prototype, tested locally, not merged.

## In one paragraph

The globe now shows what is happening on Earth right now, next to what NISAR measured. The backend polls four public disaster feeds (NASA EONET, USGS, GDACS, NOAA's National Hurricane Center) and a fifth one with a key (NASA FIRMS), turns them into one file, `live.geojson`, and tells open pages when it changes. The web app draws each event as a hollow ring on the globe and lists them under **"Happening now"**: what is happening, where, how long ago, and who reported it. Clicking a row flies the globe there. These are **not radar detections**: every event names its source, and the app says so.

## New features

### 1. Live events on the globe

- One **hollow ring** per event, colored by filter group (orange: natural disasters; pink: caused by people). Hollow, so it never reads as a NISAR detection, which is drawn filled.
- **Click a ring:** a popup with what happened, where, the date and type, the details (magnitude and depth, acres burned, alert level), the source's credit line, and a "More from the source" link.
- About **490 events** at a time (2026-11-14): earthquakes, wildfires, floods, droughts, tropical cyclones, sea ice and volcanoes.

### 2. "Happening now" list

In the left panel, under the filters:

- **One row per event, newest first:** what ("Magnitude 4.7 earthquake"), where ("24 km S of Yacuiba, Bolivia") and "Earthquakes · 2 hours ago · USGS".
- **Click a row:** the globe flies there and opens the popup.
- **15 rows at a time,** with "Show 15 more".
- **"Show live events" switch:** hides or shows the rings and the list.
- **Status line:** how many events and when they were last updated.

### 3. Same filters as the radar data

The filter checklist applies to live events too. A new filter type, **"Hurricanes and severe storms"** (`storms`), was added for cyclones and storms. Events whose type the app does not know always show.

### 4. Updates by themselves

- The backend fetches the feeds every N minutes (`serve --live-minutes 15`).
- When `live.geojson` changes, the server pushes an `event: live` message on `/events`, and open pages reload the events without a page refresh.
- The page also reloads every 10 minutes, in case the push stream is closed.

### 5. Three languages

All new text is in English, Spanish and German. Times ("2 hours ago") follow the chosen language.

### 6. A feed can fail without breaking the rest

If one feed is down or has no key, the others still load. `live.geojson` lists every feed with `ok`, its count, and the error if any.

## Sources

| Feed | Run by | What it adds | Key | Credit shown |
|---|---|---|---|---|
| EONET v3 (open events, last 30 days) | NASA Earth Observatory, Goddard Space Flight Center | wildfires, storms, sea ice, volcanoes, floods, landslides | none | NASA EONET, plus each event's own source (for example IRWIN) |
| Earthquakes M4.5+, last 7 days | U.S. Geological Survey, Earthquake Hazards Program (ANSS) | earthquakes | none | U.S. Geological Survey, Earthquake Hazards Program, ANSS ComCat |
| GDACS alerts, last 14 days | United Nations (OCHA) and European Commission (JRC) | tropical cyclones, floods, droughts, volcanoes, wildfires | none | Global Disaster Alert and Coordination System (GDACS) |
| Active tropical cyclones | NOAA National Hurricane Center | hurricanes and storms (Atlantic and Pacific) | none | NOAA National Hurricane Center |
| VIIRS fire detections, last 24 h, Mexico | NASA FIRMS; NOAA-20 and NOAA-21 satellites | wildfires (can also be crop burns or gas flares) | `FIRMS_MAP_KEY` (free) | NASA FIRMS |

Earthquakes come from USGS only (GDACS gets its own from the same network), and EONET events reported only by GDACS are skipped, so these two overlaps do not show twice.

## How it works

```
EONET   USGS   GDACS   NOAA NHC   FIRMS (key)
   \      |      |        |        /
    backend/src/sars_pipeline/livefeeds.py
      fetch -> one point per event (what, where, when, source, credit)
         |
    data root: live.geojson   (written whole, never half a file)
         |
    API server: GET /live.geojson, and event: live on /events
         |
    frontend: rings on the globe + "Happening now" list
```

### `live.geojson`

A GeoJSON FeatureCollection with `generated_at`, `note` and `sources` (one entry per feed: `id`, `name`, `owner`, `credit`, `url`, `ok`, `count`, `error`). Each feature is a point with these properties:

| Property | Meaning | Example |
|---|---|---|
| `id` | Unique, source prefix | `usgs-us7000ty9z` |
| `source`, `source_name`, `credit` | Who reported it, and the credit line | `usgs`, `U.S. Geological Survey, ...` |
| `category` | Frontend filter id | `earthquakes`, `storms`, `floods` |
| `title` | What is happening | `Magnitude 4.7 earthquake` |
| `place` | Where, in words; `""` when the feed gives none | `24 km S of Yacuiba, Bolivia` |
| `date` | Latest update (UTC) | `2026-11-14T18:04Z` |
| `detail` | Numbers behind it | `Magnitude 4.7, depth 506 km` |
| `url` | The source's own page | `https://earthquake.usgs.gov/...` |
| `lon`, `lat` | Position | `-63.65`, `-22.24` |

How each feed fills in **where** (`place`): USGS place text; GDACS affected countries ("Mexico, Guatemala, Belize and 2 more"); EONET from the title ("Flood in Guatemala" -> "Guatemala"); NOAA ocean basin. Fire detections and a few EONET items (icebergs) have none, so the app shows coordinates ("19.43° N, 99.13° W"). On 2026-11-14, 475 of 490 events had a place in words.

## Tested with real events

Full report: [`backend/LIVE_FEEDS_TEST.md`](backend/LIVE_FEEDS_TEST.md). The top 3 feeds (USGS, NASA EONET, GDACS) were checked against the live feeds on 2026-11-14 with `backend/scripts/check_live_feeds.py`:

- **No event lost**, no bad coordinates, dates or categories.
- **Links work:** every source link tried opened.
- **Feeds agree:** 99 of 100 GDACS earthquakes match USGS, with the same magnitude.
- **The server works:** it served all events as `application/geo+json`.

The test found five problems, all fixed. The biggest: GDACS returns at most 100 events per request and wildfires filled them, so **5 tropical cyclones, 29 floods and 13 droughts were missing**. Fires are now requested apart.

Unit tests: backend 39 (9 for the feeds), frontend 11 (4 for the live list and filters). All pass.

## Run it locally

Backend, in one terminal (needs [uv](https://docs.astral.sh/uv/)):

```
cd backend
uv run sars-pipeline serve --no-inbox --live-minutes 15
```

Frontend, in another (needs Node.js):

```
cd frontend
npm ci
npx vite
```

Open http://localhost:5173/. The first fetch takes about 15 seconds; the page updates by itself when it is done. Without processed NISAR data on the machine, the "Areas" list shows example places; the live events do not depend on it.

Other commands:

- `uv run sars-pipeline live-events`: fetch once and print each feed's count or error.
- `uv run python scripts/check_live_feeds.py --out report.json`: the real-event check.
- `FIRMS_MAP_KEY=...` in `backend/.env` turns on fire detections; `FIRMS_BBOX=w,s,e,n` changes their area (default Mexico).

## Files

| Where | File | What changed |
|---|---|---|
| backend | `src/sars_pipeline/livefeeds.py` | New: fetch, convert and write the feeds |
| backend | `src/sars_pipeline/server.py` | `event: live` push; `.geojson` served as `application/geo+json` |
| backend | `src/sars_pipeline/__init__.py` | `live-events` command, `serve --live-minutes` |
| backend | `tests/test_livefeeds.py` | New: 9 offline tests with recorded feed shapes |
| backend | `scripts/check_live_feeds.py`, `LIVE_FEEDS_TEST.md` | New: real-event check and its report |
| backend | `README.md` | Live feeds section and change log |
| frontend | `index.html` | "Happening now" section: switch, status, list, "Show more" |
| frontend | `src/globe.ts` | Ring layer, live popups, fly-to from the list |
| frontend | `src/main.ts` | Load, filter, list and refresh live events |
| frontend | `src/logic.ts` | `liveShown`, `liveList`, `liveWhere`, `ago` (pure, tested) |
| frontend | `src/filters.ts`, `src/i18n.ts`, `src/style.css` | `storms` type, new text in 3 languages, list and popup styles |
| frontend | `test/logic.test.ts` | 4 new tests |
| frontend | `README.md` | Live events section and change log |

This branch also carries the newest `frontend` branch (ae528b9: Simple/Technical mode, orbiting satellite, redesign), merged in at the start, plus the cached-lookup status fix that `testing` had.

## Before merging

- **Data contract:** `live.geojson`, its properties and the `event: live` push are not in `docs/04-contracts.md`. Adding them needs a `contract-change` PR approved by both lanes (`docs/04`, change protocol).
- **References:** the five sources need entries in `docs/09-references.md` (team rule). Their credit lines are already shown on every event.
- **Known limits:** the same storm can appear twice (NOAA and GDACS); GDACS fires are capped at 300; EONET wildfires are mostly in the US; Mexican fires need the FIRMS key.

## Change log

| Commit | What |
|---|---|
| `edd741e` | Sync the frontend with `origin/frontend` (ae528b9), keep `testing`'s cached-lookup status |
| `72d3ec2` | Backend: live feeds into `live.geojson`, `live-events` command, `serve --live-minutes`, `event: live` |
| `139cf97` | Frontend: rings on the globe, filters, switch, popups, `storms` type |
| `2d6b15b` | Real-event test; GDACS paging, latest-update dates, `application/geo+json` |
| `1c7cc5e` | "Happening now" list (what, where, when, source; click flies there); `place` on every event |
| this commit | This document |
