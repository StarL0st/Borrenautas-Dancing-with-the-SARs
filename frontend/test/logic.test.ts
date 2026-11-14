import assert from "node:assert/strict";
import { test } from "node:test";
import { STRINGS } from "../src/i18n.ts";
import { ago, datesFor, inFilter, layerAt, liveFiltered, liveList, liveShown, liveWhere, supportedVersion, ticks, toAreaView, topLive, type Layer, type LiveFeature } from "../src/logic.ts";
import { HISTORY, INFRA, distanceKm, infraNear, mostDestructive, statusOf, zoneHistory, zoneNote } from "../src/mexico.ts";
import { gibsUrl, viewBox, SAT_LAYERS } from "../src/satview.ts";

const layer = (polarization: string, date: string, extra: Partial<Layer> = {}) =>
  ({ id: `${polarization}-${date}`, kind: "image_overlay", bounds: [0, 0, 1, 1], polarization, date, ...extra }) as Layer;

const layers = [layer("HH", "2026-01-25"), layer("HH", "2026-01-01"), layer("HV", "2026-01-13")];

test("dates are sorted, unique and per polarization", () => {
  assert.deepEqual(datesFor(layers, "HH"), ["2026-01-01", "2026-01-25"]);
  assert.deepEqual(datesFor(layers, "HV"), ["2026-01-13"]);
  assert.equal(layerAt(layers, "HH", "2026-01-25")?.id, "HH-2026-01-25");
  assert.equal(layerAt(layers, "HV", "2026-01-25"), undefined);
});

test("only contract major version 0 is accepted", () => {
  assert.ok(supportedVersion("0.1.0"));
  assert.ok(!supportedVersion("1.0.0"));
  assert.ok(!supportedVersion(undefined));
});

test("manifest areas map to filter types and survive missing optional fields", () => {
  const flood = toAreaView({ id: "a", title: "A", summary: "", change_types: ["flood_wetland"], layers });
  assert.deepEqual(flood.types, ["floods"]);
  assert.deepEqual(flood.bbox, [0, 0, 1, 1]);
  assert.deepEqual(flood.center, [0.5, 0.5]);
  assert.equal(flood.events.length, 3);
  assert.ok(inFilter(flood, new Set(["floods"])) && !inFilter(flood, new Set(["wildfires"])) && !inFilter(flood, new Set()));

  const other = toAreaView({ id: "b", title: "B", summary: "", change_types: ["other"], layers: [layer("HH", "2026-01-01", { kind: "geojson" })] });
  assert.deepEqual(other.types, []);
  assert.ok(inFilter(other, new Set()), "untyped areas always show");
  assert.equal(other.layers.length, 0);
});

test("contract 0.3: categories drive filters, groups drive the picker, events fill the timeline", () => {
  const grouped = [
    layer("HH", "2026-01-01", { group: "HH backscatter" }),
    layer("HH", "2026-01-13", { group: "HH change", date: undefined, date_range: ["2026-01-01", "2026-01-13"] }),
  ];
  const report = (area_id: string, to: string, title: string) =>
    ({ type: "Feature", geometry: null, properties: { area_id, to, title, summary: "S.", confidence: 0.5 } }) as never;
  const area = toAreaView(
    { id: "c", title: "C", summary: "", change_types: ["deformation"], categories: ["subsidence", "other"], layers: grouped },
    [report("c", "2026-01-13", "Ground sinking"), report("elsewhere", "2026-02-01", "No")],
  );
  assert.deepEqual(area.types, ["subsidence"]);
  assert.deepEqual(datesFor(area.layers, "HH change"), ["2026-01-13"]);
  assert.deepEqual(datesFor(area.layers, "HH backscatter"), ["2026-01-01"]);
  assert.deepEqual(area.events.map((e) => e.title), ["Ground sinking"]);
  assert.equal(area.events[0].confidence, 0.5);
});

test("a radar pass row lists its polarizations", () => {
  const passes = toAreaView({ id: "p", title: "P", summary: "", change_types: [], layers }).events;
  assert.deepEqual(passes[0], { date: "2026-01-01", pols: ["HH"] });
});

test("axis ticks are round and cover the data", () => {
  assert.deepEqual(ticks(-19.4, -11.2), [-20, -15, -10]);
  assert.deepEqual(ticks(0.11, 0.34), [0.1, 0.2, 0.3, 0.4]);
  assert.deepEqual(ticks(5, 5), [5]);
});

test("every language has every text, with the same placeholders", () => {
  const holes = (text: string) => (text.match(/\{\w+\}/g) ?? []).sort().join();
  for (const [lang, strings] of Object.entries(STRINGS)) {
    assert.deepEqual(Object.keys(strings).sort(), Object.keys(STRINGS.en).sort(), lang);
    for (const [key, text] of Object.entries(strings)) {
      assert.ok(text.trim(), `${lang} ${key} is empty`);
      assert.equal(holes(text), holes(STRINGS.en[key as keyof typeof STRINGS.en]), `${lang} ${key}`);
    }
  }
});

test("live events follow the filters; unknown categories always show", () => {
  const f = (category: string) => ({ properties: { category } }) as LiveFeature;
  const known = (id: string) => ["earthquakes", "storms"].includes(id);
  const ticked = new Set(["storms"]);
  assert.ok(liveShown(f("storms"), ticked, known));
  assert.ok(!liveShown(f("earthquakes"), ticked, known));
  assert.ok(liveShown(f("other"), ticked, known));
});

test("every live category the back end sends is a filter or 'other'", () => {
  // Mirrors backend/src/sars_pipeline/livefeeds.py (EONET_CATEGORIES, GDACS_CATEGORIES).
  const sent = [
    "wildfires", "volcanoes", "floods", "landslides", "drought", "earthquakes", "sea-ice", "storms", "marine",
    "hurricanes", "heat", "cold", "dust", "industrial", "oil-spills",
  ];
  for (const id of sent) assert.ok(STRINGS.en[`type.${id}` as keyof typeof STRINGS.en], id);
});

test("live list: newest first, filtered, and every row says where", () => {
  const f = (id: string, category: string, date: string, place = "") =>
    ({ properties: { id, category, date, place, lat: 19.43, lon: -99.13 } }) as LiveFeature;
  const known = (id: string) => ["earthquakes", "wildfires"].includes(id);
  const list = liveList(
    [f("a", "earthquakes", "2026-11-10"), f("b", "earthquakes", "2026-11-14T09:26Z", "Oaxaca, Mexico"), f("c", "wildfires", "2026-11-13")],
    new Set(["earthquakes"]),
    known,
  );
  assert.deepEqual(list.map((x) => x.properties.id), ["b", "a"]);
  assert.equal(liveWhere(list[0].properties), "Oaxaca, Mexico");
  assert.equal(liveWhere(list[1].properties), "19.43° N, 99.13° W");
});

test("relative time picks a readable unit", () => {
  const now = Date.parse("2026-11-14T12:00:00Z");
  assert.deepEqual(ago("2026-11-14T11:30Z", now), [-30, "minute"]);
  assert.deepEqual(ago("2026-11-14T02:00Z", now), [-10, "hour"]);
  assert.deepEqual(ago("2026-11-10", now), [-5, "day"]);
});

// ---- jopa-testing ----

const ev = (id: string, category: string, date: string, severity: number | undefined, lon = -99.1, lat = 19.4) =>
  ({ properties: { id, category, date, place: "", lon, lat, severity } }) as LiveFeature;

test("live view: time window, danger level and the Mexico region", () => {
  const now = Date.parse("2026-11-14T12:00:00Z");
  const known = () => true;
  const all = new Set(["earthquakes", "hurricanes"]);
  const fs = [
    ev("old", "earthquakes", "2026-10-01", 3),
    ev("minor", "earthquakes", "2026-11-14T10:00Z", 0),
    ev("big", "hurricanes", "2026-11-13", 3),
    ev("tokyo", "earthquakes", "2026-11-14T09:00Z", 2, 139.7, 35.7),
    ev("nosev", "earthquakes", "2026-11-12", undefined),
  ];
  const view = { now, days: 7, minSeverity: 1, region: [-125, 8, -78, 34] as [number, number, number, number] };
  assert.deepEqual(liveFiltered(fs, all, known, view).map((f) => f.properties.id), ["big", "nosev"]);
  assert.deepEqual(liveFiltered(fs, all, known, { ...view, minSeverity: 0 }).map((f) => f.properties.id), ["minor", "big", "nosev"]);
  assert.deepEqual(topLive(fs).map((f) => f.properties.id), ["big", "old", "tokyo"]);
});

test("Mexico data: every event and site is in Mexico or its seas, with sources", () => {
  for (const e of HISTORY) {
    assert.ok(e.sources.length && e.title.en && e.title.es && e.impact.es, e.id);
    for (const [lon, lat] of e.places) assert.ok(lon > -120 && lon < -85 && lat > 14 && lat < 33, e.id);
  }
  for (const s of INFRA) assert.ok(s.sources.length && s.note.es && s.lon > -120 && s.lon < -85, s.id);
  assert.equal(new Set(HISTORY.map((e) => e.id)).size, HISTORY.length);
  assert.equal(new Set(INFRA.map((s) => s.id)).size, INFRA.length);
});

test("zone history, worst recent events, nearby infrastructure and status thresholds", () => {
  const cdmx: [number, number, number, number] = [-99.23, 19.34, -99.03, 19.52];
  const ids = zoneHistory(HISTORY, cdmx).map((e) => e.id);
  assert.ok(ids.includes("michoacan-1985") && ids.includes("puebla-2017") && !ids.includes("gilbert-1988"));
  assert.deepEqual(ids, [...ids].sort((a, b) => HISTORY.find((e) => e.id === a)!.date.localeCompare(HISTORY.find((e) => e.id === b)!.date)));
  const worst = mostDestructive(HISTORY, 2015, 3);
  assert.ok(worst.every((e) => e.severity === 3 && e.date >= "2015"));
  assert.ok(Math.abs(distanceKm([-99.13, 19.43], [-98.2, 19.04]) - 106) < 5, "Mexico City to Puebla is about 106 km");
  const near = infraNear(INFRA, [-99.13, 19.43], 30);
  assert.equal(near[0].site.id, "cdmx-subsidence");
  assert.equal(statusOf({ kind: "dam", mmYr: 2 }), "ok");
  assert.equal(statusOf({ kind: "dam", mmYr: -4 }), "watch");
  assert.equal(statusOf({ kind: "dam", mmYr: 12 }), "fast");
  assert.equal(statusOf({ kind: "levee", reported: "fast" }), "fast");
  assert.equal(statusOf({ kind: "dam" }), "unknown");
  assert.ok(zoneNote("cdmx", [0, 0]) && zoneNote("example-subsidence", [-99.13, 19.43]) && !zoneNote("x", [0, 0]));
});

test("GIBS requests use WMS 1.3.0 axis order and a sharp box", () => {
  const url = new URL(gibsUrl("HLS_S30_Nadir_BRDF_Adjusted_Reflectance", [-99.23, 19.34, -99.03, 19.52], "2026-11-01", 512));
  assert.equal(url.searchParams.get("BBOX"), "19.34,-99.23,19.52,-99.03");
  assert.equal(url.searchParams.get("TIME"), "2026-11-01");
  const hls = SAT_LAYERS.find((l) => l.id === "hls")!;
  const [w, , e] = viewBox([-118, 14, -86, 33], hls);
  assert.ok(e - w <= hls.maxSpanDeg + 1e-9);
});
