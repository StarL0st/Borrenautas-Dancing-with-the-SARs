import "@fontsource/ibm-plex-sans/latin-400.css";
import "@fontsource/ibm-plex-sans/latin-600.css";
import "@fontsource/ibm-plex-mono/latin-400.css";
import "./style.css";
import { chart, type Series } from "./chart";
import { exampleAreas } from "./example-areas";
import { GROUPS, groupLabel, isType, shortLabel, typeColor, typeLabel } from "./filters";
import { createGlobe, type ViewMode } from "./globe";
import { setLang, t, type Key } from "./i18n";
import { icon } from "./icons";
import {
  ago, datesFor, inFilter, layerAt, liveFiltered, liveWhere, polarizations, severityOf, SOURCE_SHORT, supportedVersion, toAreaView, topLive,
  type AreaView, type EventFeature, type Layer, type LiveFeature, type Manifest,
} from "./logic";
import {
  HISTORY, INFRA, INFRA_THRESHOLDS, LEARN, infraNear, mostDestructive, statusOf, tx, zoneHistory, zoneNote,
  type HistoryEvent, type Infra, type Source, type Status,
} from "./mexico";
import { findClear, isoDay, SAT_LAYERS, type Found } from "./satview";
import { loadSettings, renderSettings, saveSettings, type Settings } from "./settings";
import { startTour } from "./tour";
import { el } from "./ui";
import { createWheel } from "./wheel";

// Live backend by default; set VITE_DATA_BASE=./data/ for the static build (contract C6).
const BASE = new URL(import.meta.env.VITE_DATA_BASE ?? "http://127.0.0.1:8765/", location.href);

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const filters = $("filters"), results = $("results"), status = $("status"), cards = $("cards"), banner = $("banner");
const liveToggle = $<HTMLInputElement>("live-toggle"), liveStatus = $("live-status");
const liveListEl = $("live-list"), liveMore = $("live-more");
const LIVE_PAGE = 15;
let liveLimit = LIVE_PAGE; // rows shown in the "Happening now" list

const settings = loadSettings();
setLang(settings.lang);
// Simple mode: plain words and fewer controls. Technical mode: everything the back end sends.
const simple = () => settings.mode === "simple";
document.documentElement.dataset.mode = settings.mode;

let live: AreaView[] = [];
let reports: EventFeature[] = []; // detected changes from events.geojson (contract 0.3)
let liveEvents: LiveFeature[] = []; // live.geojson: public disaster feeds, not radar detections
let liveUpdated = ""; // its generated_at, or "" when the feeds are not available
let liveEvery = 0; // how often the back end refreshes live.geojson, in minutes (0: unknown)
const ticked = new Set(GROUPS.flatMap((g) => g.items)); // filter types switched on
let stagger = true; // the area list cascades in while the page loads, not on later updates
let opened: string[] = []; // area ids open as tabs, newest first
let entering: string | undefined; // the tab that was just opened, so only it animates in
const collapsed = new Set<string>();
const views = new Map<string, { pol: string; date: string; opacity: number }>(); // radar settings per area
const seriesCache = new Map<string, Promise<[string, Series[]][]>>(); // chart data per area, by unit

// Example places stand in only while there are no real areas.
const areas = () => (live.length ? live : exampleAreas());
const colorOf = (a: AreaView) => typeColor(a.types.find((id) => ticked.has(id)) ?? "");
// Like areas: an event whose categories are not filters ("other") is always shown.
const eventShown = (e: EventFeature) => {
  const cats = e.properties.categories.split(",").filter(isType);
  return !cats.length || cats.some((c) => ticked.has(c));
};
const dot = (color: string) => {
  const d = el("span", { className: "dot" });
  d.style.background = color;
  return d;
};

const globe = createGlobe("map", settings.texture, toggle);

// ---- Left panel: filters ----

// How many types each group shows before "Show more": one row of four tiles in Simple mode.
const FIRST_TYPES = () => (simple() ? 4 : 6);
const expanded = new Set<string>(); // groups whose full list is open

function moreButton(g: (typeof GROUPS)[number]): Node[] {
  const hidden = g.items.length - FIRST_TYPES();
  if (hidden <= 0) return [];
  const open = expanded.has(g.id);
  const button = el("button", { type: "button", className: "link more" }, open ? t("filter.less") : t("filter.more", { n: hidden }));
  button.setAttribute("aria-expanded", String(open));
  button.onclick = () => {
    if (open) expanded.delete(g.id);
    else expanded.add(g.id);
    buildFilters();
    filters.querySelector<HTMLElement>(`[data-group="${g.id}"] .more`)?.focus();
  };
  return [button];
}

function buildFilters() {
  const open = [...filters.children].map((d) => (d as HTMLDetailsElement).open);
  filters.replaceChildren(
    ...GROUPS.map((g, n) => {
      const all = el("input", { type: "checkbox" });
      const boxes = g.items.map((id) => el("input", { type: "checkbox", checked: ticked.has(id) }));
      const syncAll = () => {
        const count = boxes.filter((b) => b.checked).length;
        all.checked = count === boxes.length;
        all.indeterminate = count > 0 && count < boxes.length;
      };
      const set = (id: string, on: boolean) => (on ? ticked.add(id) : ticked.delete(id));
      for (const [i, box] of boxes.entries()) {
        box.onchange = () => {
          set(g.items[i], box.checked);
          syncAll();
          render();
        };
      }
      all.onchange = () => {
        for (const [i, box] of boxes.entries()) set(g.items[i], (box.checked = all.checked));
        render();
      };
      syncAll();
      const group = el(
        "details",
        { open: open[n] ?? n === 0 },
        el("summary", {}, dot(g.color), groupLabel(g.id)),
        el("label", { className: "check all" }, all, t("filter.all")),
        // One icon per type: filled with the group color when on, outline only when off. The
        // checkbox stays (hidden but focusable) so keyboards and screen readers work as before.
        el(
          "div",
          { className: "ftypes" },
          ...boxes.map((box, i) => {
            const id = g.items[i];
            box.className = "vh";
            const tile = el("label", { className: "ftype", title: typeLabel(id) }, box, icon(id), el("span", {}, simple() ? shortLabel(id) : typeLabel(id)));
            tile.style.setProperty("--c", g.color);
            // Only the first few types show until "Show more" is pressed, so the panel stays short.
            tile.hidden = !expanded.has(g.id) && i >= FIRST_TYPES();
            return tile;
          }),
        ),
        ...moreButton(g),
      );
      group.dataset.group = g.id;
      return group;
    }),
  );
}

// ---- Left panel: coordinates ----

$<HTMLFormElement>("coords").onsubmit = (e) => {
  e.preventDefault(); // the browser has already checked both numbers are present and in range
  setSpin(false);
  const lon = +$<HTMLInputElement>("lon").value, lat = +$<HTMLInputElement>("lat").value;
  globe.goTo(lon, lat);
  setInfraFrom([lon, lat], "coords");
};

// Ask the back end to process the typed place (needs `serve --jobs`). It shows up when ready:
// the server pushes a manifest event and the app reloads.
$("process").onclick = async () => {
  const form = $<HTMLFormElement>("coords");
  if (!form.reportValidity()) return;
  const lat = +$<HTMLInputElement>("lat").value, lon = +$<HTMLInputElement>("lon").value;
  setStatus("status.asking");
  try {
    const res = await fetch(new URL("sites", BASE), {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ lat, lon }),
    });
    if (res.status === 202 || res.status === 200) setStatus("status.accepted"); // 200: cached (contract 0.5)
    else if (res.status === 404 || res.status === 405) setStatus("status.unsupported");
    else if (res.status === 401) setStatus("status.token");
    else setStatus("status.refused", { code: res.status });
  } catch {
    setStatus("status.noserver");
  }
};

// The status line remembers what it says, not the words, so it can change language.
let statusNow: { key: Key; vars?: Record<string, string | number>; error?: boolean } | undefined;
function setStatus(key: Key, vars?: Record<string, string | number>, error = false) {
  statusNow = { key, vars, error };
  showStatus();
}
function showStatus() {
  status.className = statusNow?.error ? "error" : "muted";
  status.textContent = statusNow ? t(statusNow.key, statusNow.vars) : "";
}

// ---- Area list, dots and open tabs ----

function render() {
  const shown = areas().filter((a) => inFilter(a, ticked));
  opened = opened.filter((id) => shown.some((a) => a.id === id));

  results.replaceChildren(
    ...shown.map((a, n) => {
      const dates = a.events.map((e) => e.date).sort();
      const when = dates.length ? t("list.dates", { from: dates[0], to: dates.at(-1)! }) : t("list.nodates");
      const row = el(
        "button",
        { type: "button", className: "result", onclick: () => toggle(a.id) },
        el("strong", {}, dot(colorOf(a)), a.title),
        el("span", { className: "muted" }, a.example ? t("list.example") : `${when} · ${t("list.images", { n: a.layers.length })}`),
      );
      row.setAttribute("aria-pressed", String(opened.includes(a.id)));
      const li = el("li", { className: stagger ? "stagger" : "" }, row);
      li.style.setProperty("--i", String(Math.min(n, 12)));
      return li;
    }),
  );
  if (!shown.length) results.append(el("li", { className: "muted" }, t("list.none")));

  const notes = [shown.some((a) => a.example) && t("banner.example"), shown.some((a) => a.synthetic) && t("banner.synthetic")].filter(Boolean);
  banner.hidden = !notes.length;
  banner.textContent = notes.join(" ");

  globe.setAreas(shown.map((area) => ({ area, color: colorOf(area) })), opened);
  globe.setEvents(
    reports.filter(eventShown).map((e) => ({ ...e, properties: { ...e.properties, color: typeColor(e.properties.category) } })),
  );
  renderLiveList();
  renderRecent();
  renderInfra();
  // The globe shows exactly what the list shows: filters, time window, danger level, Mexico.
  globe.setLive(
    liveToggle.checked
      ? liveFiltered(liveEvents, ticked, isType, liveView()).map((f) => ({ ...f, properties: { ...f.properties, color: typeColor(f.properties.category) } }))
      : [],
  );
  globe.keepOverlays(opened);
  cards.replaceChildren(
    ...(opened.length ? opened.map((id) => card(shown.find((a) => a.id === id)!)) : [el("p", { className: "muted" }, t("cards.empty"))]),
  );
  entering = undefined;
}

// Clicking a dot or a list row opens the area as a tab; clicking again closes it.
function toggle(id: string) {
  const a = areas().find((x) => x.id === id);
  if (!a) return;
  if (simple()) {
    // No side panel in Simple mode: a short popup, with a way into the full details.
    setSpin(false);
    globe.openInfo(a.center[0], a.center[1], simpleArea(a), 6);
    if (infraFrom?.kind !== "you") setInfraFrom(a.center, "area", a.title);
    return;
  }
  const opening = !opened.includes(id);
  opened = opening ? [id, ...opened] : opened.filter((x) => x !== id);
  if (opening) {
    showPanel("detail", true); // an area opened from the globe must not land in a hidden panel
    collapsed.delete(id);
    entering = id;
    setSpin(false); // or the globe would drift away from the area just opened
    globe.focus(a);
    // Infrastructure risks follow the place just opened, unless the user shared their location.
    if (infraFrom?.kind !== "you") setInfraFrom(a.center, "area", a.title);
  }
  render();
  if (opening) cards.querySelector<HTMLElement>("summary")?.focus();
}

function card(a: AreaView) {
  const tags = el("p", {}, ...a.types.map((id) => el("span", { className: "tag" }, typeLabel(id))));
  if (a.example) tags.append(el("span", { className: "tag warn" }, t("tag.example")));
  if (a.synthetic) tags.append(el("span", { className: "tag warn" }, t("tag.synthetic")));

  // Simple mode sums the radar passes up in one sentence and drops the confidence figures.
  const passes = a.events.filter((e) => e.pols).map((e) => e.date).sort();
  const timeline = (simple() ? a.events.filter((e) => !e.pols) : a.events).map((e) =>
    el(
      "li",
      {},
      el("time", { dateTime: e.date }, e.date),
      el("strong", {}, e.title ?? t("timeline.pass")),
      el(
        "p",
        { className: "muted" },
        e.pols
          ? t("timeline.pols", { list: e.pols.join(", ") })
          : [e.text, !simple() && e.confidence !== undefined && t("timeline.confidence", { pct: Math.round(e.confidence * 100) })].filter(Boolean).join(" "),
      ),
    ),
  );

  const box = el(
    "details",
    { className: a.id === entering ? "card enter" : "card", open: !collapsed.has(a.id) },
    el("summary", {}, dot(colorOf(a)), a.title),
    el(
      "p",
      { className: "actions" },
      el("button", { type: "button", onclick: () => globe.focus(a) }, t("card.show")),
      el("button", { type: "button", onclick: () => toggle(a.id) }, t("card.close")),
    ),
    tags,
    el("p", {}, a.summary),
    ...radarSection(a),
    satSection(a),
    simple() ? el("div") : chartSection(a),
    // "What changed": the zone's notes (including plants and animals), then the detected changes.
    // Simple mode already titles the detected changes "What changed", so the notes join them.
    ...(simple() ? [] : changesSection(a, true)),
    el("h4", {}, t(simple() ? "simple.changes" : "card.timeline")),
    ...(simple() ? changesSection(a, false) : []),
    ...(simple() && passes.length ? [el("p", {}, t("simple.passes", { n: passes.length, from: passes[0], to: passes.at(-1)! }))] : []),
    timeline.length ? el("ol", { className: "timeline" }, ...timeline) : el("p", { className: "muted" }, t("card.noreports")),
    ...historySection(a),
    ...(a.credits.length ? [el("h4", {}, t("card.credits")), el("ul", {}, ...a.credits.map((c) => el("li", { className: "muted" }, c)))] : []),
  );
  box.ontoggle = () => (box.open ? collapsed.delete(a.id) : collapsed.add(a.id));
  return box;
}

function radarSection(a: AreaView): Node[] {
  if (!a.layers.length) return [el("h4", {}, t("card.radar")), el("p", { className: "muted" }, t("card.noradar"))];

  const pols = polarizations(a.layers);
  const v = views.get(a.id) ?? { pol: pols[0], date: "", opacity: 1 };
  views.set(a.id, v);
  if (!pols.includes(v.pol)) v.pol = pols[0];
  // Simple mode picks the most telling picture itself; the technical choice is kept for later.
  const pol = () => (simple() ? ["Detected change", "Surface type"].find((g) => pols.includes(g)) ?? pols[0] : v.pol);

  const info = el("div");
  const dateOut = el("output", {}, v.date);
  const slider = el("input", { type: "range", id: `date-${a.id}`, min: "0", step: "1" });
  const polSelect = el("select", { id: `pol-${a.id}` }, ...pols.map((p) => el("option", { value: p, selected: p === v.pol }, p)));

  // The slider moves over the available dates only, so it cannot land on a gap.
  const setDates = () => {
    const dates = datesFor(a.layers, pol());
    if (!dates.includes(v.date)) v.date = dates.at(-1) ?? "";
    slider.max = String(Math.max(dates.length - 1, 0));
    slider.value = String(dates.indexOf(v.date));
    slider.disabled = dates.length < 2;
    update();
  };
  const update = () => {
    dateOut.textContent = v.date;
    slider.setAttribute("aria-valuetext", v.date);
    const layer = layerAt(a.layers, pol(), v.date);
    globe.showOverlay(a.id, layer, BASE, v.opacity);
    info.replaceChildren(...(layer ? layerInfo(layer) : []));
  };
  slider.oninput = () => {
    v.date = datesFor(a.layers, pol())[+slider.value];
    update();
  };
  polSelect.onchange = () => {
    v.pol = polSelect.value;
    setDates();
  };
  const opacity = el("input", { type: "range", id: `opacity-${a.id}`, min: "0", max: "1", step: "0.05", value: String(v.opacity) });
  opacity.oninput = () => globe.setOpacity(a.id, (v.opacity = +opacity.value));

  setDates();
  if (simple()) return [el("h4", {}, t("simple.picture")), el("label", { htmlFor: slider.id }, t("radar.date"), " ", dateOut), slider, info];
  return [
    el("h4", {}, t("card.radar")),
    el("label", { htmlFor: polSelect.id }, t("radar.layer")), polSelect,
    el("label", { htmlFor: slider.id }, t("radar.date"), " ", dateOut), slider,
    el("label", { htmlFor: opacity.id }, t("radar.opacity")), opacity,
    info,
  ];
}

// The colors the back end paints into its images (backend/src/sars_pipeline/site.py and
// categorize.py). Keep in step with the back end.
// Color bars run from the low end of `value_range` to the high end.
const RAMPS: Record<string, string> = {
  gray: "#000, #fff",
  rdbu: "rgb(215 48 39), transparent, rgb(40 110 220)",
  brbg: "rgb(166 97 26), rgb(1 133 113)",
};
// shortcut: "classes" layers are matched by their group label because the contract does not
// list their classes; replace with the contract's class list if it gains one.
const CLASSES: Record<string, [string, Key][]> = {
  "Surface type": [
    ["rgb(33 113 181)", "class.water"], ["rgb(200 60 60)", "class.built"],
    ["rgb(49 163 84)", "class.vegetation"], ["rgb(217 180 120)", "class.bare"],
  ],
  "Detected change": [
    ["rgb(33 113 181)", "class.darkening"], ["rgb(230 85 13)", "class.hvdrop"],
    ["rgb(200 60 160)", "class.brightening"], ["rgb(150 150 150)", "class.strong"],
  ],
};

function layerInfo(l: Layer): Node[] {
  const out: Node[] = [el("p", {}, l.description)];
  const classes = l.colormap === "classes" && CLASSES[l.group ?? ""];
  if (classes) {
    out.push(
      el(
        "ul",
        { className: "swatches" },
        ...classes.map(([color, key]) => {
          const s = el("span", { className: "swatch" });
          s.style.background = color;
          return el("li", {}, s, t(key));
        }),
      ),
    );
  }
  if (l.value_range) {
    const [min, max] = l.value_range;
    const stops = RAMPS[l.colormap ?? ""];
    if (stops) {
      const bar = el("div", { className: "ramp" });
      // Ground motion is painted with the sign flipped (red = positive = away from the satellite).
      bar.style.background = `linear-gradient(${l.role === "motion" ? "to left" : "to right"}, ${stops})`;
      out.push(bar);
    }
    out.push(el("p", { className: "legend" }, el("span", {}, `${min} ${l.units}`), el("span", {}, `${max} ${l.units}`)));
  }
  if (simple()) return out;
  const p = l.provenance;
  const row = (key: Key, val: Node | string) => [el("dt", {}, t(key)), el("dd", {}, val)];
  out.push(
    el(
      "details",
      {},
      el("summary", {}, t("prov.summary")),
      el(
        "dl",
        {},
        ...row("prov.product", l.product),
        ...row("prov.pol", l.polarization ?? t("prov.none")),
        ...row("prov.maturity", l.maturity),
        ...row("prov.granules", p.source_granules.join(", ") || t("prov.nogranules")),
        ...row("prov.steps", el("ol", {}, ...p.steps.map((s) => el("li", {}, s)))),
        ...row("prov.params", JSON.stringify(p.params)),
        ...row("prov.software", JSON.stringify(p.software)),
        ...row("prov.credit", p.attribution),
      ),
    ),
  );
  return out;
}

// ---- Change over time (contract C4 time series files) ----

// One chart per unit, so lines that share a chart share a scale.
function loadSeries(a: AreaView) {
  let pending = seriesCache.get(a.id);
  if (!pending) {
    pending = Promise.all(
      a.series.map(async (ref) => {
        try {
          const file = await (await fetch(new URL(ref.url, BASE))).json();
          const points = (file.points as { date: string; value: number }[]).filter((p) => p.date && Number.isFinite(p.value));
          return points.length ? { units: String(file.units), label: String(file.polarization ?? file.title ?? ref.title), points } : undefined;
        } catch {
          return undefined; // a missing or broken file drops that line, not the tab
        }
      }),
    ).then((files) => {
      const byUnit = new Map<string, Series[]>();
      for (const f of files) if (f) byUnit.set(f.units, [...(byUnit.get(f.units) ?? []), { label: f.label, points: f.points }]);
      return [...byUnit];
    });
    seriesCache.set(a.id, pending);
  }
  return pending;
}

function chartSection(a: AreaView): Node {
  const box = el("div");
  if (a.series.length) {
    loadSeries(a).then((groups) => {
      if (!groups.length) return;
      box.replaceChildren(
        el("h4", {}, t("chart.title")),
        ...groups.map(([units, series]) => chart(series, { caption: t("chart.caption", { units }), table: t("chart.table"), date: t("chart.date"), units })),
      );
    });
  }
  return box;
}

// ---- Zone notes, history, satellite view (jopa-testing; data in mexico.ts, satview.ts) ----

// Simple mode's popup for an area: what it is, what changed, and a button to the full card.
function simpleArea(a: AreaView): Node {
  const note = zoneNote(a.id, a.center);
  const more = el("button", { type: "button", className: "primary" }, t("simple.details"));
  more.onclick = () => {
    setMode("technical");
    if (!opened.includes(a.id)) toggle(a.id);
  };
  return el(
    "div",
    { className: "event-popup" },
    el("strong", {}, a.title),
    el("p", {}, ...a.types.map((id) => el("span", { className: "tag" }, shortLabel(id)))),
    el("p", {}, a.summary),
    ...(note ? [el("p", { className: "muted" }, tx(note.changes, lang()))] : []),
    el("p", {}, more),
  );
}

const lang = () => settings.lang;

// Source names, linked when there is a link. Built as nodes, never HTML.
function sourceList(sources: Source[]): Node {
  return el(
    "p",
    { className: "muted sources" },
    ...sources.flatMap((s, i) => {
      const node = s.url ? el("a", { href: s.url, target: "_blank", rel: "noopener noreferrer" }, s.name) : el("span", {}, s.name);
      return i ? ["; ", node] : [node];
    }),
  );
}

// A small filled silhouette in its group color (lists, timeline rows, popups).
function typeIcon(type: string): SVGSVGElement {
  const ic = icon(type, "ticon sm on");
  ic.style.color = typeColor(type);
  return ic;
}

// What changed in the zone, plants and animals included. Empty when the zone has no notes.
function changesSection(a: AreaView, heading: boolean): Node[] {
  const note = zoneNote(a.id, a.center);
  if (!note) return [];
  return [
    ...(heading ? [el("h4", {}, t("zone.changes"))] : []),
    el("p", {}, tx(note.changes, lang())),
    el("h5", {}, t("zone.nature")),
    el("p", {}, tx(note.nature, lang())),
    el("details", {}, el("summary", {}, t("zone.sources")), sourceList(note.sources)),
  ];
}

const sevLabel = (n: number) => t(`sev.${Math.max(0, Math.min(3, n))}` as Key);

function historyPopup(e: HistoryEvent): Node {
  return el(
    "div",
    { className: "event-popup" },
    el("strong", {}, tx(e.title, lang())),
    el("p", { className: "muted" }, `${e.date} · ${shortLabel(e.type)} · ${sevLabel(e.severity)}`),
    el("p", {}, tx(e.impact, lang())),
    sourceList(e.sources),
  );
}

function historyItem(e: HistoryEvent): HTMLDetailsElement {
  return el(
    "details",
    { className: "hist" },
    el("summary", {}, el("time", { dateTime: e.date }, e.date.slice(0, 4)), typeIcon(e.type), el("strong", {}, tx(e.title, lang()))),
    el("p", {}, tx(e.impact, lang())),
    sourceList(e.sources),
  );
}

// Remarkable events that touched this zone: a strip of years with one mark per event (click a
// mark to open its row), then the rows, oldest first.
function historySection(a: AreaView): Node[] {
  const events = zoneHistory(HISTORY, a.bbox);
  const head = el("h4", {}, t("zone.history"));
  if (!events.length) return [head, el("p", { className: "muted" }, t("zone.history.none"))];
  const first = Math.min(1975, +events[0].date.slice(0, 4)), last = new Date().getUTCFullYear();
  const items = events.map(historyItem);
  const strip = el("div", { className: "years" });
  strip.setAttribute("role", "group");
  strip.setAttribute("aria-label", t("zone.history"));
  events.forEach((e, i) => {
    const label = `${e.date.slice(0, 4)} · ${tx(e.title, lang())}`;
    const mark = el("button", { type: "button", className: `mark s${e.severity}`, title: label });
    mark.setAttribute("aria-label", label);
    mark.style.left = `${((+e.date.slice(0, 4) - first) / Math.max(1, last - first)) * 100}%`;
    mark.style.setProperty("--c", typeColor(e.type));
    mark.onclick = () => {
      items[i].open = true;
      items[i].scrollIntoView({ block: "nearest" });
      items[i].querySelector("summary")?.focus();
    };
    strip.append(mark);
  });
  const axis = el("div", { className: "years-axis" }, el("span", {}, String(first)), el("span", {}, String(last)));
  return [head, strip, axis, el("ol", { className: "timeline history" }, ...items.map((d) => el("li", {}, d)))];
}

// Satellite view: "now" and "before" pictures from NASA GIBS with a swipe to compare. Searches are
// cached, because the cards are rebuilt on every filter change.
const MONTHS = [1, 3, 6, 12, 24, 60, 120];
const satViews = new Map<string, { layer: string; ago: number; swipe: number }>();
const satCache = new Map<string, Promise<Found | undefined>>();

function satFind(layerId: string, bbox: AreaView["bbox"], from: Date): Promise<Found | undefined> {
  const layer = SAT_LAYERS.find((l) => l.id === layerId) ?? SAT_LAYERS[0];
  const key = `${layer.id}|${bbox.join(",")}|${isoDay(from)}`;
  let found = satCache.get(key);
  if (!found) {
    found = findClear(layer, bbox, from, layer.daily ? 12 : 60);
    satCache.set(key, found);
  }
  return found;
}

function satSection(a: AreaView): Node {
  const wide = a.bbox[2] - a.bbox[0] > 1.5; // a region or the whole country: daily VIIRS, not 30 m HLS
  const v = satViews.get(a.id) ?? { layer: wide ? "viirs" : "hls", ago: 3, swipe: 50 };
  satViews.set(a.id, v);
  const layerId = () => (simple() ? (wide ? "viirs" : "hls") : v.layer);

  const status = el("p", { className: "muted" });
  const after = el("img", { className: "sat-now", alt: "" });
  const before = el("img", { className: "sat-before", alt: "" });
  const swipe = el("input", { type: "range", min: "0", max: "100", step: "1", value: String(v.swipe), className: "swipe" });
  swipe.setAttribute("aria-label", t("sat.swipe"));
  const frame = el("div", { className: "compare" }, after, before, el("span", { className: "tag-now" }, t("sat.now")), el("span", { className: "tag-before" }, t("sat.before")), swipe);
  frame.hidden = true;
  const setSwipe = () => frame.style.setProperty("--x", `${(v.swipe = +swipe.value)}%`);
  swipe.oninput = setSwipe;
  setSwipe();
  const credit = el("p", { className: "muted sources" });

  const agoOut = el("output");
  const ago = el("input", { type: "range", id: `sat-ago-${a.id}`, min: "0", max: String(MONTHS.length - 1), step: "1", value: String(v.ago) });
  const select = el("select", { id: `sat-layer-${a.id}` }, ...SAT_LAYERS.map((l) => el("option", { value: l.id, selected: l.id === v.layer }, t(`sat.layer.${l.id}` as Key))));

  const label = () => {
    agoOut.textContent = t("sat.ago.value", { n: MONTHS[+ago.value] });
    ago.setAttribute("aria-valuetext", agoOut.textContent);
  };
  let run = 0;
  const load = () => {
    const mine = ++run;
    label();
    frame.hidden = true;
    credit.textContent = "";
    status.textContent = t("sat.finding");
    const today = new Date(Date.now() - 86400000); // GIBS publishes about a day late
    const then = new Date(today.getTime() - MONTHS[+ago.value] * 30.44 * 86400000);
    const id = layerId();
    Promise.all([satFind(id, a.bbox, today), satFind(id, a.bbox, then)]).then(([now, old]) => {
      if (mine !== run) return; // a newer choice replaced this one
      if (!now || !old) {
        status.textContent = t("sat.none", { n: id === "hls" ? 60 : 12 });
        return;
      }
      after.src = now.url;
      before.src = old.url;
      after.alt = `${t("sat.now")}: ${now.date}`;
      before.alt = `${t("sat.before")}: ${old.date}`;
      status.textContent = t("sat.swipe");
      frame.hidden = false;
      credit.textContent = `${t("sat.credit", { layer: now.layer, date: now.date })} ${t("sat.credit", { layer: old.layer, date: old.date })}`;
    });
  };
  ago.oninput = label; // the label follows the thumb; the search waits for the release
  ago.onchange = () => {
    v.ago = +ago.value;
    load();
  };
  select.onchange = () => {
    v.layer = select.value;
    load();
  };
  load();
  return el(
    "div",
    { className: "sat" },
    el("h4", {}, t("sat.title")),
    ...(simple() ? [] : [el("label", { htmlFor: select.id }, t("sat.layer")), select]),
    el("label", { htmlFor: ago.id }, t("sat.ago"), " ", agoOut),
    ago,
    status,
    frame,
    credit,
    el("p", { className: "muted small" }, t("sat.note")),
  );
}

// ---- Most destructive recent events (left panel) ----

const recentList = $("recent-list");
const RECENT_SINCE = 2015;

function renderRecent() {
  $("recent-note").textContent = t("recent.since", { year: RECENT_SINCE });
  // The type filters apply here too, so ticking off "Earthquakes" hides quakes everywhere.
  const shown = mostDestructive(HISTORY.filter((e) => !isType(e.type) || ticked.has(e.type)), RECENT_SINCE, simple() ? 5 : 8);
  recentList.replaceChildren(
    ...shown.map((e) =>
      el(
        "li",
        {},
        el(
          "button",
          {
            type: "button", className: "result",
            onclick: () => {
              setSpin(false);
              globe.openInfo(e.places[0][0], e.places[0][1], historyPopup(e), 6);
            },
          },
          el("strong", {}, typeIcon(e.type), tx(e.title, lang())),
          el("span", { className: "muted" }, `${e.date.slice(0, 7)} · ${sevLabel(e.severity)}`),
        ),
      ),
    ),
  );
  if (!shown.length) recentList.append(el("li", { className: "muted" }, t("list.none")));
}

// ---- Infrastructure risks near the user (left panel) ----

type From = { pos: [number, number]; kind: "you" | "coords" | "area"; name?: string };
let infraFrom: From | undefined;
const infraRadius = $<HTMLInputElement>("infra-radius"), infraList = $("infra-list"), infraStatus = $("infra-status");
// Always named in text too (status chip), never by color alone.
const STATUS_COLOR: Record<Status, string> = { fast: "#e5484d", watch: "#f5a524", ok: "#3fb950", unknown: "#8eb1c7" };

function setInfraFrom(pos: [number, number], kind: From["kind"], name?: string) {
  infraFrom = { pos, kind, name };
  renderInfra();
}

function statusChip(st: Status): HTMLElement {
  const chip = el("span", { className: "status" }, t(`status.${st}` as Key));
  chip.style.setProperty("--c", STATUS_COLOR[st]);
  return chip;
}

function infraBody(site: Infra): Node[] {
  const measured = site.mmYr !== undefined ? t("infra.rate", { n: Math.abs(site.mmYr) }) : site.reported ? t("infra.reported") : t("infra.nodata");
  return [
    el("p", {}, tx(site.note, lang())),
    el("p", { className: "muted" }, `${measured} ${t("infra.threshold", { n: INFRA_THRESHOLDS[site.kind][1] })}`),
    el("details", {}, el("summary", {}, t("infra.learn")), el("p", {}, tx(LEARN[site.kind], lang()))),
    sourceList(site.sources),
  ];
}

function openInfra(id: string) {
  const site = INFRA.find((s) => s.id === id);
  if (!site) return;
  setSpin(false);
  globe.openInfo(
    site.lon, site.lat,
    el("div", { className: "event-popup" }, el("strong", {}, site.name), el("p", {}, statusChip(statusOf(site)), " ", t(`kind.${site.kind}` as Key)), ...infraBody(site)),
    7,
  );
}

function renderInfra() {
  const r = +infraRadius.value;
  const value = t("infra.radius.value", { n: r });
  $("infra-radius-out").textContent = value;
  infraRadius.setAttribute("aria-valuetext", value);
  globe.setInfra(INFRA.map((s) => ({ id: s.id, lon: s.lon, lat: s.lat, color: STATUS_COLOR[statusOf(s)] })), openInfra);
  if (!infraFrom) {
    infraStatus.textContent = t("infra.pick");
    infraList.replaceChildren();
    return;
  }
  const place = infraFrom.kind === "you" ? t("infra.place.you") : infraFrom.kind === "coords" ? t("infra.place.coords") : t("infra.place.area", { name: infraFrom.name ?? "" });
  infraStatus.textContent = t("infra.from", { place });
  const near = infraNear(INFRA, infraFrom.pos, r).slice(0, simple() ? 5 : 12);
  infraList.replaceChildren(
    ...near.map(({ site, km }) =>
      el(
        "li",
        {},
        el(
          "details",
          { className: "infra-item" },
          el(
            "summary",
            {},
            statusChip(statusOf(site)),
            el("strong", {}, site.name),
            el("span", { className: "muted" }, `${t(`kind.${site.kind}` as Key)} · ${t("infra.km", { n: Math.round(km) })}`),
          ),
          ...infraBody(site),
        ),
      ),
    ),
  );
  if (!near.length) infraList.append(el("li", { className: "muted" }, t("infra.none", { n: r })));
}

infraRadius.oninput = renderInfra;
// The browser asks the user first; nothing is stored or sent anywhere.
$("infra-locate").onclick = () => {
  if (!navigator.geolocation) {
    infraStatus.textContent = t("infra.denied");
    return;
  }
  infraStatus.textContent = t("infra.locating");
  navigator.geolocation.getCurrentPosition(
    (p) => {
      const pos: [number, number] = [p.coords.longitude, p.coords.latitude];
      setInfraFrom(pos, "you");
      setSpin(false);
      globe.goTo(pos[0], pos[1]);
    },
    () => (infraStatus.textContent = t("infra.denied")),
    { enableHighAccuracy: false, timeout: 15000, maximumAge: 600000 },
  );
};

// ---- Live data from the back end (optional: the app works without it) ----

async function loadLive() {
  seriesCache.clear();
  try {
    const res = await fetch(new URL("manifest.json", BASE));
    if (!res.ok) throw new Error(String(res.status));
    const manifest: Manifest = await res.json();
    if (supportedVersion(manifest.contract_version)) {
      // events.geojson is optional (older back ends have none); the areas still load without it.
      reports = await fetch(new URL("events.geojson", BASE))
        .then((r) => (r.ok ? r.json() : { features: [] }))
        .then((g) => g.features ?? [])
        .catch(() => []);
      live = manifest.areas.map((a) => toAreaView(a, reports));
      setStatus("status.connected", { areas: live.length, events: reports.length });
    } else {
      live = [];
      reports = [];
      setStatus("status.version", { version: manifest.contract_version }, true);
    }
  } catch {
    live = [];
    reports = [];
    setStatus("status.offline");
  }
  render();
  stagger = false;
}

// ---- Live disaster feeds (live.geojson; optional, like everything from the back end) ----

liveToggle.onchange = render;
// Simple mode lists fewer events at a time.
const livePage = () => (simple() ? 6 : LIVE_PAGE);
liveMore.onclick = () => {
  liveLimit += livePage();
  renderLiveList();
};

// Live events are worldwide and from the last 24 hours; one slider picks how dangerous.
const liveLevel = $<HTMLInputElement>("live-level");
const liveView = () => ({ now: Date.now(), days: 1, minSeverity: +liveLevel.value });
function showLiveControls() {
  const level = t(`level.${liveLevel.value}` as Key);
  $("live-level-out").textContent = level;
  liveLevel.setAttribute("aria-valuetext", level);
}
liveLevel.oninput = () => {
  liveLimit = livePage();
  showLiveControls();
  render();
};

// One row: what, where, type, how long ago, who reported it, and how dangerous when serious.
function liveRow(f: LiveFeature, now: number, fmt: Intl.RelativeTimeFormat): HTMLElement {
  const p = f.properties;
  const sev = severityOf(f);
  return el(
    "li",
    {},
    el(
      "button",
      {
        type: "button", className: "result",
        onclick: () => {
          setSpin(false);
          globe.openLive(p);
        },
      },
      el("strong", {}, typeIcon(p.category), p.title),
      el("span", { className: "where" }, liveWhere(p)),
      el("span", { className: "muted" }, `${shortLabel(p.category)} · ${fmt.format(...ago(p.date, now))} · ${SOURCE_SHORT[p.source] ?? p.source}`),
      ...(sev >= 2 ? [el("span", { className: `sev s${sev}` }, sevLabel(sev))] : []),
    ),
  );
}

// "Happening now": the most dangerous events first, then every event, newest first.
function renderLiveList() {
  const view = liveView();
  const on = liveToggle.checked;
  const rows = on ? liveFiltered(liveEvents, ticked, isType, view) : [];
  const fmt = new Intl.RelativeTimeFormat(settings.lang, { numeric: "auto" });
  // "Most dangerous right now" follows the filters and the time window, whatever the danger slider says.
  const top = on ? topLive(liveFiltered(liveEvents, ticked, isType, { ...view, minSeverity: 0 })) : [];
  $("live-top").hidden = !on || !liveUpdated;
  $("live-top-list").replaceChildren(...(top.length ? top.map((f) => liveRow(f, view.now, fmt)) : [el("li", { className: "muted" }, t("live.top.none"))]));
  liveListEl.replaceChildren(...rows.slice(0, liveLimit).map((f) => liveRow(f, view.now, fmt)));
  if (on && liveUpdated && !rows.length) liveListEl.append(el("li", { className: "muted" }, t("live.none")));
  const left = rows.length - liveLimit;
  liveMore.hidden = left <= 0;
  liveMore.textContent = t("live.showmore", { n: Math.min(left, livePage()) });
}

function showLiveStatus() {
  liveStatus.textContent = liveUpdated
    ? [
        t("live.status", { n: liveEvents.length, time: new Date(liveUpdated).toLocaleString(settings.lang, { dateStyle: "short", timeStyle: "short" }) }),
        liveEvery ? t("live.every", { n: liveEvery }) : "",
      ].join(" ").trim()
    : t("live.offline");
}

async function loadLiveFeeds() {
  try {
    const res = await fetch(new URL("live.geojson", BASE));
    if (!res.ok) throw new Error(String(res.status));
    const doc = await res.json();
    liveEvents = doc.features ?? [];
    liveUpdated = doc.generated_at ?? "";
    liveEvery = Number(doc.refresh_minutes) || 0;
  } catch {
    liveEvents = [];
    liveUpdated = "";
    liveEvery = 0;
  }
  showLiveStatus();
  render();
}

// Live updates exist only on the back-end server, not on the static build: give up quietly there.
const events = new EventSource(new URL("events", BASE));
events.addEventListener("manifest", loadLive);
events.addEventListener("live", loadLiveFeeds);
setInterval(loadLiveFeeds, 10 * 60 * 1000); // also refresh when the push stream is gone
events.onerror = () => events.readyState === EventSource.CONNECTING || events.close();

// ---- View switch, auto-rotate and view wheel ----

const viewButtons: Record<ViewMode, HTMLElement> = { globe: $("view-globe"), closeup: $("view-closeup") };
for (const [mode, button] of Object.entries(viewButtons) as [ViewMode, HTMLElement][]) {
  button.onclick = () => {
    globe.setView(mode);
    for (const [m, b] of Object.entries(viewButtons)) b.setAttribute("aria-pressed", String(m === mode));
  };
}

const spinBtn = $("spin-btn");
function setSpin(on: boolean) {
  globe.setSpin(on);
  spinBtn.setAttribute("aria-pressed", String(on));
}
spinBtn.onclick = () => setSpin(spinBtn.getAttribute("aria-pressed") !== "true");

// Zoom slider: follows the map, and the map follows it.
const zoomSlider = $<HTMLInputElement>("zoom");
zoomSlider.oninput = () => globe.zoom.set(+zoomSlider.value);
globe.zoom.onChange((z) => (zoomSlider.value = String(z)));
zoomSlider.value = String(globe.zoom.get());

const wheel = $("wheel"), wheelBtn = $("wheel-btn");
const showWheel = (on: boolean) => {
  wheel.hidden = !on;
  wheelBtn.setAttribute("aria-pressed", String(on));
};
wheelBtn.onclick = () => showWheel(!!wheel.hidden);
const buildWheel = () =>
  createWheel(wheel, globe.tools, () => {
    showWheel(false);
    wheelBtn.focus();
  });

// ---- Side panels: the arrows on the edges of the globe push them away and pull them back ----

function showPanel(id: "nav" | "detail", on: boolean) {
  $(id).inert = !on;
  $(id).parentElement!.classList.toggle(`no-${id}`, !on);
  $(`${id}-toggle`).setAttribute("aria-expanded", String(on));
}
for (const id of ["nav", "detail"] as const) {
  $(`${id}-toggle`).onclick = () => showPanel(id, $(`${id}-toggle`).getAttribute("aria-expanded") !== "true");
}

// ---- Accessibility menu and language ----

const dialog = $<HTMLDialogElement>("settings");

// Everything that holds interface text, rebuilt in the current language.
function applyLanguage() {
  document.documentElement.lang = settings.lang;
  for (const node of document.querySelectorAll<HTMLElement>("[data-i18n]")) node.textContent = t(node.dataset.i18n as Key);
  for (const node of document.querySelectorAll<HTMLElement>("[data-i18n-label]")) node.setAttribute("aria-label", t(node.dataset.i18nLabel as Key));
  $("mode-seg").replaceChildren(
    ...(["simple", "technical"] as const).map((mode) => {
      const input = el("input", { type: "radio", name: "mode", value: mode, checked: settings.mode === mode });
      input.onchange = () => setMode(mode, true);
      return el("label", {}, input, el("span", {}, t(`mode.${mode}`)));
    }),
  );
  buildFilters();
  buildWheel();
  showStatus();
  showLiveStatus();
  showLiveControls();
  render();
  renderSettings(dialog, settings, onSetting);
}

// Switch between Simple and Technical. `animate` cross-fades the two panels (see
// `view-transition-name` in the stylesheet); without it the switch is immediate, for callers that
// act on the new mode right away (the "See all details" button).
function setMode(mode: Settings["mode"], animate = false) {
  const flip = () => {
    settings.mode = mode;
    saveSettings(settings);
    document.documentElement.dataset.mode = mode;
    for (const r of document.querySelectorAll<HTMLInputElement>('input[name="mode"]')) r.checked = r.value === mode;
    buildFilters();
    render();
  };
  if (animate && document.startViewTransition) document.startViewTransition(flip);
  else flip();
}

function onSetting(key: keyof Settings) {
  if (key === "wheel") wheel.dataset.size = settings.wheel;
  if (key === "texture") globe.setTexture(settings.texture);
  if (key === "lang") {
    setLang(settings.lang);
    applyLanguage();
    // The menu was rebuilt in the new language; put the keyboard back where it was.
    dialog.querySelector<HTMLElement>('input[name="lang"]:checked')?.focus();
  }
}

$("settings-btn").onclick = () => dialog.showModal();

wheel.dataset.size = settings.wheel;
applyLanguage();
loadLive();
loadLiveFeeds();
// Scope is Mexico (jopa-testing): the globe stays on it at first instead of turning away.
// The Auto-rotate button still turns the Earth.
setSpin(false);

// ---- Tour ----

const tourBtn = $("tour-btn");
tourBtn.onclick = () => startTour(tourBtn);
try {
  if (!localStorage.getItem("tour-seen")) {
    localStorage.setItem("tour-seen", "1");
    startTour(tourBtn);
  }
} catch {
  // Storage blocked (private window): the tour stays available from the button.
}
