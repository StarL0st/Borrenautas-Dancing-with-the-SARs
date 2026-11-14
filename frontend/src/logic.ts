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
  timeseries?: SeriesRef[]; // C4 files: the area's own values per date
  credits?: string[];
};

export type Manifest = { contract_version: string; synthetic: boolean; areas: ManifestArea[] };

export type SeriesRef = { id: string; title: string; url: string };

// One timeline row. A detected change has `title`, `text` and `confidence`; a plain radar pass
// has only `pols`. The UI words them in the current language.
export type TimelineEvent = { date: string; title?: string; text?: string; confidence?: number; pols?: string[] };

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
  series: SeriesRef[];
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
  text: e.properties.summary,
  confidence: e.properties.confidence,
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
          pols: [...new Set(layers.filter((l) => layerDate(l) === date).map((l) => l.polarization ?? "none"))],
        })),
    layers,
    series: a.timeseries ?? [],
    credits: a.credits ?? [],
  };
}

// Round axis ticks covering [min, max]: steps of 1, 2 or 5 times a power of ten, about `n` of them.
export function ticks(min: number, max: number, n = 4): number[] {
  if (!(max > min)) return [min];
  const raw = (max - min) / n, mag = 10 ** Math.floor(Math.log10(raw));
  const step = mag * ([1, 2, 5, 10].find((m) => m * mag >= raw) ?? 10);
  const out: number[] = [];
  for (let v = Math.floor(min / step) * step; v <= max + step * 0.999; v += step) out.push(+v.toFixed(10));
  return out;
}

// ---- Live events (live.geojson from the back end's livefeeds.py; not NISAR detections) ----

export type LiveFeature = {
  type: "Feature";
  geometry: { type: "Point"; coordinates: [number, number] };
  properties: {
    id: string; source: string; source_name: string; credit: string; category: string;
    title: string; place?: string; date: string; detail: string; url: string; lon: number; lat: number;
  };
};

// A live event shows when its category is ticked; categories the filters do not know always show.
export const liveShown = (f: LiveFeature, ticked: ReadonlySet<string>, known: (id: string) => boolean) =>
  !known(f.properties.category) || ticked.has(f.properties.category);

// Where: the feed's own words, or coordinates when it gives none (fire detections, some storms).
export const liveWhere = (p: LiveFeature["properties"]) =>
  p.place?.trim() ||
  `${Math.abs(p.lat).toFixed(2)}° ${p.lat >= 0 ? "N" : "S"}, ${Math.abs(p.lon).toFixed(2)}° ${p.lon >= 0 ? "E" : "W"}`;

// The list under "Happening now": what passes the filters, newest first.
export const liveList = (fs: LiveFeature[], ticked: ReadonlySet<string>, known: (id: string) => boolean) =>
  fs.filter((f) => liveShown(f, ticked, known)).sort((a, b) => (a.properties.date < b.properties.date ? 1 : -1));

// "3 hours ago" in the largest whole unit, for Intl.RelativeTimeFormat. Dates without a time are midnight UTC.
export function ago(date: string, now: number): [number, "minute" | "hour" | "day"] {
  const t = Date.parse(/T|Z/.test(date) ? date : `${date}T00:00:00Z`);
  const minutes = Math.max(0, Math.round((now - t) / 60000));
  if (minutes < 60) return [-minutes, "minute"];
  if (minutes < 48 * 60) return [-Math.round(minutes / 60), "hour"];
  return [-Math.round(minutes / 1440), "day"];
}

export const SOURCE_SHORT: Record<string, string> = {
  usgs: "USGS", eonet: "NASA EONET", gdacs: "GDACS", nhc: "NOAA NHC", firms: "NASA FIRMS",
};

// ---- Country filter ----

const inRing = (x: number, y: number, ring: number[][]) => {
  let hit = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
};
// Is the point inside the country? `polys` is a list of polygons, each an outer ring and its holes.
// shortcut: outlines are Natural Earth 1:110m, so a point just off the coast counts as outside
// and the smallest countries are missing; switch to the 1:50m file if that matters.
export const inside = (lon: number, lat: number, polys: number[][][][]) =>
  polys.some(([outer, ...holes]) => inRing(lon, lat, outer) && !holes.some((h) => inRing(lon, lat, h)));
