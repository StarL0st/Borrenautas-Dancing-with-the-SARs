# F02 Data pipeline (fetch, extract, normalize)

Status: Draft (approve after F01, about T+3h)
Lane: L1        Owner: <human> / <agent>
Gate: Requires GO
Depends on: F01 (AOI and granule list), contracts v0.1.0
Traces to: R1, R4, M1, M6

## Goal
Turn the chosen granule list into analysis-ready, AOI-cropped rasters with recorded provenance, reproducibly and without committing raw data.

## User story
As the analysis lane, I want one command that fetches and prepares the data so I can iterate on change detection without handling HDF5 by hand.

## Inputs and outputs
- Input: `data/samples/aoi.geojson`, granule list from F01, Earthdata credentials from the environment.
- Output:
  - `data/raw/<granule>/` (gitignored) and `data/raw/downloads.json` (granule, URL, size, checksum if available, timestamp).
  - `data/interim/<area>/<date>/<pol>.tif` (gitignored): AOI-cropped rasters in analysis units, with nodata set.
  - `data/interim/<area>/run-log.json`: parameters, versions, granule IDs per output.

## Behavior and rules
1. `fetch` is idempotent and resumable: skip complete files, retry partial ones, fail loudly on checksum or size mismatch.
2. Prefer subsetting or streaming over full-file downloads when the product supports it (Harmony GeoTIFF subsets, cloud-optimized access); fall back to full download.
3. `extract` reads the selected layers/polarizations from the HDF5 product, honoring coordinate metadata (CF conventions), and crops to the AOI.
4. `normalize` applies unit conversion only according to the verified product specification (see F01 criterion 6), then optional multilook/despeckle with recorded parameters.
5. Frames that overlap the AOI with different grids are reprojected to one common grid; record the method.
6. All parameters live in one config file; nothing hardcoded in modules.
7. `make fetch` and `make pipeline` call `scripts/check_gate.sh` first.
8. No credentials in code, logs, or `run-log.json`.

## Acceptance criteria
1. Given a granule list, `make fetch` downloads missing files and a second run downloads nothing.
2. Given a small synthetic HDF5 fixture shaped like the product, `extract` produces a raster whose size and georeferencing match the expected values in the test.
3. `normalize` on a fixture with known values produces the expected output within a stated tolerance, and nodata pixels remain nodata.
4. `run-log.json` lists, for every output raster, its source granule ID, polarization, date, and parameters.
5. Raw data and interim rasters are not tracked by git (`git status` clean after a run).
6. Pipeline runs end to end on at least two dates of the real AOI, and outputs open in a GIS tool with the right location.
7. `make lint test` pass for `pipeline/`.

## Out of scope
Change detection (F03), web asset export (F03), mosaicking beyond the AOI overlap.

## Edge cases and failure modes
- Partial or corrupt download; expired Earthdata session; rate limiting: retry with backoff, clear messages.
- Layover/shadow or masked pixels: preserve the product's mask layers where present.
- Polarization missing on one date: record and skip with a warning, never silently substitute.
- Different incidence geometry between dates (ascending vs descending): flag; do not compare across geometries without a note.

## Test plan
pytest with a tiny synthetic HDF5; one manual run on real granules with a documented command and a screenshot of an output raster in a viewer.

## Delegation notes
Good executor material in slices: downloader with idempotency and logging (T-1), extractor against the synthetic HDF5 (T-2), normalizer (T-3), config and CLI wiring (T-4). Keep real-data validation and unit/scaling decisions with Claude.

## Open questions
Streaming vs full download for our AOI size (decide from the F01 size estimate).
