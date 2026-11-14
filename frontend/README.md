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

A globe home screen that zooms into a map (one MapLibre map, `globe` projection).

- **Themes:** seven filters (Agriculture, Climate Resilience, Disasters, Ecological Conservation, Health & Air Quality, Water Resources, Wildland Fires) plus "All". Picking one lights only its areas and spins the globe to the first. Defined in `src/categories.ts`.
- **Area list:** the same areas as a keyboard-friendly list with dates and counts.
- **Area details:** timeline of reports, and for areas with radar images a polarization picker, a date slider over the available dates, opacity, a legend, and the full provenance (C3).
- **Tutorial:** a five-step tour (`src/tour.ts`), shown on first visit and from the Tutorial button.
- **Manifest:** loaded from the data base URL; an unsupported major `contract_version` shows an error and the app keeps working. Refetches on each `manifest` event from the live server.

### Placeholder data

`src/sample-areas.ts` holds 14 invented areas with invented reports, because the contract has no themed areas or past reports yet. They are flagged synthetic and a banner shows whenever one is listed. Replace them when the back end provides this data. Contract change types map to themes in `src/logic.ts` (`THEMES`); `other` maps to none, so those areas appear only under "All".

### Not done yet (from `specs/F04`)

Before/after swipe, context-layer toggles, `xyz_tiles` and `geojson` layers, colormaps other than `gray`, the time-series chart (F05).

## Test

```
npm test          # date, version and theme-mapping logic (Node's built-in test runner)
```

To see the radar path without the back end, copy `../data/processed` to `public/data/` (gitignored) and run `VITE_DATA_BASE=./data/ npm run dev`.

## AI use

The code in this folder from the globe viewer onward was written with Claude Code (Anthropic), directed and reviewed by the front-end lane. No AI-generated images, audio or video are used. The basemap is the MapLibre demo tiles; theme names and topics follow NASA ARSET training areas.
