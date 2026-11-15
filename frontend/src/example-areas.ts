// EXAMPLE LOCATIONS. Real places that are widely known examples of each filter type, so the
// globe has something to mark while no back end is connected. They are hidden as soon as real
// areas load. They carry no radar images
// and no reports, and the app shows a notice while any is listed.
// Replace with back-end data once the contract carries filter types and reports.
import { typeLabel } from "./filters";
import { t } from "./i18n";
import type { AreaView } from "./logic";

// [filter type id, place, longitude, latitude]. Scope (jopa-testing): Mexico only, one widely
// known place per type (see the "Remarkable events" data in mexico.ts for what happened there).
const PLACES: [string, string, number, number][] = [
  ["earthquakes", "Juchitán, Oaxaca", -95.02, 16.43],
  ["volcanoes", "Popocatépetl, Puebla–Morelos–State of Mexico", -98.62, 19.02],
  ["hurricanes", "Acapulco, Guerrero", -99.88, 16.85],
  ["storms", "Piedras Negras, Coahuila", -100.52, 28.7],
  ["floods", "Villahermosa, Tabasco", -92.93, 17.99],
  ["landslides", "La Pintada, Guerrero", -100.33, 17.36],
  ["sinkholes", "Santa María Zacatepec, Puebla", -98.37, 19.1],
  ["wildfires", "Sierra de Arteaga, Coahuila", -100.75, 25.35],
  ["drought", "Valle de Bravo reservoir (Cutzamala), State of Mexico", -100.13, 19.19],
  ["heat", "Mexicali, Baja California", -115.45, 32.62],
  ["cold", "Sierra Tarahumara, Chihuahua", -107.6, 27.75],
  ["dust", "Ciudad Juárez, Chihuahua", -106.44, 31.69],
  ["marine", "Sargassum on the Riviera Maya, Quintana Roo", -86.87, 20.85],
  ["glaciers", "Pico de Orizaba (Citlaltépetl), Puebla–Veracruz", -97.27, 19.03],
  ["induced-seismicity", "Los Humeros geothermal field, Puebla", -97.45, 19.68],
  ["oil-spills", "Ixtoc I site, Bay of Campeche", -92.33, 19.41],
  ["industrial", "Sonora River (Cananea mine spill), Sonora", -110.3, 30.98],
  ["groundwater", "Aguascalientes valley, Aguascalientes", -102.29, 21.88],
  ["subsidence", "Mexico City", -99.13, 19.43],
  ["logging", "Sierra Tarahumara forests, Chihuahua", -107.9, 28.3],
  ["coastal-loss", "El Bosque, Centla, Tabasco", -93.08, 18.53],
  ["reservoirs", "Cantarell oil field, Bay of Campeche", -92.2, 19.38],
  ["deforestation", "Hopelchén, Campeche", -89.74, 19.75],
  ["urban", "Monterrey metro area, Nuevo León", -100.31, 25.67],
  ["agriculture", "El Bajío, Guanajuato", -101.0, 20.6],
];

// A function, not a constant: the summary is in the current language.
export const exampleAreas = (): AreaView[] =>
  PLACES.map(([type, title, lon, lat]) => ({
    id: `example-${type}`,
    title,
    summary: t("example.summary", { type: typeLabel(type) }),
    types: [type],
    center: [lon, lat],
    bbox: [lon - 0.5, lat - 0.5, lon + 0.5, lat + 0.5],
    synthetic: false,
    example: true,
    events: [],
    layers: [],
    series: [],
    credits: [],
  }));
