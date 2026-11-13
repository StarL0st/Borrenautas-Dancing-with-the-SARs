# 02. Architecture

Status: Draft. Stack defaults below are proposals; ratify or change in ADR-001 at kickoff.

## Principles

1. **Static-first.** The pipeline produces files; the frontend loads files. No server to run during judging.
2. **Contract-driven.** Pipeline and frontend only meet at the contracts in `docs/04-contracts.md`. Each lane can work alone against fixtures.
3. **Reproducible.** Any published layer can be regenerated from raw granules by one command, with parameters recorded.
4. **Small areas, small files.** One compact study area, downsampled web assets, raw data never in git.
5. **Provenance everywhere.** Layers carry their source granules, product, maturity, and parameters.
6. **A demo that cannot fail.** A built static site plus a recorded video are always available as fallbacks.

## Component flow

```
ASF DAAC / Earthdata (NISAR HDF5 products)
        |  asf_search / earthaccess (Earthdata Login)
        v
pipeline/ (Python)
  fetch -> extract -> normalize -> change products -> export web assets
        |  writes web-ready assets + manifest.json + time series JSON
        v
web/public/data/         (validated against contracts/schemas)
        |
        v
web/ (Vite + TypeScript + MapLibre GL JS)  ->  static host (build output)
```

## Default stack (ADR-001)

| Area | Default | Notes |
|---|---|---|
| Pipeline | Python 3.11+, `pyproject.toml`, ruff, pytest | numpy, h5py, rasterio, pyproj; matplotlib for QA figures |
| Data access | `asf_search` and/or `earthaccess` | Both are documented by ASF for NISAR; pick one primary |
| Frontend | Node 20+, Vite, TypeScript, MapLibre GL JS | Static build; no framework required |
| Charts | uPlot or Chart.js | Small and fast; decide in ADR-001 |
| Tests | pytest; Vitest | `make test` runs both |
| CI | GitHub Actions | Lint, test, contract validation, build, smoke |
| Hosting | Static host (GitHub Pages or similar) | Decide in ADR-004; always keep `vite preview` as local fallback |
| License | Permissive (MIT or Apache-2.0) | Decide in ADR-005; challenge wants open source |

## Pipeline stages

| Stage | Input | Output |
|---|---|---|
| discover | AOI, date window | Candidate granule list with date, product, maturity, polarizations |
| fetch | Granule list | `data/raw/<granule>/` (gitignored) and a download log |
| extract | HDF5 granules | Per-date, per-polarization rasters cropped to the AOI (`data/interim/`) |
| normalize | Rasters | Calibrated, converted to display/analysis units, despeckle/multilook as configured |
| change | Normalized rasters | Change products (e.g., date differences, thresholds, time series) |
| export | Change products | Web assets (overlay images or tiles, GeoJSON), time-series JSON, `manifest.json` |
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
