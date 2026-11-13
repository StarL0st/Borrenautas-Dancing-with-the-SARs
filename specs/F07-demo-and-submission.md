# F07 Demo and submission

Status: Draft (approve at about T+12h; mostly executed in the last 12 hours)
Lane: L3        Owner: <human> / <agent>
Gate: Requires GO
Depends on: F04, F05, F06, `docs/08-demo-and-submission-spec.md`
Traces to: R6, R9, M7, M8

## Goal
Deliver a complete, early, and safe submission: hosted app, public repo, demo video, summary, credits, and a tagged build.

## User story
As the team, we want to submit with hours to spare and a fallback for every failure we can imagine.

## Inputs and outputs
- Input: the app on `main`, the demo script in `docs/08`.
- Output: demo video, optional slides, project summary text, repo README and license, credits, tag `submission-v1`, filled submission form.

## Behavior and rules
1. Confirm official requirements (`docs/08` "Official facts to confirm") before recording.
2. Record the video from a tagged build, within the official length limit, following the demo script.
3. The README covers what it is, a screenshot, how to run, data sources, credits, license, and the team.
4. Credits include NISAR / ASF DAAC attribution (use the official citation text when available), basemap, and ancillary data.
5. The repo contains no secrets and no raw data; history is checked.
6. Two timed rehearsals with an outsider watching.
7. Submit at least two hours before the deadline.

## Acceptance criteria
1. Video exists, is within the official limit, and tells the full story (place, change, why, how radar sees it, what is next).
2. README meets the list above; license file present.
3. Fresh-clone test passes on a clean machine or container.
4. `git log` and the working tree contain no credentials or `.h5`/`.nc` files.
5. Tag `submission-v1` points to the build used in the video.
6. The submission form is filled in and saved; the hosted link and repo link open in a private window.
7. All claims in the video and summary state data maturity where relevant.

## Out of scope
Post-event development.

## Edge cases and failure modes
- Official requirements change or turn out stricter: adapt the checklist first, content second.
- Hosting fails on submission day: use the fallback link plus the video.

## Test plan
Checklist in `docs/08`; two rehearsals; outsider review of the summary text.

## Delegation notes
README and credits drafts suit the executor. Script, narration, and the final scientific wording stay with Claude and the humans.

## Open questions
Official submission fields (CONFIRM in `docs/08`).
