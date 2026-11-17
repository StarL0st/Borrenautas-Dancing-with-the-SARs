// News titles, places and details in the reader's language (jopa-testing, 2026-11-17). The
// titles are real ones, copied from the sources' feeds on 2026-11-17.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { STRINGS, type Lang } from "../src/i18n.ts";
import { countryName, liveDetail, livePlace, liveTitle, setCountryNames } from "../src/live-text.ts";

const countries = JSON.parse(readFileSync(new URL("../src/assets/countries.json", import.meta.url), "utf8"));
setCountryNames(countries);
const kind = (c: string) => `[${c}]`; // stands in for the filter name in the reader's language
const title = (text: string, lang: Lang, category = "other") => liveTitle({ title: text, category }, lang, kind);
const LANGS = Object.keys(STRINGS) as Lang[];

test("news titles: English stays as the source wrote it, without EONET's own number", () => {
  assert.equal(title("Magnitude 4.6 earthquake", "en"), "Magnitude 4.6 earthquake");
  assert.equal(title("Flood in Spain 1104287", "en"), "Flood in Spain");
  assert.equal(title("Prescribed Fire Holly Springs 119-1 &amp; 84-2 RX, Lafayette, Mississippi", "en"), "Prescribed Fire Holly Springs 119-1 & 84-2 RX, Lafayette, Mississippi");
});

test("news titles: every known shape is rebuilt in every language", () => {
  const cases: [string, Partial<Record<Lang, string>>][] = [
    ["Magnitude 4.6 earthquake", { es: "Sismo de magnitud 4.6", fr: "Séisme de magnitude 4,6", de: "Erdbeben der Stärke 4,6", ja: "マグニチュード4.6の地震" }],
    ["Shaking caused by people (quarry blast), magnitude 1.8", { es: "Sacudida causada por personas (voladura en cantera), magnitud 1.8", ja: "人為的な揺れ（採石場の発破）、マグニチュード1.8" }],
    ["Kilauea volcano: alert level WATCH", { es: "Volcán Kilauea: nivel de alerta vigilancia", fr: "Volcan Kilauea : niveau d'alerte veille", ja: "Kilauea火山：警戒レベル「警戒情報」" }],
    ["Wildfire Red Hill, Perry, Mississippi", { es: "Incendio forestal: Red Hill, Perry, Mississippi", fr: "Feu de forêt : Red Hill, Perry, Mississippi", de: "Waldbrand: Red Hill, Perry, Mississippi", ja: "山火事：Red Hill, Perry, Mississippi" }],
    ["Wildfire in Botswana 1033897", { es: "Incendio forestal en Botsuana", fr: "Feu de forêt : Botswana", ja: "ボツワナで山火事" }],
    ["Flood in Spain 1104287", { es: "Inundación en España", fr: "Inondation : Espagne", de: "Überschwemmung: Spanien", ja: "スペインで洪水" }],
    ["Forest fires in Benin, Burkina Faso", { es: "Incendios forestales en Benín, Burkina Faso", ja: "ベナン、ブルキナファソで森林火災" }],
    ["Drought in United States", { es: "Sequía en Estados Unidos", fr: "Sécheresse : États-Unis", ja: "アメリカ合衆国で干ばつ" }],
    ["Tropical Cyclone AKVAN-26", { es: "Ciclón tropical AKVAN-26", fr: "Cyclone tropical AKVAN-26", de: "Tropischer Wirbelsturm AKVAN-26", ja: "熱帯サイクロン AKVAN-26" }],
    ["Typhoon Cempaka", { es: "Tifón Cempaka", ja: "台風 Cempaka" }],
    ["Iceberg B22A", { es: "Iceberg B22A", de: "Eisberg B22A", ja: "氷山 B22A" }],
    ["Kanlaon Volcano, Philippines", { es: "Volcán Kanlaon, Filipinas", fr: "Volcan Kanlaon, Philippines", ja: "Kanlaon火山（フィリピン）" }],
    ["Flood Warning", { es: "Aviso de inundación", fr: "Avertissement d'inondation", de: "Warnung: Überschwemmung", ja: "洪水警報" }],
    ["Winter Storm Watch", { es: "Vigilancia de tormenta invernal", fr: "Veille de tempête hivernale", ja: "冬の嵐警戒情報" }],
    ["Tropical Storm Warning", { es: "Aviso de tormenta tropical", fr: "Avertissement de tempête tropicale", ja: "熱帯暴風雨警報" }],
    ["Red Flag Warning", { es: "Aviso de bandera roja (peligro de incendio)", ja: "レッドフラッグ（火災危険）警報" }],
    ["Fire or hot spot detected", { es: "Fuego o punto de calor detectado", fr: "Feu ou point chaud détecté" }],
  ];
  for (const [text, want] of cases) for (const [lang, out] of Object.entries(want)) assert.equal(title(text, lang as Lang), out, `${lang}: ${text}`);
  // No non-English title is left as the English one (every known shape matched). "Iceberg" is
  // the same word in Spanish and French.
  for (const [text] of cases.filter(([x]) => !x.startsWith("Iceberg")))
    for (const lang of LANGS.filter((l) => l !== "en")) assert.notEqual(title(text, lang), text, `${lang}: ${text}`);
});

test("news titles in no known shape keep their words after the translated type", () => {
  assert.equal(title("Dust and Haze over the Sahara", "es", "dust"), "[dust]: Dust and Haze over the Sahara");
  assert.equal(title("Something new", "ja", "other"), "[other]：Something new");
});

test("news places: USGS distances and country lists; US states are not taken for countries", () => {
  assert.equal(livePlace("12 km NNE of Ridgecrest, CA", "es"), "A 12 km al NNE de Ridgecrest, CA");
  assert.equal(livePlace("5 km WSW of Pala, CA", "fr"), "5 km OSO de Pala, CA");
  assert.equal(livePlace("5 km ESE of Home Gardens, CA", "de"), "5 km OSO von Home Gardens, CA");
  assert.equal(livePlace("6 km S of Pāhala, Hawaii", "ja"), "Pāhala, Hawaiiの南6 km");
  assert.equal(livePlace("Mexico, Guatemala and 4 more", "es"), "México, Guatemala y 4 más");
  assert.equal(livePlace("Perry, Georgia", "fr"), "Perry, Georgia");
  assert.equal(livePlace("Spain 1104287", "ja"), "スペイン");
  assert.equal(countryName("Türkiye", "de"), "Türkei");
  assert.equal(countryName("Atlantis", "fr"), "Atlantis");
});

test("news details: the app's own words are translated, the source's free text is kept", () => {
  assert.equal(liveDetail("Magnitude 5.1, depth 10 km · Tsunami possible: see NOAA tsunami.gov", "es"), "Magnitud 5.1, profundidad 10 km · Posible tsunami: consulte tsunami.gov de la NOAA");
  assert.equal(liveDetail("Orange alert · Tropical Storm (maximum wind speed of 93 km/h) · since 2026-11-10", "fr"), "Alerte orange · Tropical Storm (maximum wind speed of 93 km/h) · depuis le 2026-11-10");
  assert.equal(liveDetail("Reported by GDACS", "ja"), "報告元：GDACS");
  assert.equal(liveDetail("Magnitude 5.1", "en"), "Magnitude 5.1");
});
