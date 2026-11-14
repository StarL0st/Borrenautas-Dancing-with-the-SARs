# Frontend (lane 2)

Vite + TypeScript + MapLibre GL JS (stack from `docs/02-architecture.md`). Work on the `frontend` branch, edit only `frontend/`, and follow the root `CLAUDE.md`.

## Run

```
cd frontend
npm ci
npm run dev       # http://localhost:5173
npm run build     # type-check + static build into dist/
```

## Data

The frontend reads only contract data (`docs/04-contracts.md`): the manifest (C1), layers (C2), and time series (C4), from one base URL.

- **Live backend (default):** `http://127.0.0.1:8765/`. Start it from the `backend` branch with `cd backend && uv run sars-pipeline serve`, then `uv run sars-pipeline synthetic` to feed it test granules. It pushes `event: manifest` on `/events` when data changes (contract C6).
- **Static build:** set `VITE_DATA_BASE=./data/` and copy the backend output into `public/data/`. There is no `/events` endpoint there, so the app must work without live updates.

## Current state

A globe that zooms into a map (one MapLibre map, `globe` projection).

- **Filters:** three groups in the left sidebar (Natural disasters, Disasters caused by humans, Land use), each opening to a checklist of subdivisions with "Select all". Only areas matching a ticked subdivision are marked. Ids in `src/filters.ts` are the back end's `categories`.
- **Dots as tabs:** clicking a dot (or its row in the area list) opens that area as a tab in the right panel; clicking again closes it. Open tabs stack in a scrollable list.
- **Detected changes** (`events.geojson`): outlines and dots on the map colored by filter group, a popup on click, and each area's timeline. Filtered by the same checklist.
- **Layer picker:** one option per back-end layer `group`, each with its own date slider, opacity, legend and full provenance (C3). Color bars for `gray`, `rdbu` and `brbg`; swatches for the `Surface type` and `Detected change` class layers.
- **Change over time:** a line chart per unit from the area's C4 time series files, with a hover readout and a table view (`src/chart.ts`).
- **Process this place:** asks the back end (`POST /sites`, needs `serve --jobs`) to process the typed coordinates; the area appears when the server reports it ready.
- **Go to coordinates:** latitude and longitude inputs fly to that point and drop a pin.
- **Views:** "Globe view", "Close-up view" (low, tilted camera with the horizon in view), and "Auto-rotate" (turns the Earth slowly; stops when you open an area).
- **View wheel** (`src/wheel.ts`): Zoom, Orbit, Home, Center, Look, Up/Down. Hold a button and drag, or focus it and use the arrow keys.
- **Accessibility menu** (`src/settings.ts`): language (English, Spanish, German), wheel size (large, medium, small; medium is the default) and globe texture. Choices are saved in the browser.
- **Mode switch** (header, between Tutorial and Accessibility): **Simple** (default) or **Technical**. Technical shows everything the back end sends. Simple uses short filter names (same text size as Technical), no coordinate form, and in each open area: one radar picture chosen by the app (detected change, else surface type, else the first layer) with a date slider and color key, one sentence about the radar passes, and the detected changes without confidence figures. No chart and no provenance in Simple mode.
- **Satellite** (`src/satellite.ts`, mesh in `src/assets/satellite.bin`): a model circling the globe, drawn as a MapLibre custom layer. It is an illustration: the orbit has NISAR's 98.4° tilt, but position, height and size are not real, and the tutorial says so. It fades out when zooming in and stands still when the system asks for reduced motion.
- **Look**: the team palette (Ink Black `#031927` surfaces, White `#fefdff` text, Powder Blue `#8eb1c7` secondary text, Tangerine Dream `#ef946c` for what is on or primary, Ebony `#6b654b` as the fill behind notices); roles are documented at the top of `src/style.css`. IBM Plex Sans and IBM Plex Mono (bundled, no font server). The page title is **G.I.G.A.S**.
- **Side panels**: the arrows on the left and right edges of the globe push a panel off screen and pull it back. Opening an area brings the right panel back by itself.
- **Motion**: the Earth glides in and turns by itself on arrival (Auto-rotate starts on), the area list cascades in on load, switching mode cross-fades the two panels, tutorial steps fade. All of it is reduced to fades or switched off when the system asks for reduced motion.
- **Satellite looks**: painted (white body, blue wings) in Simple mode, a blueprint grid in Technical mode.
- **Tutorial:** a step-by-step tour (`src/tour.ts`), shown on first visit and from the Tutorial button.
- **Manifest:** an unsupported major `contract_version` shows an error and the app keeps working. Refetches on each `manifest` event from the live server.

### Languages

All interface text is in `src/i18n.ts`; a test checks every language has every key. Text from the radar data (area names, layer descriptions, event summaries) is shown as the back end sends it, in English.

### Globe textures

| Name | What it is | Source |
|---|---|---|
| High Quality (default) | Cloud-free mosaic of Copernicus Sentinel-2 images; sharp to zoom 14 (city blocks), stretched beyond | EOX `s2cloudless_3857` (2016 edition, CC BY 4.0), public tile server, no key |
| Hologram | Dark outline map | MapLibre demo tiles |
| Street map | Roads and place names | OpenStreetMap standard tiles, © OpenStreetMap contributors |

The public OpenStreetMap tile server is for light use only; move to a hosted tile service before real traffic.

### Example locations

`src/example-areas.ts` lists 23 real places, one per filter subdivision (none for "Forecast"). They are shown only while no back end is connected, carry no radar images or reports, and come with a notice. As soon as real areas load they disappear.

Areas take their filter subdivisions from the back end's `categories`. For a back end without them, `src/logic.ts` (`TYPES`) guesses from `change_types`. Areas and events with no filter category (`other`) are always shown.

### Colors copied from the back end

`RAMPS` and `CLASSES` in `src/main.ts` repeat the colors the back end paints into its images (`backend/src/sars_pipeline/site.py`, `categorize.py`). The contract does not carry them, so they must be kept in step by hand.

### Live events (prototype, from the back-end lane, branch `testing-live-events`)

"Happening now" in the left panel: hollow rings on the globe from the back end's `live.geojson` (public disaster feeds: NASA EONET, USGS, GDACS, NOAA NHC, NASA FIRMS; see `backend/README.md`). They follow the same filter checklist (new type `storms`), can be switched off, and refresh on the server's `live` push or every 10 minutes. The popup shows the date, category, detail and the source's credit line, with a link to the source. Rings are hollow so they never read as radar detections.

Under the switch, a **list of what is happening and where**, newest first: each row says what (`title`, for example "Magnitude 5.5 earthquake"), where (`place`, for example "40 km S of Puerto San José, Guatemala"; coordinates when the feed gives no place, as for fire detections) and how long ago, with the type and the source. Clicking a row flies the globe there and opens the event's popup. It follows the filters and the switch, shows 15 rows at a time ("Show 15 more"), and scrolls inside the panel.

Changes:
- 2026-11-14: live layer on the globe (rings, filters, switch, popups, `storms` type).
- 2026-11-14: "Happening now" list (what, where, when, source; click to fly there). Popups also show where. Logic in `src/logic.ts` (`liveList`, `liveWhere`, `ago`), tested in `test/logic.test.ts`.

### Not done yet

Before/after swipe, context-layer toggles, `xyz_tiles` and `geojson` layers, charts of each event's own `series` (from `events.json`), a confidence or date filter for events.

## Handoff: frontend, 2026-11-14 (second session)

Spec/task: F04 and the chart part of F05 (specs still Draft; the globe, filters, wheel and menu are not in them yet).

Done today:
- Merged `main` (contract 0.3) and the back-end lane's integration from `testing` (f87e148); fixed its popup contrast and outline order; added color bars.
- Wheel reduced to six buttons (Walk and Pan removed). Auto-rotate button. Close-up view tilted further up (pitch 70 to 76).
- Accessibility menu: three languages, wheel size, three globe textures.
- Example locations hide when real areas load.
- Time-series chart, class swatches.
- Motion pass: press feedback on buttons, entrance for a newly opened tab, the tour card and the menu; all flattened under reduced motion.
- `npm test` (7) and `npm run build` pass. Clicked through in headless Chrome with no console errors: dev server and static build against a hand-made synthetic 0.3 file; dev server against the real back end (`serve --jobs`, synthetic granules): live push, chart and layers work.

For the back-end lane (blocks "Process this place" from a browser):
- `POST /sites` fails from any page not served by the API itself. The browser first sends `OPTIONS /sites`, and the server answers 400 because CORS allows only GET (`server.py`: `allow_methods=["GET"]`). The app then reports "server not connected".
- Tried in a scratch copy, not committed: `allow_methods=["GET", "POST"], allow_headers=["content-type", "authorization"]` makes it work (202, site goes to `running`).
- With an admin token set (always in the cloud) the app has no way to send one, so it reports that a token is needed. Decide whether visitors should be able to request places at all.

Next steps (ordered):
1. Back-end lane: the CORS change above.
2. Run against real Mexico City data (needs the Earthdata token): check layer order, legends, swatches, chart, popups.
3. Add a `LICENSE` at the repo root (outside this lane). Space Apps requires an OSI license; without one NASA applies Apache 2.0.
4. Get the globe, filters, wheel and menu into `specs/F04` through the spec keeper.
5. Ask the back-end lane to put class lists and ramp colors in the contract, and to confirm the ground-motion legend direction (red = positive = away).
6. Have a Spanish and a German speaker read the translations.
7. Manual checks not done: real phone, screen reader, Firefox/Safari, dragging the wheel by touch.

Known limits:
- Orbit behaves like dragging the globe; Up/Down only tilts. MapLibre cannot move the camera independently of its target under globe projection.
- JS bundle is about 1.1 MB (MapLibre).

Resume with: `cd frontend && npm ci && npm run dev`, with the back end on port 8765 (or `VITE_DATA_BASE=<url>/`).

## Handoff: frontend, 2026-11-14 (third session)

Done: Simple/Technical mode, orbiting satellite, visual redesign, wheel default medium. Checked in headless Chrome on the dev server (both modes, tutorial, menu, no console errors); `npm test` and `npm run build` pass.

Not done or not checked:
- The satellite mesh was shrunk from the 89 MB source file (1.2 million triangles) to 280 KB by merging nearby vertices. The source had no colors or textures, so the body is painted gray and the wings blue in the shader. The source file is not in the repo.
- The model was generated with Meshy; the team must confirm its license allows an open-source submission (see Credits).
- Simple mode's short filter names are the full names cut at the first bracket or colon, not separately written text.
- Spanish and German text for the new parts is machine-written.
- Not checked: real phone, screen reader, Firefox, Safari, real back-end data.

### Later the same day (fourth batch)

Sentinel-2 imagery instead of Blue Marble, team palette, title G.I.G.A.S, panel arrows, more motion, one text size for both modes, smaller satellite with a look per mode. Checked in headless Chrome (no console errors); `npm test` and `npm run build` pass.

- The EOX tile server is a free public service with no uptime promise; for real traffic, host the tiles or get a Copernicus Data Space account.
- The natural-disasters dot color (`#E69F00`) is close to the Tangerine accent; they never mean the same thing but sit near each other in the filter list.
- Sliding a panel resizes the globe every frame; not checked on a slow machine.

### Fifth batch

Live events ("Happening now") taken from the back-end lane's `testing-live-events` branch as it was (its front-end changes only, applied on top of this branch; one conflict in `src/main.ts`, both sides kept). Also: zoom slider in the toolbar, texture renamed "High Quality", Ebony replaces Brick Ember.

- Live events need the back end from `testing-live-events` (`live.geojson`); without it the panel says the feeds are not available.

### Sixth batch

- Welcome screen ("Welcome to G.I.G.A.S." and Start) over the close-up view of the turning Earth; Start swings the camera round to the whole globe while the panels come in. It is the same page: the app waits behind it, inert (`setHome` in `src/main.ts`, `welcome` in `src/globe.ts`). The first-visit tutorial now starts after Start.
- Home (house), auto-rotate and view wheel are square buttons in the map's own column, top right. The zoom slider is gone.
- The date slider of each open area sits at the bottom middle of the globe (`#timebar`), one row per open area.
- Fix: going from close-up view back to globe view keeps the zoom; it only levels the camera.
- Checked in headless Chrome at desktop and phone size (no console errors). Not checked: other browsers, a real phone, a screen reader, more than three open areas in the date bar.

### Seventh batch

- **Country search** (left panel): pick one or more countries; they are outlined on the globe, and the area list, detected changes and live events keep only what lies inside them. Outlines and names (EN/ES/DE) are Natural Earth 1:110m (public domain), stored in `src/assets/countries.json`. Limits: a point just off the coast (many earthquakes) counts as outside, and the smallest countries are not in that file (177 countries).
- **Welcome screen** redrawn: small "Welcome to", large "G.I.G.A.S", the Earth higher on the screen.
- **"On" color** is light blue (Powder Blue, `--on`); the main action (Start, Go) stays tangerine.
- **From the `jopa-testing` branch** (its front-end code, not merged as a whole):
  - type icons (`src/icons.ts`) in the filters and the "Happening now" list, with "Show N more". The polar types that branch had dropped keep their place here and got three new drawings.
  - satellite before/now comparison in each open area (`src/satview.ts`, NASA GIBS). Added here: when the 30 m pictures have nothing (open sea, many days), it falls back to the daily VIIRS pictures.
  - the new live types (hurricanes, heat, cold, dust, industrial) and the line "The server checks the sources every N minutes", read from `refresh_minutes` in `live.geojson`.
  - Not taken: Mexico-only scope, most dangerous now, recent destructive events, zone timelines, and the panel hidden in Simple mode.
- The 15-minute refresh itself is back-end code (`serve --live-minutes 15`, `livefeeds.py` on `jopa-testing`); this branch holds no back end. With an older back end the page still works, without the new types or the refresh line.
- Checked in headless Chrome at desktop size with a live file made by that branch's `livefeeds.py` (FIRMS needs a key and was off). Not checked: phone layout of the new parts, other browsers, a screen reader.

### Eighth batch

- **Start and house button animation:** on Start the button fades and the title ("Welcome to G.I.G.A.S") circles the Earth and ends hidden behind it; the house button plays it backwards. The title is HTML over the map, so "behind" is a circular mask measured from the map (`hideBehind`, `orbitTitle` in `src/main.ts`). With reduced motion the screens simply cross-fade.
- **Live events not refreshing:** the 15-minute refresh is done by the back end (`serve --live-minutes 15`). Without a back end running, the page reads a fixed `public/data/live.geojson`, which never changes. The page now re-reads the file every 5 minutes and never from the browser cache.

### Ninth batch

- **Live events work without a back end.** `src/livefeeds.ts` is a port of the back end's `livefeeds.py` (branch `jopa-testing`; keep the two in step). When no back end keeps `live.geojson` fresh (older than 30 minutes, or missing), the page asks USGS, GDACS and NASA EONET itself, at most every 15 minutes, and drops events older than 24 hours. A fresh back-end file still wins, because only the back end can add NOAA NHC (its server refuses requests from web pages) and NASA FIRMS (needs a key).
- **Start animation, letter by letter:** the name's letters leave the title one after another, cross the front of the Earth as a line, round its side and go behind it; the house button plays it backwards. Each letter is drawn in two layers, over the map and under it (`#fly-front`, `#fly-back`); the map is see-through around the globe, so the Earth itself hides the letters behind it. This replaces the mask of the eighth batch.
- Checked in headless Chrome at desktop size: events loaded with no data file (194 events), and still frames of both animations. Not checked: the animation playing in a real browser, phone size, other browsers.
- Later: the name has a 3D look (stacked text shadows; the flying letters also turn edge-on as they round the globe). The house button no longer plays the orbit backwards: the letters rise one by one from behind the Earth's horizon into the title (`riseName`).

## Test

```
npm test          # date, version and theme-mapping logic (Node's built-in test runner)
```

To see the radar path without the back end, copy `../data/processed` to `public/data/` (gitignored) and run `VITE_DATA_BASE=./data/ npm run dev`.

## AI use

The code in this folder from the globe viewer onward was written with Claude Code (Anthropic), directed and reviewed by the front-end lane, including the Spanish and German translations (machine-written, not yet checked by native speakers). No AI-generated images, audio or video are used.

## Credits

- Country outlines and names: Natural Earth (public domain), naturalearthdata.com.
- Before/now satellite pictures: NASA GIBS (Global Imagery Browse Services), credited under each picture.

- Radar data: NISAR, NASA/JPL-Caltech and ISRO, distributed by ASF DAAC (each layer carries its own credit line).
- Globe imagery: Sentinel-2 cloudless (https://s2maps.eu) by EOX IT Services GmbH, contains modified Copernicus Sentinel data 2016, CC BY 4.0. The newer editions are non-commercial only, which is why the 2016 one is used.
- Street map: © OpenStreetMap contributors, ODbL.
- Outline map and fonts: MapLibre demo tiles. Map engine: MapLibre GL JS (BSD-3-Clause).
- Typefaces: IBM Plex Sans and IBM Plex Mono, SIL Open Font License 1.1, via the `@fontsource` packages.
- Satellite model: generated by the team with Meshy, reduced for the web. License to be confirmed by the team.
