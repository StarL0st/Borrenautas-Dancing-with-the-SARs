// EXAMPLE LOCATIONS. Real places that are widely known examples of each filter type, so the
// globe has something to mark before the back end delivers areas. They carry no radar images
// and no reports, and the app shows a notice while any is listed.
// Replace with back-end data once the contract carries filter types and reports.
import { typeLabel } from "./filters";
import type { AreaView } from "./logic";

// [filter type id, place, longitude, latitude]
const PLACES: [string, string, number, number][] = [
  ["earthquakes", "Kahramanmaraş, Türkiye", 36.94, 37.58],
  ["volcanoes", "Kīlauea, Hawaiʻi", -155.29, 19.41],
  ["landslides", "Oso, Washington, USA", -121.85, 48.28],
  ["floods", "Sindh, Pakistan", 68.5, 26.0],
  ["sinkholes", "Dead Sea shore", 35.4, 31.4],
  ["wildfires", "Paradise, California, USA", -121.62, 39.76],
  ["drought", "Lake Mead, USA", -114.4, 36.15],
  ["marine", "Tōhoku coast, Japan", 141.5, 38.3],
  ["glaciers", "Columbia Glacier, Alaska", -147.1, 61.1],
  ["ice-sheets", "Jakobshavn Glacier, Greenland", -49.8, 69.17],
  ["sea-ice", "Beaufort Sea", -140, 74],
  ["permafrost", "Batagaika crater, Siberia", 134.77, 67.58],
  ["glacial-lakes", "Imja Lake, Nepal", 86.93, 27.9],
  ["induced-seismicity", "Pawnee, Oklahoma, USA", -96.8, 36.34],
  ["oil-spills", "Deepwater Horizon site, Gulf of Mexico", -88.37, 28.74],
  ["groundwater", "Central Valley, California, USA", -119.8, 36.3],
  ["subsidence", "Mexico City, Mexico", -99.13, 19.43],
  ["logging", "Rondônia, Brazil", -63, -10.5],
  ["coastal-loss", "Louisiana coast, USA", -90.3, 29.3],
  ["reservoirs", "Groningen gas field, Netherlands", 6.8, 53.3],
  ["deforestation", "Central Kalimantan, Indonesia", 114, -1.5],
  ["urban", "Shenzhen, China", 114.06, 22.54],
  ["agriculture", "Punjab, India", 75.85, 30.9],
];

export const EXAMPLE_AREAS: AreaView[] = PLACES.map(([type, title, lon, lat]) => ({
  id: `example-${type}`,
  title,
  summary: `Example location for “${typeLabel(type)}”. Radar images and reports for this place will come from the back end.`,
  types: [type],
  center: [lon, lat],
  bbox: [lon - 0.5, lat - 0.5, lon + 0.5, lat + 0.5],
  synthetic: false,
  example: true,
  events: [],
  layers: [],
  credits: [],
}));
