# 02. Architecture

Status: Draft. Stack defaults below are proposals; ratify or change in ADR-001 at kickoff.

## Principles

1. **Service with a static fallback.** A batch pipeline turns NISAR granules into contract files and typed event records (C7). An API server (`backend/`, contract C6) serves them and answers location queries for the globe. The same data is also exported as static files, so the demo still runs if the server is down.
2. **Contract-driven.** Pipeline and frontend only meet at the contracts in `docs/04-contracts.md`. Each lane can work alone against fixtures.
3. **Reproducible.** Any published layer can be regenerated from raw granules by one command, with parameters recorded.
4. **Small areas, small files.** One compact study area, downsampled web assets, raw data never in git.
5. **Provenance everywhere.** Layers carry their source granules, product, maturity, and parameters.
6. **A demo that cannot fail.** A built static site plus a recorded video are always available as fallbacks.

## Component flow

```
ASF DAAC / Earthdata Cloud (NISAR HDF5, AWS us-west-2)
        |  asf_search (select) + h5py/fsspec over HTTPS (stream windows, no full downloads)
        v
backend/ batch (Python; local, or a GCP VM in us-west1)
  select -> read -> change -> classify -> export
        |  manifest.json, layers, time series, events.json  (contracts C1-C7)
        v
data root (local data/processed/, or a Cloud Storage bucket)
        |
        +--> backend/ API (local, or Cloud Run): C6 endpoints incl. /events.json and /query
        +--> static export (frontend/public/data/): fallback, same files
        v
frontend/ (Vite + TypeScript + MapLibre GL JS globe)
```

## Deployment (Google Cloud, team credit)

- Batch: one VM in `us-west1` (next to the data in AWS `us-west-2`), started for a run and stopped after. Streams over HTTPS; ASF HTTPS egress is free.
- Data: one Cloud Storage bucket (public read, CORS for GET) holds outputs and tiles too big for the repo.
- API: Cloud Run, scales to zero. Reads the data root from the bucket.
- Secrets: the Earthdata token lives in Secret Manager (cloud) or `backend/.env` (local), never in images or the repo.

## Default stack (ADR-001)

| Area | Default | Notes |
|---|---|---|
| Pipeline | Python 3.11+, `pyproject.toml`, ruff, pytest | numpy, h5py, rasterio, pyproj; matplotlib for QA figures |
| Data access | `asf_search` (search), `h5py` + `fsspec` (HTTPS window reads) | Decided; streaming instead of full 6-7 GB downloads |
| Classification | Rules per change type; optional scikit-learn model | Model is a stretch goal, labelled experimental |
| Frontend | Node 20+, Vite, TypeScript, MapLibre GL JS | Static build; no framework required |
| Charts | uPlot or Chart.js | Small and fast; decide in ADR-001 |
| Tests | pytest; Vitest | `make test` runs both |
| CI | GitHub Actions | Lint, test, contract validation, build, smoke |
| Hosting | Google Cloud: Cloud Run (API), Cloud Storage (data, static site) | Proposed for ADR-004; always keep `vite preview` and the static export as fallback |
| License | Permissive (MIT or Apache-2.0) | Decide in ADR-005; challenge wants open source |

## Pipeline stages

| Stage | Input | Output |
|---|---|---|
| discover | AOI, date window | Candidate granule list with date, product, maturity, polarizations |
| fetch | Granule list | `data/raw/<granule>/` (gitignored) and a download log |
| extract | HDF5 granules | Per-date, per-polarization rasters cropped to the AOI (`data/interim/`) |
| normalize | Rasters | Calibrated, converted to display/analysis units, despeckle/multilook as configured |
| change | Normalized rasters | Change products (e.g., date differences, thresholds, time series) |
| classify | Change products | Event records (C7): type, geometry, dates, confidence, method |
| export | Change products, events | Web assets (overlay images or tiles, GeoJSON), time-series JSON, `manifest.json`, `events.json` |
| validate | All exported assets | Pass/fail against JSON schemas |

## Size and performance budgets

- Committed data assets: 50 MB total target (hard stop at 100 MB per file, which GitHub rejects).
- Image overlays: at most 2048 px on the long side; PNG or WebP.
- Initial page load: under 5 s on a normal laptop connection with the static build.
- Raw HDF5, interim rasters: never committed.

## Failure modes and fallbacks

| Risk | Fallback |
|---|---|
| Thin NISAR coverage over the chosen place (few dates) | Choose another candidate in F01; widen date window; check data maturity options |
| Earthdata login or S3 access trouble | Use HTTPS download path; pre-fetch granules early; keep a cached subset |
| Large downloads on slow event wifi | Subset layers (Harmony GeoTIFF subsetting or streaming) instead of full files |
| Basemap tile provider outage | Alternate basemap style; plain-background fallback |
| Hosting issue at submission time | Local `vite preview` plus recorded demo video |
| API server down during judging | Frontend falls back to the static export (`events.json` and the C1-C5 files) |
| Executor model endpoint down | Lane falls back to Claude-only implementation (see `docs/07`) |

## Security and secrets

- Earthdata credentials, executor API key, hosting tokens: local `.env` only, never committed, never in prompts.
- `.env.example` lists variable names only.
- Anything sent to a third-party model endpoint is public code and public NASA data only.

## ADR queue

| ADR | Topic | When |
|---|---|---|
| ADR-001 | Stack confirmation | Phase 0 / kickoff |
| ADR-002 | Study area and change type(s) | T+3h |
| ADR-003 | Change-detection method | T+4h |
| ADR-004 | Hosting | By T+12h |
| ADR-005 | License | Phase 0 |
| ADR-006 | Executor model endpoint and model ID | Before first delegation |
