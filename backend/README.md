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
uv run pytest && uv run ruff check     # checks
```

Write coordinates with `=` (`--center=-99.13,19.43`), otherwise the minus sign reads as an option.

## Sites

`backend/sites.json` (curated, in git) plus `data/sites.json` (requested through the API, not in git). Fields: `title`, `summary`, `bbox` [w, s, e, n], `change_types` (C1), optional `products` (default all three), `looks` (GCOV pixels averaged per side, default 4 = 40 m), `reference_bbox` (a stable area for GUNW, see below), `thresholds`, `thresholds_gunw`, `thresholds_sme2`, `cover` (overrides of the defaults below).

## Pipeline, per site

**Select** (`selection.py`). One `asf_search` per product over the last 180 days. Never mixes maturities within a product.
- GCOV: one track/frame/direction (same viewing geometry), latest 6 dates; prefers 4+ dates (time-series rules need them), then the highest maturity.
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
| `brightening` | built-up after, or bare before | `urban` |
| `seasonal_cycle` | vegetation or bare | `agriculture` |
| `sinking` | built-up | `subsidence`, `groundwater` |
| `sinking` | other | `subsidence` |
| `soil_drying` | | `drought` |
| any land change | was water | none (waves, wind, ships) |
| anything else | | `other` (published only at confidence 0.5+) |

Confidence (0-1) = 0.5 x how far past its threshold the region is (capped) + 0.5 x region size (capped at 10x the minimum). The formula is in every event's provenance.

Frontend filter types that need other data or more time, and are not produced: earthquakes, volcanoes, landslides (need a slope layer), forecast, sinkholes, drought beyond a drying signal, marine, glaciers, ice sheets, sea ice, permafrost, glacial lakes, induced seismicity, oil spills, coastal loss, reservoirs, logging (separate from deforestation).

**Export** (`site.py`, `export.py`): one area per site (`id` = site id) in `manifest.json`.
- Layers (C2) with an extra `group` (picker label) and `role`: `HH backscatter`/`HV backscatter` per date; `Surface type`; per GCOV pair `HH change`, `HV change`, `Detected change` (signature colors); `Ground motion` (cm/yr, red = away from the satellite); `Soil moisture` per date.
- Time series (C4): site mean HH, HV backscatter, soil moisture.
- Events (C7) in `events.json` and as a GeoJSON FeatureCollection in `events.geojson` (flat properties, loads straight into MapLibre). Each event: `categories`, `signature`, real outline `geometry`, `centroid` (always inside the outline), `bbox`, `area_km2`, `confidence`, `evidence` (numbers behind the decision), `series` (the region's own values per date), provenance with the citation.

## API (`serve`, contract C6)

| Endpoint | Returns |
|---|---|
| `/manifest.json`, `/areas/...` | Contract files |
| `/events.json`, `/events.geojson` | All events |
| `/query?lat=&lon=` | Events whose outline contains the point, plus area ids |
| `/query?bbox=w,s,e,n` | Events and areas intersecting the box. Both take `category=`, `type=`, `from=`, `to=` |
| `/events` | Server-sent `manifest` events when data changes (also after a background refresh) |
| `/health` | `{"ok": true}` |
| `GET /sites` (with `--jobs`) | Every site and its processing status |
| `POST /sites` (with `--jobs`) | `{"lat", "lon", "km" (max 30), "title"?, "id"?}`: adds a requested site and processes it in the background; returns 202 and the id |
| `POST /sites/<id>/refresh` (with `--jobs`) | Search again and process if new; `?force=true` to reprocess |

With `SARS_ADMIN_TOKEN` set, POST requests need `Authorization: Bearer <token>`. Leave it unset only on your own machine: each request starts downloads.

## Live data

There is no push from ASF, so "live" is polling: `refresh` (or `serve --jobs --watch-hours N`, or the cloud schedule) searches the catalog again for each site (a few seconds per product) and only re-processes a site when it got new granules. NISAR revisits each track every 12 days and products appear days after acquisition, so checking every 6-12 hours is plenty. A new request (`POST /sites`) is processed right away: about 30 granules, a few minutes for a 10-20 km site.

## Status (backend branch, 2026-11-14)

| Site | GCOV | GUNW | SME2 | Events |
|---|---|---|---|---|
| `cdmx` Mexico City | 6 PROVISIONAL, t19 f11 asc, 2026-08-14 to 10-13 | 12 pairs, 2026-05-10 to 10-13 | 12 dates | 14: a 222 km2 sinking bowl over the old lakebed at about 14 cm/yr (line of sight), 3 smaller sinking areas, 7 vegetation losses on the western hills, 2 farmland areas |
| `sf` San Francisco (test) | 6 PROVISIONAL, t135 f21 asc | 12 pairs | 12 dates | 14: mostly new or changed structures on the waterfront |

Known limits:
- Ground motion is along the radar's line of sight, not vertical; relative to the reference area; one geometry. No troposphere correction.
- The GCOV-derived surface type is rough (one rule set, two cities checked).
- "Deforestation" from radar alone can also be harvest or drying vegetation; the event text says so.
- Overlay images use each window's WGS84 bounds; projected windows are slightly rotated in lon/lat (fine at 20 km).
- Only the selected group's geometry is used per product; other tracks over the site are ignored.

## Cloud

`backend/deploy/README.md`.
