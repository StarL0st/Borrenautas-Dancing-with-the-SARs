# Backend (lane 1): sars-pipeline

Turns NISAR granules into map layers and categorized change events for the globe, and serves them (contracts C1-C7 in `docs/04-contracts.md`). Works on three NISAR products, all NASA data (citations in `docs/09-references.md`):

| Product | What it measures | Used for |
|---|---|---|
| **GCOV** (L2, 10 m, HH and HV backscatter) | How bright the surface is to the radar | Surface type; floods, forest or vegetation loss, new structures, crops |
| **GUNW** (L2, 80 m, unwrapped interferograms) | Ground motion between two passes (cm) | Subsidence (and groundwater pumping in cities) |
| **SME2** (L3, about 200 m) | Soil moisture (m3/m3) | Soil drying (drought signal) |

Python, managed with [uv](https://docs.astral.sh/uv/) as a member of the repo's uv workspace (root `pyproject.toml`). One shared `.venv` and `uv.lock` at the repo root.

- Never use `pip install` or `uv pip install`; use `cd backend && uv add <package>`.
- Secrets in `backend/.env` (gitignored): `ASF_EARTH_DATA_TOKEN=...` (required; approve the ASF app EULA once per Earthdata account, link in `docs/03`), `FIRMS_MAP_KEY=...` (optional, NASA FIRMS, enables the wildfire category), `SARS_ADMIN_TOKEN=...` (optional, guards `POST /sites`).

## Modes

The app has three modes; the backend feeds them from the same files and API.

| Mode | For | Backend gives |
|---|---|---|
| Technical | People who read radar | Layers, events with evidence and provenance, time series (C1-C7), `/query` |
| Friendly | Anyone | `areas/<id>/friendly.json`: the same detections as a few graded plain-language cards (below) |
| Real-time weather | Anyone | Planned, not built (below) |
| History (in any mode) | Timeline, replay | `areas/<id>/history.json` and `/history`: everything known about a place in time order (below) |

Coverage, in three depths: `mexico` (the whole country at 2 km, soil moisture and fires), the three case-study sites (40 km, every date since June 2026), and any place a visitor looks up (22 km cell, processed on request, then cached).

## Commands

```
cd backend
uv run sars-pipeline add-site cdmx --center=-99.13,19.43 --km 20 --title "Mexico City" \
    --types deformation,other --reference=-99.32,19.30,-99.26,19.40
uv run sars-pipeline run cdmx          # select (first time) and process; no args: every site
uv run sars-pipeline select cdmx       # only (re)pick granules -> data/selected/cdmx.json
uv run sars-pipeline refresh           # search again; process only sites with new granules
uv run sars-pipeline watch --hours 6   # refresh in a loop
uv run sars-pipeline serve             # API on http://127.0.0.1:8765/ (read-only)
uv run sars-pipeline serve --jobs --watch-hours 6   # plus /sites: process places on request
uv run sars-pipeline serve --jobs --public --watch-hours 12   # hosted: anyone may look up a place
uv run pytest && uv run ruff check     # checks
```

Write coordinates with `=` (`--center=-99.13,19.43`), otherwise the minus sign reads as an option.

## Sites

`backend/sites.json` (curated, in git) plus `data/sites.json` (requested through the API, not in git). Fields: `title`, `summary`, `bbox` [w, s, e, n], `change_types` (C1), optional `products` (default all three), `looks` (GCOV pixels averaged per side, default 4 = 40 m), `reference_bbox` (a stable area for GUNW, see below), `thresholds`, `thresholds_gunw`, `thresholds_sme2`, `cover` (overrides of the defaults below), `max_dates` (per product, default GCOV 6, GUNW 12, SME2 12), `fire_season` [from, to] (FIRMS detections that mark burn scars; needs `FIRMS_MAP_KEY`).

Why the two context rules above: in Hopelchén the forest is cleared by burning in the dry season, which NISAR did not image in 2026, so clearing shows up as burn scars that stay bare through the rainy season, not as an HV drop between passes; and its maize and sorghum fields turn as bright in HH as buildings late in the season, far from any town. Neither rule is validated against optical imagery.

Case-study sites (Mexico): `yucatan` (Hopelchén, deforestation), `villahermosa` (floods), `chapala` (wildfires), each 40 km wide with every date since June 2026. NISAR has no data for them between 2026-01-20 and 2026-06-16 (the dry and fire season); dates before are BETA and are not mixed with the PROVISIONAL ones (docs/03), so fires are located with FIRMS and the radar shows the after.

**Country mosaic** (`national.py`, site field `"kind": "mosaic"`, e.g. `mexico`). SME2 only, no size limit.
- Select: every SME2 granule over the bbox in the two latest 12-day cycles (about 250 granules per cycle for Mexico), one maturity.
- Read: each granule's part inside the bbox, averaged to 10 x 10 pixel cells (about 2 km, at least 30 valid pixels per cell), cached in `data/interim/mosaic/`. The first run streams about 500 granules (about half an hour); later runs only new ones.
- Clip: with the site field `"clip": "mexico"`, only cells whose center is inside the country outline are kept (image, series, drying events, fire detections). Outline: `src/sars_pipeline/borders/mexico.geojson`, from Natural Earth 1:10m Admin 0 Countries (public domain), simplified to 0.005 degrees and grown by 0.02 degrees (one cell) so coastal cells stay.
- Mosaic: mean of every pass in the cycle, by grid index (all SME2 share one global grid). Image rows are respaced from the equal-area grid to Web Mercator so the picture lines up at country scale.
- Layers: `Soil moisture` per cycle, `Soil moisture change` (latest minus previous), `Fire detections` (NASA FIRMS, last 10 days, needs `FIRMS_MAP_KEY`). Series: mean soil moisture per cycle.
- Events: `soil_drying` regions (cells drier by 0.05 m3/m3 or more, 250+ joined cells, the 12 largest). Two cycles cannot tell drought from the end of the rainy season; the event text says so. Fires are a layer, not events.

## Pipeline, per site

**Select** (`selection.py`). One `asf_search` per product over the last 180 days. Never mixes maturities within a product.
- GCOV: one track/frame/direction (same viewing geometry), latest 6 dates; prefers frames that cover 90%+ of the site, then 4+ dates (time-series rules need them), then the highest maturity.
- GUNW: the longest chain of consecutive pairs (each pair's second date is the next one's first), latest 12.
- SME2: any track (shared global grid), latest 12 dates.
- Saved to `data/selected/<site>.json` (committed for curated sites, so runs repeat).

**Read** (`remote.py`, `granule.py`, `gunw.py`, `sme2.py`). Streams only the site window over HTTPS (`h5py` + `fsspec`), never whole 2-7 GB files. Cached in `data/interim/`, so later runs only stream new granules.
- GCOV: average `looks` x `looks` pixels in linear power, then dB.
- GUNW: unwrapped phase minus the ionosphere phase screen (the product does not apply it), masked for water, invalid samples, coherence < 0.3; phase to line-of-sight motion `phase x wavelength / (4 pi)`, positive = away from the satellite. The spec does not state the sign; we use the ISCE/ARIA convention, and it makes Mexico City's documented subsidence read as sinking.
- SME2: recommended retrievals only (quality flag bit 0).

**Signatures** (`classify.py`): what the radar saw, per GCOV pair, after removing the scene-wide median change (weather, calibration) and a 3 px smoothing.

| Signature | Rule (dB) |
|---|---|
| `darkening_both` | HH and HV drop 3+ and HH ends below -18 (open water) |
| `hv_drop` | HV drops 3+, 1.5 more than HH, from vegetation-level HV (> -18) |
| `brightening` | HH rises 4+ on land |
| `strong_change` | anything else over 5 on land |
| `seasonal_cycle` | HV standard deviation over 2 across 4+ dates, never water |
| `sinking` (GUNW) | line-of-sight rate over 5 cm/yr away from the satellite, region 1 km2+ |
| `soil_drying` (SME2) | latest site mean 0.05 m3/m3 below the mean of earlier dates (4+ dates) |
| `burn_scar` (GCOV + FIRMS) | NASA FIRMS VIIRS fire detections in the site's `fire_season`, grown to their 375 m footprint, on vegetation or bare ground; then HV per date vs unburned vegetation (recovery) |

Regions under 25 px (0.04 km2 at 40 m) are dropped. A land change (not darkening) must still show at least half its threshold on the next pass, or it is dropped (ships, wet patches, glints). Changes in the latest pair cannot be checked yet: kept at 0.7x confidence and marked `persistent: null`.

**Surface type** (`categorize.cover_map`), from the mean of all GCOV dates. Thresholds checked on known places (Mexico City centro and Polanco, San Francisco downtown, Golden Gate Park, Presidio, the Bay and ocean, airport grass):

| Type | Rule |
|---|---|
| water | HV < -19 and HH < -11, or HH < -18 |
| built-up | HH > -4.5 (walls and ground act as corner reflectors) |
| vegetation | HV > -15 |
| bare or low | everything else (fields, grass, runways, dunes) |

At L-band, HV and the HH/HV ratio do not separate city from forest (both scatter strongly in HV); HH brightness does.

**Categories** (`categorize.decide`): signature x surface type x fire -> the frontend filter ids (`frontend/src/filters.ts`). First category is the primary one.

| Signature | Context | Categories |
|---|---|---|
| `darkening_both` | was not water | `floods` |
| `hv_drop` | vegetation, FIRMS fire detections in the window | `wildfires`, `deforestation` |
| `hv_drop` | vegetation | `deforestation` |
| `hv_drop` | bare or low | `agriculture` (harvest, ploughing) |
| `brightening` | vegetation before, HH rose 3+ dB more than HV (double bounce off water under plants) | `floods` (flooded vegetation) |
| `brightening` | built-up after, and built-up ground within 500 m before (or it was built-up already) | `urban` |
| `brightening` | bare before | `agriculture` (crops growing, soil wetting) |
| `seasonal_cycle` | vegetation or bare | `agriculture` |
| `sinking` | built-up (only sites with a checked `reference_bbox`; elsewhere the motion map only) | `subsidence`, `groundwater` |
| `sinking` | other | `subsidence` |
| `soil_drying` | | `drought` |
| `burn_scar` | bare or low on average since the fire, and latest HV 1.5 dB or more below unburned vegetation (not grown back) | `deforestation`, `wildfires` |
| `burn_scar` | otherwise | `wildfires` |
| any land change | was water | none (waves, wind, ships) |
| anything else | | `other` (published only at confidence 0.5+) |

Confidence (0-1) = 0.5 x how far past its threshold the region is (capped) + 0.5 x region size (capped at 10x the minimum). The formula is in every event's provenance.

Frontend filter types that need other data or more time, and are not produced: earthquakes, volcanoes, landslides (need a slope layer), forecast, sinkholes, drought beyond a drying signal, marine, glaciers, ice sheets, sea ice, permafrost, glacial lakes, induced seismicity, oil spills, coastal loss, reservoirs, logging (separate from deforestation).

**Export** (`site.py`, `export.py`): one area per site (`id` = site id) in `manifest.json`.
- Layers (C2) with an extra `group` (picker label) and `role`: `HH backscatter`/`HV backscatter` per date; `Surface type`; per GCOV pair `HH change`, `HV change`, `Detected change` (signature colors); `Ground motion` (cm/yr, red = away from the satellite); `Soil moisture` per date.
- Time series (C4): site mean HH, HV backscatter, soil moisture, open water as % of the site (`water-area`).
- Friendly cards in `areas/<id>/friendly.json` (`friendly.py`), linked from the area as `friendly`. One card per category found, plus a level 0 card for each category the site is watched for and nothing was found. Fields: `category`, `label`, `level`, `headline`, and when found `number` (km2 affected), `share_percent`, `places`, `from`, `to`, `confidence`, `maturity`, `event_ids` (largest first, max 5), `layer_id`. Top level: `status` (`calm`, `watch`, `alert` from the highest level), `headline`, `data_notes` (maturity wording). Levels are a judgment call, not validated: 1 = found but under 1% of the area or best confidence under 0.4; 2 = 1 to 5%; 3 = over 5%.
- Events (C7) in `events.json` and as a GeoJSON FeatureCollection in `events.geojson` (flat properties, loads straight into MapLibre). Each event: `categories`, `signature`, real outline `geometry`, `centroid` (always inside the outline), `bbox`, `area_km2`, `confidence`, `evidence` (numbers behind the decision), `series` (the region's own values per date), provenance with the citation.

## API (`serve`, contract C6)

| Endpoint | Returns |
|---|---|
| `/manifest.json`, `/areas/...` | Contract files |
| `/events.json`, `/events.geojson` | All events |
| `/query?lat=&lon=` | Events whose outline contains the point, plus area ids |
| `/query?bbox=w,s,e,n` | Events and areas intersecting the box. Both take `category=`, `type=`, `from=`, `to=` |
| `/history?lat=&lon=` | Per area at the point: its history (below), with only the events within 5 km of the point. Takes `from=`, `to=`, `category=` |
| `/events` | Server-sent `manifest` events when data changes (also after a background refresh); `live` events when `live.geojson` changes. At most 500 open streams, then 503 |
| `/health` | `{"ok": true}` |
| `GET /sites` (with `--jobs`) | Every site and its processing status |
| `GET /sites/<id>` (with `--jobs`) | One site: `status` (`idle`, `queued`, `running`, `done`, `error`), `position` in the queue, `processed` (has data), `error` |
| `POST /sites` (with `--jobs`) | `{"lat", "lon", "km" (max 30), "title"?, "id"?}`: adds a requested site and processes it in the background; returns 202 and the id |
| `POST /sites` (with `--jobs --public`), no token | `{"lat", "lon"}` only. See below |
| `POST /sites/<id>/refresh` (with `--jobs`) | Search again and process if new; `?force=true` to reprocess |

With `SARS_ADMIN_TOKEN` set, POST requests need `Authorization: Bearer <token>`. Leave it unset only on your own machine: each request starts downloads.

**Public lookup** (`serve --jobs --public`). Anyone may `POST /sites {"lat", "lon"}`; `km`, `title`, `id` and `/refresh` still need the token.
- Inside a curated site: answers with that site.
- Elsewhere the point snaps to a 0.2 degree grid; the cell (`cell-<lat>-<lon>`, a 22 km box) is the cached unit, so nearby lookups share it. Cells use few dates (GCOV 4, GUNW 4, SME2 6) to be quick.
- `200 {"id", "status": "done"}`: cached, load the area now. `"empty": true` with a `message` means there is no NISAR data there.
- `202 {"id", "status": "queued", "position"}`: processing; poll `GET /sites/<id>` or wait for the `manifest` event on `/events`. Visitor requests run before the timer's refreshes.
- A cell is searched again when asked for 12 hours or more after its last check. The timer (`--watch-hours`) refreshes curated sites only.
- Limits, answered with `429` and a reason: 5 new cells per client address per hour, 20 jobs queued, 300 cells in total. Kept in memory, so a restart resets the per-address count.
- shortcut: one worker, one process, files on disk. Many visitors asking for new places wait in line (minutes each); upgrade to several workers with a real queue when that hurts.

## History (`history.py`, contract C10)

One builder, used twice: `areas/<id>/history.json` (written with every site run, linked from the manifest area as `history`) and `GET /history` (the same, cut to a point and a date range).

- `timeline`: one entry per date that has anything: `layer_ids`, `event_ids`, `values` (series id -> value on that date).
- A layer or event sits at its **last** date: the pass on which it became visible. A change layer for June 17 to June 29 is under June 29.
- `events` are trimmed (no outline, evidence or provenance; those are in `events.json`), `layers` carry id, title, group, role, dates and URL, `series` id, title, units and URL.
- `periods`: one per maturity level with its first and last date. Values from different levels must not be compared (docs/03).
- Layers without a date (surface type) are not in a history. Passes without a reading have no value, not a null.
- Bookkeeping only: nothing here detects anything.

## Planned: real-time weather (not built)

`GET /weather?lat=&lon=`: the backend calls the Meteomatics Weather API (https://www.meteomatics.com/en/weather-api/) with credentials held only in the server environment (never in the browser), caches the answer 15 minutes per 0.1 degree cell, and returns temperature, rain, wind, the valid time and the source credit. Meteomatics is not NASA data: check its license terms before use and cite it in `docs/09-references.md`.

## Live data

There is no push from ASF, so "live" is polling: `refresh` (or `serve --jobs --watch-hours N`, or the cloud schedule) searches the catalog again for each site (a few seconds per product) and only re-processes a site when it got new granules. NISAR revisits each track every 12 days and products appear days after acquisition, so checking every 6-12 hours is plenty. A new request (`POST /sites`) is processed right away: about 30 granules, a few minutes for a 10-20 km site.

## Live disaster feeds (prototype)

`livefeeds.py` polls public event feeds and writes `live.geojson` to the data root, next to the contract files. These are **not NISAR detections**: each feature names its source (`source`, `source_name`, `credit`, `url`) and the file says so in `note`.

| Feed | Run by | Categories | Key |
|---|---|---|---|
| EONET v3, open events, last 30 days | NASA Earth Observatory (GSFC) | wildfires, volcanoes, floods, landslides, drought, earthquakes, sea-ice, storms, marine | none |
| Earthquakes M4.5+, last 7 days | USGS Earthquake Hazards Program (ANSS) | earthquakes | none |
| GDACS alerts, last 14 days (no earthquakes: USGS has them) | UN OCHA + European Commission JRC | storms, floods, volcanoes, drought, wildfires | none |
| Active tropical cyclones | NOAA National Hurricane Center | storms | none |
| VIIRS fire detections, last 24 h, in `FIRMS_BBOX` (default Mexico) | NASA FIRMS; NOAA-20/21 satellites | wildfires | `FIRMS_MAP_KEY` |

- `uv run sars-pipeline live-events`: fetch once, print each feed's count or error.
- `uv run sars-pipeline serve --live-minutes 15`: refresh in the background; `/events` pushes `event: live` (`{"type": "live", "url": "live.geojson"}`) when the file changes.
- One failing feed never stops the others: it is listed in `sources` with `ok: false` and the reason.
- Feature properties: `id`, `source`, `source_name`, `credit`, `category` (frontend filter id; `storms` is new), `title` (what, for example "Magnitude 5.5 earthquake"), `place` (where, in words, or "" when the feed gives none), `date`, `detail`, `url`, `lon`, `lat`. Points only.
- EONET events reported only by GDACS are dropped (they come in from GDACS directly). Other overlaps (for example a storm in both NHC and GDACS) are not merged yet.
- GDACS returns at most 100 events per request: cyclones, floods, volcanoes and droughts are paged apart from fires (fires capped at 300). Dates are the latest update.
- Tested against real events: `LIVE_FEEDS_TEST.md` (`scripts/check_live_feeds.py`).
- Where (`place`): USGS place text; EONET from the title ("Flood in Guatemala" -> "Guatemala"); GDACS affected countries ("Mexico, Guatemala, Belize and 2 more"); NOAA NHC ocean basin; FIRMS none (the app shows coordinates).

Changes:
- 2026-11-14: `livefeeds.py`, `live-events` command, `serve --live-minutes`, SSE `live` event.
- 2026-11-15 (UTC): fire detections vanished from the live file after 00:00 UTC. Cause: FIRMS counts days by UTC date, so "1 day" is only today. Now 2 days are asked and the last 24 hours kept (0 fires before, 1041 after). `refresh_minutes` is written into `live.geojson`. The VM refreshes every 5 minutes; measured there: a `live` push 14 s after the file was written, storage already holding the new file.
- 2026-11-15 (UTC): the live file follows the same rules as the app's own collector (`frontend/src/livefeeds.ts`): USGS last day (magnitude 2.5+, and landslides, collapses, blasts), US weather alerts (NOAA NWS, 40 newest, each placed at the middle of its first land zone), US volcanoes with a raised alert level, `severity` 0 to 3, `active`, and only events under 24 hours old or still active. Before, a page reading the server file and a page asking the sources itself showed different events. First run after a restart takes about 30 s (weather zones are looked up once, then kept in memory).
- 2026-11-15 (UTC): curated sites reduced to `mexico`, `chapala`, `yucatan`, `villahermosa` (`sf` and `cdmx` removed from `sites.json`; looked-up cells removed from the data). A new search found no newer NISAR granules for any of the four: the data ends 2026-10-21 because that is the latest published.
- 2026-11-14: real-event test (`LIVE_FEEDS_TEST.md`); GDACS paging, latest-update dates, `application/geo+json`.
- 2026-11-14: `place` on every event; USGS `title` is now "Magnitude N earthquake" (the place moved to `place`).
- Not in the contract (`docs/04`): adding `live.geojson` and the `live` push event there needs a `contract-change` PR. Sources still need entries in `docs/09-references.md`.

## Status (backend branch, 2026-11-14)

| Site | GCOV | GUNW | SME2 | Events |
|---|---|---|---|---|
| `chapala` Lake Chapala | 10 PROVISIONAL, t48 f12 asc, 2026-06-17 to 10-15 | 9 pairs | 24 dates | 224: wildfires 91 (37 burn scars not regrown also count as deforestation), agriculture 71, deforestation 55, floods 20, urban 10 |
| `yucatan` Hopelchén | 9 PROVISIONAL, t127 f79 desc, 2026-06-23 to 10-21 | 8 pairs | 24 dates | 443: agriculture 239, wildfires 172, deforestation 64 (62 are burn scars not regrown), urban 21 |
| `villahermosa` | 10 PROVISIONAL, t62 f11 asc, 2026-06-18 to 10-16 | 9 pairs | 19 dates | 64: floods 5 (0.4 km2, thin: data ends mid-October) |
| `mexico` (mosaic) | none | none | 496 granules, two cycles, 2026-09-28 to 10-21 | 7 drying regions inside the border; fire layer from FIRMS, last 10 days |

Known limits:
- Ground motion is along the radar's line of sight, not vertical; relative to the reference area; one geometry. No troposphere correction.
- The GCOV-derived surface type is rough (one rule set, two cities checked).
- "Deforestation" from radar alone can also be harvest or drying vegetation; the event text says so.
- Overlay images use each window's WGS84 bounds; projected windows are slightly rotated in lon/lat (fine at 20 km).
- Only the selected group's geometry is used per product; other tracks over the site are ignored.

## Cloud

`backend/deploy/README.md`: results in Azure Blob Storage (browsers read them there), an Azure VM (Docker, HTTPS) for lookups, queries and refreshes, a Static Web App for the frontend. Guards against load and crashes, steps, cost.
