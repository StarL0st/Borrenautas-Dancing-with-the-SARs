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

`src/main.ts` is only a toolchain check. It loads the manifest, shows the latest image overlay of the first area, reloads on each `manifest` event, and shows a banner for synthetic data. Replace it with the real viewer from `specs/F04-frontend-map-viewer.md`.
