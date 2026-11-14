# 10. Status, to-do and time log

Updated: 2026-11-14 14:35 (local time, UTC-7). Judging starts 2026-11-16.

This file records what is built, what is left, and the time spent, for the project submission. Add a row to the time log at the end of each work session.

## 1. Where the work is

| Branch | Head | Holds |
|---|---|---|
| `main` | docs only | Specs, contracts v0.5.0, references, this file |
| `backend` | `167f22b` | Pipeline, API, deployment scripts. Not merged into `main` |
| `frontend` | `e7a8f48` | Globe viewer. Not merged into `main` |
| `testing` | `8e44003` | `backend` plus `frontend` (as of `bbd7ea0`) for local checks |

Contract v0.5.0 was merged into `main` on 2026-11-14; the `contract-0.4`, `contract-0.5`, `docs-contracts-0.3` and `Back-End` branches were deleted. The backend writes `contract_version` 0.5.0. The frontend accepts any `0.x`.

## 2. Done (backend lane)

- **Data in.** NISAR GCOV (HH and HV backscatter), GUNW (ground motion) and SME2 (soil moisture) found with `asf_search` and read as windows over HTTPS, cached on disk. NASA FIRMS fire detections from VIIRS on NOAA-20. Maturity levels (BETA, PROVISIONAL, VALIDATED) are never mixed in one comparison.
- **Detection and categories.** Change regions get a signature (what the radar saw), then categories (floods, deforestation, wildfires, agriculture, urban, subsidence, groundwater, drought, other). Rules are listed in `backend/README.md`.
- **Three case studies** with wide boxes: Yucatán (deforestation), Villahermosa (flooding), Chapala (wildfires). Also Mexico City and San Francisco.
- **Whole-Mexico view.** Soil moisture at about 2 km for the two latest 12-day cycles, the change between them, drying regions as events, and fire detections of the last 10 days, all clipped to the country border (Natural Earth outline).
- **Any-place lookup.** A visitor sends a point; the server answers from cache or queues the place and processes it. Places are cached by 0.2 degree grid cell. Limits: 5 new places per address per hour, 20 queued, 300 places in total.
- **Friendly cards.** Each area's events summed per category and graded 0 to 3 in plain language (`areas/<id>/friendly.json`), for the friendly mode.
- **API.** Manifest, layers, events, series, `/query`, `POST /sites`, `GET /sites/<id>`, server-sent events when new data is ready.
- **Deployment scripts** for an Azure virtual machine (Docker Compose, automatic HTTPS) and a static site for the frontend. Written, not yet run. The unused Google Cloud scripts were removed.
- **Live disaster feeds** (NASA EONET, USGS, GDACS, NOAA NHC, NASA FIRMS) into `live.geojson`, built by the frontend lane on `testing-live-events` and brought onto `backend`. Not radar detections; each carries its source's credit.
- **Tests.** 40 automated tests pass; lint is clean.

### Results on real data (2026-11-14)

| Area | Events | Notes |
|---|---|---|
| Mexico | 7 drying regions, 4 layers | 1,777 fire detections inside the border in the last 10 days |
| Chapala | 224 | wildfires 91, agriculture 71, deforestation 55, floods 20, urban 10 |
| Yucatán | 443 | agriculture 239, wildfires 172, deforestation 64, urban 21 |
| Villahermosa | 64 | floods 5 (0.4 km²): thin, the data ends in mid-October |
| Mexico City | 14 | |
| San Francisco | 14 | |
| Monterrey, Guadalajara, Mérida, Tijuana, Puebla (looked-up cells) | 0 to 2 each | Processed in advance so the demo answers at once; 25 layers each |

Checked locally against a running server: manifest, `/query`, friendly cards, lookup of a curated site, lookup of a new place (Guanajuato: 5 minutes from request to ready), cache hit, rate limit, and the Mexico and Chapala layers in a headless browser (aligned with coastlines, no console errors).

### Known limits

- NISAR has no GCOV over the sites from 2026-01-20 to 2026-06-16 (the fire season), so fires and clearing are seen only by what the ground looks like afterwards.
- Two rules are not validated against optical imagery: a burn scar that stays bare counts as deforestation; brightening counts as urban only next to built-up ground.
- Friendly card thresholds (1% and 5% of the area) are judgment calls.
- Lookup limits are kept in memory and reset when the server restarts.

## 3. To do

### Before judging (2026-11-16)

| # | Task | Owner |
|---|---|---|
| 1 | Install the Azure CLI, `az login`, then `backend/deploy/azure.sh vm`, `deploy`, `seed`, `site` | Human (backend) |
| 2 | Check the deployed server: `/health`, `/query`, one public lookup from the site | Backend |
| 4 | Frontend: read `frontend/INTEGRATION.md` on `testing` (lookup answers 200 or 202, friendly cards, `GET /sites/<id>` for a "processing" state) | Frontend |
| 5 | Test the "Process this place" button and the static fallback build | Backend |
| 7 | Merge `backend` and `frontend` into `main` | Humans |
| 8 | Licenses (`docs/09`): confirm the Meshy plan used for the satellite model; show the OpenStreetMap credit openly on the Street map look; decide whether to keep GDACS (no data license stated) | Frontend, team |
| 11 | Live disaster feeds (`live.geojson`) are now on `backend` and `testing`, and the virtual machine refreshes them every 15 minutes. Still missing: a contract entry in `docs/04` (file and `live` push event), approved by both lanes. Then delete the `testing-live-events` branch | Both lanes |
| 12 | `docs/01`, `specs/F02` and `specs/F06` still mention Google Cloud Run (`docs/02` is updated) | Docs |
| 13 | Process five more demo places locally, run `sars-pipeline refresh`, then `azure.sh seed` | Backend |
| 9 | Video, demo script and submission form (F07); confirm the judging criteria and submission rules in `docs/08` | Humans |
| 10 | License file and repository visibility | Humans |

### If time allows

- Real-time weather: `GET /weather?lat=&lon=` as a server-side proxy to the Meteomatics Weather API, cached 15 minutes. Scoped in `backend/README.md`, not built. Needs credentials and a `docs/09` entry.
- Villahermosa: a stronger flood signal (wider dates or a different box).
- Compare the two unvalidated rules with optical imagery for a few events.
- Update the status table in `backend/README.md`.

### Not planned for this event

AI helpers, real-time events, user accounts, a database.

## 4. Time log

Times come from git commit timestamps (local time, UTC-7), rounded to the quarter hour. A session is a run of commits with no gap over two hours, so thinking and reading before a first commit are not counted. Hours per person are not recorded here: add them below if the submission asks.

| Date | From | To | Hours | Lane | Work |
|---|---|---|---|---|---|
| 2026-11-13 | 16:00 | 20:00 | 4.0 | Docs, backend | Repo and spec package, uv backend, first GCOV pull, Mexico chosen as region |
| 2026-11-13 | 17:45 | 19:45 | 2.0 | Frontend | Vite, TypeScript and MapLibre scaffold, globe home screen, filters, timeline |
| 2026-11-13 | 22:15 | 01:00 | 2.75 | Backend, docs | Site pipeline for GCOV, GUNW and SME2, signatures and categories, API, contracts v0.3.0 |
| 2026-11-14 | 09:15 | 12:55 | 3.75 | Backend | Case-study sites, burn scars, public lookup, Mexico mosaic, friendly cards, Azure scripts, fixes from real-data runs |
| 2026-11-14 | 09:15 | 12:45 | 3.5 | Frontend | Contract 0.3, accessibility menu, Simple and Technical modes, imagery, redesign |
| 2026-11-14 | 12:55 | 14:35 | 1.75 | Backend, docs | Mexico clipped to the border, contract v0.5.0 merged, branch clean-up, five cities processed in advance, references |
| 2026-11-14 | 12:45 | 13:30 | 0.75 | Frontend | Live events panel, zoom slider, texture names |

Total so far: backend and docs 12.25 h, frontend 6.25 h, 18.5 h in all.
