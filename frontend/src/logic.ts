// Pure data logic (no DOM, no imports) so `node --test` can run it directly.
// Types follow docs/04-contracts.md (C1, C2, C3).

export type Bbox = [number, number, number, number]; // [west, south, east, north]

export type Provenance = {
  source_granules: string[];
  steps: string[];
  params: Record<string, unknown>;
  software: Record<string, unknown>;
  attribution: string;
};

export type Layer = {
  id: string;
  title: string;
  description: string;
  kind: string;
  url: string;
  bounds?: Bbox;
  date?: string;
  date_range?: [string, string];
  product: string;
  polarization: string | null;
  maturity: string;
  units: string;
  value_range?: [number, number];
  colormap?: string;
  synthetic: boolean;
  provenance: Provenance;
  group?: string; // contract 0.3: picker label, e.g. "HV backscatter", "Ground motion"
  role?: string;
};

export type ManifestArea = {
  id: string;
  title: string;
  summary: string;
  change_types: string[];
  categories?: string[]; // contract 0.3: filter type ids (filters.ts), set by the back end
  bbox?: Bbox;
  center?: [number, number];
  layers: Layer[];
  credits?: string[];
};

export type Manifest = { contract_version: string; synthetic: boolean; areas: ManifestArea[] };

export type TimelineEvent = { date: string; title: string; text: string };

// One feature of events.geojson (contract 0.3, C6); properties are flat for MapLibre.
export type EventFeature = {
  type: "Feature";
  geometry: unknown;
  properties: {
    id: string; area_id: string; category: string; categories: string; title: string; summary: string;
    from: string; to: string; confidence: number; area_km2: number; maturity: string; lon: number; lat: number;
  };
};

// What the UI shows for one area, whether it came from the manifest or from the placeholders.
export type AreaView = {
  id: string;
  title: string;
  summary: string;
  types: string[]; // filter type ids (filters.ts)
  center: [number, number];
  bbox: Bbox;
  synthetic: boolean;
  example?: boolean; // a real place shown as an example, with no data behind it yet
  events: TimelineEvent[];
  layers: Layer[];
  credits: string[];
};

// Contract change types -> the app's filter types (ids in filters.ts). The contract has no field
// for these yet, so this is a best guess; "other" and "deformation" map to none.
const TYPES: Record<string, string[]> = {
  flood_wetland: ["floods"],
  forest_loss: ["logging", "deforestation"],
  wildfire: ["wildfires"],
  agriculture: ["agriculture"],
  soil_moisture: ["drought", "agriculture"],
  glacier_ice: ["glaciers"],
};

export const supportedVersion = (v: unknown) => typeof v === "string" && /^0\.\d+\.\d+/.test(v);

export const typesFor = (changeTypes: string[]) => [...new Set(changeTypes.flatMap((t) => TYPES[t] ?? []))];

// Areas with no type cannot be filtered out, otherwise they could never be seen.
export const inFilter = (a: AreaView, ticked: ReadonlySet<string>) =>
  !a.types.length || a.types.some((t) => ticked.has(t));

export const layerDate = (l: Layer) => l.date ?? l.date_range?.[1] ?? "";

// The picker groups layers by the back end's `group` label when there is one (imagery per
// polarization, change, ground motion, soil moisture), else by polarization.
const pol = (l: Layer) => l.group ?? l.polarization ?? "none";

export const polarizations = (layers: Layer[]) => [...new Set(layers.map(pol))];

// ISO dates sort correctly as plain strings.
export const datesFor = (layers: Layer[], p: string) =>
  [...new Set(layers.filter((l) => pol(l) === p).map(layerDate).filter(Boolean))].sort();

export const layerAt = (layers: Layer[], p: string, date: string) =>
  layers.find((l) => pol(l) === p && layerDate(l) === date);

// Back-end categories are filter ids already; "other" is not a filter, so such areas stay visible.
const typesOf = (a: ManifestArea) =>
  a.categories ? a.categories.filter((c) => c !== "other") : typesFor(a.change_types ?? []);

const report = (e: EventFeature): TimelineEvent => ({
  date: e.properties.to,
  title: e.properties.title,
  text: `${e.properties.summary} Confidence ${Math.round(e.properties.confidence * 100)}%.`,
});

export function toAreaView(a: ManifestArea, reports: EventFeature[] = []): AreaView {
  // shortcut: only image overlays are drawn, add xyz_tiles and geojson when the back end emits them.
  const layers = a.layers.filter((l) => l.kind === "image_overlay" && l.bounds);
  const bbox = a.bbox ?? layers[0]?.bounds ?? [-180, -85, 180, 85];
  const dates = [...new Set(layers.map(layerDate).filter(Boolean))].sort();
  const mine = reports.filter((e) => e.properties.area_id === a.id);
  return {
    id: a.id,
    title: a.title,
    summary: a.summary,
    types: typesOf(a),
    center: a.center ?? [(bbox[0] + bbox[2]) / 2, (bbox[1] + bbox[3]) / 2],
    bbox,
    synthetic: layers.some((l) => l.synthetic),
    // Detected changes from the back end when there are any, newest first; else one row per pass.
    events: mine.length
      ? mine.map(report).sort((x, y) => y.date.localeCompare(x.date))
      : dates.map((date) => ({
          date,
          title: "Radar pass",
          text: `Polarizations: ${polarizations(layers.filter((l) => layerDate(l) === date)).join(", ")}`,
        })),
    layers,
    credits: a.credits ?? [],
  };
}
