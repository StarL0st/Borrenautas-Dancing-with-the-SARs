# F03 Change analysis and web exports

Status: Draft (approve after ADR-003, about T+4h)
Lane: L1        Owner: <human> / <agent>
Gate: Requires GO
Depends on: F02, ADR-002, ADR-003, contracts v0.1.0
Traces to: R2, R7, R8, M1, M2, M4, M5, M6, S1, S3

## Goal
Produce the change products the app displays (maps and time series), exported as contract-valid web assets with full provenance.

## User story
As a viewer, I want to see where and how much the surface changed between dates, and which polarization shows it best.

## Inputs and outputs
- Input: `data/interim/<area>/<date>/<pol>.tif`, config, ADR-003 (method).
- Output (written to `data/processed/` then synced to `web/public/data/`):
  - Change layers: image overlays (or tiles) with bounds, value range, colormap (contract C2).
  - Time-series JSON for chosen points/regions (contract C4).
  - `manifest.json` (contract C1) including provenance (C3) and credits.
  - QA figures (not shipped) comparing methods or polarizations.

## Behavior and rules
1. Method is chosen in ADR-003 from candidates, for example: dB difference or log ratio between dates; thresholded change with a documented threshold; co-pol vs cross-pol comparison; time-series statistics over a region. Interferometric displacement or soil moisture only if the chosen area and products support them.
2. Account for speckle: use multilooking or spatial averaging before differencing; record window sizes.
3. Every layer states `maturity`, polarization, units, and the dates used.
4. Thresholds and colormaps are in config; the legend description is plain language.
5. Output is deterministic: same inputs and config give identical outputs.
6. Validate against an independent reference where possible (an optical image, a known event date) and note agreement or disagreement honestly in the data notes.
7. Never claim more than the data support; BETA or PROVISIONAL status is carried into the UI text.
8. Image overlays are at most 2048 px on the long side.

## Acceptance criteria
1. On a synthetic pair of arrays with a known changed patch, the method detects the patch (stated precision/recall thresholds in the test) and leaves the unchanged area alone.
2. `make pipeline` on the real AOI produces at least one change layer and one time-series file that pass `make validate`.
3. Each produced layer's provenance lists real granule IDs, steps, and parameters; none is marked synthetic.
4. Running the pipeline twice yields byte-identical web assets (or documented tolerance).
5. A short methods note in `docs/` explains the method, thresholds, polarization findings, and known limitations in plain language.
6. At least one comparison (polarization or date pair) is available for the story in F05, with a one-sentence takeaway.
7. `make lint test validate` pass.

## Out of scope
Frontend rendering (F04), narrative writing (F05), global or on-demand processing.

## Edge cases and failure modes
- Little or no visible change: report that honestly as a result (the challenge asks about changes "or don't see").
- Saturated or nodata areas: masked and excluded from statistics; `n_pixels` reflects valid pixels.
- Colormap range too narrow or too wide: set `value_range` from robust percentiles, documented.

## Test plan
pytest on synthetic arrays; one end-to-end run on real data with output inspection; schema validation; determinism check by hashing outputs.

## Delegation notes
Good executor slices: export writers (PNG/WebP + bounds), manifest builder, time-series extractor, schema-valid output tests. Keep method choice, thresholds, and physical interpretation with Claude and the human.

## Open questions
Which method best shows the chosen change type (ADR-003)?
