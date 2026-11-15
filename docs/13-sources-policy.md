# 13. Sources policy

The rule: **no sentence in the app or its reports states a fact without a real source behind it, preferably NASA.** Data comes from the services that publish it; explanations cite the pages they come from; the app's own rules cite the code that applies them.

## 1. Kinds of information and where they come from

| Kind | Examples | Source | Shown as |
|---|---|---|---|
| NISAR data | Radar pictures, detected changes, ground motion, soil moisture | NISAR products via ASF DAAC, processed by `backend/` (granules listed in each layer's provenance) | ◆ NISAR radar badge, product, maturity, date |
| Other satellites | Before/now photos, fire hot spots | NASA GIBS (HLS, VIIRS, MODIS), NASA FIRMS | ● Other satellite badge, satellite, date |
| Live reports | Earthquakes, storms, floods, alerts | USGS, NASA EONET, GDACS, NOAA | ▲ Live report badge, agency, report time |
| Published records | Zone notes, remarkable events | Agency reports and peer-reviewed studies, each linked in `frontend/src/mexico.ts` | ■ Published record badge, date checked |
| Explanations | Radar explainer, glossary, decision log, kids' facts | The pages in `frontend/src/sources.ts` | Links on the page; [n] citations and References in the report |
| The app's own rules | 3 dB flood rule, 4 dB new buildings, 5 cm/yr sinking, 0.04 km² minimum, top-5 ranking | `backend/src/sars_pipeline/classify.py`, `categorize.py`, `site.py`; `frontend/src` | Called "the app's rule", citing the code |

## 2. The source registry

`frontend/src/sources.ts` lists every outside source the explanations cite: who published it, the title and the link. Each entry was opened and read on the date in `SOURCES_CHECKED`, and each sentence that cites it says only what the page says. Most are NASA pages: NISAR quick facts, NASA Earthdata (SAR, SAR image interpretation, HLS, GIBS, MODIS near real-time), NASA/JPL (Mexico City subsidence), NASA ASF DAAC (NISAR data products), NASA Earth Observatory (NDVI), NASA FIRMS, NASA EONET and NASA SPHEREx. The others are official agencies (USGS, NOAA, GDACS, the National Eye Institute) and the authors of the colorblind-safe palette.

Tests (`frontend/test/logic.test.ts`) check that every explanation, decision and kids' fact cites at least one source, and that every source in the registry has a link.

## 3. Adding or changing a fact

1. **Find the source**, preferably a NASA page; otherwise an official agency or a peer-reviewed study. News articles and encyclopedias are not enough on their own.
2. **Open it and read it.** Write the sentence so it says only what the page says. Numbers must match the page (for example, NISAR's L-band is 24 cm on NISAR's own page).
3. **Add it to `sources.ts`** if it is new, and list its id in the item's `refs`.
4. **Update `SOURCES_CHECKED`** when you re-check the registry.
5. **The app's own numbers** (thresholds, rankings) cite `rules` or `app`, never an outside page.
6. **If no source supports a claim, remove the claim.** Analogies ("like a cake sinking in the middle") are allowed in the kids' guide when they do not state a fact.
7. Run `npm test` in `frontend/`; regenerate `frontend/DECISIONS.md` with `npm run decisions` if decisions changed.

## 4. Corrections made while checking

Kept as a record, so they are not reintroduced:

| Was | Now | Source |
|---|---|---|
| Mexico City "sinks 30 to 50 cm a year" | About 35 cm a year in the 1990s and 2000s; more than 2 cm a month measured by NISAR between October 2025 and January 2026 | NASA/JPL, April 29, 2026 |
| Glossary: "HH is strong for buildings and water" | Calm water looks black; HH shows double bounce (buildings, trunks, flooded vegetation) | NASA Earthdata |
| "Radar speckle is multiplicative" | Removed; replaced by "multi-looking removes speckle" | NASA Earthdata |
| "There is no labeled training data for NISAR over Mexico" | Removed (no source) | - |
| "Small or cloud-hidden fires are missed" | Removed; replaced by the app's own rule | - |
| Resolution figures on VIIRS and MODIS photo labels | Removed (not verified); HLS keeps 30 m | NASA Earthdata (HLS) |
| Ground motion "red: often sinking" | "Red: moving away from the satellite" | Data legend |
