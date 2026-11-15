# 10. Status, to-do and time log

Updated: 2026-11-15 11:00 (local time, UTC-7). Judging starts 2026-11-16.

This file records what is built, what is left, and the time spent, for the project submission. Add a row to the time log at the end of each work session.

## 1. Where the work is

| Branch | Holds |
|---|---|
| `main` | Everything: specs, contracts v0.7.0, backend, frontend, the project README. What the live site runs |
| `backend` | Backend lane work (`backend/`, `data/`). Equal to `main` since 2026-11-15 11:00 |
| `frontend` | Frontend lane work (`frontend/`). Equal to `main` since 2026-11-15 11:00 |
| `testing` | Equal to `main` since 2026-11-15 11:00; the place to try both lanes together before the next merge to `main` |

Branch clean-up on 2026-11-14:

| Branch | What happened |
|---|---|
| `contract-0.4`, `contract-0.5`, `docs-contracts-0.3`, `Back-End` | Merged or obsolete, deleted earlier in the day |
| `backend-azure` | Merged into `backend`, deleted |
| `testing-live-events` | Its live feeds are on `backend` and `frontend`; kept as tag `archive/testing-live-events`, branch deleted |
| `jopa-testing` | A teammate's trial branch. Parts were ported to `frontend` (type icons, satellite before/now, live refresh note). The rest is **not merged**: kept as tag `archive/jopa-testing`, branch deleted |
| `Front-End` | One early commit, never used; kept as tag `archive/Front-End`, branch deleted |

Branch clean-up on 2026-11-15 at 10:00: `mobile`, `testing-frontend` and a second `jopa-testing` were deleted. All three were fully contained in `main` (nothing lost, no tag needed). GitHub holds `main`, `backend`, `frontend`, `testing`.

Restore an archived branch: `git switch -c <name> archive/<name>`.

The backend writes `contract_version` 0.7.0 (0.6.0 until 2026-11-14 23:35). The frontend accepts any `0.x`.

## Live deployment (Microsoft Azure, since 2026-11-14)

| What | Where |
|---|---|
| API (HTTPS) | `https://api.gigas.earth` (also still `https://gigas-sars.westus2.cloudapp.azure.com`) |
| Results | `https://gigassars.blob.core.windows.net/data/` (the page starts from `index.json`). 37 curated areas, 3,191 events and 2,845 layers since the backfill ended on 2026-11-15 (2.1 GB of results, 4.2 GB of cached windows on the VM, 40 GB free) |
| Site | https://gigas.earth, also https://gigas-project.starl0stgaming.workers.dev (Cloudflare Worker `gigas-project`, account StarL0stGaming; static files only, config in `frontend/wrangler.jsonc`; built with the storage address and an API address). Build and deploy steps: `frontend/README.md` (Deploy). Previews per branch: `https://<branch>-gigas-project.starl0stgaming.workers.dev` |
| Resources | Resource group `sars`, region `westus2`: virtual machine `sars-vm` (`Standard_B2s_v2`, 2 vCPU, 8 GB), storage account `gigassars` |
| Live version | Site: `main` at `3e3aa18`, released by hand 2026-11-15 10:25 (Worker version `2d48f28f`; the one before, `cc163214`, for rollback). Backend on the VM: branch `testing` as of 2026-11-15 00:45 (contract 0.7.0, memory fix); nothing newer in `backend/` since |

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
- **Released.** What follows was built on `testing` in the night of 2026-11-14, published to the live site at 00:30 on the team lead's word, and is on `main`.
- **The page loads on demand** (contract 0.7.0, C11). It starts from a short `index.json`; an area's layers and events are fetched when it is opened or when the map is zoomed in over it. Before, every visit fetched every event outline (13 MB).
- **Grouped markers.** Events on the globe are small square markers with the filter icons; events of one type close together share one marker with a count. Hollow: live event. Filled: seen by the radar. A click lists the events in the right panel.
- **City names** on the globe in three languages (Natural Earth).
- **My places.** The left list shows the places the visitor opened or asked for (positions kept in the browser only), with a remove button; suggestions until there are any. A request next to a known city opens the city instead of processing a new place.
- **More data, kept longer.** Larger boxes for the three case studies (60 to 90 km), six city sites, 27 state capitals queued one at a time on the VM (visitors first). Searches start at a fixed date and keep every date; events whose dates leave a series are archived, not deleted.
- **Marker fixes (2026-11-15 00:00 to 00:45).** A pressed marker no longer slides away (the page's press-shrink also shrank the marker's position on the map); radar markers show only from zoom 7 in and not for areas the visitor closed; markers can be clicked while the globe turns; selecting a group shows a dot at each of its events and fades the other markers; a double click zooms to the group; the group list has a close button on top.
- **Phones and Simple mode (2026-11-15 01:00).** Markers take a 44 px tap; groups are wider (fewer markers in dense areas); in Simple mode an event shows its name, dates and size, not the radar wording. Checked in a headless browser at phone, sideways-phone and desktop sizes, not on a real phone.
- **Backfill finished (2026-11-15, about 05:00).** All 37 curated sites processed on the VM with no errors and no restart, one at a time, about 9 minutes each. The server kept the memory of its largest run (5.9 of 6 GB after three large sites); it now hands memory back after each site (about 0.5 GB at rest).
- **Favicon** from the project logo (globe and orbit, transparent background).
- **Confidence floor.** Since 2026-11-14 21:30 no event under confidence 0.3 is published: 406 events in all, 738 before. The weak half was small regions barely past their threshold; 80 to 85% of the changed area stays. A judgment call, not checked against ground truth. Live on Azure.
- **Calls for other programs.** `GET /api/areas`, `/api/events` (by area, category, dates, lowest confidence; paged) and `/api/live` (by category, source), next to `/query` and `/history`. All listed with a try-it page at https://gigas-sars.westus2.cloudapp.azure.com/docs.
- **Tests.** 52 backend and 33 frontend tests pass; lint and the type check are clean.

### Results on real data (2026-11-14)

| Area | Events | Notes |
|---|---|---|
| Mexico | 5 drying regions (7 before the floor), 4 layers | 1,777 fire detections inside the border in the last 10 days |
| Chapala | 127 (224 before the floor) | agriculture 42, wildfires 32, deforestation 30, floods 20, other 14, urban 4 |
| Yucatán | 227 (443) | agriculture 142, wildfires 65, deforestation 28, other 9, urban 9 |
| Villahermosa | 47 (64) | deforestation 24, agriculture 18, wildfires 15, floods 5 (0.4 km²): thin, the data ends in mid-October |

The table above is the state on 2026-11-14 at 21:30. With the larger boxes (2026-11-15): Yucatán 1,173 events, Chapala 355, Villahermosa 223, and 3,191 over all 37 areas (`index.json` has the count per area; Xalapa has layers but no event above the confidence floor).

A search on 2026-11-14 at 17:50 found no newer granules **of the same maturity**: the PROVISIONAL series end 2026-10-21. Correction (2026-11-14 22:10): newer GCOV passes, up to 2026-11-13, are published as VALIDATED and are not shown yet (to-do 16).

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
| 1 | Try the live site end to end on a desktop browser and on a real phone (iOS Safari, Android Chrome): markers and their lists, zoom-in loading, my places, city names, a case study, a state capital, looking up a place, live events. Only headless-browser checks were done | Humans |
| 2 | Cloudflare automatic builds: pushes to `main` on 2026-11-15 produced no build, so the site is released by hand (`frontend/README.md`, Deploy). If builds start working, every push to `main` goes live by itself | Human |
| 4 | Azure account is a Free Trial: credit ends 30 days after sign-up (to be confirmed in the portal). Check that date against the judging period; upgrade to pay-as-you-go if needed. Add a budget alert | Human |
| 5 | Frontend: show history (`areas/<id>/history.json`, C10) in the bottom timeline; friendly cards (C8); a "processing" state from `GET /sites/<id>`; the server's sentence on a 429 answer | Frontend |
| 6 | Decide what to take from `archive/jopa-testing` (not merged). Its backend change (`refresh_minutes` in `live.geojson`) is on `backend` since 2026-11-14 | Both lanes |
| 7 | Licenses (`docs/09`): confirm the Meshy plan used for the satellite model; show the OpenStreetMap credit openly on the Street map look; decide whether to keep GDACS (no data license stated) | Frontend, team |
| 12 | Pending (decided 2026-11-14: not now): the VM updating itself from the `backend` branch. Until then Azure is updated by hand (`azure.sh deploy`, then `seed` when data changed; VPN needed at the venue) | Backend |
| 13 | Domain: site at https://gigas.earth and API at https://api.gigas.earth since 2026-11-14 22:00 (the API also still answers at its Azure name). The Worker's `VITE_API_BASE` build variable is `https://api.gigas.earth/` since 2026-11-15; left: the next build from `main` (the live site, released by hand as `5a53667b`, still calls the Azure name until then; settings in `frontend/README.md`, Deploy). Every `azure.sh deploy` now needs `SARS_DOMAIN=gigas.earth` | Human (Cloudflare), backend |
| 9 | Video, demo script and submission form (F07); confirm the judging criteria and submission rules in `docs/08` | Humans |
| 10 | Repository visibility (a `LICENSE` file was added on 2026-11-15) | Humans |
| 11 | `frontend/INTEGRATION.md` describes contract 0.5 and an old state of `testing`: update or remove | Frontend |
| 16 | Newer GCOV passes (late October on) are published as VALIDATED and are not shown: a series never mixes maturities and VALIDATED has 1 or 2 dates per frame. When it reaches 4 the selection moves to it; the earlier events stay (archived) but the earlier images leave the area. Showing both maturities as separate periods is not built | Backend |
| 17 | A place NISAR has no data for stays "processing" in My places until removed by hand | Frontend |
| 18 | Simple mode: no way to ask for a new place (the coordinates form is Technical only); the place list says "radar images" and shows ISO dates; "Suggested places" and the remove button have no child-level wording; live event rows keep the feeds' own terms | Frontend |
| 19 | Markers of different types can still overlap in a dense area. On a phone held sideways the map is about 195 px high: an opened area fits below zoom 7, so its radar markers stay hidden until zoomed in. Double tap on a marker is not verified on touch | Frontend |
| 20 | Backend deploys: always `SARS_DOMAIN=gigas.earth AZ_PREFIX=gigas backend/deploy/azure.sh deploy` (without the domain the API drops `api.gigas.earth`). Never `azure.sh seed`: the VM holds 37 areas the local `data/` does not, and seeding replaces its index | Backend |
| 21 | Speed: the VM reads one file at a time and uses about 5% of its processor while a site runs. Reading several at once is not built | Backend |
| 22 | Radar (not only soil moisture) for the whole country: at full detail about 1,200 boxes, more than the VM's disk and a week of running. A coarse national radar mosaic is possible; one full frame must be timed first. Not built | Backend |
| 23 | The Mexico mosaic keeps only its two latest cycles; earlier cycles since May 2026 are published and not shown. Not built | Backend |
| 24 | Leftovers: `/opt/sars/old` on the VM (185 MB, the data from before the first clean-up); local folders `sars-mobile` and `sars-testing-frontend` are on branches deleted from GitHub; `docs/01`, `specs/F02` and `specs/F06` were last checked on 2026-11-14 | Backend, docs |

### Decisions (asked at 20:00 on 2026-11-14, answered at 21:15)

| Decision | Outcome |
|---|---|
| Lowest confidence for published events | 0.3, done and live |
| REST calls for the processed data beyond `/query` and `/history` | Done and live: `/api/areas`, `/api/events`, `/api/live` (C6 in `docs/04`) |
| The VM updating itself from the `backend` branch | Not now; stays pending (needs a public repository or a read-only key on the VM) |
| `frontend` into `main` (newer than `main`: phone layout, satellite model, Worker config) | Open: frontend lane decides. The frontend was not touched for the changes above |
| Domain | Done 2026-11-14 22:00: `gigas.earth` (site), `api.gigas.earth` (API) |

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
| 2026-11-14 | 18:15 | 20:00 | 1.75 | Frontend | Phone layout, satellite model from NASA's NISAR illustration, Cloudflare Worker config, README draft, handoff notes |
| 2026-11-14 | 19:15 | 20:00 | 0.75 | Backend, docs | Session close: deploy notes match the real site host, open decisions written down |
| 2026-11-14 | 21:15 | 21:45 | 0.5 | Backend, docs | Confidence floor 0.3, rerun of the four areas, `/api` calls, deployed to Azure and checked |
| 2026-11-14 | 22:00 | 22:25 | 0.5 | Backend | API on `api.gigas.earth`, larger case-study boxes, six city sites, deployed |
| 2026-11-14 | 23:00 | 23:55 | 1.0 | Backend, frontend, docs | `main` and `testing` updated; contract 0.7 (index, per-area files), fixed search start, slow queue, event archive, 27 state capitals; page loads on demand, grouped markers, city names, my places; preview and VM deploy |
| 2026-11-14 | 23:55 | 01:10 | 1.25 | Frontend, backend | Marker fixes, ghost dots, double-click zoom, memory fix on the VM, release of `testing` to the live site, phone and Simple-mode pass on `mobile` |
| 2026-11-15 | 09:55 | 11:00 | 1.0 | Frontend, docs | Favicon, branch clean-up, release of `main` to the live site, README image moved, this log |

Total so far: backend and docs 20.25 h, frontend 13.0 h, 33.25 h in all. Not counted: the frontend lane's own sessions after 2026-11-14 20:00 (phone layout, reports, opening animation, deployment notes) and the README written by the team on 2026-11-15; their commits are in the git history. Work on `jopa-testing` (13:57 to 15:20, not merged) is not counted.
