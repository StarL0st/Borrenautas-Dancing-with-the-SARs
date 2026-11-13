# F05 Time series, story mode, and explainers

Status: Draft (approve after F04 basics, about T+8h)
Lane: L2 (UI) and L3 (content)        Owner: <human> / <agent>
Gate: Requires GO
Depends on: F03 outputs (or fixtures), F04
Traces to: R6, R7, R8, R9, R10, M3, M4, M5, S1, S4, S5

## Goal
Turn the map into a story: a time-series view for any clicked location, a guided narrative that drives the map, and plain-language explainers that answer the challenge's guiding questions.

## User story
As an educator, I want a guided walkthrough that tells me what radar sees, why the surface changed, and what NISAR could do next.

## Inputs and outputs
- Input: time-series files (contract C4), story file (contract C5), glossary and methods content (Markdown in `web/public/content/`).
- Output: chart panel, story panel, Methods/About page, glossary, "future applications" section.

## Behavior and rules
1. Clicking a map location (or a predefined region) loads the matching time series and plots value vs date with units and polarization; shows `n_pixels` where relevant.
2. Story mode steps through the C5 steps: each step sets the camera, selected layers, and date, and shows short plain-language text (target under 80 words per step).
3. Story text states the data basis for each claim, including maturity, and separates what the data show from the hypothesis about why.
4. The Methods/About page covers: what NISAR and SAR are (roughness and dielectric constant in plain words), why radar works through clouds and at night, which polarization highlights the change, limitations, and credits.
5. A glossary defines backscatter, polarization (HH/HV), dB, speckle, and maturity in one or two sentences each.
6. A "What NISAR can do next" section lists future applications tied to the change types in the challenge text.
7. Content is data/Markdown, not code, so L3 can edit without touching components.
8. Chart is keyboard accessible, has a text summary, and does not rely on color alone.

## Acceptance criteria
1. With the fixture, clicking a point shows a chart whose points match the fixture's series values (Vitest test of the data-to-chart mapping).
2. Story mode moves through every step in order, and each step sets layers, date, and camera as specified.
3. Every story step text under 100 words; each ties to at least one layer ID that exists in the manifest (validated by `make validate`).
4. The Methods page answers: which polarizations highlight the change, and what future applications are possible (R8), in plain language.
5. The glossary contains the five required terms.
6. A reader outside the team can summarize the main change after the story (outsider test, noted in the PR).
7. `make lint test validate build smoke` pass.

## Out of scope
Backend, user accounts, comments, sharing.

## Edge cases and failure modes
- No time series for a clicked location: show a clear message and the nearest available region.
- Story references a layer missing from the manifest: validation fails in CI, not at runtime.

## Test plan
Vitest for chart mapping and story navigation; schema validation for story files; outsider test; mobile check.

## Delegation notes
UI components and tests suit the executor (chart panel, story navigator). Narrative writing, hypothesis wording, and polarization explanation are Claude plus human work, reviewed for scientific accuracy.

## Open questions
Whether to use the interactive "dance" framing (C4 in the product spec) in copy or visuals.
