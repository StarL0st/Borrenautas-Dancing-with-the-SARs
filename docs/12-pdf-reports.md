# 12. Area reports (PDF)

How the area report is built, kept up to date and sourced. Code: `frontend/src/report.ts` (template and drawing), `report-core.ts` (snapshots and versions), `reader.ts` (in-page reader), `pdf-text.ts` (text helpers), and the report manager in `main.ts`.

## 1. Principles

- **A fixed template filled with data.** The cover and the twelve sections, their order and their wording are fixed in `report.ts` (English and Spanish; German falls back to English). The blanks are filled from the area's data. The same data always gives the same content.
- **No AI at runtime.** No service is called and no text is generated when a report is made. The libraries only draw pages: jsPDF and jspdf-autotable (making the PDF), pdf.js (reading it in the page).
- **Everything sourced.** Numbers, maps and tables come from the data files. Every explanation carries numbered citations [n], listed in the References section ([13-sources-policy.md](13-sources-policy.md)).
- **Never from incomplete data.** If the detected changes have not loaded, no report is made: it would claim there are none.

## 2. What a report contains

| Part | Content | Source of the content |
|---|---|---|
| Cover | Area name, version, when it was made, the types of change; tiles with radar dates, number of detected changes, main kinds of change, data maturity; the area description; when each source last published; a "What is new since version N" box; contents with page numbers and links | Manifest, events, live file, satellite search; the description from `backend/sites.json` |
| 1. Where the data come from | The four kinds of source (NISAR radar, other satellite, live report, published record) and a table of every source used, with dates | Layers, satellite pictures, live file |
| 2. Pictures | NISAR radar first vs latest pass; detected change, surface type and ground motion maps over the radar picture, two per row with legends; satellite before/now | Layer PNGs from storage, NASA GIBS |
| 3. Detected changes | Count and date span; bars by kind and by month; the 5 most important in full; every change in a table | `events.geojson` |
| 4. Change over time | One chart per unit (dB, %, m³/m³) | The area's time-series files |
| 5. What changed in the zone | Notes, plants and animals, linked sources | `frontend/src/mexico.ts` |
| 6. Remarkable events | Every past event within 150 km, then their sources with links | `frontend/src/mexico.ts` |
| 7. Live reports nearby | Reports within 300 km from the last 24 hours; satellite fire hot spots in one line | The live file or the page's own collector |
| 8. How the radar sees these changes | The explainer ideas for the area's types | `frontend/src/explain.ts` |
| 9. Methods and decisions | The decision log as a table | `frontend/src/decisions.ts` |
| 10. List of radar pictures | Every NISAR layer with dates, product, maturity, units and range | Manifest |
| 11. Glossary | Terms used in the report | `report.ts`, each with sources |
| 12. References and data citations | Every cited source (who, title, link, date checked); the NISAR product DOIs, live feed credits, GIBS layer; the "hypotheses, not facts" note | `frontend/src/sources.ts`, manifest credits |

Every page has a header (report and area name) and a footer (area, version, date, "Page N of M").

## 3. Layout rules

- Big sections start a new page; short ones follow the previous one when there is room.
- Two-picture rows are measured first (chip, picture, legend, caption), so a row never breaks across pages. Pictures are kept within 120 mm of height.
- The contents stay on the cover when they fit, otherwise they take the page after it.
- Long text wraps; text that must be cut ends in "..." so nothing is silently truncated.
- The built-in PDF fonts only draw Western European letters; other characters are swapped for a near match (`pdf-text.ts`).

## 4. Versions: keeping reports current

```
area shown ──> snapshot (everything the report shows, fetched now) ──> content key
                                                                          │
                     same key as the kept report? ──yes──> keep it        │
                                     │no                                   │
                                     v                                     │
              draw version N+1, list what changed, drop version N  <──────┘
```

- **Snapshot:** the area and its layers, its detected changes, live reports within 300 km, the satellite pictures (same layer and period as the card), the time series, and the language. When each source last published (`asOf`) is recorded but is not part of the key, so a source republishing the same data is not a new version.
- **When it is checked:** when the area is shown; after new radar results (pushed by the server or found by the 5-minute check); after each live update; every hour (satellite photos are published daily); after a language change or a change of the card's satellite settings.
- **Only areas on screen are rebuilt at once.** Reports of other areas are marked stale and rebuilt when the area is shown or the report is read.
- **No lost updates:** data arriving while a report is being drawn triggers one more build when it finishes.
- **Time limits:** each step (gathering, drawing) gives up after 90 seconds; pictures after 30 seconds (the report is made without them); the button then offers to try again.
- **What is new** is worded from the difference between the two snapshots: radar pictures added or removed, detected changes (from → to), live reports nearby, a newer satellite photo, time series, area details, language.

## 5. Reading and downloading

- The PDF is made in advance and kept as a file in the page, so **Download** is a plain link that works at the click in every browser (some browsers, Safari above all, refuse a download started after a wait).
- **Read the report** draws the pages inside the page with pdf.js, only those near the view (cleared again when far away), at most 1.5× screen sharpness, and releases the document when closed. It works in browsers that block new tabs or have no PDF viewer.

## 6. Changing the template

- Wording: the `EN` and `ES` objects at the top of `report.ts`. Keep the same keys and `{placeholders}` in both.
- Sections: the numbered blocks in `renderReport` (search for `=====`). Keep each section's data in the snapshot, so versions stay correct.
- New facts in explanations, the glossary or decisions: add their source to `sources.ts` first ([13-sources-policy.md](13-sources-policy.md)).
- Run `npm test` in `frontend/` (report-core and text helpers are covered) and open a report in the app to check the layout.
