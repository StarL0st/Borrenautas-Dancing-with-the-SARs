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
  categories: string[];
  center: [number, number];
  bbox: Bbox;
  synthetic: boolean;
  events: TimelineEvent[];
  layers: Layer[];
  credits: string[];
};

// Contract change types -> the app's seven themes (ids in categories.ts). "other" maps to none,
// so those areas only appear under "All".
const THEMES: Record<string, string[]> = {
  flood_wetland: ["disasters", "water"],
  forest_loss: ["ecology"],
  wildfire: ["fires", "disasters"],
  agriculture: ["agriculture"],
  soil_moisture: ["agriculture", "water"],
  glacier_ice: ["climate"],
  deformation: ["disasters"],
};

export const supportedVersion = (v: unknown) => typeof v === "string" && /^0\.\d+\.\d+/.test(v);

export const categoriesFor = (changeTypes: string[]) => [
  ...new Set(changeTypes.flatMap((t) => THEMES[t] ?? [])),
];

export const inCategory = (a: AreaView, cat: string) => cat === "all" || a.categories.includes(cat);

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
    categories: categoriesFor(a.change_types ?? []),
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
