# Changelog

What changed and when, newest first. Dates are UTC-7 (the team's local time), as in the git history. The `jopa-testing` entries summarize [frontend/JOPA_TESTING.md](frontend/JOPA_TESTING.md), which has every round in detail; the team's milestones come from [docs/10-status-log.md](docs/10-status-log.md) and the history of `main`.

## 2026-11-15

### `jopa-testing`

- **Repository organized:** this README (from the team's draft, updated), a documentation index, a user guide, the report and sources documents, contributing guide, this changelog, issue and pull request templates, a test workflow, an `.editorconfig`. The old spec-package README moved to `docs/spec-package.md`.
- **Merged the latest `main` and `frontend`:** the newest backend (confidence floor 0.3, `/api` calls, live events aligned with the app, four demo areas, Cloudflare publishing), the phone layout, the NISAR satellite model, the README draft and screenshots. Backend conflicts take `main`'s newer versions; at full size, an up-down drag on a comparator picture now scrolls the panel on phones.
- **Second review (round 11):** report layout (rows measured before drawing, tall pictures capped, contents move off a full cover, no silent truncation, wrapped titles and source names, linked sources for remarkable events), the reader cancels drawings it no longer needs, comparator controls (double-click, wheel at zoom limits, arrow keys), live and status edge cases.
- **Code review fixes (round 10):** failed or slow loads keep the last good data and never become "no changes"; no update lost while a report is being made; the reader draws only pages near the view; live updates no longer reset open cards; time limits on every network step; numbered loads; a failing live source keeps its last events for 24 hours; photo search 6 days at a time; dead texts and duplicated styles removed.
- **Reports readable everywhere (round 9):** reports are made in advance; "Read the report" opens an in-page reader (pdf.js); "Download" is a plain link.
- **Decision log off the page (round 8):** kept in `frontend/DECISIONS.md`, generated with `npm run decisions`.
- **Simple-mode picture choices (round 7):** kind of picture and time frame in the guide; the "Most destructive events" section removed; spacing for the danger tag.
- **Versioned, sourced reports (round 6):** a report is remade as a new version whenever new data changes it; every explanation cites checked sources, mostly NASA; corrections listed in [docs/13-sources-policy.md](docs/13-sources-policy.md).
- **Simple-mode guide, top-5 timelines, PDF report (round 5).**

### Team (`main`, `backend`, `frontend`, `mobile`)

- Confidence floor 0.3 for published events; `GET /api/areas`, `/api/events`, `/api/live`.
- Selections re-checked: no newer NISAR granules for any site.
- Phone layout merged into `frontend`; frontend handoff notes.
- The `mobile` and `testing-frontend` branches take parts of this branch's interface, fitted to phones.

## 2026-11-14

### `jopa-testing`

- **Round 4:** merged the then-latest `frontend`; source-and-date badges on every piece of data; "Why the radar sees changes" explainer; before/after comparator with zoom and change percentage; decision log.
- **Round 3:** removed the danger slider, the "infrastructure near you" function and the "Most dangerous right now" box.
- **Round 2:** compact icon filters with "Show more"; open-areas panel in Technical mode only; live events worldwide from the last 24 hours; every source checked and figures corrected; how often each source updates.
- **Round 1:** branch created from `testing` with the latest `frontend`; Mexico context data (zone notes with plants and animals, remarkable events); event icons; live weather types and severity; zone timelines; satellite before/now.

### Team

- Live deployment: results in Azure Blob Storage, API on an Azure VM, site on a Cloudflare Worker.
- `backend` and `frontend` merged into `main`; contract 0.6.0 (history per area, live events).
- Backend: GCOV, GUNW and SME2 per site, detection rules and categories, three case studies and a whole-Mexico soil-moisture view, burn scars from fire detections, public place lookup, live feeds.
- Frontend: globe and close-up views, welcome screen, country search, filters with icons, live events fetched by the page, two languages more, tutorial, accessibility menu, satellite model.

## 2026-11-13

### Team

- Specification package (spec authority, lane branches, commit rules); Mexico chosen as the study region.
- Backend: a `uv` project that pulls NISAR GCOV granules with `asf_search`, ingests them into contract files, a site pipeline with streamed reads, rule-based classification, change events and `/query`.
- Frontend: Vite + TypeScript + MapLibre scaffold, then the globe home screen with theme filters, area tabs and timeline, radar viewer, coordinate jump, close-up view, view wheel and tour.
