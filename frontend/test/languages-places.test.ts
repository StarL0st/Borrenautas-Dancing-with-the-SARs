// French and Japanese, and the larger set of places (jopa-testing, 2026-11-17).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { TOPICS } from "../src/explain.ts";
import { KID_FACTS, KID_FOUND, KID_TYPES } from "../src/kid.ts";
import { HISTORY, tx, zoneHistory, ZONES, type Text } from "../src/mexico.ts";

const full = (t: Text, what: string) => {
  for (const l of ["en", "es", "fr", "ja"] as const) assert.ok(t[l]?.trim(), `${what}: ${l}`);
};

test("long texts: every event, zone note, kids' text and radar explainer is in English, Spanish, French and Japanese", () => {
  for (const e of HISTORY) {
    full(e.title, `${e.id} title`);
    full(e.impact, `${e.id} impact`);
  }
  for (const [id, z] of Object.entries(ZONES)) {
    full(z.changes, `${id} changes`);
    full(z.nature, `${id} nature`);
  }
  for (const [id, t] of Object.entries(KID_TYPES)) full(t, `kid type ${id}`);
  for (const [id, f] of Object.entries(KID_FOUND)) (full(f.one, `found ${id}`), full(f.many, `found ${id}`));
  for (const [id, f] of Object.entries(KID_FACTS)) full(f, `fact ${id}`);
  for (const t of TOPICS) (full(t.title, t.id), full(t.text, t.id), full(t.looks, t.id));
  // "{n}" survives in every language of the kids' counts.
  for (const f of Object.values(KID_FOUND)) for (const l of ["en", "es", "fr", "ja"] as const) assert.ok(f.many[l]!.includes("{n}"), l);
});

test("a text without French or Japanese falls back to English; German always does", () => {
  const t: Text = { en: "Hello", es: "Hola" };
  assert.equal(tx(t, "fr"), "Hello");
  assert.equal(tx(t, "ja"), "Hello");
  assert.equal(tx({ ...t, fr: "Bonjour", ja: "こんにちは" }, "ja"), "こんにちは");
  assert.equal(tx({ ...t, fr: "Bonjour" }, "de"), "Hello");
});

test("new events name the satellites that saw them, and every source is a web page", () => {
  for (const e of HISTORY) {
    for (const s of e.sources) assert.ok(!s.url || /^https?:\/\//.test(s.url), `${e.id}: ${s.name}`);
    for (const sat of e.seenBy ?? []) assert.ok(sat.trim(), e.id);
  }
  const seen = new Set(HISTORY.flatMap((e) => e.seenBy ?? []).map((s) => s.split(" ")[0]));
  // More than one kind of satellite: Japanese radar, NASA and NOAA cameras, rain radars.
  for (const sat of ["ALOS", "Aqua", "Terra", "Landsat", "GOES-12", "TRMM", "Suomi", "QuikSCAT", "UAVSAR", "GPM"]) assert.ok(seen.has(sat), sat);
});

test("every study site has remarkable events nearby, except two with none found yet", () => {
  const sites = JSON.parse(readFileSync(new URL("../../backend/sites.json", import.meta.url), "utf8")) as Record<string, { bbox: [number, number, number, number] }>;
  const bare = Object.entries(sites).filter(([, s]) => !zoneHistory(HISTORY, s.bbox).length).map(([id]) => id).sort();
  // Durango and Ciudad Victoria: no source could be read that places an event within 150 km.
  assert.deepEqual(bare, ["ciudadvictoria", "durango"]);
});
