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
- **Go to coordinates:** latitude and longitude inputs fly to that point and drop a pin.
- **Views:** "Globe view" (whole Earth) and "Close-up view" (low, tilted camera with the horizon in view).
- **View wheel** (`src/wheel.ts`): Zoom, Orbit, Pan, Center, Walk, Look, Up/Down, and Home (centers the whole Earth). Hold a button and drag, or focus it and use the arrow keys.
- **Tutorial:** a step-by-step tour (`src/tour.ts`), shown on first visit and from the Tutorial button.
- **Manifest:** loaded from the data base URL; an unsupported major `contract_version` shows an error and the app keeps working. Refetches on each `manifest` event from the live server.

### Example locations

`src/example-areas.ts` lists 23 real places, one per filter subdivision (none for "Forecast"), so the globe has something to mark before the back end delivers areas. They carry no radar images and no reports, and a notice shows whenever one is listed. Replace them when the back end provides areas.

The contract has no field for filter subdivisions yet. `src/logic.ts` (`TYPES`) guesses them from `change_types`; areas it cannot classify (`other`, `deformation`) are always shown.

### Not done yet (from `specs/F04`)

Before/after swipe, context-layer toggles, `xyz_tiles` and `geojson` layers, colormaps other than `gray`, the time-series chart (F05).

## Test

```
npm test          # date, version and theme-mapping logic (Node's built-in test runner)
```

To see the radar path without the back end, copy `../data/processed` to `public/data/` (gitignored) and run `VITE_DATA_BASE=./data/ npm run dev`.

## AI use

The code in this folder from the globe viewer onward was written with Claude Code (Anthropic), directed and reviewed by the front-end lane. No AI-generated images, audio or video are used. The basemap is the MapLibre demo tiles; theme names and topics follow NASA ARSET training areas.
