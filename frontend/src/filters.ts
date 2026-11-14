// Filter groups and their subdivisions. Colors are from the Okabe-Ito colorblind-safe palette;
// groups are always named in text too, never by color alone.

export type Group = { id: string; label: string; color: string; items: { id: string; label: string }[] };

export const GROUPS: Group[] = [
  {
    id: "natural",
    label: "Natural disasters",
    color: "#E69F00",
    items: [
      { id: "earthquakes", label: "Earthquakes (location and impact assessment)" },
      { id: "volcanoes", label: "Volcanic eruptions (ground deformation measured with InSAR)" },
      { id: "landslides", label: "Landslides" },
      { id: "floods", label: "Floods" },
      { id: "forecast", label: "Forecast" },
      { id: "sinkholes", label: "Sinkholes and cave collapses" },
      { id: "wildfires", label: "Wildfires" },
      { id: "drought", label: "Drought" },
      { id: "marine", label: "Marine hazards" },
      { id: "glaciers", label: "Changes in glaciers" },
      { id: "ice-sheets", label: "Ice sheets" },
      { id: "sea-ice", label: "Sea ice" },
      { id: "permafrost", label: "Permafrost" },
      { id: "glacial-lakes", label: "Glacial lakes overflowing" },
    ],
  },
  {
    id: "human",
    label: "Disasters caused by humans",
    color: "#CC79A7",
    items: [
      { id: "induced-seismicity", label: "Induced seismicity: tremors caused by human activity" },
      { id: "oil-spills", label: "Oil spills" },
      { id: "groundwater", label: "Groundwater extraction" },
      { id: "subsidence", label: "Land subsidence" },
      { id: "logging", label: "Logging and forest disturbance" },
      { id: "coastal-loss", label: "Coastal land loss" },
      { id: "reservoirs", label: "Extraction of oil, gas, and water from underground reservoirs" },
    ],
  },
  {
    id: "land",
    label: "Land use",
    color: "#F0E442",
    items: [
      { id: "deforestation", label: "Deforestation and forest degradation" },
      { id: "urban", label: "Urban monitoring and change" },
      { id: "agriculture", label: "Agriculture" },
    ],
  },
];

export const typeLabel = (id: string) => GROUPS.flatMap((g) => g.items).find((i) => i.id === id)?.label ?? id;
