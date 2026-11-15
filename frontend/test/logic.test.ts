import assert from "node:assert/strict";
import { test } from "node:test";
import { STRINGS } from "../src/i18n.ts";
import { HISTORY, distanceKm, mostDestructive, zoneHistory, zoneNote } from "../src/mexico.ts";
import { readFileSync } from "node:fs";
import { collectLive, eonetCategory, parseEonet, parseGdacs, parseNws, parseUsgs, parseVolcanoes, quakeSeverity, recent } from "../src/livefeeds.ts";
import { gibsUrl, viewBox, SAT_LAYERS } from "../src/satview.ts";
import { ago, datesFor, inFilter, inside, layerAt, liveFiltered, liveList, liveShown, liveWhere, readFriendly, supportedVersion, ticks, toAreaView, type Layer, type LiveFeature } from "../src/logic.ts";

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

test("live view: time window and region", () => {
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
  const view = { now, days: 7, region: [-125, 8, -78, 34] as [number, number, number, number] };
  assert.deepEqual(liveFiltered(fs, all, known, view).map((f) => f.properties.id), ["minor", "big", "nosev"]);
  assert.deepEqual(liveFiltered(fs, all, known, { now, days: 7 }).map((f) => f.properties.id), ["minor", "tokyo", "big", "nosev"]);
});

test("Mexico data: every event is in Mexico or its seas, with sources", () => {
  for (const e of HISTORY) {
    assert.ok(e.sources.length && e.title.en && e.title.es && e.impact.es, e.id);
    for (const [lon, lat] of e.places) assert.ok(lon > -120 && lon < -85 && lat > 14 && lat < 33, e.id);
  }
  assert.equal(new Set(HISTORY.map((e) => e.id)).size, HISTORY.length);
});

test("zone history, worst recent events and distances", () => {
  const cdmx: [number, number, number, number] = [-99.23, 19.34, -99.03, 19.52];
  const ids = zoneHistory(HISTORY, cdmx).map((e) => e.id);
  assert.ok(ids.includes("michoacan-1985") && ids.includes("puebla-2017") && !ids.includes("gilbert-1988"));
  assert.deepEqual(ids, [...ids].sort((a, b) => HISTORY.find((e) => e.id === a)!.date.localeCompare(HISTORY.find((e) => e.id === b)!.date)));
  const worst = mostDestructive(HISTORY, 2015, 3);
  assert.ok(worst.every((e) => e.severity === 3 && e.date >= "2015"));
  assert.ok(Math.abs(distanceKm([-99.13, 19.43], [-98.2, 19.04]) - 106) < 5, "Mexico City to Puebla is about 106 km");
  // Notes belong to one place only: a new place next door must not borrow them.
  assert.ok(zoneNote("cdmx") && !zoneNote("example-subsidence") && !zoneNote("x"));
});

test("GIBS requests use WMS 1.3.0 axis order and a sharp box", () => {
  const url = new URL(gibsUrl("HLS_S30_Nadir_BRDF_Adjusted_Reflectance", [-99.23, 19.34, -99.03, 19.52], "2026-11-01", 512));
  assert.equal(url.searchParams.get("BBOX"), "19.34,-99.23,19.52,-99.03");
  assert.equal(url.searchParams.get("TIME"), "2026-11-01");
  const hls = SAT_LAYERS.find((l) => l.id === "hls")!;
  const [w, , e] = viewBox([-118, 14, -86, 33], hls);
  assert.ok(e - w <= hls.maxSpanDeg + 1e-9);
});

test("country filter: a point is inside its own country only", () => {
  const countries: { id: string; polys: number[][][][] }[] = JSON.parse(readFileSync(new URL("../src/assets/countries.json", import.meta.url), "utf8"));
  const polys = (id: string) => countries.find((c) => c.id === id)!.polys;
  assert.ok(inside(-99.13, 19.43, polys("MEX")), "Mexico City is in Mexico");
  assert.ok(!inside(-99.13, 19.43, polys("USA")));
  assert.ok(inside(-149.9, 61.2, polys("USA")), "Anchorage: countries with several pieces");
  assert.ok(!inside(28.2, -29.6, polys("ZAF")) && inside(28.2, -29.6, polys("LSO")), "Lesotho is a hole in South Africa");
});

// ---- Live events asked by the page (a port of the back end's livefeeds.py) ----

const usgs = { features: [{ id: "us1", properties: { type: "earthquake", mag: 6.1, time: Date.parse("2026-11-14T10:30:00Z"), place: "7 km SE of Tagbina, Philippines", tsunami: 1, url: "https://earthquake.usgs.gov/x" }, geometry: { coordinates: [126.2, 8.4, 35.2] } }] };
const gdacs = { features: [
  { properties: { eventtype: "TC", eventid: 7, name: "Tropical Cyclone ANA", alertlevel: "Red", fromdate: "2026-11-12T00:00:00", todate: "2026-11-14T06:00:00", affectedcountries: [{ countryname: "Mexico" }], url: { report: "https://www.gdacs.org/r" } }, geometry: { type: "Point", coordinates: [-100, 15] } },
  { properties: { eventtype: "EQ", eventid: 8, name: "Quake" }, geometry: { type: "Point", coordinates: [0, 0] } },
] };
const eonet = { events: [
  { id: "E1", title: "Typhoon Kiko", categories: [{ id: "severeStorms" }], sources: [{ id: "JTWC", url: "https://x" }], geometry: [{ date: "2026-11-13T00:00:00Z", type: "Point", coordinates: [130, 20] }, { date: "2026-11-14T00:00:00Z", type: "Point", coordinates: [131, 21] }] },
  { id: "E2", title: "Flood in Guatemala", categories: [{ id: "floods" }], sources: [{ id: "GDACS" }], geometry: [{ date: "2026-11-14T00:00:00Z", type: "Point", coordinates: [-90, 15] }] },
] };

test("live feeds: each source becomes events with a type, a place, a source and a danger score", () => {
  const [q] = parseUsgs(usgs);
  assert.deepEqual([q.properties.id, q.properties.category, q.properties.date, q.properties.severity, q.properties.lon], ["usgs-us1", "earthquakes", "2026-11-14T10:30Z", 2, 126.2]);
  assert.match(q.properties.detail, /depth 35 km · Tsunami/);
  const g = parseGdacs(gdacs);
  assert.deepEqual(g.map((f) => [f.properties.id, f.properties.category, f.properties.date, f.properties.severity, f.properties.place]), [["gdacs-TC7", "hurricanes", "2026-11-14", 3, "Mexico"]]);
  const e = parseEonet(eonet, ["GDACS"]); // the flood reached EONET through GDACS: taken from GDACS only
  assert.deepEqual(e.map((f) => [f.properties.category, f.properties.lon, f.properties.date]), [["hurricanes", 131, "2026-11-14"]]);
  assert.equal(eonetCategory("tempExtremes", "Cold wave in Peru"), "cold");
  assert.equal(eonetCategory("somethingNew", "x"), "other");
  assert.deepEqual([4.9, 5, 6.5, 7.2].map((m) => quakeSeverity(m)), [0, 1, 2, 3]);
});

test("live feeds: events expire after 24 hours; one source failing does not stop the others", async () => {
  const now = Date.parse("2026-11-15T12:00:00Z");
  const at = (date: string) => ({ properties: { date } }) as LiveFeature;
  // A date without a time counts to the end of that day.
  assert.deepEqual(recent([at("2026-11-15T09:00Z"), at("2026-11-14T11:00Z"), at("2026-11-14"), at("2026-11-13")], now).map((f) => f.properties.date), ["2026-11-15T09:00Z", "2026-11-14"]);
  const got = await collectLive(async (url) => {
    if (url.includes("usgs")) return usgs;
    if (url.includes("gdacs")) throw new Error("down");
    if (url.includes("weather.gov") || url.includes("volcanoes")) return { features: [] };
    return eonet;
  });
  assert.equal(got.ok, 4); // the weather and volcano feeds answered with nothing in them
  assert.deepEqual(got.features.map((f) => f.properties.source).sort(), ["eonet", "usgs"]);
  // An event its source still lists as going on stays past 24 hours.
  assert.equal(recent([{ properties: { date: "2026-11-01", active: true } } as LiveFeature], now).length, 1);
});

test("live feeds: more than earthquakes (other USGS kinds, weather alerts, volcano alert levels)", async () => {
  const quake = (id: string, type: string, mag: number) => ({ id, properties: { type, mag, time: 0 }, geometry: { coordinates: [0, 0, 1] } });
  const kinds = parseUsgs({ features: [quake("a", "earthquake", 1.2), quake("b", "quarry blast", 1.5), quake("c", "landslide", 2), quake("d", "sonic boom", 2), quake("e", "earthquake", 3)] });
  assert.deepEqual(kinds.map((f) => [f.properties.id, f.properties.category]), [["usgs-b", "induced-seismicity"], ["usgs-c", "landslides"], ["usgs-e", "earthquakes"]]);

  const alert = (id: string, event: string, zone: string, sent: string) => ({ properties: { id, event, sent, severity: "Severe", areaDesc: "Sherman; Wallace; Greeley; Logan", affectedZones: [`https://api.weather.gov/zones/forecast/${zone}`] } });
  const nws = await parseNws(
    { features: [alert("1", "Flash Flood Warning", "KSZ013", "2026-11-14T10:00:00-06:00"), alert("2", "Small Craft Advisory", "KSZ013", "2026-11-14T11:00:00-06:00"), alert("3", "Gale Watch", "PZZ350", "2026-11-14T12:00:00-06:00"), alert("4", "Winter Storm Watch", "COZ091", "2026-11-14T13:00:00-06:00"), alert("5", "Heat Advisory", "XXZ000", "2026-11-14T09:00:00-06:00")] },
    async (zone) => (zone.endsWith("XXZ000") ? undefined : [-101.7, 39.3]),
  );
  // Routine advisories, sea zones and alerts whose zone cannot be found are left out.
  assert.deepEqual(nws.map((f) => [f.properties.category, f.properties.title, f.properties.date, f.properties.place, f.properties.active]), [
    ["forecast", "Winter Storm Watch", "2026-11-14T19:00Z", "Sherman, Wallace, Greeley", true],
    ["floods", "Flash Flood Warning", "2026-11-14T16:00Z", "Sherman, Wallace, Greeley", true],
  ]);

  const volcano = (name: string, alertLevel: string) => ({ geometry: { coordinates: [-176.1, 52.1] }, properties: { volcanoName: name, vnum: name, alertLevel, region: "Aleutians", noticeId: "DOI-USGS-AVO-2026-11-13T19:12:01+00:00", noticeSynopsis: "<p>Lava continues to erupt.</p>" } });
  const v = parseVolcanoes({ features: [volcano("Great Sitkin", "WATCH"), volcano("Adagdak", "UNASSIGNED"), volcano("Spurr", "NORMAL")] });
  assert.deepEqual(v.map((f) => [f.properties.title, f.properties.date, f.properties.severity, f.properties.detail]), [["Great Sitkin volcano: alert level WATCH", "2026-11-13", 2, "Lava continues to erupt."]]);
});

// ---- jopa-testing: comparator, radar explainer, decision log ----

import { changeMap, opticalDecode, pctToDb, radarDecode, relChange, subBox, viewRect } from "../src/compare-core.ts";
import { TOPICS, topicsFor } from "../src/explain.ts";
import { DECISIONS } from "../src/decisions.ts";

test("comparator: change is relative, the same both ways, and 50% is 3 dB", () => {
  assert.equal(relChange(100, 50), -0.5);
  assert.equal(relChange(50, 100), 0.5);
  assert.equal(relChange(0, 0), 0);
  assert.ok(Math.abs(pctToDb(0.5) - 3.01) < 0.01);
  // A radar gray PNG stretched over -20..0 dB: 255 is 0 dB (power 1), 0 is -20 dB (power 0.01).
  const dec = radarDecode(-20, 0);
  assert.ok(Math.abs(dec(255) - 1) < 1e-9 && Math.abs(dec(0) - 0.01) < 1e-9);
});

test("comparator: marks brighter and darker pixels past the threshold, skips missing ones", () => {
  const w = 6, h = 1;
  const px = (vals: number[], alpha = 255) => new Uint8ClampedArray(vals.flatMap((v) => [v, v, v, alpha]));
  const before = px([60, 60, 60, 60, 60, 60]);
  const after = px([60, 60, 60, 120, 120, 120]);
  const { codes, stats } = changeMap(before, after, w, h, opticalDecode, opticalDecode, 0.3);
  // The 3x3 average blurs the edge: the last unchanged pixel averages to 80 against 60, a 25%
  // change, under the 30% threshold; the first changed one averages to 100, 40%.
  assert.deepEqual([...codes], [0, 0, 0, 1, 1, 1]);
  assert.deepEqual(stats, { valid: 6, brighter: 3, darker: 0 });
  const half = changeMap(before, px([60, 60, 60, 120, 120, 120], 0), w, h, opticalDecode, opticalDecode, 0.3);
  assert.equal(half.stats.valid, 0, "transparent pixels are no data");
  const cloudy = changeMap(px([60, 60, 60, 60, 60, 60]), px([60, 60, 60, 230, 230, 230]), w, h, opticalDecode, opticalDecode, 0.3, true);
  assert.deepEqual(cloudy.stats, { valid: 2, brighter: 0, darker: 0 }, "a cloud (and the pixel next to it) in one photo is not a change");
  // Dark ground in photos: 20 -> 35 is not a 43% change, it is measured against at least 60.
  assert.equal(changeMap(px([20]), px([35]), 1, 1, opticalDecode, opticalDecode, 0.3, true).stats.brighter, 0);
  // Two radar pictures with different stretches: the same gray can be a different echo.
  const same = changeMap(px([128]), px([128]), 1, 1, radarDecode(-20, 0), radarDecode(-14, 6), 0.5);
  assert.deepEqual(same.stats, { valid: 1, brighter: 1, darker: 0 });
});

test("comparator: the zoomed view stays inside the picture and maps back to lon/lat", () => {
  assert.deepEqual(viewRect(1, 0.9, 0.1), [0, 0, 1, 1]);
  assert.deepEqual(viewRect(2, 0.9, 0.1), [0.5, 0, 1, 0.5]);
  assert.deepEqual(subBox([-100, 10, -90, 20], [0.5, 0, 1, 0.5]), [-95, 15, -90, 20]);
});

test("radar explainer: every area gets the basics, its own ideas and the caveats", () => {
  assert.deepEqual(topicsFor(["floods"]), ["basics", "water", "structure", "fooled"]);
  assert.deepEqual(topicsFor(["subsidence", "groundwater"]), ["basics", "motion", "fooled"]);
  assert.deepEqual(topicsFor([]), ["basics", "water", "plants", "fooled"]);
  for (const id of topicsFor(["floods", "deforestation", "drought", "subsidence"])) assert.ok(TOPICS.some((x) => x.id === id), id);
  for (const x of TOPICS) assert.ok(x.title.es && x.text.es && x.looks.es && x.text.en, x.id);
});

test("decision log: unique ids, real dates, every field in English and Spanish", () => {
  assert.equal(new Set(DECISIONS.map((d) => d.id)).size, DECISIONS.length);
  for (const d of DECISIONS) {
    assert.match(d.date, /^\d{4}-\d{2}-\d{2}$/);
    for (const f of [d.title, d.chose, d.why, d.instead, d.tradeoff]) assert.ok(f.en && f.es, d.id);
  }
});

// ---- jopa-testing round 5: top-5 timelines, PDF text, Simple-mode guide ----

import { topEvents } from "../src/logic.ts";
import { topHistory } from "../src/mexico.ts";
import { clean, fill } from "../src/pdf-text.ts";
import { KID_FACTS, KID_FOUND, KID_TYPES, kidFact } from "../src/kid.ts";

test("timeline keeps the 5 most important changes (size x confidence), newest first", () => {
  const ev = (date: string, confidence: number, km2: number) => ({ date, title: date, confidence, km2 });
  const events = [ev("2026-01", 0.9, 100), ev("2026-02", 0.2, 1), ev("2026-03", 0.8, 50), ev("2026-04", 0.5, 4), ev("2026-05", 0.9, 0.1), ev("2026-06", 0.6, 30), ev("2026-07", 0.7, 9)];
  assert.deepEqual(topEvents(events).map((e) => e.date), ["2026-07", "2026-06", "2026-04", "2026-03", "2026-01"]);
  // With only radar passes, the latest five.
  const passes = ["a", "b", "c", "d", "e", "f"].map((x, i) => ({ date: `2026-0${i + 1}`, pols: ["HH"] }));
  assert.deepEqual(topEvents(passes).map((e) => e.date), ["2026-06", "2026-05", "2026-04", "2026-03", "2026-02"]);
});

test("zone history keeps the 5 worst events, oldest first", () => {
  const top = topHistory(HISTORY, 5);
  assert.equal(top.length, 5);
  assert.deepEqual(top.map((e) => e.date), [...top.map((e) => e.date)].sort());
  const worst = Math.min(...top.map((e) => e.severity));
  assert.ok(HISTORY.filter((e) => e.severity > worst).every((e) => top.includes(e)), "nothing worse is left out");
});

test("PDF text: only letters the built-in fonts can draw", () => {
  assert.equal(clean("Área −3 dB ≥ 4 → “ok” … Tōkyō"), 'Área -3 dB >= 4 -> "ok" ... Tokyo');
  assert.equal(clean("km² · 25 × 25"), "km² · 25 × 25");
  assert.ok([...clean("漢字")].every((c) => c === "?"));
  assert.equal(fill("{n} of {total}", { n: 2, total: 9 }), "2 of 9");
});

test("Simple-mode guide: every sentence in English and Spanish, every kind has words", () => {
  for (const [k, v] of Object.entries(KID_TYPES)) assert.ok(v.en && v.es, k);
  for (const [k, v] of Object.entries(KID_FACTS)) assert.ok(v.en && v.es, k);
  for (const [k, v] of Object.entries(KID_FOUND)) {
    assert.ok(v.many.en.includes("{n}") && v.many.es.includes("{n}") && v.one.en.startsWith("1 ") && v.one.es.startsWith("1 "), k);
  }
  // Every change the back end can report has kid words (categorize.py).
  for (const k of ["floods", "deforestation", "wildfires", "agriculture", "urban", "subsidence", "groundwater", "drought", "other"]) assert.ok(KID_FOUND[k], k);
  assert.equal(kidFact(["nothing", "floods"]), KID_FACTS.floods);
  assert.equal(kidFact([]), KID_FACTS.default);
});

// ---- jopa-testing round 6: sourced text, report versions ----

import { REFS } from "../src/sources.ts";
import { contentKey, diffSnapshots, type ReportSnapshot } from "../src/report-core.ts";

test("every explanation, decision and kids' fact cites at least one known source", () => {
  const known = new Set(Object.keys(REFS));
  for (const x of TOPICS) assert.ok(x.refs.length && x.refs.every((r) => known.has(r)), x.id);
  for (const d of DECISIONS) assert.ok(d.refs.length && d.refs.every((r) => known.has(r)), d.id);
  for (const [k, f] of Object.entries(KID_FACTS)) assert.ok(f.refs.length && f.refs.every((r) => known.has(r)), k);
  for (const r of Object.values(REFS)) assert.match(r.url, /^https:\/\//);
  // Outside facts lean on NASA: most cited sources are NASA pages.
  const nasa = Object.values(REFS).filter((r) => /NASA/.test(r.who)).length;
  assert.ok(nasa >= 8, `${nasa} NASA sources`);
});

test("report versions: same data, same key; new data, a new key and a list of what changed", () => {
  const layer = (date: string) => ({ id: date, url: `hh-${date}.png`, date, maturity: "PROVISIONAL", kind: "image_overlay" }) as unknown as Layer;
  const ev = (id: string) => ({ id, from: "2026-08-14", to: "2026-08-26", category: "floods", title: "Flood", summary: "s", confidence: 0.8, area_km2: 1 });
  const base: ReportSnapshot = {
    area: { id: "v", title: "V", summary: "", types: ["floods"], center: [0, 0], bbox: [0, 0, 1, 1], synthetic: false, events: [], layers: [layer("2026-08-14")], series: [], credits: [] },
    events: [ev("a")] as ReportSnapshot["events"], live: [], lang: "en",
    sat: [{ url: "u1", date: "2025-11-01", layer: "HLS" }, { url: "u2", date: "2026-11-01", layer: "HLS" }],
    series: [], asOf: { radar: "2026-11-14T00:00:00Z", live: "" },
  };
  // A source republishing the same content is not a new version.
  assert.equal(contentKey(base), contentKey({ ...base, asOf: { radar: "2026-11-15T00:00:00Z", live: "x" } }));
  const next: ReportSnapshot = {
    ...base,
    area: { ...base.area, layers: [layer("2026-08-14"), layer("2026-08-26")] },
    events: [ev("a"), ev("b")] as ReportSnapshot["events"],
    sat: [base.sat[0], { url: "u3", date: "2026-11-13", layer: "HLS" }],
  };
  assert.notEqual(contentKey(base), contentKey(next));
  assert.deepEqual(diffSnapshots(base, next), [
    { kind: "radar", added: 1, removed: 0, latest: "2026-08-26" },
    { kind: "changes", from: 1, to: 2 },
    { kind: "satellite", date: "2026-11-13" },
  ]);
  assert.deepEqual(diffSnapshots(base, { ...base, lang: "es" }), [{ kind: "lang" }]);
});

test("friendly cards (C8) are read safely", () => {
  const f = readFriendly({
    status: "watch", headline: "Biggest signal: farming.", data_notes: ["Provisional NISAR data."],
    cards: [
      { category: "agriculture", label: "Farming", level: 2, headline: "Fields changed.", number: { value: 39.7, unit: "km2", label: "area affected" } },
      { category: "urban", label: "Building", level: 0, headline: "No new structures stood out." },
      { label: "broken, no category", level: 1, headline: "x" },
    ],
  });
  assert.equal(f?.status, "watch");
  assert.deepEqual(f?.cards.map((c) => c.category), ["agriculture", "urban"]);
  assert.equal(readFriendly({ status: "odd", headline: "h", cards: [] })?.status, "calm");
  assert.equal(readFriendly({ cards: [] }), undefined);
  assert.equal(readFriendly(null), undefined);
  assert.equal(toAreaView({ id: "a", title: "A", summary: "", change_types: [], layers: [], friendly: "areas/a/friendly.json" }).friendly, "areas/a/friendly.json");
});
