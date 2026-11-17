// Makes src/assets/cities.json, the city names drawn on the globe, from Natural Earth
// "populated places" 1:10m (public domain, naturalearthdata.com):
//   node scripts/cities.mjs path/to/ne_10m_populated_places.geojson
// Download: https://github.com/nvkelso/natural-earth-vector/blob/master/geojson/ne_10m_populated_places.geojson
// Kept: capitals of countries and of states or provinces, and the other cities Natural Earth
// lists. Each row: [lon, lat, rank (0 = largest), capital (2 country, 1 state, 0 no), English
// name, Spanish, German, French, Japanese]; a name equal to the English one is left empty.
// French and Japanese were added on jopa-testing (2026-11-17) to the existing rows, matched by
// position and English name (all 7,295 matched), so the list itself did not change.
import { readFileSync, writeFileSync } from "node:fs";

const SKIP = ["Scientific station", "Historic place", "Meteorological Station"];
const capital = (c) => (c.startsWith("Admin-0") ? 2 : c.startsWith("Admin-1") ? 1 : 0);
const rows = JSON.parse(readFileSync(process.argv[2], "utf8"))
  .features.map((f) => f.properties)
  .filter((p) => !SKIP.includes(p.FEATURECLA))
  .map((p) => {
    const en = p.NAME_EN || p.NAME;
    const other = (n) => (n && n !== en ? n : "");
    return [+p.LONGITUDE.toFixed(3), +p.LATITUDE.toFixed(3), p.SCALERANK, capital(p.FEATURECLA), en, other(p.NAME_ES), other(p.NAME_DE), other(p.NAME_FR), other(p.NAME_JA)];
  })
  .sort((a, b) => a[2] - b[2] || b[3] - a[3]);
writeFileSync(new URL("../src/assets/cities.json", import.meta.url), JSON.stringify(rows));
console.log(`${rows.length} places`);
