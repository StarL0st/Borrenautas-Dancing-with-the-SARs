# F04 Frontend map viewer

Status: Draft (approve at about T+3h; buildable against fixtures immediately)
Lane: L2        Owner: <human> / <agent>
Gate: Requires GO
Depends on: F00 (skeleton), contracts v0.1.0 and fixtures
Traces to: R1, R2, R9, R10, M1, M2, M3, M6, S2

## Goal
An accessible, responsive web map that loads `manifest.json`, shows change layers over a basemap, lets people move through time, and exposes provenance.

## User story
As a visitor, I want to see a place, switch between layers and dates, and understand what I am looking at.

## Inputs and outputs
- Input: `web/public/data/manifest.json` and referenced layer files (contract C1, C2, C3). Until real data exists, the synthetic fixture.
- Output: a static build in `web/dist/`.

## Behavior and rules
1. On load, fetch the manifest, check `contract_version` (unsupported major version shows an error), and center the map on the first area.
2. Layers render by `kind`: `image_overlay` (with bounds), `xyz_tiles`, `geojson`.
3. Layer panel: switch layers, change opacity, toggle context layers.
4. Time control: a date slider for layers with dates, plus a before/after swipe comparison for two dates.
5. Legend generated from `units`, `value_range`, `colormap`; the layer's plain-language `description` is shown next to it.
6. Provenance panel per layer: granule IDs, product, polarization, maturity, steps, parameters, attribution.
7. If `synthetic` is true anywhere, show a persistent, visible banner.
8. Basemap with required attribution; if the basemap fails, fall back to a plain background without breaking overlays.
9. All text strings come from the data files, not hardcoded to a specific study area.
10. Keyboard-operable controls; colormaps are colorblind-safe; sufficient contrast; labels for controls.
11. Responsive from phone to wide desktop.

## Acceptance criteria
1. With the synthetic fixture, `make dev` shows the map, one overlay, and the synthetic banner.
2. Changing the slider changes the displayed layer date; the swipe compares two dates correctly (Vitest test on the date-selection logic).
3. Legend values match the layer's `value_range` and `units`.
4. Provenance panel shows every field from C3 for the selected layer.
5. A manifest with an unsupported major `contract_version` shows a clear error, not a blank page.
6. A simulated basemap failure leaves overlays visible.
7. Lighthouse-style checks (or manual): all controls reachable by keyboard; no text below contrast guidance.
8. `make lint test build smoke` pass; initial load of the static build under 5 s on a normal connection (record measurement).
9. Works from static hosting with no server code.

## Out of scope
Time-series chart and story mode (F05), deployment (F06).

## Edge cases and failure modes
- Large overlay slow to load: show loading state; keep assets within budgets.
- Layers with different bounds: map fits to the area bbox, not a single layer.
- Date gaps: slider snaps to available dates only.
- Missing optional fields: UI degrades gracefully.

## Test plan
Vitest for manifest parsing, version check, date logic, legend; manual keyboard and mobile viewport checks; screenshots in the PR.

## Delegation notes
Good for the executor once the contract and fixtures exist: manifest loader and types (T-1), layer renderers (T-2), time slider and swipe (T-3), legend and provenance panel (T-4), accessibility pass (T-5). Visual design polish and UX decisions stay with Claude and the human; the `frontend-design` guidance is useful here.

## Open questions
Charting library (ADR-001) is only needed for F05.
