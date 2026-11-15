# G.I.G.A.S: Global Interactive Geographical Analytics System

<p align="center">
  <img src="images/welcome-screen.png" alt="The G.I.G.A.S welcome screen: 'Welcome to G.I.G.A.S' in raised letters and a Start button over the Earth's horizon, with Mexico and its event markers below" width="800">
</p>

Team: [Borrenautas](https://www.spaceappschallenge.org/2026/find-a-team/borrenautas/?tab=members)

Challenge: [Dancing with the SARs](https://www.spaceappschallenge.org/2026/challenges/dancing-with-the-sars/), NASA International Space Apps Challenge 2026.

Live site: **[gigas.earth](https://gigas.earth)**

G.I.G.A.S (Global Interactive Geographical Analytics System) is an open-source web app that shows how the Earth's surface changes, as seen by the NISAR radar satellite, on an interactive 3D globe. A back end turns NISAR radar products into map layers and typed change events (floods, forest loss, sinking ground, soil drying). The globe shows them next to live disaster events from official public sources, in plain words for the public and with full technical detail for scientists.

## Map of Contents

1. [About the project](#about-the-project)
2. [Background](#background)
3. [Who it is for](#who-it-is-for)
4. [Video and demo](#video-and-demo)
5. [The web page](#the-web-page)
6. [Features](#features)
7. [Live events: sources and update times](#live-events-sources-and-update-times)
8. [The NISAR pipeline (back end)](#the-nisar-pipeline-back-end)
9. [Methodology for radar data processing](#methodology-for-radar-data-processing)
10. [Architecture](#architecture)
11. [How to run it](#how-to-run-it)
12. [NASA data and other sources](#nasa-data-and-other-sources)
13. [What is real and what is not](#what-is-real-and-what-is-not)
14. [Known limits](#known-limits)
15. [Future](#future)
16. [File descriptions](#file-descriptions)
17. [Languages, frameworks and other technologies](#languages-frameworks-and-other-technologies)
18. [Use of AI](#use-of-ai)
19. [License](#license)
20. [Team members and their contributions](#team-members-and-their-contributions)

## About the project

Submission for the challenge [Dancing with the SARs](https://www.spaceappschallenge.org/2026/challenges/dancing-with-the-sars/) (event: November 14-15, 2026).

The Earth's surface is always changing: wetlands flood and dry, forests are cleared or burn, cities sink as groundwater is pumped out, fields change with the seasons. Radar satellites see these changes day and night and through clouds, but radar images are hard to read without training.

G.I.G.A.S makes that data readable:

- A **3D globe** you can spin, zoom and search by country or coordinates, on a computer or a mobile device.
- **Radar areas**: places processed from NISAR data, each with its radar pictures over time, the changes detected, a chart, a downloadable PDF report, and where every image comes from.
- **Live events**: what is happening on Earth right now (earthquakes, fires, floods, storms, volcanoes and more), from official sources, always labelled as *not* radar detections.
- **Two modes**: *Simple*, written so a 10-year-old can follow it, and *Technical*, with every layer, measurement and provenance record.

The hackathon demo covers Mexico: three case-study sites, a country-wide soil-moisture mosaic and 33 city sites watched for sinking ground. The design is global.

## Background

<p align="center">
  <img src="https://assets.science.nasa.gov/dynamicimage/assets/science/psd/photojournal/pia/pia26/pia26613/PIA26613.jpg" alt="Artist's concept of the NISAR satellite in orbit above the Earth, with its large round radar reflector unfolded" width="800">
</p>
<p align="center">NISAR in Orbit (Artist's Concept), PIA26613. Credit: NASA/JPL-Caltech.</p>

NISAR (NASA-ISRO Synthetic Aperture Radar) is a radar satellite from NASA and ISRO. A radar sends its own microwave pulses and measures what comes back, so it works at night and through clouds. What comes back depends mostly on how rough the surface is and how much water it holds. That makes radar good at seeing floods (open water turns dark), forest loss (the signal from tree canopies drops), new buildings (bright corners), and ground that rises or sinks by centimetres between two passes.

The challenge asks for an interactive application that uses NISAR data to track and visualize one or more types of surface change, with intuitive tools that make the data understandable to a broad audience.

## Who it is for

| User | What they get |
|---|---|
| Public and educators | Simple mode: a guide written for a 10-year-old, one picture per place chosen by the app, a "why the radar sees changes" explainer, a guided tutorial, three languages |
| Resource managers and decision-makers | Where and when change happened, how big, how confident the detection is, what is happening live nearby, and a PDF report per area to share |
| Scientists | Technical mode: every layer and polarization, value ranges, time series, full provenance (granules, product, maturity, parameters), and a public API |

## Video and demo

- Live site: [gigas.earth](https://gigas.earth)
- Demo video: (awaiting)

## The web page

The page opens on a welcome screen: the name over the Earth's horizon, slowly turning. Pressing **Start** sends the letters round the Earth and behind it while the camera pulls back to the whole globe and the panels slide in. On the first visit the app asks whether you want the tutorial and which mode to start in. The house button brings you back.

The screen has three parts:

- **Left panel**: country search, filters by type of change, live events ("Happening now"), my places, coordinates (Technical mode) and the list of radar areas.
- **The globe**: one map that is a globe when zoomed out and a flat map when zoomed in.
- **Right panel**: the areas you opened, stacked as tabs. In Simple mode it becomes "Your guide".

On a mobile device the globe sits on top and the panels below it, under two tabs (**Explore** and **Open areas**). The panel grows as you scroll and the globe shrinks to a strip.

<p align="center">
  <img src="images/app-overview.png" alt="The app in Simple mode: live events and my places on the left, Mexico on the globe with grouped event markers, and the guide for Mexico on the right" width="800">
</p>
<p align="center">The program in Simple mode: live events on the left, Mexico on the globe with its markers, and "Your guide" on the right.</p>

## Features

### The globe

- **Globe and close-up views.** The close-up view is a low, tilted camera with the horizon in sight. Switching views keeps your zoom.

<p align="center">
  <img src="images/globe-views.png" alt="The Globe view and Close-up view buttons, highlighted at the top left of the globe" width="800">
</p>
<p align="center">The Globe view and Close-up view buttons.</p>

- **Auto-rotate**, a **view wheel** (Zoom, Orbit, Look, Up/Down, Center, Home; works with mouse, touch and arrow keys) and a **home** button, as square buttons beside the zoom buttons.

<p align="center">
  <img src="images/globe-controls.png" alt="The buttons at the top right of the globe, highlighted: home, zoom in, zoom out, compass, auto-rotate and the view wheel" width="800">
</p>
<p align="center">Home, zoom, compass, auto-rotate and view wheel buttons.</p>

<p align="center">
  <img src="images/view-wheel-v2.png" alt="The view wheel: Zoom, Orbit and Home around the outside, Center, Up/Down and Look inside, with the hint 'Home: bring the whole Earth back to the middle'" width="181">
</p>
<p align="center">The view wheel.</p>

- **Three looks** for the Earth: High Quality (cloud-free Sentinel-2 mosaic, sharp down to city blocks), Hologram (dark outline map) and Street map.

<table>
  <tr>
    <td align="center" width="33%"><img src="images/look-high-quality.png" alt="The globe with the High Quality look: a cloud-free satellite picture of the Americas"><br>High Quality</td>
    <td align="center" width="33%"><img src="images/look-hologram.png" alt="The globe with the Hologram look: dark blue land and sea with light outlines"><br>Hologram</td>
    <td align="center" width="33%"><img src="images/look-street.png" alt="The globe with the Street map look: a light map with country names"><br>Street map</td>
  </tr>
</table>

<p align="center">
  <img src="images/look-street-zoom.png" alt="The Street map look in the close-up view, zoomed in on Hermosillo, Sonora, with roads and place names" width="800">
</p>
<p align="center">Street map, zoomed in on Hermosillo, Sonora.</p>
- **City names** in English, Spanish and German, largest cities first (Natural Earth populated places).
- **Grouped markers.** Events of the same type close together on screen share one square marker with its type icon and a count. Filled markers are radar detections; hollow markers are live events. Clicking a marker lists its events at the top of the right panel, and double-clicking zooms to the group. Markers stay clickable while the globe turns.
- **An orbiting satellite** as a decoration. Its orbit has NISAR's tilt, but its position, height and size are not real, and the tutorial says so.
- **Side panels** can be pushed off screen and pulled back with the arrows on the globe's edges.

### Scope reduction

- **Country search.** Pick one or more countries: they are outlined on the globe, and the area list, the detected changes and the live events keep only what lies inside them.

<p align="center">
  <img src="images/country-search-v2.png" alt="The country search box, highlighted at the top of the left panel, above the filters" width="800">
</p>
<p align="center">The country search, at the top of the left panel.</p>

- **Filters by type**, in three groups (natural disasters, disasters caused by humans, land use), each type with its own icon. Everything on the globe follows the filters.

<p align="center">
  <img src="images/filters.png" alt="The filters panel, highlighted: Natural disasters, Disasters caused by humans and Land use, each type with its icon and a 'Select all' box" width="800">
</p>
<p align="center">Filters by type, in three groups.</p>

- **My places.** Places you open are kept in your browser (only their coordinates) and listed for next time. New visitors see a few suggested places.
- **Go to coordinates** (Technical mode): fly to a latitude and longitude. **Process this place** asks the back end to analyze it. If the place is already a known area, that area opens instead.

<p align="center">
  <img src="images/coordinates.png" alt="The Go to coordinates box, highlighted: latitude and longitude fields, a Go button and a Process this place button, with the globe turned to Asia and Africa" width="800">
</p>
<p align="center">Go to coordinates (Technical mode).</p>

### Radar areas

Areas load only when needed: when you open one, or when you zoom in close over it. Clicking a marker or a list row opens the area as a tab:

- **Radar pictures** with a **date slider at the bottom of the globe** and an opacity control. In Technical mode you choose the layer (backscatter per polarization, detected change, ground motion, soil moisture); in Simple mode the app picks the most telling one.
- **A color key** for every picture and a plain description of what it shows.
- **"What the radar found here"**: a short summary of the changes found in the area, written by the back end for every area, including places looked up by visitors.
- **"Where this comes from"**: product, polarization, data maturity, source granules, processing steps, parameters, software and credit.
- **A source badge on every piece of data** (◆ NISAR radar, ● other satellite, ▲ live report, ■ published record), with the product and the date it was taken.
- **Change over time**: a line chart per unit with a hover readout and a table view.
- **Timeline** of radar passes and the five most important detected changes, with a confidence figure in Technical mode. The rest are in the report.
- **Before/after comparator**: drag a line across two pictures, for NISAR radar pictures and for optical satellite photos from NASA GIBS (Landsat/Sentinel-2 at 30 m, or daily VIIRS), from 1 month to 10 years apart. Ctrl/⌘ + scroll zooms. In Technical mode a slider highlights only changes larger than a chosen percentage (also given in dB).
- **PDF report** per area: press **Make report**, then read it inside the page or download it. A cover with key numbers, then numbered sections with pictures, charts and tables, every part labelled with its source and date, and a numbered list of references (mostly NASA).

#### A radar area, step by step (Villahermosa, Tabasco, in Technical mode)

<p align="center">
  <img src="images/area-card.png" alt="Villahermosa open in Technical mode: the radar picture over the city with its date slider, and the area card with Make report, the types watched for, the source badges, a description of the place and what the radar found" width="800">
</p>
<p align="center">The area card: Make report, the types of change watched for, where each part comes from, and what the radar found.</p>

<p align="center">
  <img src="images/area-found.png" alt="The list of changes found in Villahermosa, highlighted: agriculture, deforestation, urban change, floods, other change and wildfires, each with its level, area in square kilometres, number of places and dates" width="800">
</p>
<p align="center">"What the radar found here": each type of change with its level, its area, how many places and when.</p>

<p align="center">
  <img src="images/compare-radar.png" alt="Compare two dates: two NISAR radar pictures of Villahermosa (HV backscatter, June and October 2026) split by a line you can drag" width="800">
</p>
<p align="center">Comparing two NISAR radar dates (HV backscatter, June and October 2026).</p>

<p align="center">
  <img src="images/compare-satellite.png" alt="The satellite view, highlighted: Landsat and Sentinel-2 photos a year apart, split by a line, with 'Mark what changed' on and changes larger than 30% painted blue for brighter and orange for darker" width="800">
</p>
<p align="center">Optical satellite photos a year apart, with changes larger than 30% marked (blue: brighter, orange: darker).</p>

<p align="center">
  <img src="images/area-chart-v2.png" alt="Change over time charts for the whole area: HH and HV backscatter in dB, the HH/HV ratio in percent, and soil moisture, date by date" width="800">
</p>
<p align="center">Change over time: the radar signal of the whole area, date by date.</p>

<p align="center">
  <img src="images/area-timeline.png" alt="The timeline: the latest NISAR radar passes with their polarizations, a Make report button, and remarkable past events nearby on a line from 1975 to 2026" width="800">
</p>
<p align="center">The timeline of radar passes, and remarkable past events nearby (a hand-picked list, labelled as such).</p>

#### Close-ups of the area card (Mexico, soil moisture)

<table>
  <tr>
    <td align="center" width="33%"><img src="images/layer-picker.png" alt="The layer picker set to Soil moisture, the opacity slider, the NISAR radar badge (PROVISIONAL, 2026-10-10 to 2026-10-21), a plain description and a color key from 0 to 0.5 cubic metres per cubic metre"><br>Layer picker, source badge and color key</td>
    <td align="center" width="33%"><img src="images/soil-drying-events.png" alt="Timeline entries for soil drying detected by NISAR radar, each with its area, an explanation that it is a hypothesis from radar alone, and a confidence figure"><br>Detected changes, each with its confidence</td>
    <td align="center" width="33%"><img src="images/past-events-credits.png" alt="Remarkable past events nearby, a hand-picked list of the five most important (Chiapas and Puebla-Morelos earthquakes, Tlahuelilpan pipeline explosion, Metro Line 12 collapse, Hurricane Otis), then the credits with DOIs"><br>Hand-picked past events and credits</td>
  </tr>
</table>

### Simple mode: "Your guide"

Simple mode has its own side panel, written for beginners: a welcome guide, then six numbered questions for each place:

1. What is the place about?
2. What did the space radar see?
3. Look for yourself (pick the kind of picture and how far back)
4. Did you know?
5. Where does this come from?
6. Words to know

<table>
  <tr>
    <td align="center" width="33%"><img src="images/guide-1.png" alt="Your guide for Villahermosa: question 1, what is this place about, lists cutting down forests, farming, wildfires, floods and growing cities; question 2 says NISAR looked at the place on 10 days"><br>1-2: The place and what the radar saw</td>
    <td align="center" width="33%"><img src="images/guide-2.png" alt="Question 3, look for yourself: choose the kind of picture (close-up photo chosen) and how far back (1 year chosen), then a before and after photo with changes in blue and orange"><br>3-4: Look for yourself</td>
    <td align="center" width="33%"><img src="images/guide-3.png" alt="Question 5, where does this come from, with NISAR radar, other satellite and published record explained, and question 6, words to know: radar, satellite, echo; then Make report and I want all the details"><br>5-6: Sources and words to know</td>
  </tr>
</table>

A **"Why the radar sees changes"** section explains with pictures, in every area card, and can expand to a full page with the "How radar sees"
button tab.
<p align="center">
  <img src="images/how-radar-sees-button.png" alt="The How radar sees button, highlighted in the header between Tutorial and the mode switch" width="800">
</p>
<p align="center">"How radar sees" button opens the explainer.</p>

### Live events ("Happening now")

- Hollow markers on the globe and a list that says **what, where, how long ago, and who reported it**. Serious and extreme events carry a danger label. Clicking a row flies there and opens the details with a link to the source.

<p align="center">
  <img src="images/live-events.png" alt="The Happening now list, highlighted: worldwide, last 24 hours, labelled as a live report from USGS, NASA EONET, GDACS and NOAA, not NISAR, with earthquakes and surf advisories listed; the globe shows the event markers" width="800">
</p>
<p align="center">"Happening now": live events worldwide from the last 24 hours, labelled as not NISAR.</p>

<p align="center">
  <img src="images/live-event-details.png" alt="The details of a magnitude 3.3 earthquake in Alaska, highlighted: live report badge, the U.S. Geological Survey as source, the time reported, the depth and a 'More from the source' link" width="800">
</p>
<p align="center">The details of a live event, with its source and a link to it.</p>

- The page asks the sources itself **every 15 minutes**, so it works wherever it is opened, even without the server. New events appear and expired ones leave without a reload. The server also keeps its own copy, refreshed every 5 minutes.
- See [the next section](#live-events-sources-and-update-times) for the sources.

### For everyone

- **Simple and Technical modes**, switched in the header with an animated cross-fade.

<p align="center">
  <img src="images/mode-selection.png" alt="The mode switch, highlighted in the header: Simple and Technical" width="800">
</p>
<p align="center">The mode switch in the header.</p>

- **Three languages**: English, Spanish and German.
- **Guided tutorial** on the first visit and from the Tutorial button.
- **Works on phones**, in portrait and landscape.
- **Accessibility**: full keyboard use, screen-reader labels, color never used alone (types are always named and have icons), a colorblind-safe palette for the filter groups and charts, and reduced motion respected throughout (animations become fades or stop).
- **Honesty notices**: a banner whenever example places or synthetic test data are on screen.

<p align="center">
  <img src="images/accessibility-menu-v2.png" alt="The accessibility menu: language (English, Español, Deutsch), wheel size (Large, Medium, Small) and globe texture (High Quality, Hologram, Street map), with a note that text from the radar data stays in English" width="800">
</p>
<p align="center">The accessibility menu: language, wheel size and globe look.</p>

## Live events: sources and update times

Only official sources are used, and every event names its source.

| Source | Types it feeds | Coverage |
|---|---|---|
| U.S. Geological Survey, Earthquake Hazards Program | Earthquakes (M2.5+); also landslides, collapses, ice quakes and human-caused shaking when its network records them | World |
| GDACS (United Nations OCHA and European Commission JRC) | Tropical cyclones, floods, volcanoes, drought, wildfires | World |
| NASA EONET (Earth Observatory Natural Event Tracker) | Wildfires, severe storms, volcanoes, sea ice, dust, heat and cold, and others | World |
| NOAA National Weather Service alerts | Storms, hurricanes, floods, heat, cold, dust, fire weather, marine hazards, and watches ("Forecast") | United States |
| U.S. Geological Survey, Volcano Hazards Program | Volcanoes at a raised alert level | United States |
| NOAA National Hurricane Center, NASA FIRMS fire detections (VIIRS on NOAA-20) | Tropical cyclones, fire hot spots | Only through the back end (see [Known limits](#known-limits)) |

**When an event leaves the globe:** a moment in time (an earthquake, a fire detection) after 24 hours; an event its source still lists as going on (a flood, a drought, a weather alert, a restless volcano) when the source stops listing it.

**No live source exists** for the slow changes (subsidence, groundwater extraction, logging, coastal land loss, permafrost, ice sheets). Those are exactly what the NISAR radar areas are for.

## The NISAR pipeline (back end)

<!-- Written from backend/README.md and docs/ on main. Back-end lane: please check this section. -->

The back end (`backend/`, Python) turns NISAR granules into the map layers and change events the globe shows. The complete technical method is in [Methodology for radar data processing](#methodology-for-radar-data-processing). It uses three NISAR products, all NASA data:

| Product | What it measures | Used for |
|---|---|---|
| **GCOV** (L2, 10 m, HH and HV backscatter) | How bright the surface is to the radar | Surface type; floods, forest or vegetation loss, new structures, crops |
| **GUNW** (L2, 80 m, unwrapped interferograms) | Ground motion between two passes (cm) | Subsidence |
| **SME2** (L3, about 200 m) | Soil moisture | Soil drying (a drought signal) |

Steps, per site:

1. **Select** granules with `asf_search` (same viewing geometry, frames that cover the site, never mixing data maturities).
2. **Read** only the site's window over HTTPS, never whole 2-7 GB files.
3. **Detect** change signatures (for example: both polarizations darken to open-water levels; HV drops over vegetation; line-of-sight motion over 5 cm per year). Burn scars use NASA FIRMS fire detections from the fire season, with NISAR showing the ground afterwards.
4. **Classify** them into typed events with a confidence figure and a plain-language summary. Events under confidence 0.3 are not published.
5. **Export** the contract files the globe reads: an index of areas, and per area its layers, time series, events, history and a plain-language summary card. Events whose dates have left the series are kept as archived.

**Sites (Mexico):**

| Site | Watched for |
|---|---|
| Hopelchén, Campeche (Yucatán Peninsula) | Deforestation, farmland |
| Villahermosa, Tabasco | Floods |
| Lake Chapala, Jalisco | Wildfires, forest loss |
| Mexico (whole country) | Soil moisture mosaic, fires |
| 33 cities: Mexico City, Guadalajara, Monterrey, Puerto Vallarta, El Paso and Ciudad Juárez, Tijuana, and 27 state capitals | Sinking ground |

<p align="center">
  <img src="images/mexico-technical.png" alt="The whole of Mexico open in Technical mode: the country with its event markers, and the area card describing the soil moisture mosaic at about 2 km, with drought found in 1-5% of the area and fires watched" width="800">
</p>
<p align="center">The country-wide area in Technical mode: soil moisture at about 2 km, drought and fire detections.</p>

The server re-checks every site for new NISAR passes every 12 hours, one site at a time. Visitors can also ask for any other place (**public lookup**): the point snaps to a 22 km grid cell, so nearby requests share the result, and a point within 10 km of a known site gets that site.

**Public API** (at `api.gigas.earth`): `GET /api/areas` (every processed area), `GET /api/events` (detected changes, filterable by area, type, dates and minimum confidence), `GET /api/live` (live events), plus history by point and dates. Details: `backend/README.md`.

**Which polarizations show the change:** HH responds most to surface roughness and to water (floods darken it); HV responds to volume scattering in vegetation, so a drop in HV larger than in HH points to canopy loss. The app lets you switch between them in Technical mode.

## Methodology for radar data processing

This section explains, step by step, how the back end turns NISAR radar data into map layers, time series and change events. It describes `sars-pipeline` (contract 0.7.0) as on `main` at commit `5a29f65`. Every value is a default in the code, and a site can override most of them in `backend/sites.json`. The code is in `backend/src/sars_pipeline/`; a code map is at the end of this section.

**The pipeline in one line:** choose the area → search ASF → select granules → stream and cache the area's window → reduce speckle → measure → detect change → interpret → filter → publish.

### 1. Data sources

**NISAR (NASA-ISRO SAR), from the NASA ASF DAAC**

| Product | Level | Measures | Grid read | Datasets used |
|---|---|---|---|---|
| **GCOV**: Geocoded Polarimetric Covariance | L2 | Radar backscatter | UTM, frequency A (10 or 20 m posting) | Diagonal covariance terms `HHHH`, `HVHV`: linear γ⁰ power, terrain-flattened (RTC applied), NaN fill |
| **GUNW**: Geocoded Unwrapped Interferogram | L2 | Line-of-sight ground motion between two passes | UTM, 80 m, frequency A, `HH` | `unwrappedPhase`, `ionospherePhaseScreen`, `coherenceMagnitude`, `connectedComponents`, `mask`, `centerFrequency` |
| **SME2**: Soil Moisture | L3 | Volumetric water in the top few centimeters of soil | EASE-Grid 2.0 (EPSG 6933), about 200 m | `soilMoisture` (m³/m³), `retrievalQualityFlag` |

- Over Mexico, GCOV is dual-polarization (HH and HV) and L-band ([docs/03](docs/03-data-sources.md)).
- **Data maturity** (BETA, PROVISIONAL, VALIDATED) is not stored in the granule file; it is read from the collection name:
  - `*_BETA_V1` is BETA.
  - `*_PROVISIONAL_V1` is PROVISIONAL.
  - `NISAR_L2_*_V1` is VALIDATED.
  - Anything else, including Urgent Response, is OTHER.
- Every layer and event carries its maturity and a citation with the collection DOI (`export.CITATIONS`).

**Ancillary data (context only, never shown as radar)**

- **NASA FIRMS**: VIIRS 375 m active-fire detections from NOAA-20.
  - Both the standard (`VIIRS_NOAA20_SP`) and near-real-time (`VIIRS_NOAA20_NRT`) sources are used.
  - FIRMS is used only to interpret radar changes (5.7) and to find burn scars (5.10).
  - It needs a free map key (`FIRMS_MAP_KEY`). Without one, fire evidence is recorded as "not checked" (`null`), never as zero fires.
- **Natural Earth country outline**: clips the national mosaic to Mexico (step 8).

The live disaster feeds (USGS, GDACS, NASA EONET, NOAA) are separate. They are not radar and are not processed by this pipeline.

### 2. Areas of interest

| Kind | Box | Dates | Products |
|---|---|---|---|
| Curated site (`backend/sites.json`) | Set by hand; the tool that adds sites refuses boxes over 1 square degree | Every acquisition since 2026-05-01 | GCOV, GUNW, SME2 (per site) |
| Visitor lookup | 22 × 22 km, centered on a 0.2° grid cell (so nearby lookups share one cell). A point within 10 km of a curated site gets that site | The newest 4 GCOV dates, 4 GUNW pairs, 6 SME2 dates | GCOV, GUNW, SME2 |
| National mosaic (`"kind": "mosaic"`) | Mexico | The two latest 12-day cycles | SME2 only |

### 3. Granule search and selection

Code: `selection.py`.

1. **Search.** One `asf_search` query per product: `dataset="NISAR"`, the product as `processingLevel`, and the box as a WKT polygon.
   - Searches start on 2026-05-01, before the first PROVISIONAL passes over Mexico, so a site's record only grows.
   - Each result keeps its ID, date, track, frame, pass direction, collection, maturity, URL, and **coverage**: the share of the box inside the granule footprint.
2. **Group.**
   - GCOV and GUNW are grouped by (track, frame, pass direction, maturity), so every date in a group has the same viewing geometry.
   - SME2 is grouped by maturity only, because all tracks share the EASE grid.
3. **Deduplicate dates.**
   - For reprocessed granules on one date, the higher granule ID (the later version) wins.
   - For GUNW pairs on the same secondary date, the shortest pair (latest reference date) wins.
4. **GUNW chain.** Only the longest run of *consecutive* pairs is kept, where each pair's secondary date is the next pair's reference date. Summing the chain then gives motion since its first date.
5. **Choose one group.** Groups are ranked lexicographically by:
   1. Footprints cover at least 90% of the box on every date (not applied to SME2).
   2. At least 4 dates.
   3. At least 2 dates.
   4. Higher maturity.
   5. More dates.

   **Maturities are never mixed within a product.**
6. The selection is written to `data/selected/<site>.json`.

### 4. Access: streaming and caching

Code: `remote.py`, `site.py`.

- **No granule is downloaded.** A full GCOV granule is about 6–7 GB.
  - Each file is opened over HTTPS with `fsspec` (Earthdata bearer token, 4 MiB blocks, block cache) and read with `h5py`.
  - Only the HDF5 chunks under the area's window are fetched. A 20 × 20 km GCOV window takes about 16 s ([docs/03](docs/03-data-sources.md)).
- **Window.** The WGS84 box is projected to the granule's grid. The window is the rows and columns whose pixel *centers* fall inside it (`granule.window_slices`).
- **Cache.** Each window is saved as compressed `.npz` in `data/interim/`, keyed by granule ID, number of looks and a hash of the box. A rerun reads only granules it has not seen.

### 5. GCOV: backscatter and surface change

Code: `granule.py`, `classify.py`, `categorize.py`, `site.run_gcov`.

#### 5.1 Speckle reduction and units

- **Multilooking.** Each term is averaged over 4 × 4 pixel blocks in **linear power**, ignoring NaN; a block with no valid pixel stays NaN. On a 10 m grid this gives the 40 m pixels the thresholds were tuned at.
- **Units.** Values are converted to decibels only after averaging:

  ```math
  \gamma^0_{dB} = 10\log_{10}\gamma^0 \quad (\gamma^0 \le 0 \Rightarrow \text{NaN})
  ```

  Averaging in dB would bias the mean low, so every mean in the pipeline (time series, region series) is taken in linear power, then converted.

#### 5.2 Alignment

- Dates come from one track and frame, so their grids share the same snapped coordinates. Windows are cropped to the common shape.
- If any window's first pixel is more than 1 m from the first window's, the run stops with an error. **No resampling is done.**

#### 5.3 Surface type

Code: `categorize.cover_map`.

A rough land-cover map is computed from the radar itself. It is used to interpret every change. It uses the dB values of the **mean of all dates** (in linear power). It is also computed **per date**, to know what a changed region was *before* and *after*. Rules are applied in this order, and the first match wins:

| Class | Rule |
|---|---|
| Water | (HV < −19 dB and HH < −11 dB) or HH < −18 dB |
| Built-up | HH > −4.5 dB |
| Vegetation | HV > −15 dB |
| Bare or low | everything else |

The thresholds were checked on known places at 40 m: city blocks in Mexico City and San Francisco, parks and forest, ocean and bay, dunes, airport grass. They are written in the code. At L-band, HV and HH−HV alone do not separate city from forest; HH brightness does.

#### 5.4 Pairwise change

Every pair of **consecutive** dates (t₋, t₊) is compared, for each polarization p ∈ {HH, HV}:

```math
\Delta_p = S_3\left( \left(\gamma^0_{p,dB}(t_+) - \gamma^0_{p,dB}(t_-)\right) - \mathrm{median}_{scene}\left(\gamma^0_{p,dB}(t_+) - \gamma^0_{p,dB}(t_-)\right) \right)
```

- **Scene-wide median removed.** If the whole scene gets darker or brighter, that is weather (wet or dry soil, wind on water) or calibration, not land change. Only change relative to the rest of the scene is kept. The removed offset is stored with each event (`scene_offset_db`).
- **S₃** is a NaN-aware 3 × 3 box mean, applied after multilooking.
- **Sign.** Negative Δ means the surface got darker to the radar.

#### 5.5 Change signatures

Code: `classify.signature_map`.

Each pixel gets at most one signature, from simple rules. Here "land" means HH ≥ −18 dB on both dates.

| Signature | Rule | Typical cause |
|---|---|---|
| `darkening_both` | ΔHH < −3 dB **and** ΔHV < −3 dB **and** HH(t₊) < −18 dB | New open water: a smooth surface reflects radar away like a mirror |
| `hv_drop` | ΔHV < −3 dB **and** ΔHV − ΔHH < −1.5 dB **and** HV(t₋) > −18 dB | Loss of volume scattering from leaves and branches |
| `brightening` | ΔHH > +4 dB, on land | New walls and roofs (corner reflection), taller crops, wetter soil, water under plants |
| `strong_change` | \|ΔHH\| > 5 dB **or** \|ΔHV\| > 5 dB, on land | Any other large change |

- **Precedence:** darkening, then HV drop, then brightening, then strong change.
- **Edge rings removed.** Smoothing blurs an edge into a ring of weaker change. So `strong_change` pixels within 2 pixels of another signature are cleared, since they belong to that event.
- **Water.** Over water on either date, only the darkening rule may fire, because ships, wind and sidelobe streaks change water constantly.
- **No data.** Pixels without valid data on both dates are marked as such.

#### 5.6 Regions and confidence

- **Regions.** Pixels of one signature are grouped into 8-connected regions. Regions under **25 pixels** (0.04 km² at 40 m) are dropped as noise.
- **Confidence.** Each region scores from 0 to 1: half from how far past its threshold it is, half from its size.

  ```math
  c = 0.5 \min\left(1, \frac{\bar e}{T}\right) + 0.5 \min\left(1, \frac{n}{10 \cdot n_{min}}\right)
  ```

  - ē is the mean excess over the threshold T (in dB) across the region. For darkening, the excess is min(−ΔHH, −ΔHV) − 3.
  - n is the pixel count; n_min = 25.
  - The result is clipped at 0 and rounded to 2 decimals. The same formula, with each product's own threshold and minimum size, is used everywhere below.
- **Outline.** Each region is turned into a polygon (simplified to half a pixel), and its WGS84 box, area in km² and an interior point are stored.

#### 5.7 Interpretation: signature × context → category

Code: `categorize.decide`.

Each region's context is:

- **Before and after:** the majority surface type inside the region on t₋ and t₊.
- **Fires:** the number of FIRMS detections between t₋ and t₊ inside the region's box (±0.005°).
- **Near built-up:** at least 25 built-up pixels on t₋ in a ring of about 500 m (12 pixels) around the region.
- **Double bounce:** mean ΔHH − mean ΔHV of the region.

| Signature | Condition | Categories (first = primary) |
|---|---|---|
| `darkening_both` | before ≠ water | floods |
| `darkening_both` | before = water | *dropped*: water staying water is not a flood |
| any other | before = water | *dropped* |
| `hv_drop` | before = vegetation, with fire detections | wildfires, deforestation |
| `hv_drop` | before = vegetation, no detections (or FIRMS not checked) | deforestation |
| `hv_drop` | before = bare or low | agriculture (harvest, ploughing) |
| `hv_drop` | otherwise | other |
| `brightening` | before = vegetation and ΔHH − ΔHV ≥ 3 dB | floods (flooded vegetation: double bounce off water and stems) |
| `brightening` | after = built-up, and before = built-up or built-up within about 500 m | urban |
| `brightening` | before = bare or low | agriculture |
| `brightening` | otherwise | other |
| `strong_change` | any | other |

Regions that end up only as "other" with confidence below 0.5 are not published.

#### 5.8 Persistence check

A real land change should still be there on the **next** pass. For pair (t₋, t₊), if a later date t₊₊ exists, the region is compared again between t₋ and t₊₊ with the same Δ computation. It must keep at least half of its threshold:

| Signature | Still present if |
|---|---|
| `hv_drop` | mean ΔHV < −1.5 dB |
| `brightening` | mean ΔHH > +2 dB |
| `strong_change` | max(\|mean ΔHH\|, \|mean ΔHV\|) > 2.5 dB |
| `darkening_both` | always: floods are allowed to recede |

- A region that fails is **dropped**: a ship, a wet patch, a one-off glint.
- Regions from the **latest** pair cannot be checked yet. They are kept with confidence × 0.7 and labelled "not yet confirmed by a later pass".

#### 5.9 Seasonal cycle: crops

This needs at least 4 dates.

1. Each date's HV is smoothed with S₃, then the standard deviation of HV is taken across dates.
2. Pixels are kept where it is above **2 dB**, the mean surface type is vegetation or bare, and HH was never below −18 dB (never water).
3. Regions of at least 100 pixels become agriculture events covering the whole record. Their confidence uses the excess of the region's HV standard deviation over 2 dB.

#### 5.10 Burn scars (sites with a `fire_season`)

1. **Burned area.**
   - FIRMS detections in the fire season are placed on the latest window's grid.
   - Each is grown into a disk of 187.5 m radius, half a 375 m VIIRS pixel.
   - Only vegetation or bare ground (mean surface type) is kept.
2. **Control.** Unburned vegetation of the same site, more than three disk radii away from any burned pixel.
3. **Recovery.** For each burned region of at least 25 pixels, mean HV (linear mean → dB) is computed per date for the region and the control.
   - The **gap** is region HV minus control HV for each date.
   - **Recovery** is the latest gap minus the first gap; a positive value means growing back.
4. **Category.**
   - If the region is bare or low on average since the fire, and still 1.5 dB or more below the control on the latest pass, it is treated as cleared land: deforestation, wildfires.
   - Otherwise it is wildfires.
   - Confidence = 0.5·min(1, detections/10) + 0.5·min(1, n/250).

#### 5.11 Time series

- Mean HH and HV over the site per date: linear mean, then dB, with the valid pixel count and the granule ID.
- Open-water share of the site per date: the per-date surface type, as % of valid pixels.
- For every event, HH and HV of its own region per date.

### 6. GUNW: ground motion

Code: `gunw.py`, `site.run_gunw`.

1. **Window.** The site box, enlarged to include its stable **reference area** (`reference_bbox`) if one is set.
2. **Usable pixels.** A pixel is used only if all of these hold:
   - It is valid in both passes (mask subswath digits not 0, and not 255).
   - It is not water (mask water digit).
   - Coherence ≥ 0.3.
   - Its connected component is not 0 or 65535.
   - Phase and ionosphere values are finite.
3. **Line-of-sight motion per pair.** The ionosphere phase screen is not applied in the product by default, so it is subtracted here:

   ```math
   d = (\phi_{unw} - \phi_{iono}) \frac{\lambda}{4\pi}, \qquad \lambda = \frac{c}{f_{center}}
   ```

   - Positive d means the ground moved away from the satellite, which is mostly sinking.
   - The product specification (JPL D-102272 Rev E) does not state the sign. The ISCE/ARIA convention is used, and it was checked to show Mexico City's documented subsidence bowl as sinking.
4. **Referencing.** Unwrapped phase is only meaningful relative to another pixel.
   - For each pair, only the connected component covering most of the reference area is kept, because ambiguities differ between components.
   - The median motion of the reference area is subtracted.
   - Without a reference area, the window median is used instead.
5. **Rate.** Per pixel, over the pairs where the pixel is valid:

   ```math
   v = \frac{\sum_k d_k}{\sum_k \Delta t_k / 365.25}
   ```

   - v is kept only where the pixel is valid in at least 60% of pairs, then converted to cm/yr and smoothed with S₃.
   - On the map, red is away from the satellite. The scale is ±max(5, 98th percentile of |v|) cm/yr.
6. **Events.** These are made only when a reference area is set; otherwise wet air (troposphere) can look like centimeters of motion, and the result is map only.
   - Rate > **5 cm/yr** away from the satellite, inside the site box.
   - Regions of at least **150 pixels**, about 1 km² at 80 m. Subsidence bowls are large; smaller blobs are treated as atmospheric noise.
   - **Category:** subsidence, plus groundwater if the region is built-up (GCOV surface type sampled at the region's pixels).
   - Each event carries its cumulative line-of-sight series: the running sum of the region's mean motion per pair.
   - Confidence: excess over 5 cm/yr, n_min = 150.

### 7. SME2: soil moisture per site

Code: `sme2.py`, `site.run_sme2`.

1. **Valid values.** Values are kept only where soil moisture is not the fill value (−9999), the quality flag is not fill, **bit 0 of the quality flag is 0** (a recommended retrieval), and moisture ≥ 0.
2. **Layers and series.** All tracks share the EASE grid, so dates compare directly with no resampling.
   - One map per date, on a scale of 0–0.5 m³/m³ from brown (dry) to blue-green (wet).
   - A site-mean series.
3. **Soil drying.**
   - Condition: at least 4 dates, and the mean of the earlier dates minus the latest is more than **0.05 m³/m³**.
   - The event covers the site box, with category drought.
   - Its text says drier soil is not a drought declaration; confirming one needs a longer record and rainfall data.

### 8. National soil-moisture mosaic

Code: `national.py`.

1. **Selection.**
   - SME2 granules over Mexico from the last 75 days, keeping only the maturity of the newest granule.
   - They are split into two 12-day cycles ending at the newest date. 12 days is NISAR's repeat cycle, in which each direction covers the country once.
2. **Coarsening without resampling.**
   - Each granule's 200 m pixels are averaged into 10 × 10 cells of the EASE grid (36 032.220840584 m / 180 × 10, about 2.0 km), by grid index.
   - A cell needs at least 30 valid fine pixels.
   - Overlapping granules are averaged per cell.
   - Cells whose center is outside the Natural Earth outline of Mexico (buffered 0.02°) are dropped.
   - Up to 8 granules are read in parallel. An unreadable granule leaves a gap and does not stop the run.
3. **Display.** The equal-area grid is resampled row by row to Web Mercator spacing, because map libraries stretch images evenly in Mercator.
4. **Drying regions.**
   - The two cycles are differenced (later − earlier).
   - Cells drier by more than 0.05 m³/m³ are cleaned with a morphological opening.
   - Regions of at least 250 cells become events, at most 12.
5. **Fires.** FIRMS detections from the last 10 days, drawn one cell larger so they show at country zoom.

### 9. Publication rules

Code: `site.run_site`.

- **One product failing does not stop the others.** The error is recorded in the area's `errors`.
- **Confidence floor.** After every check (including persistence), events with confidence < **0.3** are not published.
- **Archived events.** An earlier event whose dates are now before the start of the selected series is kept and marked `archived: true`. This happens when a newer maturity replaced older dates, or an older pass left the search window.
- **Withdrawn events.** An earlier event inside the current series that the new run does not find again is withdrawn and not kept.
- **Synthetic data.** Test granules are flagged `synthetic` at every level and are never shown as real.

### 10. Outputs and provenance

Code: `export.py`; file formats in [docs/04](docs/04-contracts.md).

| Output | Content |
|---|---|
| Backscatter layer per date and polarization | Grayscale PNG, stretched between the 2nd and 98th percentile of the dB values |
| Change layer per pair (HH, HV) | ΔdB on a red (darker) to blue (brighter) scale of ±6 dB, opacity proportional to change |
| Signature layer per pair | One color per signature |
| Surface type, fire detections, ground motion, soil moisture | Context and product layers (5.3, 5.10, 6, 7) |
| Time series (C4) | `areas/<id>/timeseries/*.json` |
| Events (C7) | `events.json`, `events.geojson` and `areas/<id>/events.geojson` |
| History (C10) and plain-language cards (C8) | `areas/<id>/history.json`, `areas/<id>/friendly.json`. Both are bookkeeping over the events; they detect nothing |
| Index (C11) | `index.json`, one short entry per area, so a page loads areas on demand |

- **Provenance.** Every layer and event records:
  - Its source granule IDs.
  - The processing steps in words, including the scene offset removed from each pair, written out in dB for HH and HV.
  - All parameters.
  - The software name, version and git commit.
  - The citation (DOI).
- **Evidence.** Each event also stores its measured values: mean ΔHH and ΔHV, surface type before and after, fire detections, the persistence result, the scene offset, and pixel count.
- **Safe writes.** Files are written to a temporary name and then renamed, so the server never serves half a file. Unchanged files are not rewritten, so the copy to storage sends only what changed.

### 11. Updates

Code: `live.py`.

A refresh searches ASF again. A site is processed again only if at least one of these holds:

- New granule IDs were selected.
- The refresh was forced.
- The site's box moved.
- The last run had a product error.
- The area was never published.

Because windows are cached (step 4), only the new granules are streamed. On the server:

- Curated sites are re-checked every 12 hours, one at a time, each only when the queue is empty.
- A visitor's place is re-checked when someone looks it up again more than 12 hours after its last check.
- Visitor lookups go to the front of the queue.

### 12. Limits of the method

- **Events are hypotheses from radar alone.** Every event summary says so and states the data maturity.
- **The surface type is rough.** It is a guide for interpretation, not a land-cover product.
- **A change over the whole scene is removed on purpose** (5.4). A real change covering most of the window would be reduced as well.
- **Grids are not resampled.** Dates from one track and frame are assumed aligned; the run stops if they are offset by more than 1 m.
- **Ground motion is along the line of sight.** It is not purely vertical. Without a stable reference area it is shown as a map only, with no events.
- **Fire evidence depends on a FIRMS key.** Without it, burned forest is reported as deforestation, and the evidence says fires were not checked.
- **Soil drying is not a drought declaration** (step 7).

<details>
<summary><b>Default parameters</b></summary>

| Parameter | Value | Used in |
|---|---|---|
| Looks (GCOV) | 4 × 4 | 5.1 |
| `smooth_px` | 3 | 5.4, 5.9, 6 |
| `flood_drop_db` / `water_db` | 3 dB / −18 dB | 5.5 |
| `forest_hv_drop_db` / `forest_margin_db` / `vegetation_hv_db` | 3 dB / 1.5 dB / −18 dB | 5.5 |
| `brighten_db` / `other_db` | 4 dB / 5 dB | 5.5 |
| Surface type thresholds | built-up HH > −4.5 dB; vegetation HV > −15 dB; water HV < −19 dB and HH < −11 dB | 5.3 |
| Double bounce | ΔHH − ΔHV ≥ 3 dB | 5.7 |
| `min_pixels` | 25 (GCOV), 150 (GUNW) | 5.6, 6 |
| `persist_fraction` | 0.5 | 5.8 |
| `seasonal_std_db` | 2 dB | 5.9 |
| `BURN_NOT_REGROWN_DB` | 1.5 dB | 5.10 |
| GUNW coherence / valid fraction / sinking | 0.3 / 60% / 5 cm/yr | 6 |
| SME2 `drying_drop` / `min_dates` | 0.05 m³/m³ / 4 | 7, 8 |
| Mosaic cell / min fine pixels / min cells / max events | about 2 km / 30 / 250 / 12 | 8 |
| `other_min_confidence` / `min_confidence` | 0.5 / 0.3 | 5.7, 9 |

</details>

<details>
<summary><b>Code map</b> (<code>backend/src/sars_pipeline/</code>)</summary>

| File | Role |
|---|---|
| `selection.py` | ASF search, grouping, deduplication, GUNW chains, group choice |
| `remote.py` | HTTPS streaming of HDF5 granules |
| `granule.py` | GCOV metadata, maturity, windowing, multilooking, dB |
| `classify.py` | Δ computation, signatures, regions, confidence, persistence, seasonal mask |
| `categorize.py` | Surface type, decision table, outlines |
| `gunw.py` | GUNW reading, mask decoding, line-of-sight motion, referencing, chains |
| `sme2.py` | SME2 reading and quality filtering |
| `national.py` | Country mosaic, cycle selection, drying regions, fire layer |
| `firms.py` | NASA FIRMS detections (context) |
| `site.py` | Runs one site through all products; events; publication rules |
| `export.py` | Contract files, images, provenance, citations |
| `live.py` | Refreshes and the processing queue |

</details>

## Architecture

<p align="center">
  <img src="images/architecture-radar-flow.png" alt="From a radar echo to a map anyone can read, in eight steps: 1 NISAR satellite, NASA and ISRO radar scanning every 12 days; 2 NASA archive, ASF DAAC open data with 3 radar products; 3 find and read only our area's window, never mixing data quality; 4 compare dates, before and after, in decibels; 5 spot patterns with clear rules; 6 name and score, with categories and a confidence from 0 to 1; 7 store and serve, files on Azure and an API, any new place on request; 8 the globe app at gigas.earth, 3D map in Simple and Technical modes">
</p>

## How to run it

**Front end** (needs Node.js):

```
cd frontend
npm ci
npm run dev       # http://localhost:5173
npm test          # unit tests
npm run build     # type-check + static build into dist/
```

Without a back end the app still runs: it shows example places (labelled as examples) and live events. To see the real radar areas, point it at the team's public storage:

```
VITE_DATA_BASE=https://gigassars.blob.core.windows.net/data/ npm run dev
```

**Back end** (needs [uv](https://docs.astral.sh/uv/) and a NASA Earthdata token in `backend/.env`):

```
cd backend
uv run sars-pipeline run            # select and process every site
uv run sars-pipeline serve          # API on http://127.0.0.1:8765/
```

Details: `frontend/README.md`, `backend/README.md`, and `backend/deploy/README.md` for the Azure and Cloudflare setup.

## NASA data and other sources

**NASA data**

- **NISAR** GCOV, GUNW and SME2 products (NASA/JPL-Caltech and ISRO, distributed by the Alaska Satellite Facility DAAC). The exact granules behind every layer are listed in its provenance.
- **NASA GIBS** (Global Imagery Browse Services): before/after optical pictures.
- **NASA EONET**: live natural events.
- **NASA FIRMS**: fire detections (VIIRS on NOAA-20), for live fires and burn scars.

**Other sources**, each credited in the app:

- USGS (earthquakes, volcano alert levels), NOAA (weather alerts, hurricanes), GDACS (United Nations and European Commission).
- Globe imagery: Sentinel-2 cloudless by EOX IT Services GmbH (contains modified Copernicus Sentinel data 2016), CC BY 4.0.
- Street map: © OpenStreetMap contributors (ODbL). Outline map: MapLibre demo tiles.
- Country outlines and city names: Natural Earth (public domain).
- Typefaces: IBM Plex Sans and IBM Plex Mono (SIL Open Font License 1.1).
- PDF reports: made with jsPDF (MIT) and shown with pdf.js (Mozilla, Apache 2.0).
- NISAR illustration in this README: "NISAR in Orbit (Artist's Concept)", PIA26613, NASA/JPL-Caltech.
- Satellite model: generated by the team with Meshy from the same NASA/JPL-Caltech illustration (PIA26613).

The full list with DOIs and licenses is in `docs/09-references.md`. Why each data source and method was chosen, and what was given up, is in `frontend/DECISIONS.md`.

## What is real and what is not

The project's rule is that nothing synthetic is ever shown as real.

- **Example places** appear only while no radar data is connected, and are labelled as examples.
- **Synthetic test data** carries a banner and a tag on every area that uses it.
- **Live events** are labelled "not radar detections" and each names its source.
- **Hand-written text** (background notes on a place, the list of past disasters) is labelled as such, and shown only for the place it was written for.
- **The orbiting satellite** is an illustration, and the tutorial says so.
- **Detections are not validated on the ground.** Each carries a confidence figure. The 0.3 confidence floor and the alert levels in the summary cards are judgment calls, documented in `backend/README.md` with the detection rules.

## Known limits

- **Two live sources need the back end:** NOAA's hurricane center does not accept requests from web pages, and NASA FIRMS needs a key. Tropical cyclones still arrive through GDACS.
- **Weather alerts and volcano alert levels cover the United States only.**
- **NISAR data gap:** there is no usable data for the sites between 2026-01-20 and 2026-06-16 (Mexico's dry and fire season), and older data is not mixed with newer data of a different maturity. Fires in that season are located with FIRMS, and the radar shows the ground after.
- **The newest radar dates** (late October on) are published as VALIDATED and are not shown yet, because a series never mixes maturities and VALIDATED has only one or two dates per frame so far.
- **"What the radar found here"** is in English only; the names of the types of change are translated.
- **Markers** of different types can overlap, and a looked-up place with no NISAR data stays "Processing" until you remove it.
- **Country filter:** outlines are coarse (1:110m), so a point just off the coast counts as outside, and the smallest countries are missing.
- **Translations** (Spanish, German) are machine-written and not yet checked by native speakers.
- **Not yet checked:** browsers other than Chrome, a screen reader, keyboard use of the markers.
- **Public tile servers** (OpenStreetMap, EOX) are for light use; a hosted tile service is needed before real traffic.

## Future

- More radar areas beyond Mexico, and ground-motion figures for dams, levees and sinking cities.
- A date and confidence filter for detected changes in the app (the API already has one).
- Live sources for more regions (weather alerts outside the United States).
- Translated summary cards, native-speaker review of the translations, and more languages.

## File descriptions

| Path | What it holds |
|---|---|
| `frontend/` | The web app |
| `frontend/src/main.ts` | The page: panels, filters, areas, live events, welcome screen |
| `frontend/src/globe.ts` | The MapLibre globe, its layers, markers and camera |
| `frontend/src/livefeeds.ts` | Live events fetched from the public sources |
| `frontend/src/places.ts` | My places, kept in the browser |
| `frontend/src/compare.ts`, `compare-core.ts`, `satview.ts` | Before/after comparator; satellite pictures from NASA GIBS |
| `frontend/src/report.ts`, `report-core.ts`, `reader.ts`, `pdf-text.ts` | PDF report per area and the reader inside the page |
| `frontend/src/kid.ts` | Simple mode's guide ("Your guide") |
| `frontend/src/explain.ts`, `explain-view.ts` | "Why the radar sees changes" explainer |
| `frontend/src/origin.ts`, `sources.ts` | Source badges and the cited sources |
| `frontend/src/decisions.ts` | Methods and decisions (also written to `DECISIONS.md`) |
| `frontend/src/satellite.ts` | The orbiting satellite (WebGL custom layer) |
| `frontend/src/filters.ts`, `icons.ts`, `legend.ts` | Types of change, their groups, colors, icons and color keys |
| `frontend/src/i18n.ts` | Every interface text in English, Spanish and German |
| `frontend/src/chart.ts`, `wheel.ts`, `tour.ts`, `settings.ts` | Chart, view wheel, tutorial, accessibility menu |
| `frontend/src/assets/` | Country outlines, city names, satellite model |
| `frontend/src/logic.ts`, `frontend/test/` | Pure logic and its unit tests |
| `frontend/DECISIONS.md` | Why these data and methods were chosen |
| `backend/` | The NISAR pipeline, the live feeds and the data server |
| `backend/sites.json` | The curated sites |
| `backend/deploy/` | Azure server and Cloudflare site setup |
| `docs/` | Challenge text, product spec, architecture, data contracts, references, status log |
| `specs/` | Feature specs with acceptance criteria |

## Languages, frameworks and other technologies

- **Front end:** TypeScript, Vite, MapLibre GL JS (globe projection), WebGL, jsPDF (makes the reports), pdf.js (shows them), plain DOM and CSS (no UI framework), Node's built-in test runner.
- **Back end:** Python, uv, `asf_search`, `h5py` + `fsspec`, pytest, ruff.
- **Hosting:** Cloudflare Workers (the site, gigas.earth); Microsoft Azure virtual machine and Blob Storage (the API and the data), Docker Compose, Caddy.
- **Data services:** NASA Earthdata / ASF DAAC, NASA GIBS, NASA EONET, NASA FIRMS, USGS, NOAA, GDACS.

## Use of AI

Two AI tools were used. **Claude** (Anthropic) wrote code under the team's direction and review, and wrote the Spanish and German interface texts. **Meshy** generated the satellite 3D model from NASA/JPL-Caltech's illustration of NISAR. No AI-generated images, audio or video are shown as data, and no data is invented: see [What is real and what is not](#what-is-real-and-what-is-not).

## License

G.I.G.A.S is open source under the [GNU Affero General Public License v3.0](LICENSE).

## Team members and their contributions

| Name | Role |
|---|---|
| Diego de Silva Hernandez | Front-end development |
| Adrián Madrid Castro | Front-end development |
| Hector Lerma Scott | Back-end development |
| Jose Pablo Mendez Espino | Back-end development |
| Samuel André Rivera Dominguez | Documentation |

<!-- TODO (team): GitHub profile links, and a team photo if you want one. -->
