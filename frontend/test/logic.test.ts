import assert from "node:assert/strict";
import { test } from "node:test";
import { STRINGS } from "../src/i18n.ts";
import { datesFor, inFilter, layerAt, supportedVersion, ticks, toAreaView, type Layer } from "../src/logic.ts";

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
