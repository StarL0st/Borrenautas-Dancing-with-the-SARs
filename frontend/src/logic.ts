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
};

export type ManifestArea = {
  id: string;
  title: string;
  summary: string;
  change_types: string[];
  bbox?: Bbox;
  center?: [number, number];
  layers: Layer[];
  credits?: string[];
};

export type Manifest = { contract_version: string; synthetic: boolean; areas: ManifestArea[] };

export type TimelineEvent = { date: string; title: string; text: string };

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

const pol = (l: Layer) => l.polarization ?? "none";

export const polarizations = (layers: Layer[]) => [...new Set(layers.map(pol))];

// ISO dates sort correctly as plain strings.
export const datesFor = (layers: Layer[], p: string) =>
  [...new Set(layers.filter((l) => pol(l) === p).map(layerDate).filter(Boolean))].sort();

export const layerAt = (layers: Layer[], p: string, date: string) =>
  layers.find((l) => pol(l) === p && layerDate(l) === date);

export function toAreaView(a: ManifestArea): AreaView {
  // shortcut: only image overlays are drawn, add xyz_tiles and geojson when the back end emits them.
  const layers = a.layers.filter((l) => l.kind === "image_overlay" && l.bounds);
  const bbox = a.bbox ?? layers[0]?.bounds ?? [-180, -85, 180, 85];
  const dates = [...new Set(layers.map(layerDate).filter(Boolean))].sort();
  return {
    id: a.id,
    title: a.title,
    summary: a.summary,
    types: typesFor(a.change_types ?? []),
    center: a.center ?? [(bbox[0] + bbox[2]) / 2, (bbox[1] + bbox[3]) / 2],
    bbox,
    synthetic: layers.some((l) => l.synthetic),
    events: dates.map((date) => ({
      date,
      title: "Radar pass",
      text: `Polarizations: ${polarizations(layers.filter((l) => layerDate(l) === date)).join(", ")}`,
    })),
    layers,
    credits: a.credits ?? [],
  };
}
