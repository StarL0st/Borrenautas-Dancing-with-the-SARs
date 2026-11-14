import assert from "node:assert/strict";
import { test } from "node:test";
import { STRINGS } from "../src/i18n.ts";
import { readFileSync } from "node:fs";
import { collectLive, eonetCategory, parseEonet, parseGdacs, parseUsgs, quakeSeverity, recent } from "../src/livefeeds.ts";
import { gibsUrl, viewBox, SAT_LAYERS } from "../src/satview.ts";
import { ago, datesFor, inFilter, inside, layerAt, liveList, liveShown, liveWhere, supportedVersion, ticks, toAreaView, type Layer, type LiveFeature } from "../src/logic.ts";

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

const usgs = { features: [{ id: "us1", properties: { mag: 6.1, time: Date.parse("2026-11-14T10:30:00Z"), place: "7 km SE of Tagbina, Philippines", tsunami: 1, url: "https://earthquake.usgs.gov/x" }, geometry: { coordinates: [126.2, 8.4, 35.2] } }] };
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
    return eonet;
  });
  assert.equal(got.ok, 2);
  assert.deepEqual(got.features.map((f) => f.properties.source).sort(), ["eonet", "usgs"]);
});
