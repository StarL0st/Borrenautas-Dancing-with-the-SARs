# 01. Product Spec

Status: Draft. Ratify at kickoff (hour 0-3). Decisions marked **DECIDE** are closed in an ADR at kickoff, not before.

## Vision

An open-source web app that lets a non-expert watch a piece of Earth's surface change over time as NISAR sees it, understand why it changed, and trust what they are looking at. The radar is the hard part; the product's job is to make it readable.

Shape: a 3D globe (frontend) backed by a service (backend). The backend selects NISAR acquisitions, detects change, classifies it into typed event records (flood, forest loss, ...), stores them, and answers location queries; the frontend shows them on the globe and asks the backend what is known at a place. The long-term goal is global; the hackathon demo covers Mexico with three sites.

Working title: "Dancing with the SARs" (**DECIDE**: final product name).

## Users and what they need

| User | Need |
|---|---|
| Public / educators | Understand what radar shows without SAR background; shareable, visual, plain language |
| Resource managers / decision-makers | See where and when change happened, how big, and how confident we are |
| Scientists | Inspect provenance (granules, product, maturity, parameters), polarizations, time series |

## User stories

1. As a visitor, I open the app and immediately see a map of a place with a clear "what changed" layer and a one-sentence explanation.
2. As a visitor, I move a slider (or swipe) between dates and see the surface change.
3. As an educator, I follow a guided story that explains what the radar sees and why it changed.
4. As a manager, I click a location and see how its radar signal changed across all available dates.
5. As a scientist, I open any layer and see which NISAR granules, product type, polarization, and data maturity produced it.

## Scope

### Must (traces to R-IDs)

| ID | Item | Traces to |
|---|---|---|
| M1 | Interactive web map of one study area with at least one NISAR-derived change layer | R1, R2, R3, R4 |
| M2 | Time dimension: at least two dates comparable via slider or swipe | R2, R10 |
| M3 | Legend and plain-language "what you are seeing" text for every layer | R9 |
| M4 | Narrative with physical-driver hypotheses for observed (or absent) change | R7 |
| M5 | Discussion of which polarizations highlight the change, and future NISAR applications | R8 |
| M6 | Provenance on every layer: granule IDs, product, polarization, maturity, processing parameters | R9 (trust) |
| M7 | Open-source repo with README and license; runs as a static site | R9 |
| M8 | Submission-ready presentation (video and/or slides) and project summary | R6 |

### Should

| ID | Item |
|---|---|
| S1 | Time-series chart for a clicked point or drawn region |
| S2 | Context layers (optical imagery or GIS layers) that can be toggled |
| S3 | A second polarization or a composite view, with an explanation of the difference |
| S4 | Guided story mode that drives the map |
| S5 | A "what NISAR can do next" section |

### Could

| ID | Item |
|---|---|
| C1 | A second study area or second change type |
| C2 | Displacement (interferometry) layer if the chosen area suits it |
| C3 | Export (PNG of current view, CSV of a time series) |
| C4 | Playful framing that echoes the challenge's "dance" theme without hurting clarity |

## Non-goals

- Global coverage or on-demand processing during the hackathon. The query API is built for it, but the demo covers Mexico (three sites)
- User accounts. The API server (Cloud Run) is used, but the demo must also run from a static export if the server is down
- Writing new SAR processing from raw signal data (we use the mission's higher-level products)
- Real-time or near-real-time updates. "Live" means the latest acquisition (12-day repeat per track and frame), and the app says so
- Claims beyond what the data supports (every layer states its data maturity)

## Quality bar

- A first-time viewer understands the main change within 30 seconds, without help.
- A 3-minute walkthrough tells a complete story: place, change, why, how radar sees it, what is next.
- Nothing synthetic is ever shown as real. Synthetic fixtures carry `synthetic: true` and a visible banner.
- Works on a laptop browser and acceptably on a phone.

## Success checks (for the demo)

- All Must items pass their feature-spec acceptance criteria.
- Two people outside the team can explain the main change after using the app for two minutes.
- Fresh clone to running app works from the README.

## Open decisions (close at kickoff via ADR)

| Decision | Owner | Deadline |
|---|---|---|
| Study area and change type(s) (ADR-002). **Region decided: Mexico**, three sites (10 m detail, optional national 80 m overview); the three sites and their change types still open. San Francisco is the local pipeline test area only | Team, led by Lane 3 and Lane 1 | T+3h |
| Change-detection method (ADR-003) | Lane 1 | T+4h |
| Final product name | Team | T+6h |
