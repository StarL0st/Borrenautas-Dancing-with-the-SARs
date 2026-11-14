// Live events fetched by the page itself, so they refresh wherever the app is opened, with no
// back end running. A port of the back end's `livefeeds.py` (branch `jopa-testing`): same
// sources, categories, danger scores and 24-hour window. Keep the two in step.
//
// Left to the back end, because a web page cannot do them: NOAA NHC (its server does not allow
// requests from other sites; GDACS carries the tropical cyclones too) and NASA FIRMS (needs a key).
import type { LiveFeature } from "./logic";

export const LIVE_MINUTES = 15; // how often the page asks the sources again
export const LIVE_HOURS = 24; // events older than this are dropped
const GDACS_PAGE = 100; // the most GDACS returns per request
const GDACS_FIRE_PAGES = 3; // newest 300 fires at most

const SOURCES = {
  eonet: {
    owner: "NASA Earth Observatory, Goddard Space Flight Center",
    url: "https://eonet.gsfc.nasa.gov/api/v3/events?status=open&days=2",
    credit: "NASA EONET, https://eonet.gsfc.nasa.gov/ (each event credits its own source)",
  },
  usgs: {
    owner: "U.S. Geological Survey, Earthquake Hazards Program (ANSS)",
    url: "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson",
    credit: "U.S. Geological Survey, Earthquake Hazards Program, ANSS ComCat",
  },
  gdacs: {
    owner: "United Nations OCHA and European Commission JRC",
    url: "https://www.gdacs.org/gdacsapi/api/events/geteventlist/SEARCH",
    credit: "Global Disaster Alert and Coordination System (GDACS), https://www.gdacs.org/",
  },
};
type SourceId = keyof typeof SOURCES;

// Filter ids (filters.ts) for each feed's own categories.
const EONET_CATEGORIES: Record<string, string> = {
  wildfires: "wildfires", volcanoes: "volcanoes", floods: "floods", landslides: "landslides", drought: "drought",
  earthquakes: "earthquakes", seaLakeIce: "sea-ice", severeStorms: "storms", waterColor: "marine", dustHaze: "dust",
  snow: "cold", tempExtremes: "heat", manmade: "industrial",
};
const GDACS_CATEGORIES: Record<string, string> = {
  TC: "hurricanes", FL: "floods", VO: "volcanoes", DR: "drought", WF: "wildfires", EQ: "earthquakes",
};
const TROPICAL_WORDS = ["hurricane", "typhoon", "cyclone", "tropical storm", "tropical depression"];

// EONET lumps tropical cyclones in with other storms, cold with heat, and every human-made
// event together; the title tells them apart.
export function eonetCategory(id: string, title: string): string {
  const low = title.toLowerCase();
  const has = (words: string[]) => words.some((w) => low.includes(w));
  if (id === "severeStorms" && has(TROPICAL_WORDS)) return "hurricanes";
  if (id === "tempExtremes" && has(["cold", "freez", "frost", "snow"])) return "cold";
  if (id === "manmade" && has(["oil", "spill"])) return "oil-spills";
  return EONET_CATEGORIES[id] ?? "other";
}

type Extra = { place?: string; detail?: string; url?: string; severity?: number };
function feature(source: SourceId, uid: string, category: string, title: string, date: string, lon: number, lat: number, extra: Extra): LiveFeature {
  const round = (v: number) => Math.round(v * 1e5) / 1e5;
  return {
    type: "Feature",
    geometry: { type: "Point", coordinates: [round(lon), round(lat)] },
    properties: {
      id: `${source}-${uid}`, source, source_name: SOURCES[source].owner, credit: SOURCES[source].credit, category, title,
      place: extra.place ?? "", date, detail: extra.detail ?? "", url: extra.url ?? "", severity: extra.severity ?? 1,
      lon: round(lon), lat: round(lat),
    },
  } as LiveFeature;
}

// EONET titles carry the place: "Flood in Guatemala", "Wildfire Red Hill, Perry, Texas".
function placeFromTitle(title: string): string {
  for (const cut of [" in ", ", "]) if (title.includes(cut)) return title.slice(title.indexOf(cut) + cut.length).trim();
  return "";
}

/* eslint-disable @typescript-eslint/no-explicit-any -- the feeds are other people's JSON */
type Json = any;

// A representative point of a Point or Polygon geometry (the first ring's mean).
function pointOf(geometry: Json): [number, number] | undefined {
  const coords = geometry?.coordinates;
  if (geometry?.type === "Point") return [coords[0], coords[1]];
  const ring: number[][] | undefined = geometry?.type === "Polygon" ? coords?.[0] : undefined;
  if (!ring?.length) return undefined;
  return [ring.reduce((s, p) => s + p[0], 0) / ring.length, ring.reduce((s, p) => s + p[1], 0) / ring.length];
}

// EONET events, latest position each. Events whose only sources are in `skip` are dropped
// (they come in directly from that feed).
export function parseEonet(data: Json, skip: string[] = []): LiveFeature[] {
  const out: LiveFeature[] = [];
  for (const e of data.events ?? []) {
    const sources: string[] = (e.sources ?? []).map((s: Json) => s.id);
    if (sources.length && sources.every((s) => skip.includes(s))) continue;
    const geoms = [...(e.geometry ?? [])].sort((a: Json, b: Json) => String(a.date ?? "").localeCompare(String(b.date ?? "")));
    const g = geoms.at(-1);
    const p: [number, number] | undefined = g && pointOf(g);
    if (!p) continue;
    let detail = `Reported by ${[...sources].sort().join(", ")}`;
    if (g.magnitudeValue != null) detail = `${`${g.magnitudeValue} ${g.magnitudeUnit ?? ""}`.trim()} · ${detail}`;
    const title: string = e.title ?? "";
    out.push(
      feature("eonet", e.id, e.categories?.length ? eonetCategory(e.categories[0].id, title) : "other", title, String(g.date ?? "").slice(0, 10), ...p, {
        detail, url: (e.sources ?? []).find((s: Json) => s.url)?.url ?? e.link ?? "", place: placeFromTitle(title),
        severity: title.toLowerCase().includes("hurricane") ? 2 : 1,
      }),
    );
  }
  return out;
}

// Magnitude 7+ is a major quake; a tsunami flag is always at least serious.
export function quakeSeverity(mag: unknown, tsunami: unknown = 0): number {
  const m = Number(mag) || 0;
  const level = m >= 7 ? 3 : m >= 6 ? 2 : m >= 5 ? 1 : 0;
  return tsunami ? Math.max(level, 2) : level;
}

export function parseUsgs(data: Json): LiveFeature[] {
  return (data.features ?? []).map((f: Json) => {
    const p = f.properties, [lon, lat, depth] = f.geometry.coordinates;
    return feature("usgs", f.id, "earthquakes", `Magnitude ${p.mag} earthquake`, `${new Date(p.time).toISOString().slice(0, 16)}Z`, lon, lat, {
      detail: `Magnitude ${p.mag}${depth != null ? `, depth ${Math.round(depth)} km` : ""}${p.tsunami ? " · Tsunami possible: see NOAA tsunami.gov" : ""}`,
      url: p.url ?? "", place: p.place ?? "", severity: quakeSeverity(p.mag, p.tsunami),
    });
  });
}

// GDACS affected countries as words: "Mexico, Guatemala and 4 more".
function countries(p: Json, most = 3): string {
  const names: string[] = (p.affectedcountries ?? []).map((c: Json) => c.countryname).filter(Boolean);
  if (!names.length) return p.country ?? "";
  const more = names.length - most;
  return names.slice(0, most).join(", ") + (more > 0 ? ` and ${more} more` : "");
}

// Earthquakes are skipped: they come from USGS.
export function parseGdacs(data: Json, skipTypes: string[] = ["EQ"]): LiveFeature[] {
  const out: LiveFeature[] = [];
  for (const f of data.features ?? []) {
    const p = f.properties, pt = pointOf(f.geometry);
    if (skipTypes.includes(p.eventtype) || !pt) continue;
    const sev = p.severitydata ?? {};
    const start = String(p.fromdate ?? "").slice(0, 10), last = String(p.todate ?? "").slice(0, 10);
    const detail = [p.alertlevel && `${p.alertlevel} alert`, sev.severity ? sev.severitytext : "", last && `since ${start}`].filter(Boolean).join(" · ");
    out.push(
      // The date is the latest update: a live map shows what is current.
      feature("gdacs", `${p.eventtype}${p.eventid}`, GDACS_CATEGORIES[p.eventtype] ?? "other", p.name || p.description || "", last || start, ...pt, {
        detail, url: p.url?.report ?? "", place: countries(p), severity: ({ Red: 3, Orange: 2 } as Record<string, number>)[p.alertlevel] ?? 1,
      }),
    );
  }
  return out;
}

// A feed date as a time. A date without a clock time counts as the end of that day, so an event
// the feed dates "today" is not dropped just because it has no time.
const when = (date: string) => (date.includes("T") ? Date.parse(date) : Date.parse(`${date}T23:59:00Z`));

/** The events updated within the last `hours`. Run again later, it drops the ones that expired. */
export const recent = (features: LiveFeature[], now: number, hours = LIVE_HOURS) =>
  features.filter((f) => when(f.properties.date) >= now - hours * 3600000);

/**
 * Ask every source. One failing source never stops the others; `ok` counts the ones that
 * answered, so the caller can tell "no events" from "no connection".
 */
export async function collectLive(get: (url: string) => Promise<Json> = (url) => fetch(url).then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))) {
  const day = (ago: number) => new Date(Date.now() - ago * 86400000).toISOString().slice(0, 10);
  async function gdacs() {
    // Fires are many, so they get their own pages; otherwise they crowd out cyclones and floods.
    const seen = new Set<string>(), out: LiveFeature[] = [];
    for (const [types, pages] of [["TC;FL;VO;DR", 5], ["WF", GDACS_FIRE_PAGES]] as const) {
      for (let page = 1; page <= pages; page++) {
        const q = `?eventlist=${types}&fromDate=${day(2)}&toDate=${day(0)}&alertlevel=Green;Orange;Red&pagesize=${GDACS_PAGE}&pagenumber=${page}`;
        const got = (await get(SOURCES.gdacs.url + q)).features ?? [];
        const fresh = parseGdacs({ features: got }).filter((f) => !seen.has(f.properties.id));
        for (const f of fresh) seen.add(f.properties.id);
        out.push(...fresh);
        if (got.length < GDACS_PAGE || !fresh.length) break;
      }
    }
    return out;
  }
  const answers = await Promise.allSettled([
    get(SOURCES.usgs.url).then(parseUsgs),
    gdacs(),
    get(SOURCES.eonet.url).then((d) => parseEonet(d, ["GDACS"])), // GDACS events reach EONET too
  ]);
  const features = answers.flatMap((a) => (a.status === "fulfilled" ? a.value : []));
  features.sort((a, b) => (a.properties.date < b.properties.date ? 1 : -1));
  return { features, ok: answers.filter((a) => a.status === "fulfilled").length, generated_at: new Date().toISOString() };
}
