import assert from "node:assert/strict";
import { test } from "node:test";
import { datesFor, inFilter, layerAt, supportedVersion, toAreaView, type Layer } from "../src/logic.ts";

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
