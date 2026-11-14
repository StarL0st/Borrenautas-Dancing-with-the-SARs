# F06 Integration, performance, and deployment

Status: Draft (approve at about T+5h; runs continuously)
Lane: L3        Owner: <human> / <agent>
Gate: Requires GO
Depends on: F02, F03, F04, F05
Traces to: R9, M7

## Goal
Keep a working end-to-end demo on `main` at all times, move real pipeline outputs into the app, and publish a static site with fallbacks.

## User story
As the team, we want integration problems found within hours, not on the last night.

## Inputs and outputs
- Input: pipeline outputs, built frontend.
- Output: `make sync-data`, a deployed static site, a deployment fallback, integration check reports.

## Behavior and rules
1. `make sync-data` validates outputs against the schemas, then copies them to `frontend/public/data/`. It refuses to copy invalid data.
2. Run the `integration-check` skill every 3 to 4 hours and before freezes; log breakages with their owning lane.
3. Deploy the static build to the host chosen in ADR-004; keep local `vite preview` as a fallback and the demo video as the last resort.
4. Keep asset budgets (committed data about 50 MB total; overlays at most 2048 px).
5. Smoke test the deployed site: manifest loads, a layer shows, story mode opens.
6. Sanity check in at least two desktop browsers and one phone-sized viewport.
7. A fresh-clone test works from the README.

## Acceptance criteria
1. `make sync-data` copies valid data and rejects a deliberately broken file.
2. Integration reports exist for every 3 to 4 hour block, each with pass/fail and owners for failures.
3. The deployed URL loads the real manifest and a real layer, verified from a second device.
4. A fresh clone runs `make setup && make build` and serves the app.
5. Initial load under 5 s on a normal connection; sizes within budgets (record numbers).
6. `main` has a passing CI run at every merge.

## Out of scope
Domain names, analytics, authentication.

## Edge cases and failure modes
- Pipeline output changes shape late: contract-change PR required (frozen contracts).
- Hosting outage: switch to the fallback, note it in the handoff.

## Test plan
Run the checks above; record the browser/device matrix and measurements in the PR.

## Delegation notes
Scripts (`sync-data`, smoke tests) suit the executor. Deployment decisions and secrets stay human.

## Open questions
Hosting choice (ADR-004).
