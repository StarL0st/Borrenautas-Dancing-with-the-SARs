// Every outside source the app's own explanations rest on (jopa-testing, round 6).
//
// Rule: no sentence in the explainer, the glossary, the decision log, the kids' facts or the PDF
// report states a fact without one of these behind it. Each entry was opened and read on
// `SOURCES_CHECKED`; the sentence that uses it says only what the page says. The app's own rules
// (thresholds, rankings) cite the code that applies them, not an outside page.
// No imports, so `node --test` can check that every id used exists.

export type Ref = { who: string; title: string; url: string };

export const SOURCES_CHECKED = "2026-11-14";

export const REFS = {
  // ---- NASA and NASA-funded archives ----
  nisarFacts: { who: "NASA", title: "NISAR Mission Overview: Quick Facts", url: "https://science.nasa.gov/mission/nisar/mission-overview/" },
  sar: { who: "NASA Earthdata", title: "Synthetic Aperture Radar (SAR)", url: "https://www.earthdata.nasa.gov/learn/earth-observation-data-basics/sar" },
  sarImage: { who: "NASA Earthdata", title: "SAR Image Interpretation", url: "https://www.earthdata.nasa.gov/learn/earth-observation-data-basics/sar/image-interpretation" },
  cdmx: { who: "NASA Jet Propulsion Laboratory", title: "US-Indian Space Mission Maps Extreme Subsidence in Mexico City (April 29, 2026)", url: "https://www.jpl.nasa.gov/news/us-indian-space-mission-maps-extreme-subsidence-in-mexico-city/" },
  asfProducts: { who: "NASA Alaska Satellite Facility DAAC", title: "NISAR Data User Guide: NISAR Data Products", url: "https://nisar-docs.asf.alaska.edu/products-overview/" },
  hls: { who: "NASA Earthdata", title: "Harmonized Landsat and Sentinel-2 (HLS)", url: "https://www.earthdata.nasa.gov/data/projects/hls" },
  gibs: { who: "NASA Earthdata", title: "Global Imagery Browse Services (GIBS) APIs", url: "https://www.earthdata.nasa.gov/engage/open-data-services-software/earthdata-developer-portal/gibs-api" },
  modisNrt: { who: "NASA Earthdata", title: "MODIS Near Real-Time Data: Corrected Reflectance (Bands 7, 2, 1)", url: "https://www.earthdata.nasa.gov/data/instruments/modis/near-real-time-data" },
  fireTutorial: { who: "NASA Earthdata", title: "Use Worldview to Determine Fire Affected Areas in NRT Using MODIS and VIIRS", url: "https://www.earthdata.nasa.gov/learn/tutorials/use-worldview-determine-fire-affected-areas-nrt-using-modis-viirs" },
  ndvi: { who: "NASA Earth Observatory", title: "Measuring Vegetation (NDVI & EVI)", url: "https://science.nasa.gov/earth/earth-observatory/measuring-vegetation-ndvi-evi/" },
  firms: { who: "NASA LANCE", title: "Fire Information for Resource Management System (FIRMS)", url: "https://firms.modaps.eosdis.nasa.gov/" },
  eonet: { who: "NASA", title: "Earth Observatory Natural Event Tracker (EONET)", url: "https://eonet.gsfc.nasa.gov/" },
  spherex: { who: "NASA", title: "SPHEREx mission", url: "https://science.nasa.gov/mission/spherex/" },
  // ---- Other official sources ----
  usgs: { who: "U.S. Geological Survey", title: "Earthquake Hazards Program real-time feeds", url: "https://earthquake.usgs.gov/earthquakes/feed/" },
  usgsVolcano: { who: "U.S. Geological Survey", title: "Volcano Hazards Program", url: "https://www.usgs.gov/programs/VHP" },
  noaa: { who: "NOAA National Weather Service", title: "Weather alerts", url: "https://www.weather.gov/alerts" },
  gdacs: { who: "UN OCHA and European Commission JRC", title: "GDACS terms of use", url: "https://www.gdacs.org/About/termofuse.aspx" },
  nei: { who: "National Eye Institute (NIH)", title: "Color Blindness", url: "https://www.nei.nih.gov/eye-health-information/eye-conditions-and-diseases/color-blindness" },
  okabe: { who: "Okabe and Ito (J*Fly)", title: "Color Universal Design (CUD)", url: "https://jfly.uni-koeln.de/color/" },
  // ---- The project's own files (for its own rules and choices) ----
  rules: { who: "G.I.G.A.S project", title: "Detection rules: backend/src/sars_pipeline/classify.py, categorize.py and site.py", url: "https://github.com/StarL0st/Borrenautas-Dancing-with-the-SARs" },
  sites: { who: "G.I.G.A.S project", title: "Study areas and their descriptions: backend/sites.json", url: "https://github.com/StarL0st/Borrenautas-Dancing-with-the-SARs" },
  docs: { who: "G.I.G.A.S project", title: "Data sources, references and status log: docs/03, docs/09 and docs/10", url: "https://github.com/StarL0st/Borrenautas-Dancing-with-the-SARs" },
  app: { who: "G.I.G.A.S project", title: "This app's code: frontend/src (compare-core.ts, logic.ts, mexico.ts)", url: "https://github.com/StarL0st/Borrenautas-Dancing-with-the-SARs" },
} satisfies Record<string, Ref>;

export type RefId = keyof typeof REFS;
