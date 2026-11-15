# Decision log

Why G.I.G.A.S uses these data and methods, and what it gave up. This file is for anyone curious; the app itself does not show it (the PDF report keeps a short table in its "Methods and decisions" section).

Generated from `src/decisions.ts` and `src/sources.ts` by `npm run decisions`; edit those, not this file. Facts about the world cite outside sources, mostly NASA, read on 2026-11-14; the project's own choices cite its files. Newest first.

## Compare in decibels, after removing the scene-wide change

*2026-11-14 · Method* · [1] [2]

- **We chose:** Average 4 × 4 pixels in linear power, convert to dB, subtract the two dates, and remove the change shared by the whole scene.
- **Why:** Averaging neighboring pixels (multi-looking) removes radar speckle. A change over the whole scene, such as rain everywhere, is not a local event.
- **Instead of:** Subtracting raw pixel values.
- **What we give up:** Detail below about 40 m is averaged away.

## Written rules instead of machine learning

*2026-11-14 · Method* · [2]

- **We chose:** A decision table: flood if HH and HV both drop 3 dB and HH ends below −18 dB; forest loss if HV drops 3 dB and 1.5 dB more than HH; new buildings if HH rises 4 dB. Patches under 25 pixels (0.04 km²) are dropped and a change must still show half its size on the next pass.
- **Why:** Every result can be explained in one sentence and checked by hand against the numbers behind it.
- **Instead of:** A trained classifier.
- **What we give up:** Subtle changes are missed, so results are labeled hypotheses with a confidence.

## GUNW for ground motion, SME2 for soil moisture

*2026-11-14 · Data* · [3] [2] [4]

- **We chose:** Interferograms (GUNW) flag ground sinking 5 cm a year or more; soil moisture (SME2) flags drying of 0.05 m³/m³ or more over at least 4 dates.
- **Why:** These NISAR products are made for exactly that: GUNW for measuring ground displacement, SME2 for soil moisture.
- **Instead of:** Guessing drought or sinking from backscatter alone.
- **What we give up:** Motion is along the radar's line of sight, not straight down, and soil moisture is coarse (about 2 km nationally).

## Fire detections as context

*2026-11-14 · Data* · [5] [2]

- **We chose:** NASA FIRMS fire points (VIIRS) decide whether lost forest burned or was cleared.
- **Why:** Radar sees that the trees are gone, not why. A fire at the same place and time is strong evidence.
- **Instead of:** Calling every forest loss deforestation.
- **What we give up:** A clearing with no fire detection is called forest loss, never fire.

## Satellite photos only as context

*2026-11-14 · Data* · [6] [7] [8] [9]

- **We chose:** NASA GIBS pictures (HLS 30 m, VIIRS daily, MODIS) next to the radar, always labeled "other satellite" with their date. They never feed the detection.
- **Why:** People understand photos at once. GIBS gives full-resolution satellite imagery, most of it updated daily, and this page can load it directly. HLS harmonizes Landsat 8/9 and Sentinel-2 at 30 m. SPHEREx makes an all-sky survey, not pictures of the Earth, so it cannot be used.
- **Instead of:** Radar only.
- **What we give up:** Clouds hide many days, so the picture is the nearest clear day, which can differ from the radar dates.

## Live reports from official alert services

*2026-11-14 · Data* · [10] [11] [12] [13] [14] [15] [4] [9]

- **We chose:** USGS (earthquakes, volcanoes), NASA EONET, GDACS and NOAA (weather alerts), worldwide, last 24 hours, checked every 15 minutes.
- **Why:** They are public services run by official agencies. NISAR repeats its orbit every 12 days, so it cannot say what is happening today.
- **Instead of:** News sites or social media.
- **What we give up:** GDACS states no data license; it is shown with credit, a link and its disclaimer.

## Only claims we could check

*2026-11-14 · Data* · [9]

- **We chose:** Past disasters and zone notes come from agencies and peer-reviewed studies, each linked. Claims we could not confirm were removed.
- **Why:** A wrong number on a disaster map damages trust in everything else on it.
- **Instead of:** Popular figures repeated without a source.
- **What we give up:** Some well-known stories are shorter or missing.

## No danger score, no "infrastructure near me"

*2026-11-14 · Design* · [9]

- **We chose:** The "how dangerous" slider and the nearby-infrastructure check were removed.
- **Why:** We cannot check risk thresholds responsibly; a wrong "safe" could mislead someone in danger.
- **Instead of:** Our own risk scale.
- **What we give up:** Users read the official alert levels instead.

## How the comparator measures change

*2026-11-14 · Method* · [9] [2]

- **We chose:** Change = |after − before| ÷ the brighter of the two, after a 3 × 3 average. Radar starts at 50% (3 dB, the rules' own step); photos at 30%.
- **Why:** It reads the same both ways (half and double are both 50%), stays between 0 and 100%, and for radar maps straight onto dB.
- **Instead of:** A plain difference of pixel values.
- **What we give up:** On photos it is a visual guide: clouds, shadows and seasons change colors too.

## Colorblind-safe colors, always with words

*2026-11-14 · Design* · [16] [17]

- **We chose:** The Okabe-Ito palette, and every color also named in text or shown with a shape.
- **Why:** About 1 in 12 men have color vision deficiency.
- **Instead of:** Red and green for bad and good.
- **What we give up:** Fewer distinct colors to use.

## NISAR GCOV as the main radar product

*2026-11-13 · Data* · [3] [15] [1] [18] [2]

- **We chose:** Geocoded, calibrated L-band backscatter (GCOV), two channels: HH and HV.
- **Why:** GCOV is radiometrically terrain-corrected backscatter made for uses such as disturbance detection, inundation mapping and crop mapping. NISAR's L-band (24 cm) goes deeper into tree canopy than shorter waves, and works day and night, through clouds.
- **Instead of:** Raw radar files (RSLC), which need heavy processing; or a shorter C-band radar, which penetrates only the top layers of a forest canopy.
- **What we give up:** Objects smaller than a pixel (about 40 m after averaging) are not seen.

## Never mix data maturities in one comparison

*2026-11-13 · Method* · [3] [4]

- **We chose:** Each comparison uses one maturity only (BETA, PROVISIONAL or VALIDATED), and every layer says which.
- **Why:** BETA products are not fully calibrated and PROVISIONAL ones are. Mixing them could create a change that is only in the processing, not on the ground.
- **Instead of:** Using every date available, whatever its maturity.
- **What we give up:** Fewer dates to compare in some places.

## Mexico as the study region

*2026-11-13 · Data* · [4] [18]

- **We chose:** Case studies with well documented changes: Mexico City (sinking), Villahermosa (floods), Yucatán (forest loss), Chapala (fires), plus a whole-country soil moisture view.
- **Why:** Known events let us check the radar's answers against published studies, and the team knows these places.
- **Instead of:** Random places around the world.
- **What we give up:** Other regions get live reports, but no radar analysis yet.

## Sources

1. NASA Earthdata. *Synthetic Aperture Radar (SAR).* <https://www.earthdata.nasa.gov/learn/earth-observation-data-basics/sar>
2. G.I.G.A.S project. *Detection rules: backend/src/sars_pipeline/classify.py, categorize.py and site.py.* <https://github.com/StarL0st/Borrenautas-Dancing-with-the-SARs>
3. NASA Alaska Satellite Facility DAAC. *NISAR Data User Guide: NISAR Data Products.* <https://nisar-docs.asf.alaska.edu/products-overview/>
4. G.I.G.A.S project. *Data sources, references and status log: docs/03, docs/09 and docs/10.* <https://github.com/StarL0st/Borrenautas-Dancing-with-the-SARs>
5. NASA LANCE. *Fire Information for Resource Management System (FIRMS).* <https://firms.modaps.eosdis.nasa.gov/>
6. NASA Earthdata. *Global Imagery Browse Services (GIBS) APIs.* <https://www.earthdata.nasa.gov/engage/open-data-services-software/earthdata-developer-portal/gibs-api>
7. NASA Earthdata. *Harmonized Landsat and Sentinel-2 (HLS).* <https://www.earthdata.nasa.gov/data/projects/hls>
8. NASA. *SPHEREx mission.* <https://science.nasa.gov/mission/spherex/>
9. G.I.G.A.S project. *This app's code: frontend/src (compare-core.ts, logic.ts, mexico.ts).* <https://github.com/StarL0st/Borrenautas-Dancing-with-the-SARs>
10. U.S. Geological Survey. *Earthquake Hazards Program real-time feeds.* <https://earthquake.usgs.gov/earthquakes/feed/>
11. U.S. Geological Survey. *Volcano Hazards Program.* <https://www.usgs.gov/programs/VHP>
12. NASA. *Earth Observatory Natural Event Tracker (EONET).* <https://eonet.gsfc.nasa.gov/>
13. UN OCHA and European Commission JRC. *GDACS terms of use.* <https://www.gdacs.org/About/termofuse.aspx>
14. NOAA National Weather Service. *Weather alerts.* <https://www.weather.gov/alerts>
15. NASA. *NISAR Mission Overview: Quick Facts.* <https://science.nasa.gov/mission/nisar/mission-overview/>
16. National Eye Institute (NIH). *Color Blindness.* <https://www.nei.nih.gov/eye-health-information/eye-conditions-and-diseases/color-blindness>
17. Okabe and Ito (J*Fly). *Color Universal Design (CUD).* <https://jfly.uni-koeln.de/color/>
18. NASA Jet Propulsion Laboratory. *US-Indian Space Mission Maps Extreme Subsidence in Mexico City (April 29, 2026).* <https://www.jpl.nasa.gov/news/us-indian-space-mission-maps-extreme-subsidence-in-mexico-city/>
