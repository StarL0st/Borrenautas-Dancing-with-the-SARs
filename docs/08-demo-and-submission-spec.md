# 08. Demo and Submission Spec

Status: Draft. Official submission requirements were not in the pasted challenge text. Fill the blanks marked **CONFIRM** from the official Space Apps site before kickoff.

## Official facts to confirm

| Item | Value |
|---|---|
| Local event start and end time | **CONFIRM** |
| Submission deadline (local time) | **CONFIRM** |
| Required submission fields (title, summary, links, video, etc.) | **CONFIRM** |
| Video length and format limits | **CONFIRM** |
| Repo must be public / open-source? | **CONFIRM** (challenge text asks for an open-source solution) |
| AI-tool use or disclosure rules | **CONFIRM** |
| Judging criteria | **CONFIRM**, then add to `docs/00-challenge.md` as J1, J2, ... |

Known: event runs November 14-15, 2026; judging begins November 16.

## Deliverables

| Deliverable | Notes | Spec |
|---|---|---|
| Hosted app (static) | Primary artifact | F04, F05, F06 |
| Public repository | README, license, open-source, credits | F07 |
| Demo video | Target 2 to 3 minutes, within the official limit | F07 |
| Slides (optional) | Only if the submission form wants them | F07 |
| Project summary | Short text, plus the app's About/Methods page | F05, F07 |
| Data credits | NISAR/ASF DAAC attribution, basemap, ancillary data | F07 |

## Demo script (outline; fill after F01)

1. **Hook (15 s):** the dance metaphor, one striking before/after.
2. **Place (15 s):** where we are and why it matters to people.
3. **What changed (30 s):** the change layer, the slider, plain-language reading of the legend.
4. **How radar sees it (30 s):** roughness and dielectric constant in one sentence each; why radar works through clouds and at night.
5. **Why it changed (30 s):** the physical-driver hypothesis, with what the data shows and does not show.
6. **Polarization insight (20 s):** which polarization highlights the change and why.
7. **Time series (15 s):** click a point, see its history.
8. **What is next (15 s):** future NISAR applications.
9. **Close (10 s):** open source, link, credits.

Every claim states data maturity (BETA or PROVISIONAL) when it matters.

## Final-hour routine

- [ ] Feature freeze held; only fixes since
- [ ] Fresh clone test: `git clone`, `make setup`, `make build`, open the site
- [ ] Hosted link opens in a private window on a different device
- [ ] Offline fallback ready: local `vite preview` and the recorded video file
- [ ] Credits and license present; no secrets or data files in history
- [ ] `submission-v1` tagged
- [ ] Submission form filled out and saved early; edit after, if allowed

## Rehearsal

Two full rehearsals with a timer (one at Deadline-6h, one at Deadline-3h), one person outside the team watching without help.

## Risks

| Risk | Mitigation |
|---|---|
| App breaks during recording | Record from a tagged build; keep the video as the fallback |
| Story too technical | Outsider test; cut jargon; glossary in the app |
| Last-night integration bugs | Integration check every 3 to 4 hours; freeze early |
