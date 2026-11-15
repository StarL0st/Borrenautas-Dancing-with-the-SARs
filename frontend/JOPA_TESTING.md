# `jopa-testing`: user interface work (local branch)

Personal testing branch, created 2026-11-14 from `origin/testing` (6e9cd94) with the latest `origin/frontend` (e7a8f48) merged in.
**Rounds 4 to 9 are local only (not pushed).** On GitHub the team deleted the branch `jopa-testing` on 2026-11-14 and kept its round 3 state as the tag `archive/jopa-testing` (see `docs/10-status-log.md` on `main`); some of its features were ported to `frontend`. Checked after every round: `tsc --noEmit` and the frontend unit tests (30 after round 6) pass; it was run locally and looked at in the app's browser.

## What the branch has now (after round 10)

- **Round 10 (code review fixes):** failed or slow loads no longer wipe data or put false numbers in reports; no update is lost while a report is being made; the reader draws only the pages near the view; open cards no longer reset every 5 minutes. Round 11 fixed what a second review found (report layout, reader, comparator controls). Pushed to GitHub only up to round 9; rounds 10 and 11 are local.

- **Reading a zone's report works everywhere** (round 9): "Read the report" opens it inside the page; "Download full report (PDF)" is a plain link to the finished file.

- **No decision log on the page** (round 8): the header button and the cards' "Why these data and methods?" link are gone. The decisions live in the repository as [DECISIONS.md](DECISIONS.md), generated from `src/decisions.ts` with `npm run decisions`. The PDF report keeps its "Methods and decisions" table.

- **Left panel:** the "Most destructive recent events" section is gone (round 7).
- **Simple mode, section 3 "Look for yourself":** the child picks the kind of picture (NISAR radar when the area has it, close-up photo, whole-region photo, fire view, green leaves map) and how far back (1 month to 5 years).

- **PDF reports stay up to date**: each zone's PDF is made when its card opens and remade as a new version whenever new data changes what it shows; the old version is thrown away and the new one says what is new.
- **Every explanation is sourced**: the radar explainer, glossary, decision log and kids' facts cite pages that were opened and read (mostly NASA); the PDF numbers its citations and ends with a References section.

- **Simple mode has its own side panel, written for a 10-year-old**: a welcome guide, then for each place six numbered questions (what is this place about, what did the space radar see, look for yourself, did you know, where does this come from, words to know).
- **Technical timelines are short**: the 5 most important detected changes and the 5 most important remarkable events per zone; the rest is in the report.
- **Downloadable PDF report per zone**: a cover with key numbers and contents, then 12 numbered sections with pictures, charts and tables, every part labeled with its source and date.

- **The latest `frontend` branch** (welcome screen, country search, live events the page fetches itself, NOAA weather alerts and USGS volcano levels, Azure addresses), with this branch's own features kept.
- **Every piece of data says where it comes from and when**, with one badge style: ◆ NISAR radar, ● other satellite, ▲ live report, ■ published record, each with the product and the date it was taken.
- **"Why the radar sees changes"**: a simple illustrated explainer, in each card (the ideas for that area) and as a full page from the header.
- **Before/after comparator** with zoom and a "changes larger than N%" control, for NISAR radar pictures and for the satellite photos.
- **Decision log**: why these data and methods were chosen, what was given up, with dates.

- **Event icons** on every filter type: filled when on, outline when off. Compact buttons, with "Show N more" per group.
- **Live events, worldwide, last 24 hours,** for every type with a public feed, weather included. Serious and extreme events carry a danger label. The page says how often the server checks the sources.
- ~~**Most destructive recent events**~~ (removed in round 7).
- **Open areas panel (Technical mode only):** a satellite before/now view (NASA GIBS), "What changed" with effects on plants and animals, and a timeline of remarkable events per zone. Simple mode shows a short popup with "See all details".
- **Removed in round 3:** the "How dangerous" slider, the "Infrastructure risks near you" function and the "Most dangerous right now" box.

## Change log (one row per commit)

| Commit | Round | What it did |
|---|---|---|
| `bbe50eb` | setup | Branch created from `origin/testing`, with the latest `origin/frontend` (e7a8f48) merged in |
| `c4a711a` | 1 | Backend: live feeds ported from `testing-live-events`; weather types (hurricanes, storms, heat, cold, dust, industrial); danger score 0–3; Mexico region filter |
| `f6c30d8` | 1 | Frontend: Mexico scope, event icons, live sliders, most dangerous now, recent destructive events, infrastructure risks, zone timelines, satellite before/now, plants and animals notes |
| `d80fba3` | 1 | Docs: this file, first version |
| `92f7ce8` | 2 | Backend: live events worldwide and from the last 24 hours; `refresh_minutes` in `live.geojson` |
| `932105d` | 2 | Frontend: compact icon buttons with "Show more", open areas panel in Technical mode only, live list worldwide and 24 h, corrected sources and facts |
| `d5143fc` | 2 | Docs: round 2, source check, update frequency |
| `4dec1df` | 2 | Fixes found while running: worldwide wording, Simple list length, sea ice label, popup no longer waits for the map's flight |
| `281dd08` | 3 | Removed the "How dangerous" slider (and its minimum-danger filter and texts) and the "Infrastructure risks near you" function (panel, location, radius slider, globe dots, data, texts, styles, tests) |
| `82c0e5d` | 3 | Docs: round 3 and this change log |
| `31596a7` | 3 | Removed the "Most dangerous right now" box (heading, list, empty message, `topLive`, texts, styles, test) |
| `2103f2d` | 3 | Docs: change log row above |
| `a3c0da6` | 4 | Merged the latest `origin/frontend` (abbf80b) into this branch; kept the Mexico history, zone notes, worst-events list, Simple-mode popup and danger labels |
| `db6c2a1` | 4 | Data origin badges, radar explainer, before/after comparator, decision log |
| `689018e` | 4 | Docs: round 4 |
| `a0e9a8a` | 5 | Simple-mode guide, top-5 timelines, PDF report, cloud-aware photo comparison |
| `1b71788` | 5 | Docs: round 5 |
| `fa02065` | 6 | Versioned PDFs kept up to date; every explanation sourced (NASA first) |
| `cd616da` | 6 | Docs: round 6 |
| `bb7a14f` | 7 | Removed "Most destructive recent events"; spacing for the danger tag; picture type and time frame in Simple mode's comparison |
| `99896ae` | 7 | Docs: round 7 |
| `0ea75a8` | 8 | Decision log and "Why these data and methods?" removed from the page; DECISIONS.md in the repository |
| `80b47e7` | 8 | Docs: round 8 |
| `e8d9080` | 9 | Report reader inside the page; report buttons become links to a file made in advance |
| `1d955b6` | 9 | Docs: round 9 (pushed to GitHub `jopa-testing`) |
| `9cd2dde` | 10 | Code review fixes (13 findings) and a sweep for breakages and inconsistencies |
| `7145939` | 10 | Docs: round 10 |
| `a40d77a` | 11 | Second review: report layout, reader drawing, comparator controls, live and status edge cases |
| *this commit* | 11 | Docs: round 11 |

## Round 11 (2026-11-15): second review (local, not pushed; checked with tests, type-check and a build, not run)

| Where | Problem | Fix |
|---|---|---|
| PDF, picture rows | A long caption or a wrapping legend could start a new page halfway through a two-picture row, leaving the second picture on the wrong page | The whole row is measured first (legend rows included) and its text never breaks the page |
| PDF, pictures | A very tall picture could run past the bottom of the page | Pictures are kept within 120 mm of height |
| PDF, cover | A long summary or a long "what is new" list could push the contents off the cover | The contents move to their own page after the cover when they do not fit; the "what is new" box checks its room |
| PDF, cover tile and bars | "Main kinds of change" and the bar labels were cut mid-phrase with no sign ("Agriculture, Deforestation and") | Two kinds only when both fit, else the main one; anything cut ends in "..." |
| PDF, top changes | Long change titles did not wrap | They wrap |
| PDF, charts | A point with a broken date or value would make the PDF library throw, failing the whole report | Such points are left out; a line with none is skipped |
| PDF, sources | Long source names (study citations) ran off the page | They wrap, every line linked |
| PDF, remarkable events | The table named its sources but had no links | The sources follow the table with their links |
| PDF, live reports | "As of" used the time the PDF was drawn | It uses the time the reports were published |
| PDF, references | A reference number could be left alone at the foot of a page | Each reference stays on one page |
| Reader | Clearing a page while pdf.js was still drawing it could make it refuse the next drawing (blank or flickering page) | Each page's drawing is cancelled when it is cleared or the reader closes |
| Comparator | A double-click to zoom also moved the divider; the wheel over a picture blocked page scrolling even at full size or 8×; the arrow keys did nothing at full size | The divider is put back on a double-click; the wheel scrolls the page when it cannot zoom further; left/right move the divider at full size |
| Live reports | A source that kept failing kept its "still going on" events forever | Kept events from a failing source expire 24 hours after their date |
| Status | A failed retry of the detected changes switched to "could not refresh" | It keeps saying the changes have not loaded yet |
| Simple guide | A missing date would read "Invalid Date" | It shows the raw value or "-" |

## Round 10 (2026-11-15): code review fixes (local, not pushed)

| # | Problem found | Fix |
|---|---|---|
| 1 | A failed refresh replaced the real zones with the examples and threw the reports away; a failed `events.geojson` read as "no changes", so a new PDF version said "detected changes: 224 → 0" | A failed refresh keeps the last good data and says so ("Could not refresh the radar data; still showing the last results loaded"). Only a 404 means "no changes file". On a first visit, if only the changes file fails, the real zones still show with a note, no PDF is made (it would claim zero changes), and the 5-minute check tries again. |
| 2 | New data arriving while a PDF was being made was dropped | A request with new data during a build marks it, and the PDF is made once more when the build ends; a refresh pass called during another pass runs again. |
| 3 | The reader drew every page at up to 2× (about 570 MB for 31 pages) and never released the document | Pages are drawn only within one screen of the view and cleared beyond four, at 1.5× at most; the document is released when the reader closes or another opens. Checked: 2 of 25 pages drawn at the top, 3 after scrolling. |
| 4 | Every live update (every 5 minutes) rebuilt the open cards, closing opened sections and reloading pictures | Live updates now redraw only the live list and the globe's live dots (`renderLive`). |
| 5 | A request that never answered could stall every report forever | Time limits: thumbnails 15 s, report pictures 30 s, charts 20 s, area files 60 s, each report step 90 s. |
| 6 | Changing the language or the card's satellite settings left the kept PDF out of date | Both now remake the report. |
| 7 | A background build could use the zone as it was before a reload | The build looks the zone up again when it starts. |
| 8 | Two overlapping area loads could finish out of order | Loads are numbered; only the newest is applied. |
| 9 | If the reader's code failed to load, "Read" did nothing | The status line says the report could not be shown. |
| 10 | Pictures that failed to load were reported as "change cannot be measured" | Now "The pictures could not be loaded. Try again later." |
| 11 | When some live sources failed, their events vanished and the PDF said "live reports changed" | Events from sources that did not answer are kept until they expire (`collectLive` now says which failed). |
| 12 | The satellite photo search checked one day at a time (up to about a minute) | It checks 6 days at once and still takes the newest clear day. |
| 13 | Every kept PDF was remade on every live update | Only zones on screen are remade at once; the others are marked stale and remade when shown or read. |

**Also found in the sweep:** the first load showed the 25 example places with no message while a 2 MB file downloaded (40+ seconds today); it now says "Loading radar data…". Eight unused texts and 36 duplicated or dead style rules left by the frontend merge were removed (computed styles unchanged; one property, `overflow-wrap`, was kept by moving it). The 5-minute check no longer treats an error page as new data.

**Checked:** 30 frontend tests and 45 backend tests pass; a production build works; in the browser, the loading message, the real zones (5 areas, 406 changes today), a report ready in about 11 seconds, an opened section that stays open, no page errors, and the reader's lazy drawing. **Not exercised live:** the "changes file failed on first visit" path (the storage answered).

## Round 9 (2026-11-15)

| Request | What changed |
|---|---|
| "I am not able to read the report for each zone" | **Cause:** the button made the PDF only after the click (several seconds, satellite search included) and then started the download from code. Browsers, Safari above all, refuse a download or a new tab that does not start at the click itself, so nothing happened. And some browsers (embedded and in-app views) have no PDF viewer at all, so even a new tab would show nothing. **Fix:** (1) Each zone's PDF is made in the background as soon as the zone is shown (Technical card or Simple guide) and kept up to date as before; until it is ready the control says "Preparing the report…". (2) **Read the report** (Simple mode: **Read everything**) opens a reader inside the page (`src/reader.ts`) that draws every page with pdf.js 4.10.38 (Mozilla's PDF renderer), so it works in any browser; it has its own Download and Close. (3) **Download full report (PDF)** is now a plain link to the finished file, so the browser downloads it at the click. (4) "N more in the full report" opens the reader too. (5) If making a PDF ever fails, the control says so and tries again when clicked. pdf.js is loaded only when a report is opened. |

**Checked in the browser:** Chapala, Technical mode: the controls were ready 9 seconds after opening the zone; a real mouse click on "Read the report" opened the reader with all 24 pages drawn; the download link carries the file and its name (`gigas-chapala-v1-2026-11-15.pdf`). Villahermosa, Simple mode: "Read everything" opens the same reader. A production build keeps the reader and pdf.js in their own files.

## Round 8 (2026-11-15)

| Request | What changed |
|---|---|
| Erase the decision log from the app; it will be in the repository for the curious | **Removed from the page:** the header's **Decision log** button and its dialog (list, kind filter), the decision texts (`btn.decisions`, `dec.*`) in three languages and their styles. The explainer dialog ("How radar sees") stays. **In the repository:** [DECISIONS.md](DECISIONS.md), all 13 decisions with date, kind, what we chose, why, instead of what, what we give up, and numbered sources (mostly NASA). It is generated from `src/decisions.ts` and `src/sources.ts` by `npm run decisions` (`scripts/decisions-md.mjs`), so it never drifts from the data. **Kept:** the PDF report's "Methods and decisions" table. |
| Erase "Why these data and methods?" | The link at the end of each Technical card is gone (it only opened the decision log). |

## Round 7 (2026-11-15)

| Request | What changed |
|---|---|
| Remove the "Most destructive events" section from the left panel | **Removed:** the heading, note and list (`index.html`), `renderRecent` and its popup (`main.ts`), its styles and its texts in three languages. The events themselves stay in each zone's "Remarkable events" and in the PDF; `mostDestructive` stays in `mexico.ts` (tested, unused by the page). |
| The "Serious" tag runs into the event text | The tag now keeps 10 px from the text before it, has wider padding (10 px each side), never breaks inside, and the row keeps 14 px from its right edge. Checked on every tagged row: 12 px gap when it shares a line, its own line when the row is narrow, no overlap. |
| Simple mode, section 3: choose the kind of pictures and their time frame | **"What kind of picture?"**: Space radar (NISAR, only where the area has radar pictures), Close-up photo (HLS, city-sized areas), Whole-region photo (VIIRS), Fire view (MODIS bands 7-2-1), Green leaves map (MODIS NDVI). Each choice shows one sentence that says only what its NASA source says, with the source linked: NASA Earthdata's MODIS page and Worldview fire tutorial ("burned land looks reddish brown"), NASA Earth Observatory's NDVI page ("no green leaves gives a number close to zero"), NASA Earthdata HLS and GIBS, NISAR quick facts. **"How far back?"**: 1 month, 3 months, 6 months, 1 year, 2 years, 5 years. Photos look for clear days; the radar compares the latest pass with the last pass that far back, and says so when NISAR's record is shorter ("NISAR's pictures here go back to June 18, 2026"). Each area remembers its choices. |

**Checked in the browser:** the section is gone; tag spacing measured on all 5 tagged rows; Villahermosa in Simple mode offers all 5 picture kinds and 6 time frames; radar 1 year (June 18 → October 16, with the "goes back to" note), radar 1 month (September 10 → October 16), fire view 1 month (October 14 → November 14) all load and compare.

## Round 6 (2026-11-15)

| Request | What changed |
|---|---|
| PDFs must never be out of date | **Versions** (`report-core.ts`, the PDF code in `main.ts`): a report is now made from a *snapshot* of everything it shows (radar layers, detected changes, live reports within 300 km, satellite photos, time series). A zone's PDF is made when its card opens in Technical mode and kept. Whenever new data arrives (new radar results, the 5-minute live check, the hourly satellite check) every kept PDF is checked again: if its content changed, the old file is thrown away and **version N+1** is made. The PDF cover says its version, when it was made, when each source last published ("Data as of"), and a **"What is new since version N"** box (for example "newer satellite photo (2026-11-04)", "detected changes: 64 → 66"). The footer carries the version on every page. Downloading always checks first, so it gives the newest version. The card shows "Report version N, made …, matches the latest data. It replaced version N-1: …". A source republishing identical data does not make a new version. Zones that leave the data lose their PDF. **New data reaches the page:** the radar results (`manifest.json`, `events.geojson`) are now fetched without the browser cache and checked every 5 minutes, so new passes appear without reloading. |
| No invented information; every fact from a real source, preferably NASA | **`src/sources.ts`**: the outside sources, each opened and read on 2026-11-14: NASA NISAR Quick Facts, NASA Earthdata *SAR* and *SAR Image Interpretation*, NASA/JPL's Mexico City subsidence report (April 29, 2026), NASA ASF *NISAR Data Products*, NASA Earthdata HLS and GIBS, NASA FIRMS, NASA EONET, NASA SPHEREx, USGS, NOAA, GDACS, the National Eye Institute and Okabe & Ito. The project's own rules cite the project's code. **Rewritten to match the sources:** the radar explainer, the PDF glossary, the decision log and the kids' "Did you know?" facts; each item now carries its sources, shown as links on the page and as numbered citations [n] in the PDF, which ends with a **References** list (who, title, link) and the data citations (NISAR DOIs, live feed credits, GIBS). **Corrections:** Mexico City sinking was "30 to 50 cm a year"; NASA/JPL says about 35 cm a year in the 1990s and 2000s, and more than 2 cm a month measured by NISAR (Oct 2025 to Jan 2026). The glossary said HH is strong for water; NASA says calm water looks black, and HH shows double bounce (buildings, trunks, flooded vegetation). **Removed because no source said so:** "radar speckle is multiplicative", "there is no labeled training data for NISAR over Mexico", "small or cloud-hidden fires are missed", the "often sinking" note on ground-motion maps, the VIIRS and MODIS resolutions on photo labels, and a revisit time for HLS. The area descriptions are marked as coming from the project's list of study areas, and detected-change descriptions as written by the detection rules from the measurements. |

**Checked in the browser:** opening Villahermosa made version 1 by itself; changing what the report shows made version 2 with "It replaced version 1: newer satellite photo (2026-11-04)"; the PDF (18 pages) has the version, "Data as of", the "What is new" box, 61 numbered citations and 20 references with links.

## Round 5 (2026-11-15)

| Request | What changed |
|---|---|
| A sidebar for Simple mode, easy enough for a 10-year-old | The right-hand panel now shows in Simple mode too, as **Your guide** (`kidCard`, `kidWelcome` in `src/main.ts`; words in `src/kid.ts` and the `kid.*` texts in `src/i18n.ts`). **Nothing open:** "Hi, explorer!", how to use the map in three steps, what the dot colors mean, who NISAR is, words to know. **A place open** (one at a time; clicking it again goes back): 1. *What is this place about?* each kind of change in one everyday sentence ("Sinking ground: the ground slowly goes down, like a cake sinking in the middle"). 2. *What did the space radar see?* how many days NISAR looked and what it found, in words ("239 farm fields that changed"), with a note that "may have" still needs checking. 3. *Look for yourself:* two space photos a year apart in the comparator, without the technical controls, ending in "About N out of every 100 pieces of this picture changed". 4. *Did you know?* one true fact. 5. *Where does this come from?* NISAR, other satellites and experts' reports, each with its date written out ("October 21, 2026"). 6. *Words to know.* Then **Download everything (PDF)** and **I want all the details** (switches to Technical). The old Simple-mode popup is gone. Short sentences, one idea each; English, Spanish and German. |
| Technical mode: only the 5 most important events per zone | **Detected changes:** the card keeps the 5 with the largest size × confidence (`topEvents` in `src/logic.ts`), newest first; with only radar passes, the 5 latest. **Remarkable events:** the 5 worst, then newest (`topHistory` in `src/mexico.ts`). Each list says "N more in the full report" with a PDF button. Headings only say "the 5 most important" when there were more to choose from. |
| A downloadable PDF with all the information, organized and good-looking | `src/report.ts` (loaded only when asked, with jsPDF 4.2.1 and jspdf-autotable 5.0.9). **Cover:** dark band with the area name, "At a glance" tiles (radar dates, detected changes, main kinds, data maturity), summary and clickable contents with page numbers. **Sections:** 1 Where the data come from (the four source kinds and a table of every source with dates). 2 Pictures: radar first vs latest pass, detected-change, surface-type and ground-motion maps two per row with legends, satellite before/now. 3 Detected changes: bars by kind and by month, the 5 most important in full, then every change in a table. 4 Change over time (charts). 5 What changed in the zone, plants and animals, linked sources. 6 Remarkable events (all). 7 Live reports nearby (fire hot spots summed up in one line). 8 How the radar sees these changes. 9 Methods and decisions. 10 List of every radar picture. 11 Words used. 12 Credits and the "hypotheses, not facts" note. Page header and "Page N of M" footer on every page. English or Spanish (German falls back to English). Villahermosa: 17 pages; Yucatán (443 changes): 31 pages, made in under 4 seconds. |
| (found while testing) Clouds counted as change in photos | The photo comparison now leaves out clouds and a 1-pixel ring around them, and measures dark ground against a minimum brightness so forest shade is not "changed". Technical mode says how much cloud was left out; the kids' view says when clouds make counting unfair ("That is why NISAR uses radar: it sees right through clouds!") and looks longer for clear days. |

**Checked in the browser:** the guide's welcome and a place card (Yucatán, Villahermosa, Chapala), the top-5 timelines with "59 more in the full report", PDFs for Villahermosa (English) and Yucatán (Spanish) rendered page by page and looked at; a production build works and keeps the PDF code in its own file. **Note:** the team's Azure storage changed during testing (13 areas, then 4); the app shows whatever is there.

## Round 4 (2026-11-14, night)

| Request | What changed |
|---|---|
| Update to the new frontend and use it in my branch | `origin/frontend` merged in (merge commit `a3c0da6`). Conflicts resolved by keeping both: the frontend's page-side live feeds (`src/livefeeds.ts`), country filter and welcome screen, plus this branch's Mexico data (`src/mexico.ts`), worst-events list, zone notes, Simple-mode popup and danger labels. Polar types (ice sheets, sea ice, permafrost, glacial lakes) are back in the filters, as on `frontend`. |
| Make it very clear which data are from NISAR, which from other sources, and when they were taken | New `src/origin.ts`: one badge style everywhere, shape + name + color (never color alone). **NISAR radar** (diamond): each radar picture says product, channel, maturity and date (for example *GCOV HV · PROVISIONAL · taken 2026-08-14*); detected changes say their two dates; timeline rows, charts and the globe's change popups carry it too. Areas with no radar data say so plainly. **Other satellite** (circle): each satellite photo names the satellite (HLS Landsat or Sentinel-2, VIIRS, MODIS) and its date. **Live report** (triangle): the live list says the reports are not NISAR; each popup gives the agency and the exact report time in UTC. **Published record** (square): zone notes, remarkable events and the worst-events list say when the sources were checked. Each card starts with a key of the kinds it uses. |
| A module that explains why the radar sees changes, simply | New `src/explain.ts` (text, English and Spanish; German falls back to English) and `src/explain-view.ts` (small drawings). Seven ideas: an echo not a photo, water is a mirror, corners shine, leaves scramble the wave, wet ground echoes more, measuring centimeters, what can fool it. The numbers are the back end's own rules (3 dB flood and forest loss, 4 dB new buildings, 5 cm/yr sinking, 0.04 km² minimum). **In each card:** "Why the radar sees changes here", folded, with the ideas for that area's types. **Header button "How radar sees":** all seven. |
| A before/after comparator with zoom and a change-percentage control | New `src/compare.ts` (canvas view) and `src/compare-core.ts` (the math, unit-tested). **Radar:** a new "Compare two dates" section picks any two dates of the HH or HV backscatter (Technical mode; Simple mode compares the first and latest). The gray levels are turned back into echo power with each picture's own dB stretch, so the comparison is real. A warning appears if the two dates have different data maturity. **Satellite photos:** the old swipe was replaced by the same comparator; zooming in loads a sharper picture of that part. **Both:** divider to swipe, zoom 1–8× (buttons, wheel, double-click, keys + − 0 and arrows), drag to move, "Mark what changed" with a "Changes larger than N%" slider (Technical radar shows the dB too), blue for brighter and orange for darker, and "N% of what you see changed". Change = \|after − before\| ÷ the brighter one, after a 3 × 3 average: 50% is 3 dB, the step the detection rules use. Photos default to 30% and say it is a visual guide. |
| A small record of decisions | New `src/decisions.ts` and a **Decision log** header button (also "Why these data and methods?" at the end of each card). 13 decisions with date, kind (data, method, design), what we chose, why, instead of what, and what we give up; filter by kind. Dates and numbers come from the repository (`docs/03`, `docs/10`, `classify.py`, `site.py`). |
| Run it locally | `npm run dev` at http://127.0.0.1:5173/, reading the team's real NISAR results from the Azure storage (`VITE_DATA_BASE`, read-only) so the radar parts have data. See "When you want to run it". |

**Checked in the browser:** Mexico City card shows the key and NISAR badges with dates; the radar comparator reads real pixels (HV, 2026-08-14 vs 2026-10-13: 0.2% changed by more than 50%, 13% by more than 20%); zoom works; the satellite comparator found HLS pictures 2025-11-13 and 2026-10-31; both dialogs open and the decision filter works (a bug that cancelled clicks inside the dialog was fixed). **Not checked in the browser:** the Simple-mode popup (the hidden browser pane pauses the mode switch's animation).

## Round 3 (2026-11-14, evening)

| Request | What changed |
|---|---|
| Erase the "How dangerous" slider and data | **Removed:** the slider in "Happening now", the minimum-danger filter (`minSeverity` in `src/logic.ts`), and its texts (`live.level`, `level.0`–`level.3`) in three languages. The unused "From the last" texts from round 2 went too. **Kept:** each event's danger score (`severity` from the backend), because **Most dangerous right now** needs it to rank events and the list marks serious and extreme events. Ask if you also want the score itself removed. |
| Erase the function that analyzes infrastructure near the user | **Removed:** the left-panel section (Use my location, the radius slider, the list), the colored dots on the globe, the data (`INFRA`, `LEARN`, `INFRA_THRESHOLDS`, `statusOf`, `infraNear` in `src/mexico.ts`), about 30 texts in each language, the styles and the tests. The browser no longer asks for location. |
| Erase the "Most dangerous right now" text | **Removed:** the whole box, including the heading, its list, the "Nothing serious…" message, the `topLive` ranking, its texts in three languages, its styles and its test. **Kept:** the danger label (Serious, Extreme) on events in the live list. |
| Push to my personal branch | The branch `jopa-testing` was pushed to GitHub (`origin/jopa-testing`). Nothing was merged into `testing`, `frontend` or `main`. |

The round 1 and round 2 sections below describe some features that were removed later; they are marked as such.

## Round 2 (2026-11-14, later the same day)

This round overrides parts of round 1.

| Request | What changed |
|---|---|
| Keep the icons, make them smaller (the whole button) | Filter buttons are compact. **Simple mode:** 4 small tiles per row (20 px icon, small text). **Technical mode:** tight rows with an 18 px icon. |
| "Show N more" in the disasters panel | Each group shows its first types (4 in Simple mode, 6 in Technical mode) and a **Show N more / Show less** button. Hidden types keep their on/off state. |
| Keep timelines and the open areas sidebar, but only in Technical mode | **Technical mode:** the right-hand panel, with its full cards (satellite view, What changed, zone timeline, radar), works as before. **Simple mode:** the panel is gone and the globe gets the space. Clicking an area opens a short popup with its summary, what changed, and **See all details (Technical mode)**, which switches mode and opens the full card. |
| Live events only from the day, worldwide | **Range:** the backend keeps events updated in the **last 24 hours** (`LIVE_HOURS`, default 24), worldwide by default. `LIVE_REGION=mexico` is still available to narrow it. **Feeds:** USGS uses its *past day* feed, GDACS and EONET are asked for the last 2 days, and the 24-hour filter is applied last. **FIRMS:** worldwide it would be tens of thousands of points a day, so only high-confidence detections, newest 1,500. **Page:** the "From the last" slider was removed; "How dangerous" stays. "Most dangerous right now" is worldwide. |
| How often the data updates | The page shows "The server checks the sources every N minutes". The full table is under "How often the data updates". |
| Check the sources | Every link was opened and every figure was checked against independent sources. The corrections are listed under "Source check". |

**Unchanged:** "Most destructive recent events", the zone timelines and the infrastructure risks still use the Mexico data. Only live events went worldwide.

### How often the data updates

| Step | How often | Source for the figure |
|---|---|---|
| USGS earthquakes (past day feed) | The feed is rebuilt about every minute | USGS feed list (cache 60 s for hour/day/week feeds) |
| NASA FIRMS fire detections | Within about 3 hours of the satellite passing (real time in the US and Canada) | NASA FIRMS / Earthdata |
| NOAA NHC tropical cyclones | Advisories every 6 hours (03, 09, 15, 21 UTC), every 3 hours when coastal watches or warnings are up, specials any time | NHC Product Description (2023) |
| GDACS alerts | When an alert is issued or updated (event-driven, no fixed interval published) | GDACS API quick start |
| NASA EONET | Continuously, as curators add and update events (no fixed interval published) | EONET event curation page |
| **Our backend** (`serve --live-minutes 15`) | Fetches all feeds every **15 minutes** (the number is a startup option) and writes `live.geojson` | `livefeeds.poll` |
| **The page** | Reloads live events as soon as the server announces a new file (push on `/events`), and every 10 minutes in any case | `main.ts` |
| Satellite view (NASA GIBS) | VIIRS and MODIS daily, a few hours after the pass; HLS every 2–3 days, a few days late | GIBS layer time ranges, checked 2026-11-14 |

In practice an event reaches the page **at most about 15 minutes after its source publishes it**. How long the source takes after the event itself varies: about a minute for USGS, up to 3 hours for FIRMS, and up to 6 hours for NHC.

### Source check

**Links.** Every source link in `src/mexico.ts` was opened.

| Source | Problem | Fix |
|---|---|---|
| CONAGUA dam inventory (`sinav30…:8080`) | Did not respond | CONAGUA's official page |
| NASA Earth Observatory | Has moved | `science.nasa.gov/earth/earth-observatory` |
| Comisión Nacional de Hidrocarburos | Dissolved in the 2025 energy reform | Pemex |
| Global Forest Watch | Now redirects to a renamed site | The original University of Maryland GLAD Global Forest Change dataset (Landsat-based) |
| Chaussard et al. (2014) | Had no link | DOI added |
| Smithsonian GVP, IUCN Red List | Refuse automated checks (403) | None needed: both open normally in a browser |

**Facts.** Checked with web searches. Corrected:

| Event | Was | Now |
|---|---|---|
| 1985 earthquake deaths | "about 3,000 to over 10,000" | official count about 10,000; other estimates higher |
| Otis | "first Category 5 landfall on Mexico's Pacific coast on record" (not supported) | "one of the strongest hurricanes ever to hit Mexico's Pacific coast" |
| Patricia | weakened before landfall | weakened to **Category 4** before landfall (NHC final report) |
| Gilbert | "hundreds died" | about 200 in Mexico, most in Monterrey |
| Wilma | stalled "more than a day" | "two days or more" (48–60 h reported) |
| Tabasco 2007 | "most of the state" | up to about 80% of the state; about a million affected |
| Piedras Negras tornado | "several" deaths | 3 in Piedras Negras, 7 in Eagle Pass, Texas |
| Cutzamala 2024 | "a quarter to a third" | about 26% in June 2024, the lowest in some 25 years |
| Mexico City subsidence | 30–40 cm/yr | up to about 30–50 cm/yr |
| Other sinking cities | "several cm" | about 5–10 cm/yr (Chaussard et al., 2014) |

**Confirmed as written:**
- Ixtoc I (about 9–10 months)
- El Chichón (about 2,000 deaths)
- Chiapas 2017 (about 100)
- Puebla 2017 (about 370)
- Tlahuelilpan (more than 130)
- Sonora spill (40,000 m³, August 6, 2014)
- Ingrid and Manuel (well over a hundred; La Pintada)
- Zacatepec sinkhole (more than 100 m across)
- Northern blackout 2021 (millions of users; Reuters reports 4.7 million)
- Popocatépetl 2023 (Yellow Phase 3, airports closed, about 25 million within about 100 km)

**Not independently checked:** Metro Line 12 (26 deaths), Oaxaca 2020 (10 deaths), Alex 2010, John 2024, and the dam descriptions. These are widely reported, but I did not search them this session.

**How trustworthy each kind of source is:**
- **NASA, NOAA and USGS:** primary data from the agencies that measure it. Most reliable.
- **GDACS (UN and EU):** a coordination system that aggregates agency data.
- **Mexican government agencies** (SSN at UNAM, CENAPRED, CONAGUA, SEMARNAT, CONABIO, CONANP): official national sources.
- **Chaussard et al. (2014):** a peer-reviewed study.
- **IUCN Red List:** the reference for species status.
- **Not used in the app:** news outlets and Wikipedia. They were only used to cross-check figures.

## Round 1: what changed, in short

| # | Request | What was built | Files |
|---|---|---|---|
| 1 | An icon per event, keeping the colored-dot groups | One silhouette per filter type. Filled with the group color when on, outline only when off. Groups keep their colored dots and "Select all". | `src/icons.ts`, `src/main.ts` (`buildFilters`), `src/style.css` |
| 2 | Live events for every event type, weather included | Live feeds now carry hurricanes and tropical cyclones, severe storms, heat, cold and snow, dust and haze, and industrial accidents, besides earthquakes, wildfires, floods, volcanoes, drought, landslides and marine events. | `backend/src/sars_pipeline/livefeeds.py`, `src/filters.ts` |
| 3 | Most dangerous or destructive recent events, with legal sources | **Most dangerous right now** (live, ranked by a 0–3 danger score) and **Most destructive recent events** (Mexico since 2015, curated, every item names its sources) | `livefeeds.py`, `src/logic.ts`, `src/mexico.ts`, `src/main.ts` |
| 4 | A timeline of remarkable events for each zone | Each open area shows a strip of years with a mark per event and the events below, oldest first | `src/mexico.ts` (`HISTORY`, `zoneHistory`), `src/main.ts` (`historySection`) |
| 5 | Mexico only | Globe opens on Mexico; live events are kept to Mexico and its seas; example places, filters and data are Mexican; polar filter types removed | `src/globe.ts`, `src/example-areas.ts`, `src/filters.ts`, `livefeeds.py` |
| 6 | Infrastructure risks near the user (**removed in round 3**) | Dams, levees, sinking cities, mine tailings, pipelines, bridges, roads, oil fields, a nuclear plant, an unstable slope: on the globe and in a list near you, red when movement passes a threshold, with "what can go wrong" examples | `src/mexico.ts` (`INFRA`, `LEARN`, `INFRA_THRESHOLDS`), `src/main.ts`, `src/globe.ts` |
| 7 | A simpler Simple mode, with sliders | Big icon tiles instead of a checklist; sliders for time window, danger level, search radius, "compare with" and a before/now swipe; shorter lists | `src/main.ts`, `src/style.css`, `index.html` |
| 8 | Satellite pictures of the zone now, and notes on what changed (plants and animals) | A **Satellite view** in each area card (the "Radar images / What changed" panel from the screenshot): a "now" and a "before" picture from NASA GIBS with a swipe to compare. **What changed** gains notes on each zone, including effects on plants and animals. | `src/satview.ts`, `src/mexico.ts` (`ZONES`), `src/main.ts` |

## The features

### 1. Event icons

- `src/icons.ts` draws one silhouette per type on a 24×24 grid (original shapes, one even-odd path each).
- **On:** filled with the group color (orange: natural, pink: caused by humans, yellow: land use). **Off:** the outline alone.
- The checkbox is still there, hidden but focusable, so keyboards and screen readers work as before.
- The same icons, filled, mark each row in "Happening now", the recent events and the zone timelines.
- **Technical mode:** a list (icon + full name). **Simple mode:** a grid of three tiles per row with big icons and short names.

### 2. Live events for every type (backend)

The live feeds were ported from `testing-live-events`, because `testing` only had their frontend part. They were then extended:

| Type (filter id) | Live source | Note |
|---|---|---|
| Earthquakes (`earthquakes`) | USGS, now M2.5+ (was M4.5+) | Mexico's smaller quakes show; a tsunami flag adds a note |
| Hurricanes and tropical cyclones (`hurricanes`, new) | NOAA NHC, GDACS (TC), NASA EONET | EONET's "severe storms" with a tropical name |
| Severe storms (`storms`) | NASA EONET | other severe storms |
| Heat waves (`heat`, new) | NASA EONET (temperature extremes) | |
| Cold waves, frost and snow (`cold`, new) | NASA EONET (snow, cold temperature extremes) | |
| Dust storms and haze (`dust`, new) | NASA EONET (dust and haze) | |
| Wildfires | NASA FIRMS (key), NASA EONET, GDACS | |
| Floods, volcanoes, drought | GDACS, NASA EONET | |
| Landslides, marine (sargassum, algal blooms) | NASA EONET | rare in the feed |
| Oil spills, industrial accidents (`industrial`, new) | NASA EONET "manmade" | rare in the feed |
| Subsidence, groundwater, deforestation, logging, urban, agriculture, coastal loss, reservoirs, induced seismicity, sinkholes, glaciers | none | Slow changes: no public live feed exists. They come from the NISAR radar areas, the timelines and the infrastructure panel. |

- **Danger score, `severity` 0–3:**
  - Earthquakes: magnitude 5, 6 and 7 (a tsunami flag counts as at least 2).
  - GDACS: Green, Orange and Red alerts.
  - NOAA NHC: tropical storm 1, hurricane 2, major hurricane (96 kt and up, Category 3+) 3.
  - FIRMS hot spots: 0.
- **Mexico only:** `write()` keeps the events inside `LIVE_REGION`. The default is Mexico plus the Eastern Pacific, the Gulf and the western Caribbean, where its storms form. `LIVE_REGION=world` keeps everything. The frontend applies the same box, so older worldwide files are trimmed too.
- **Tests:** `backend/tests/test_livefeeds.py` covers the weather mapping, the severity scores and the region filter. 12 pass; the whole backend suite is 43 passed.

### 3. Most dangerous now, most destructive recently

- **Most dangerous right now** (top of "Happening now"): the three worst live events (severity 2+), worst first, then newest. It follows the filters and the time window but not the danger slider, so it never hides itself.
- **Most destructive recent events** (left panel): Mexico since 2015, worst first, eight in Technical mode and five in Simple mode. The type filters apply. Click one to fly there and read what happened, with its sources.

### 4. Zone timeline

- Each open area lists the remarkable events that touched it (`zoneHistory`): any of the event's places within 150 km of the area's center, or all of them for the whole-country area.
- Events list the places they hit as well as the epicenter: the 1985 quake struck off Michoacán but killed thousands in Mexico City.
- A **strip of years** (1975 to now) has one mark per event, bigger for the most destructive. Click a mark to open its row.

### 5. Mexico only

- The globe opens on Mexico. Auto-rotate starts off so the view stays on Mexico; the button still turns the Earth.
- **Filters:** ice sheets, sea ice, permafrost and glacial lakes were removed (they don't apply to Mexico). Glaciers stay for Pico de Orizaba. New: hurricanes, heat, cold, dust, industrial.
- **Example places** (shown while no backend is connected) are now 25 Mexican places, one per type, for example Juchitán, Popocatépetl, Acapulco, Villahermosa and Mexico City.

### 6. Infrastructure risks near you (removed in round 3)

- **Where from:**
  - "Use my location": the browser asks first; the position is not stored or sent anywhere.
  - The coordinates typed in Technical mode.
  - The last area opened.
- **Radius slider:** 25–400 km.
- **Each site** shows a status chip (always words plus a color), its kind, its distance, why it matters, its measured or reported movement, the threshold for its kind, "What can go wrong" with real cases, and its sources.
- **On the globe:** every site is a dot colored by status. Click it for the same details.

| Status | Rule |
|---|---|
| Moving fast (red) | measured movement at or above the red threshold for its kind, or a published study reports fast movement |
| Watch (amber) | at or above the amber threshold |
| Stable (green) | below it |
| Not measured yet (gray) | no measurement: NISAR time series would fill this |

- **Thresholds** (mm per year, amber/red; `INFRA_THRESHOLDS`):
  - dams, tailings, bridges, power plants: 3/10
  - levees: 5/15
  - pipelines: 5/20
  - sinking cities: 10/20
  - roads, slopes, oil fields: 10/30

  They are illustrative, not engineering limits. They follow the NISAR applications documents' idea of flagging unusually large localized movement.
- **Only Mexico City has a number** (about −350 mm per year at its fastest, Chaussard et al., 2014). The other sinking cities are "reported fast" from the same study, and the dams are "not measured yet".
- **Next step:** fill `mmYr` per structure from the backend's NISAR ground-motion layers. That needs a contract field; see "Open questions".
- **Learning texts** use the brief's examples (Derna, Oroville, Brumadinho, New Orleans, Morandi, Mexico City) plus Mexican ones (Peñitas 2007, Cananea 2014, Tlahuelilpan 2019, Metro Line 12 2021).

### 7. Simpler Simple mode (the time-window and danger sliders were removed in rounds 2 and 3)

- **Filters:** icon tiles with short names.
- **Sliders instead of extra controls:**
  - Happening now: "From the last" (1, 3, 7, 14 or 30 days) and "How dangerous" (everything, notable, serious, extreme).
  - Infrastructure: "Look within" (km).
  - Satellite view: "Compare with" (1 month to 10 years earlier).
  - A swipe slider on the before/now picture.
- **Shorter lists:** 6 live events at a time (15 in Technical mode), 5 recent events, 5 nearby sites.
- **Satellite view** picks the picture by itself in Simple mode; Technical mode can switch between natural color 30 m, daily natural color, burn scars and water, and vegetation.

### 8. Satellite view and "What changed" in the area card

- **Not SPHEREx:** SPHEREx is an astronomy telescope that maps the sky, not the Earth, so it has no pictures of cities. The card says so in one line.
- **What it uses:** NASA GIBS (public, no key, CORS), which serves these layers:

  | Layer | Detail | Revisit |
  |---|---|---|
  | HLS (Harmonized Landsat 8/9 + Sentinel-2) | 30 m | every 2–3 days |
  | VIIRS natural color | 375 m | daily |
  | MODIS bands 7-2-1 | burn scars, water | daily |
  | MODIS vegetation index | green vegetation | 8 days |

- **How a picture is chosen:** `findClear` steps back day by day. For each day it reads a 48-px thumbnail and skips days with no pass (black) or too many clouds (white), then loads the full 640-px picture.
  - "Now" searches back from yesterday, since GIBS is about a day late.
  - "Before" searches back from the chosen number of months earlier.
  - Searches are cached per area, layer and date.
- **Checked on 2026-11-14** with `curl` against GIBS:
  - HLS shows Mexico City streets clearly (for example 2025-01-20).
  - Many recent HLS dates came back empty for that box, which is why the search looks back up to 60 days.
- **What changed** in the card:
  - The zone's notes on what changed, then **Effects on plants and animals**, then their sources, then the detected changes from the backend as before.
  - Zones with notes: Mexico City (Xochimilco and the axolotl), Hopelchén (forest corridor to Calakmul, Maya beekeepers), Chapala (native fish, wintering pelicans), Villahermosa (Pantanos de Centla).
  - Example areas use the nearest zone within 100 km.

## Space Apps data rules followed

- **NASA data first:**
  - EONET, FIRMS and GIBS (HLS, VIIRS, MODIS) are NASA.
  - NASA Earth Observatory is cited for context.
- **Other public sources,** each credited by name with a link:
  - US government: USGS, NOAA NHC, NOAA OR&R.
  - International: GDACS (UN OCHA and EU JRC), Smithsonian GVP.
  - Mexican government: SSN (UNAM), CENAPRED, CONAGUA, SEMARNAT, CONABIO, CONANP.
  - Other: IUCN Red List, Global Forest Watch (Landsat), and a peer-reviewed paper.
- **No logos, no claim of endorsement.** Live events say they are not radar detections, as before.
- **Sentinel-2 cloudless basemap** (EOX, CC BY 4.0) is unchanged and credited as before.

## Facts to double-check before submission

See "Source check" in Round 2 for what was checked and corrected, and what was not checked.

## Open questions for the team

1. **Contract:** to color structures from real NISAR data, the backend could add per-site ground motion (mm per year) to the manifest or a new `infra.geojson`. That is a contract change (`docs/04-contracts.md`), so it was not made here.
2. **Removed filter types:** the backend's categorizer may still emit `ice-sheets` and the other polar types. They would then show as "unknown" types (always visible), which is harmless for Mexico.
3. **Tutorial:** the tour has no steps yet for the new panels.

## When you want to run it

Rounds 4 and 5: the front end alone, reading the team's real NISAR results from Azure (read-only):

```bash
cd frontend && VITE_DATA_BASE=https://gigassars.blob.core.windows.net/data/ VITE_API_BASE=https://gigas-sars.westus2.cloudapp.azure.com/ npm run dev -- --host 127.0.0.1 --port 5173
```

Without those two variables it looks for a local back end at http://127.0.0.1:8765/ and, without one, shows example places (no NISAR data, which the cards then say).

Earlier rounds:

Node is at `/opt/homebrew/bin/node`. If your shell doesn't find it, run `export PATH="/opt/homebrew/bin:$PATH"` first.

```
cd frontend
npm ci
npm test          # frontend tests, including the new ones
npm run build     # type-check + build
npm run dev       # http://localhost:5173
```

Backend with Mexico-only live events:

```
cd backend
uv run sars-pipeline live-events
uv run sars-pipeline serve --live-minutes 15
```
