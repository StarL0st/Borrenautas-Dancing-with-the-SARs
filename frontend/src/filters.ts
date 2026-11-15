// Filter groups and their subdivisions. The ids are the back end's `categories` (contract 0.3);
// their names live in i18n.ts as `group.<id>` and `type.<id>`. Colors are from the Okabe-Ito
// colorblind-safe palette; groups are always named in text too, never by color alone.
import { t, type Key } from "./i18n";

export const GROUPS: { id: string; color: string; items: string[] }[] = [
  {
    id: "natural",
    color: "#E69F00",
    items: [
      "earthquakes", "volcanoes", "hurricanes", "storms", "floods", "landslides", "sinkholes", "wildfires", "drought",
      "heat", "cold", "dust", "marine", "forecast", "glaciers", "ice-sheets", "sea-ice", "permafrost", "glacial-lakes",
    ],
  },
  {
    id: "human",
    color: "#CC79A7",
    items: ["induced-seismicity", "oil-spills", "industrial", "groundwater", "subsidence", "logging", "coastal-loss", "reservoirs"],
  },
  { id: "land", color: "#F0E442", items: ["deforestation", "urban", "agriculture"] },
];

export const isType = (id: string) => GROUPS.some((g) => g.items.includes(id));
export const groupLabel = (id: string) => t(`group.${id}` as Key);
// An id the app does not know (a newer back end) is shown as it is.
export const typeLabel = (id: string) => (isType(id) ? t(`type.${id}` as Key) : id);
export const typeColor = (id: string) => GROUPS.find((g) => g.items.includes(id))?.color ?? "#e6f1f5";
// "Earthquakes", not "Earthquakes (location and impact assessment)".
export const shortLabel = (id: string) => typeLabel(id).replace(/\s*[(:].*/, "");
