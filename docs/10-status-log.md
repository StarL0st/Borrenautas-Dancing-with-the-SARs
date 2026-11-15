# 10. Status, to-do and time log

Updated: 2026-11-14 19:15 (local time, UTC-7). Judging starts 2026-11-16.

This file records what is built, what is left, and the time spent, for the project submission. Add a row to the time log at the end of each work session.

## 1. Where the work is

| Branch | Holds |
|---|---|
| `main` | Everything: specs, contracts v0.6.0, backend, frontend. `backend` and `frontend` were merged in on 2026-11-14 at 17:15 on the team lead's instruction |
| `backend` | Backend lane work (`backend/`, `data/`). Equal to `main` at the merge |
| `frontend` | Frontend lane work (`frontend/`). Equal to `main` at the merge |
| `testing` | Same files as `main` at the merge; the place to try both lanes together before the next merge to `main` |

Branch clean-up on 2026-11-14:

| Branch | What happened |
|---|---|
| `contract-0.4`, `contract-0.5`, `docs-contracts-0.3`, `Back-End` | Merged or obsolete, deleted earlier in the day |
| `backend-azure` | Merged into `backend`, deleted |
| `testing-live-events` | Its live feeds are on `backend` and `frontend`; kept as tag `archive/testing-live-events`, branch deleted |
| `jopa-testing` | A teammate's trial branch. Parts were ported to `frontend` (type icons, satellite before/now, live refresh note). The rest is **not merged**: kept as tag `archive/jopa-testing`, branch deleted |
| `Front-End` | One early commit, never used; kept as tag `archive/Front-End`, branch deleted |

Restore an archived branch: `git switch -c <name> archive/<name>`.

The backend writes `contract_version` 0.6.0. The frontend accepts any `0.x`.

## Live deployment (Microsoft Azure, since 2026-11-14)

| What | Where |
|---|---|
| API (HTTPS) | `https://gigas-sars.westus2.cloudapp.azure.com` (will move to `api.gigas.earth`) |
| Results | `https://gigassars.blob.core.windows.net/data/` (for example `manifest.json`) |
| Site | Not published yet. Goes to Cloudflare Pages, not Azure (decided 2026-11-14): `azure.sh site`, or a Pages project connected to the `frontend` branch (`backend/deploy/README.md`) |
| Resources | Resource group `sars`, region `westus2`: virtual machine `sars-vm` (`Standard_B2s_v2`, 2 vCPU, 8 GB), storage account `gigassars` |

Checked on Azure on 2026-11-14:

| Check | Result |
|---|---|
| HTTPS certificate | Issued automatically |
| Copy to storage as the machine itself (no stored key) | Works; 4 areas in storage since the clean-up at 18:00 (13 before) |
| Browsers on another site reading storage and calling the API | Allowed; listing the storage is refused |
| `/health`, `/query`, `/history` | Answer, contract 0.6.0 |
| A place already processed | Answered at once |
| A new place (Oaxaca, 14 granules) | About 2 minutes from request to storage (5 minutes on a laptop) |
| API stopped on purpose | Storage kept serving every file; API back in about 10 s |
| Load: 300 open push streams plus 50 requests a second for 20 s | 1000 of 1000 answered, median 0.8 s, slowest 2.9 s (sent through a VPN while a job ran) |
| Frontend built with the two addresses | 16 tests pass, build succeeds; not yet looked at in a browser by a person |

Not checked on Azure: the 500-stream cap (passed locally), a 12-hour refresh, a month of running.

## 2. Done (backend lane)

- **Data in.** NISAR GCOV (HH and HV backscatter), GUNW (ground motion) and SME2 (soil moisture) found with `asf_search` and read as windows over HTTPS, cached on disk. NASA FIRMS fire detections from VIIRS on NOAA-20. Maturity levels (BETA, PROVISIONAL, VALIDATED) are never mixed in one comparison.
- **Detection and categories.** Change regions get a signature (what the radar saw), then categories (floods, deforestation, wildfires, agriculture, urban, subsidence, groundwater, drought, other). Rules are listed in `backend/README.md`.
- **Three case studies** with wide boxes: Yucatán (deforestation), Villahermosa (flooding), Chapala (wildfires). Mexico City, San Francisco and the places looked up in advance were removed from the data on 2026-11-14 at 18:00: the demo holds Mexico and the three case studies (visitors can still look up any place).
- **Whole-Mexico view.** Soil moisture at about 2 km for the two latest 12-day cycles, the change between them, drying regions as events, and fire detections of the last 10 days, all clipped to the country border (Natural Earth outline).
- **Any-place lookup.** A visitor sends a point; the server answers from cache or queues the place and processes it. Places are cached by 0.2 degree grid cell. Limits: 5 new places per address per hour, 20 queued, 300 places in total.
- **Friendly cards.** Each area's events summed per category and graded 0 to 3 in plain language (`areas/<id>/friendly.json`), for the friendly mode.
- **API.** Manifest, layers, events, series, `/query`, `POST /sites`, `GET /sites/<id>`, server-sent events when new data is ready.
- **Live events, one rule set.** Since 2026-11-14 19:00 the server's file follows the same rules as the app's own collector (events of the last 24 hours plus those still going on; US weather alerts and volcano alert levels added; danger level per event), refreshed every 5 minutes. Before, a page that reached the server and a page that did not showed different events. Fixed the same evening: fire detections disappeared every day after 00:00 UTC (FIRMS counts days by UTC date).
- **Live disaster feeds** (NASA EONET, USGS, GDACS, NOAA NHC, NASA FIRMS) into `live.geojson`, built by the frontend lane on `testing-live-events` and brought onto `backend`. Not radar detections; each carries its source's credit.
- **History.** `areas/<id>/history.json` per area and `GET /history` by point and dates: every layer, event and series value in time order (contract C10).
- **Launch design** (running on Azure, see above): results in Blob Storage read directly by browsers, the virtual machine only for lookups, queries and refreshes; push after the copy to storage; stream cap, disk guard, memory limit and swap. Details: `docs/02`, `backend/deploy/README.md`.
- **Load test** on a laptop: 300 open push streams plus 50 requests a second for 20 s, 1000 of 1000 answered, median 120 ms, slowest 435 ms; beyond 500 streams the server answers 503 as designed.
- **Tests.** 47 automated tests pass; lint is clean.

### Results on real data (2026-11-14)

| Area | Events | Notes |
|---|---|---|
| Mexico | 7 drying regions, 4 layers | 1,777 fire detections inside the border in the last 10 days |
| Chapala | 224 | wildfires 91, agriculture 71, deforestation 55, floods 20, urban 10 |
| Yucatán | 443 | agriculture 239, wildfires 172, deforestation 64, urban 21 |
| Villahermosa | 64 | floods 5 (0.4 km²): thin, the data ends in mid-October |

A new search on 2026-11-14 at 17:50 found no newer NISAR granules for any of the four areas: the data ends 2026-10-21 because that is the latest published.

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
| 1 | Open the frontend against Azure in a browser and try it: map, Mexico, a case study, looking up a place | Humans |
| 2 | Publish the site on Cloudflare Pages: `npx wrangler login`, then `AZ_PREFIX=gigas backend/deploy/azure.sh site`; or connect a Pages project to the `frontend` branch | Human with backend |
| 3 | Domain `gigas.earth` (DNS is at Porkbun today): move the nameservers to Cloudflare, record `A api 20.112.74.42` (proxy off), then `SARS_DOMAIN=gigas.earth backend/deploy/azure.sh dns` for the rest (`backend/deploy/README.md`) | Human |
| 4 | Azure account is a Free Trial: credit ends 30 days after sign-up (to be confirmed in the portal). Check that date against the judging period; upgrade to pay-as-you-go if needed. Add a budget alert | Human |
| 5 | Frontend: show history (`areas/<id>/history.json`, C10) in the bottom timeline; friendly cards (C8); a "processing" state from `GET /sites/<id>`; the server's sentence on a 429 answer | Frontend |
| 6 | Decide what to take from `archive/jopa-testing` (not merged). Its backend change (`refresh_minutes` in `live.geojson`) is on `backend` since 2026-11-14 | Both lanes |
| 7 | Licenses (`docs/09`): confirm the Meshy plan used for the satellite model; show the OpenStreetMap credit openly on the Street map look; decide whether to keep GDACS (no data license stated) | Frontend, team |
| 8 | Event quality: decide a lowest confidence for published events (0.3 keeps about half the events and four fifths of the changed area), then rerun the three case studies and `azure.sh seed` | Human with backend |
| 12 | Updating Azure is by hand (`azure.sh deploy` over SSH, VPN needed at the venue). Decide whether the VM should update itself from the `backend` branch | Human with backend |
| 9 | Video, demo script and submission form (F07); confirm the judging criteria and submission rules in `docs/08` | Humans |
| 10 | License file and repository visibility | Humans |
| 11 | `frontend/INTEGRATION.md` describes contract 0.5 and an old state of `testing`: update or remove | Frontend |

### If time allows

- Real-time weather: `GET /weather?lat=&lon=` as a server-side proxy to the Meteomatics Weather API, cached 15 minutes. Scoped in `backend/README.md`, not built. Needs credentials and a `docs/09` entry.
- Villahermosa: a stronger flood signal (wider dates or a different box).
- Compare the two unvalidated rules with optical imagery for a few events.

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
| 2026-11-14 | 14:35 | 15:50 | 1.25 | Backend, docs | Live feeds onto `backend`, license checks, history API, Azure launch design (Blob Storage, guards, scripts), load test |
| 2026-11-14 | 13:30 | 16:45 | 3.25 | Frontend | Welcome screen, country search, live events fetched by the page, more live sources, 3D title, two-address build for Azure |
| 2026-11-14 | 15:50 | 17:30 | 1.75 | Backend, docs | First Azure run (machine, storage, deploy, seed), fixes, checks and load test on Azure, merge of both lanes into `main`, branch clean-up |
| 2026-11-14 | 17:30 | 19:15 | 1.75 | Backend, docs | Cloudflare Pages for the site, data reduced to four areas (local, VM, storage), live fire fix, live events aligned with the app, new granule search |

Total so far: backend and docs 17.0 h, frontend 9.5 h (frontend after 16:45 not counted yet), 26.5 h in all. Work on `jopa-testing` (13:57 to 15:20, not merged) is not counted.
