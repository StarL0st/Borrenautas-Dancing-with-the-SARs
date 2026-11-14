// The seven themes follow NASA ARSET's training topic areas. Colors are the Okabe-Ito
// colorblind-safe palette; every theme is also named in text, never by color alone.

export type Category = { id: string; label: string; color: string; topics: string[] };

export const CATEGORIES: Category[] = [
  {
    id: "agriculture",
    label: "Agriculture",
    color: "#F0E442",
    topics: [
      "Crop mapping",
      "Soil moisture and evapotranspiration for water and farm management",
      "Large-scale data and machine learning applications",
      "Radar (SAR) observations to identify and describe crops",
    ],
  },
  {
    id: "climate",
    label: "Climate Resilience",
    color: "#56B4E9",
    topics: [
      "Climate risks: sea level change, coastal storms, landslides",
      "Climate projections",
      "Greenhouse gas monitoring",
      "Renewable energy management",
    ],
  },
  {
    id: "disasters",
    label: "Disasters",
    color: "#D55E00",
    topics: [
      "Disaster monitoring, preparedness and relief",
      "Wildland fire risk, detection and analysis",
      "Flood monitoring and management",
      "Radar (SAR) detection of floods, sea ice, subsidence, oil slicks and landslides",
      "Urban heat islands and other human impacts",
    ],
  },
  {
    id: "ecology",
    label: "Ecological Conservation",
    color: "#009E73",
    topics: [
      "Land cover and land use change detection",
      "Vegetation indices",
      "Coastal and marine ecosystem monitoring",
      "Biodiversity management",
    ],
  },
  {
    id: "health",
    label: "Health & Air Quality",
    color: "#CC79A7",
    topics: [
      "Aerosols, trace gases, smoke, dust and particulate matter",
      "Long-range transport of atmospheric pollutants",
      "Surface and satellite data validation",
      "Waterborne and vector-borne diseases",
    ],
  },
  {
    id: "water",
    label: "Water Resources",
    color: "#6FA8FF",
    topics: [
      "Drought monitoring, prediction and projection",
      "Water quality in inland, coastal and estuarine waters",
      "Drought and evapotranspiration for agriculture",
    ],
  },
  {
    id: "fires",
    label: "Wildland Fires",
    color: "#E69F00",
    topics: [
      "Pre-fire conditions and risk assessment",
      "Active fire and smoke detection",
      "Post-fire burn severity mapping",
      "River and freshwater quality before and after fires",
    ],
  },
];
