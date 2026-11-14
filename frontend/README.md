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

- **Filters:** three groups in the left sidebar (Natural disasters, Disasters caused by humans, Land use), each opening to a checklist of subdivisions with "Select all". Only areas matching a ticked subdivision are marked. Defined in `src/filters.ts`.
- **Dots as tabs:** clicking a dot (or its row in the area list) opens that area as a tab in the right panel; clicking again closes it. Open tabs stack in a scrollable list, each with its timeline and, when radar images exist, a polarization picker, a date slider over the available dates, opacity, a legend, and the full provenance (C3).
- **Detected changes** (contract 0.3, `events.geojson`): outlines and dots on the map colored by filter group, a popup on click, and each area's timeline. Filtered by the same checklist.
- **Layer picker:** one option per back-end layer `group` (backscatter per polarization, change, detected change, surface type, ground motion, soil moisture), each with its own date slider. Color bars for `gray`, `rdbu` and `brbg`; the colors are copied from `backend/src/sars_pipeline/site.py` (`RAMPS` in `src/main.ts`) and must be kept in step with it.
- **Process this place:** asks the back end (`POST /sites`, needs `serve --jobs`) to process the typed coordinates; the area appears when the server reports it ready.
- **Go to coordinates:** latitude and longitude inputs fly to that point and drop a pin.
- **Views:** "Globe view" (whole Earth) and "Close-up view" (low, tilted camera with the horizon in view).
- **View wheel** (`src/wheel.ts`): Zoom, Orbit, Pan, Center, Walk, Look, Up/Down, and Home (centers the whole Earth). Hold a button and drag, or focus it and use the arrow keys.
- **Tutorial:** a step-by-step tour (`src/tour.ts`), shown on first visit and from the Tutorial button.
- **Manifest:** loaded from the data base URL; an unsupported major `contract_version` shows an error and the app keeps working. Refetches on each `manifest` event from the live server.

### Example locations

`src/example-areas.ts` lists 23 real places, one per filter subdivision (none for "Forecast"), so the globe has something to mark before the back end delivers areas. They carry no radar images and no reports, and a notice shows whenever one is listed. Replace them when the back end provides areas.

Areas take their filter subdivisions from the back end's `categories` (contract 0.3). For a back end without them, `src/logic.ts` (`TYPES`) guesses from `change_types`. Areas and events with no filter category (`other`) are always shown.

### Not done yet (from `specs/F04`)

Before/after swipe, context-layer toggles, `xyz_tiles` and `geojson` layers, swatches for `classes` layers, the time-series chart (F05).

## Handoff: frontend, 2026-11-14

Spec/task: F04 (still Draft; the globe, filters and view wheel are not in it yet).

Done:
- 2026-11-13: globe with three filter groups and subdivision checklists, dots that open as stacked tabs, area list, coordinate jump, Globe/Close-up views, view wheel, tutorial, radar viewer per open area.
- 2026-11-14: merged `main` (contract 0.3, Mexico as study region). Took the back-end lane's contract-0.3 integration from the `testing` branch (f87e148): categories, layer groups, detected changes, "Process this place". Added color bars for `rdbu` and `brbg`. Fixed two faults in that integration: the event popup was white with unreadable text, and radar images covered the change outlines.
- `npm test` (4) and `npm run build` pass. Dev server and static build clicked through in headless Chrome with no console errors, including an event popup click and the Process button's "not supported" path, against a hand-made synthetic 0.3 file.

Next steps (ordered):
1. Run against the real back end (`cd backend && uv run sars-pipeline serve --jobs`, needs the Earthdata token) and look at Mexico City: layer order, legends, popups. Not done from the frontend machine.
2. Confirm the Space Apps AI-use rules and adjust the "AI use" section below if needed (the legal page could not be read from the build machine).
3. Get the globe/filter direction into `specs/F04` through the spec keeper.
4. Time-series chart (F05): each event has `series` in `events.json`, areas have C4 files; nothing plots them yet.
5. Ask the back-end lane for a class list on `classes` layers (label and color) so they can get swatches, and to confirm the ground-motion legend direction (red = positive = away).
6. Decide whether example locations should hide once real areas load, and whether to hide filter subdivisions the back end cannot produce yet.
7. Remaining F04 items: before/after swipe, context-layer toggles, `xyz_tiles` and `geojson` layers.
8. Manual checks not done yet: real phone, screen reader, Firefox/Safari, dragging the wheel by touch, "Process this place" against a live server.

Blockers / questions:
- Wheel tools overlap on a globe (Orbit is close to Pan; Up/Down only tilts). MapLibre cannot move the camera independently of its target under globe projection.
- JS bundle is about 1.1 MB (MapLibre); fine for now, split later if load time matters.

Resume with: `cd frontend && npm ci && npm run dev`, with the back end running on port 8765 (or `VITE_DATA_BASE=<url>/`).

## Test

```
npm test          # date, version and theme-mapping logic (Node's built-in test runner)
```

To see the radar path without the back end, copy `../data/processed` to `public/data/` (gitignored) and run `VITE_DATA_BASE=./data/ npm run dev`.

## AI use

The code in this folder from the globe viewer onward was written with Claude Code (Anthropic), directed and reviewed by the front-end lane. No AI-generated images, audio or video are used. The basemap is the MapLibre demo tiles; theme names and topics follow NASA ARSET training areas.
