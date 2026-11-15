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
  friendly?: string; // C8 file: the area's findings in plain words
};

export type Manifest = { contract_version: string; synthetic: boolean; areas: ManifestArea[] };

export type SeriesRef = { id: string; title: string; url: string };

// One timeline row. A detected change has `title`, `text` and `confidence`; a plain radar pass
// has only `pols`. The UI words them in the current language.
export type TimelineEvent = { date: string; title?: string; text?: string; confidence?: number; km2?: number; pols?: string[] };

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
  friendly?: string; // C8 file, when the back end made one
  requested?: boolean; // looked up by some visitor, not a curated site
  kind?: string; // "mosaic": a whole country
  stub?: { events: number; layers: number; dates: string[] }; // from index.json; its files are not loaded yet
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
  km2: e.properties.area_km2,
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
    friendly: a.friendly,
  };
}

// The `n` most important rows of a timeline, newest first. A detected change weighs its size
// times how sure the back end is (a big, sure change first); plain radar passes have no weight,
// so the latest ones are kept.
export const importance = (e: TimelineEvent) => (e.confidence ?? 0) * Math.sqrt(e.km2 ?? 0);
export function topEvents(events: TimelineEvent[], n = 5): TimelineEvent[] {
  const changes = events.filter((e) => !e.pols);
  const pool = changes.length
    ? [...changes].sort((x, y) => importance(y) - importance(x) || y.date.localeCompare(x.date)).slice(0, n)
    : [...events].sort((x, y) => y.date.localeCompare(x.date)).slice(0, n);
  return pool.sort((x, y) => y.date.localeCompare(x.date));
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
    severity?: number; // 0 minor .. 3 most dangerous
    active?: boolean; // its source still lists it as going on (set by livefeeds.ts)
  };
};

// Severity 1 ("notable") when an older back end sends none, so nothing disappears by default.
export const severityOf = (f: LiveFeature) => f.properties.severity ?? 1;

const timeOf = (date: string) => Date.parse(/T|Z/.test(date) ? date : `${date}T00:00:00Z`);

export type LiveView = { now: number; days: number; region?: [number, number, number, number] };

// What the "Happening now" list and the globe show: the filters, plus the time window and an
// optional region.
export const liveFiltered = (fs: LiveFeature[], ticked: ReadonlySet<string>, known: (id: string) => boolean, v: LiveView) =>
  liveList(fs, ticked, known).filter((f) => {
    const p = f.properties;
    const [w, s, e, n] = v.region ?? [-180, -90, 180, 90];
    return (
      v.now - timeOf(p.date) <= v.days * 86400000 &&
      p.lon >= w && p.lon <= e && p.lat >= s && p.lat <= n
    );
  });

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
  const t = timeOf(date);
  const minutes = Math.max(0, Math.round((now - t) / 60000));
  if (minutes < 60) return [-minutes, "minute"];
  if (minutes < 48 * 60) return [-Math.round(minutes / 60), "hour"];
  return [-Math.round(minutes / 1440), "day"];
}

export const SOURCE_SHORT: Record<string, string> = {
  usgs: "USGS", eonet: "NASA EONET", gdacs: "GDACS", nhc: "NOAA NHC", firms: "NASA FIRMS", nws: "NOAA NWS", volcano: "USGS Volcanoes",
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

// Contract C8: what the radar found in an area, in plain words. The back end makes it for every
// area, new lookups included, so it describes any place without hand-written text.
export type FriendlyCard = {
  category: string;
  label: string;
  level: number; // 0 watched for, nothing found; 1 small or weak; 2 1-5% of the area; 3 over 5%
  headline: string;
  number?: { value: number; unit: string; label: string };
  places?: number;
  from?: string;
  to?: string;
};
export type Friendly = { status: "calm" | "watch" | "alert"; headline: string; cards: FriendlyCard[]; data_notes: string[] };

/** A C8 file as the page uses it; undefined when it is not one. Cards missing their words are left out. */
export function readFriendly(j: unknown): Friendly | undefined {
  const f = j as Partial<Friendly> | null;
  if (!f || typeof f.headline !== "string" || !Array.isArray(f.cards)) return undefined;
  return {
    status: f.status === "watch" || f.status === "alert" ? f.status : "calm",
    headline: f.headline,
    cards: f.cards.filter((c) => c && typeof c.category === "string" && typeof c.headline === "string" && Number.isFinite(c.level)),
    data_notes: Array.isArray(f.data_notes) ? f.data_notes.map(String) : [],
  };
}

// ---- Loading on demand (index.json, contract 0.7) ----

// One entry of index.json: an area without its layers and events.
export type IndexArea = Omit<ManifestArea, "layers" | "timeseries" | "credits" | "friendly"> & {
  events?: number; layers?: number; dates?: string[]; requested?: boolean; kind?: string;
};

export const stubView = (a: IndexArea): AreaView => ({
  ...toAreaView({ ...a, layers: [] }),
  requested: a.requested,
  kind: a.kind,
  stub: { events: a.events ?? 0, layers: a.layers ?? 0, dates: a.dates ?? [] },
});

export const overlaps = (a: Bbox, b: Bbox) => a[0] <= b[2] && b[0] <= a[2] && a[1] <= b[3] && b[1] <= a[3];

export const NEAR_KM = 10; // same as the back end's lookup (server.py NEAR_KM)
const grown = ([w, s, e, n]: Bbox, km: number): Bbox => {
  const dy = km / 111.32, dx = dy / Math.cos((((s + n) / 2) * Math.PI) / 180);
  return [w - dx, s - dy, e + dx, n + dy];
};

// The area a position belongs to: inside its box or within NEAR_KM of it. Curated sites win over
// looked-up places; whole countries never match (every point would).
export function areaAt<A extends { bbox: Bbox; requested?: boolean; kind?: string }>(lon: number, lat: number, areas: A[]): A | undefined {
  const hits = areas.filter((a) => a.kind !== "mosaic" && overlaps(grown(a.bbox, NEAR_KM), [lon, lat, lon, lat]));
  return hits.find((a) => !a.requested) ?? hits[0];
}

// ---- Markers that stand for several events ----

// Points on the screen become groups: same type, and within `px` of the group's first point.
// Each group is drawn as one marker; zooming in moves the points apart and splits it.
export function groupDots<T extends { x: number; y: number; type: string }>(pts: T[], px: number): T[][] {
  const groups: T[][] = [];
  for (const p of pts) {
    const g = groups.find(([q]) => q.type === p.type && Math.abs(q.x - p.x) <= px && Math.abs(q.y - p.y) <= px);
    if (g) g.push(p);
    else groups.push([p]);
  }
  return groups;
}
