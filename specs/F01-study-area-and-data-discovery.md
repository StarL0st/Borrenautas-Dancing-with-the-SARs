# F01 Study area and data discovery

Status: Draft (approve at T+0)
Lane: L3 (lead) with L1        Owner: spec keeper
Gate: Requires GO
Depends on: F00, `docs/03-data-sources.md`
Traces to: R2, R3, R4, M1, M2

## Goal
Choose the study area and change type(s) based on verified NISAR data coverage, and record the evidence, so the rest of the build stands on data we know exists.

## User story
As the team, we want to commit to a place only after we have confirmed enough usable NISAR acquisitions, so we do not discover a data problem at hour 20.

## Inputs and outputs
- Input: three or more candidate places and change types (team brainstorm), Earthdata Login, ASF Vertex or `asf_search`, the NISAR track-frame map.
- Output: ADR-002 with scorecard; filled dataset inventory in `docs/03-data-sources.md`; `data/samples/aoi.geojson` (the area of interest); list of at least two testable physical-driver hypotheses.

## Behavior and rules
1. Shortlist 3 candidates within 45 minutes.
2. For each, check footprint coverage (track-frame map), then list products for the AOI by product type, maturity, date, and polarizations.
3. Score candidates with the table below. Weights are suggestions; adjust once, then stick to them.

| Criterion | Weight |
|---|---|
| Usable acquisitions: at least 2 dates, same track/frame preferred, at least 3 for a time series | 30 |
| Expected visible change in the date window (magnitude and type) | 20 |
| Story value and clarity to non-experts | 15 |
| AOI size manageable (small, one or two frames) | 10 |
| Data maturity and product suitability (e.g. GCOV for backscatter change) | 10 |
| Ancillary context available (optical, land cover) | 10 |
| Team knowledge or personal connection | 5 |

4. Decide by T+3h. Fallback: if no candidate has at least two usable acquisitions, widen the date window or area, then re-score. If still none, record this as a blocker immediately and escalate to the whole team.
5. Verify GCOV (or chosen product) units and scaling from the product specification before any dB conversion plans are made.
6. Each person who will download data confirms Earthdata Login works.

## Acceptance criteria
1. ADR-002 exists with the filled scorecard and the decision.
2. `docs/03-data-sources.md` inventory lists granule IDs with date, product, maturity, polarizations, and size for the chosen AOI.
3. `data/samples/aoi.geojson` validates as GeoJSON and its bbox matches the AOI in the ADR.
4. A download size estimate and plan exist (full files vs Harmony subsets vs streaming).
5. At least two physical-driver hypotheses and the polarizations expected to show them are written in the ADR.
6. Units and scaling for the selected product are recorded.

## Out of scope
Downloading full granules (F02), choosing a method (F03).

## Edge cases and failure modes
- Coverage exists but only BETA maturity: acceptable; maturity must be stated on every layer and in the story.
- Different frames per date: record it; F02 may need a mosaic or a common AOI inside overlap.

## Test plan
Reviewer checks each acceptance criterion against the ADR and inventory. Spot-check two granule IDs in Vertex.

## Delegation notes
Not delegated (judgment and live data lookups). Claude may draft the inventory table from search output; a human confirms.

## Open questions
Which change type best fits the available acquisitions?
