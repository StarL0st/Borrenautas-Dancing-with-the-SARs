// Writes DECISIONS.md from src/decisions.ts and src/sources.ts: npm run decisions
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const { DECISIONS } = await import(`${root}/src/decisions.ts`);
const { REFS, SOURCES_CHECKED } = await import(`${root}/src/sources.ts`);
const kinds = { data: "Data", method: "Method", design: "Design" };
const cited = [];
const num = (id) => (cited.includes(id) ? cited.indexOf(id) : cited.push(id) - 1) + 1;
const out = [
  "# Decision log",
  "",
  "Why G.I.G.A.S uses these data and methods, and what it gave up. This file is for anyone curious; the app itself does not show it (the PDF report keeps a short table in its \"Methods and decisions\" section).",
  "",
  "Generated from `src/decisions.ts` and `src/sources.ts` by `npm run decisions`; edit those, not this file. Facts about the world cite outside sources, mostly NASA, read on " + SOURCES_CHECKED + "; the project's own choices cite its files. Newest first.",
  "",
];
for (const d of [...DECISIONS].sort((a, b) => b.date.localeCompare(a.date))) {
  out.push(`## ${d.title.en}`, "", `*${d.date} · ${kinds[d.kind]}* · ${d.refs.map((r) => `[${num(r)}]`).join(" ")}`, "",
    `- **We chose:** ${d.chose.en}`, `- **Why:** ${d.why.en}`, `- **Instead of:** ${d.instead.en}`, `- **What we give up:** ${d.tradeoff.en}`, "");
}
out.push("## Sources", "");
cited.forEach((id, i) => out.push(`${i + 1}. ${REFS[id].who}. *${REFS[id].title}.* <${REFS[id].url}>`));
out.push("");
writeFileSync(join(root, "DECISIONS.md"), out.join("\n"));
