// Versions of the PDF report (jopa-testing, round 6). No DOM and only type imports, so `node --test`
// runs it directly.
//
// A report is made from a snapshot: everything it shows, already fetched (radar layers, detected
// changes, live reports nearby, satellite photos, time series). Two snapshots with the same
// content key make the same PDF; when new data changes the key, the old PDF is thrown away and a
// new version is made, listing what changed (`diffSnapshots`).
import type { Series } from "./chart";
import type { AreaView, EventFeature, Friendly, LiveFeature } from "./logic";
import type { Found } from "./satview";

export type ReportSnapshot = {
  area: AreaView;
  events: EventFeature["properties"][]; // this area's detected changes
  live: LiveFeature["properties"][]; // live reports near the area
  lang: string;
  sat: [Found | undefined, Found | undefined]; // before, now
  series: [string, Series[]][];
  friendly?: Friendly; // C8 cards; made from `events`, so not part of the key
  asOf: { radar: string; live: string }; // when the sources last published (not part of the key)
};

export type ReportMeta = {
  version: number;
  made: string; // ISO time the PDF was made
  replaces?: number; // the version this one replaced
  changes: string[]; // what is new since that version, in words
};

export type Change =
  | { kind: "lang" }
  | { kind: "radar"; added: number; removed: number; latest: string }
  | { kind: "changes"; from: number; to: number }
  | { kind: "live"; n: number }
  | { kind: "satellite"; date: string }
  | { kind: "series" }
  | { kind: "area" };

// The parts of a snapshot, each as a stable string (sorted, only what the PDF shows).
const parts = (s: ReportSnapshot) => ({
  lang: s.lang,
  area: JSON.stringify([s.area.id, s.area.title, s.area.summary, s.area.types, s.area.bbox, s.area.credits]),
  layers: s.area.layers.map((l) => JSON.stringify([l.url, l.date ?? null, l.date_range ?? null, l.maturity, l.value_range ?? null])).sort(),
  events: s.events.map((e) => JSON.stringify([e.id, e.from, e.to, e.category, e.title, e.summary, e.confidence, e.area_km2])).sort(),
  live: s.live.map((p) => JSON.stringify([p.id, p.date, p.title, p.category, p.source, p.place ?? null, p.severity ?? null])).sort(),
  sat: JSON.stringify(s.sat.map((f) => (f ? [f.url, f.date] : null))),
  series: JSON.stringify(s.series),
});

// FNV-1a, 32 bits, twice with different seeds: a short key, not a security hash.
function fnv(text: string, seed: number): string {
  let h = seed >>> 0;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

/** Same content, same key. `asOf` is left out: a source republishing the same data is not news. */
export function contentKey(s: ReportSnapshot): string {
  const text = JSON.stringify(parts(s));
  return fnv(text, 2166136261) + fnv(text, 33554467) + text.length.toString(16);
}

/** What changed from one snapshot to the next, most important first. */
export function diffSnapshots(prev: ReportSnapshot, next: ReportSnapshot): Change[] {
  const a = parts(prev), b = parts(next);
  const out: Change[] = [];
  if (a.lang !== b.lang) out.push({ kind: "lang" });
  const before = new Set(a.layers), after = new Set(b.layers);
  const added = b.layers.filter((x) => !before.has(x)).length, removed = a.layers.filter((x) => !after.has(x)).length;
  if (added || removed) {
    const dates = next.area.layers.flatMap((l) => l.date_range ?? (l.date ? [l.date] : [])).sort();
    out.push({ kind: "radar", added, removed, latest: dates.at(-1) ?? "" });
  }
  if (a.events.join() !== b.events.join()) out.push({ kind: "changes", from: prev.events.length, to: next.events.length });
  if (a.live.join() !== b.live.join()) out.push({ kind: "live", n: next.live.length });
  if (a.sat !== b.sat) out.push({ kind: "satellite", date: next.sat[1]?.date ?? "" });
  if (a.series !== b.series) out.push({ kind: "series" });
  if (a.area !== b.area) out.push({ kind: "area" });
  return out;
}
