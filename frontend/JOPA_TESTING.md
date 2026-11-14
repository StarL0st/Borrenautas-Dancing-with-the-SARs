# `jopa-testing`: user interface work (local branch)

Personal testing branch, created 2026-11-14 from `origin/testing` (6e9cd94) with the latest `origin/frontend` (e7a8f48) merged in.
**Local only: not pushed, not merged.** The app has not been run in a browser (no dev server). Checked without running it: `tsc --noEmit` passes, the frontend unit tests pass (15 of 15), and the backend unit tests pass (43, including 12 for the live feeds).

## What changed, in short

| # | Request | What was built | Files |
|---|---|---|---|
| 1 | An icon per event, keeping the colored-dot groups | One silhouette per filter type. Filled with the group color when on, outline only when off. Groups keep their colored dots and "Select all". | `src/icons.ts`, `src/main.ts` (`buildFilters`), `src/style.css` |
| 2 | Live events for every event type, weather included | Live feeds now carry hurricanes and tropical cyclones, severe storms, heat, cold and snow, dust and haze, and industrial accidents, besides earthquakes, wildfires, floods, volcanoes, drought, landslides and marine events. | `backend/src/sars_pipeline/livefeeds.py`, `src/filters.ts` |
| 3 | Most dangerous or destructive recent events, with legal sources | **Most dangerous right now** (live, ranked by a 0–3 danger score) and **Most destructive recent events** (Mexico since 2015, curated, every item names its sources) | `livefeeds.py`, `src/logic.ts`, `src/mexico.ts`, `src/main.ts` |
| 4 | A timeline of remarkable events for each zone | Each open area shows a strip of years with a mark per event and the events below, oldest first | `src/mexico.ts` (`HISTORY`, `zoneHistory`), `src/main.ts` (`historySection`) |
| 5 | Mexico only | Globe opens on Mexico; live events are kept to Mexico and its seas; example places, filters and data are Mexican; polar filter types removed | `src/globe.ts`, `src/example-areas.ts`, `src/filters.ts`, `livefeeds.py` |
| 6 | Infrastructure risks near the user | Dams, levees, sinking cities, mine tailings, pipelines, bridges, roads, oil fields, a nuclear plant, an unstable slope: on the globe and in a list near you, red when movement passes a threshold, with "what can go wrong" examples | `src/mexico.ts` (`INFRA`, `LEARN`, `INFRA_THRESHOLDS`), `src/main.ts`, `src/globe.ts` |
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

### 6. Infrastructure risks near you

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

### 7. Simpler Simple mode

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

These figures are widely reported, but I wrote them from memory, not checked against the source this session:

- **Death tolls:**
  - 1985 quake: "about 3,000 to over 10,000".
  - El Chichón: "about 2,000".
  - Pauline: "more than 200".
  - Chiapas 2017: "about a hundred".
  - Puebla 2017: "about 370".
  - Tlahuelilpan: "more than 130".
  - Metro Line 12: 26.
  - Oaxaca 2020: ten.
- **Other figures:**
  - Sonora spill volume: about 40,000 m³.
  - Cutzamala in 2024: "a quarter to a third of capacity".
  - Otis: "first Category 5 landfall on Mexico's Pacific coast on record".
  - Mexico City sinking: "up to roughly 30–40 cm a year".
- **Coordinates are approximate** (city or epicenter level). Check epicenters on the USGS event pages.
- **Some example places are illustrative** and could be swapped:
  - Sierra de Arteaga (wildfires)
  - Los Humeros (induced seismicity)
  - El Bosque, Centla (coastal loss)
  - Sierra Tarahumara (cold and logging)

## Open questions for the team

1. **Contract:** to color structures from real NISAR data, the backend could add per-site ground motion (mm per year) to the manifest or a new `infra.geojson`. That is a contract change (`docs/04-contracts.md`), so it was not made here.
2. **Removed filter types:** the backend's categorizer may still emit `ice-sheets` and the other polar types. They would then show as "unknown" types (always visible), which is harmless for Mexico.
3. **Tutorial:** the tour has no steps yet for the new panels.

## When you want to run it

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
