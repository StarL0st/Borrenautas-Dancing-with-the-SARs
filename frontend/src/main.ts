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
import countriesUrl from "./assets/countries.json?url";
import {
  ago, datesFor, inFilter, inside, layerAt, liveList, liveShown, liveWhere, polarizations, SOURCE_SHORT, supportedVersion, toAreaView,
  type AreaView, type EventFeature, type Layer, type LiveFeature, type Manifest,
} from "./logic";
import { findClear, isoDay, SAT_LAYERS, type Found } from "./satview";
import { collectLive, LIVE_MINUTES, recent } from "./livefeeds";
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
const timebar = $("timebar"); // date sliders of the open areas, at the bottom of the globe
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
// The home, auto-rotate and view wheel squares join MapLibre's own column of + and - buttons.
const column = document.querySelector(".maplibregl-ctrl-top-right")!;
column.prepend($("ctrl-home"));
column.append($("ctrl-view"));

// ---- Left panel: filters ----

// How many types each group shows before "Show more": two rows of three tiles in Simple mode.
const FIRST_TYPES = () => 6;
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

// ---- Left panel: country search ----

// Natural Earth outlines (public domain), with each country's name in the three languages.
type Country = { id: string; en: string; es: string; de: string; at: [number, number]; polys: number[][][][] };
let countries: Country[] = [];
const picked = new Set<string>(); // ids of the countries searched for; empty means everywhere
const inPicked = (lon: number, lat: number) => !picked.size || countries.some((c) => picked.has(c.id) && inside(lon, lat, c.polys));
const countrySearch = $<HTMLInputElement>("country-search");

function buildCountries() {
  const chosen = countries.filter((c) => picked.has(c.id));
  countrySearch.placeholder = t("country.search");
  $("country-names").replaceChildren(...countries.map((c) => el("option", { value: c[settings.lang] })));
  $("country-status").textContent = chosen.length ? t("country.note") : "";
  $("country-picked").replaceChildren(
    ...chosen.map((c) => {
      const remove = el("button", { type: "button", className: "chip", onclick: () => pickCountry(c, false) }, c[settings.lang], " ×");
      remove.setAttribute("aria-label", t("country.remove", { name: c[settings.lang] }));
      return el("li", {}, remove);
    }),
  );
  globe.setCountries(chosen.map((c) => c.polys));
}

function pickCountry(c: Country, on: boolean) {
  if (on) picked.add(c.id);
  else picked.delete(c.id);
  buildCountries();
  render();
  if (on) {
    setSpin(false); // or the globe would drift away from the country
    globe.lookAt(c.at);
  } else countrySearch.focus(); // the chip that had the focus is gone
}

// `loose`: Enter also takes the first country that starts with what was typed.
function searchCountry(loose: boolean) {
  const typed = countrySearch.value.trim().toLowerCase();
  if (!typed) return;
  const name = (c: Country) => c[settings.lang].toLowerCase();
  const found = countries.find((c) => name(c) === typed) ?? (loose ? countries.find((c) => name(c).startsWith(typed)) : undefined);
  if (found) {
    countrySearch.value = "";
    pickCountry(found, true);
  } else if (loose) $("country-status").textContent = t("country.none");
}
// Choosing from the suggestions arrives as a replacement (or a plain event), typing does not:
// typing "Niger" must not pick Niger on the way to Nigeria.
countrySearch.oninput = (e) => ((e as InputEvent).inputType ?? "insertReplacementText") === "insertReplacementText" && searchCountry(false);
$<HTMLFormElement>("country-form").onsubmit = (e) => {
  e.preventDefault();
  searchCountry(true);
};
fetch(countriesUrl)
  .then((r) => r.json())
  .then((list: Country[]) => {
    countries = list;
    buildCountries();
    render();
  })
  .catch(() => (countrySearch.disabled = true)); // without the outlines there is nothing to search

// ---- Left panel: coordinates ----

$<HTMLFormElement>("coords").onsubmit = (e) => {
  e.preventDefault(); // the browser has already checked both numbers are present and in range
  setSpin(false);
  globe.goTo(+$<HTMLInputElement>("lon").value, +$<HTMLInputElement>("lat").value);
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
  const shown = areas().filter((a) => inFilter(a, ticked) && inPicked(...a.center));
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
    reports.filter((e) => eventShown(e) && inPicked(e.properties.lon, e.properties.lat)).map((e) => ({ ...e, properties: { ...e.properties, color: typeColor(e.properties.category) } })),
  );
  renderLiveList();
  globe.setLive(
    liveToggle.checked
      ? liveHere().filter((f) => liveShown(f, ticked, isType)).map((f) => ({ ...f, properties: { ...f.properties, color: typeColor(f.properties.category) } }))
      : [],
  );
  globe.keepOverlays(opened);
  timebar.replaceChildren(); // each open area's card puts its date slider back
  cards.replaceChildren(
    ...(opened.length ? opened.map((id) => card(shown.find((a) => a.id === id)!)) : [el("p", { className: "muted" }, t("cards.empty"))]),
  );
  entering = undefined;
}

// Clicking a dot or a list row opens the area as a tab; clicking again closes it.
function toggle(id: string) {
  const a = areas().find((x) => x.id === id);
  if (!a) return;
  const opening = !opened.includes(id);
  opened = opening ? [id, ...opened] : opened.filter((x) => x !== id);
  if (opening) {
    showPanel("detail", true); // an area opened from the globe must not land in a hidden panel
    collapsed.delete(id);
    entering = id;
    setSpin(false); // or the globe would drift away from the area just opened
    globe.focus(a);
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
    el("h4", {}, t(simple() ? "simple.changes" : "card.timeline")),
    ...(simple() && passes.length ? [el("p", {}, t("simple.passes", { n: passes.length, from: passes[0], to: passes.at(-1)! }))] : []),
    timeline.length ? el("ol", { className: "timeline" }, ...timeline) : el("p", { className: "muted" }, t("card.noreports")),
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
  // The date slider lives on the globe, where the picture it changes is.
  timebar.append(
    el("div", { className: a.id === entering ? "time-row enter" : "time-row" }, el("label", { htmlFor: slider.id }, el("strong", {}, a.title), " ", dateOut), slider),
  );
  if (simple()) return [el("h4", {}, t("simple.picture")), info];
  return [
    el("h4", {}, t("card.radar")),
    el("label", { htmlFor: polSelect.id }, t("radar.layer")), polSelect,
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

// Satellite view (from the `jopa-testing` branch): "now" and "before" pictures from NASA GIBS with a swipe to compare. Searches are
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
    const pair = (layer: string) => Promise.all([satFind(layer, a.bbox, today), satFind(layer, a.bbox, then)]);
    // The sharp 30 m pictures skip many days and the open sea: fall back to the daily ones.
    pair(id).then((found) => (id === "hls" && !(found[0] && found[1]) ? pair("viirs") : found)).then(([now, old]) => {
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
  );
}

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
const liveHere = () => liveEvents.filter((f) => inPicked(f.properties.lon, f.properties.lat));
liveMore.onclick = () => {
  liveLimit += LIVE_PAGE;
  renderLiveList();
};

// A small filled silhouette in its group color (lists, timeline rows, popups).
function typeIcon(type: string): SVGSVGElement {
  const ic = icon(type, "ticon sm on");
  ic.style.color = typeColor(type);
  return ic;
}

// "Happening now": one row per event, saying what, where and when, newest first.
function renderLiveList() {
  const rows = liveToggle.checked ? liveList(liveHere(), ticked, isType) : [];
  const fmt = new Intl.RelativeTimeFormat(settings.lang, { numeric: "auto" });
  const now = Date.now();
  liveListEl.replaceChildren(
    ...rows.slice(0, liveLimit).map((f) => {
      const p = f.properties;
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
        ),
      );
    }),
  );
  if (liveToggle.checked && liveUpdated && !rows.length) liveListEl.append(el("li", { className: "muted" }, t("live.none")));
  const left = rows.length - liveLimit;
  liveMore.hidden = left <= 0;
  liveMore.textContent = t("live.showmore", { n: Math.min(left, LIVE_PAGE) });
}

function showLiveStatus() {
  liveStatus.textContent = liveUpdated
    ? [
        t("live.status", { n: liveEvents.length, time: new Date(liveUpdated).toLocaleString(settings.lang, { dateStyle: "short", timeStyle: "short" }) }),
        liveEvery ? t("live.every", { n: liveEvery }) : "",
      ].join(" ").trim()
    : t("live.offline");
}

let askedAt = 0; // when the page last asked the sources itself

// A running back end keeps live.geojson fresh, and its file is used. Without one (a static copy
// of the app, or a file nobody rewrites) the page asks the public sources itself, so the events
// refresh wherever the app is opened.
async function loadLiveFeeds() {
  const now = Date.now();
  let doc: { features?: LiveFeature[]; generated_at?: string; refresh_minutes?: number } | undefined;
  try {
    const res = await fetch(new URL("live.geojson", BASE), { cache: "no-store" }); // never an old copy
    if (res.ok) doc = await res.json();
  } catch {
    // no back end and no file: the sources are asked directly below
  }
  if (doc?.generated_at && now - Date.parse(doc.generated_at) < 2 * LIVE_MINUTES * 60000) {
    liveEvents = doc.features ?? [];
    liveUpdated = doc.generated_at;
    liveEvery = Number(doc.refresh_minutes) || 0;
  } else if (now - askedAt > (LIVE_MINUTES - 1) * 60000) {
    const got = await collectLive();
    // With no source answering (offline), what is already on the globe stays until it expires.
    if (got.ok) {
      askedAt = now;
      liveEvents = got.features;
      liveUpdated = got.generated_at;
      liveEvery = LIVE_MINUTES;
    }
  }
  liveEvents = recent(liveEvents, Date.now()); // events past 24 hours leave the globe and the list
  showLiveStatus();
  render();
}

// Live updates exist only on the back-end server, not on the static build: give up quietly there.
const events = new EventSource(new URL("events", BASE));
events.addEventListener("manifest", loadLive);
events.addEventListener("live", loadLiveFeeds);
setInterval(loadLiveFeeds, 5 * 60 * 1000); // look again; the sources themselves are asked every 15 minutes at most
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

// ---- Welcome screen: the Earth's horizon turning under the title, until Start ----

// Everything but the camera: the page waits behind the welcome screen, inert.
function homeUi(on: boolean) {
  document.body.classList.toggle("at-home", on);
  for (const part of document.querySelectorAll<HTMLElement>("header, main")) part.inert = on;
  showPanel("nav", !on);
  showPanel("detail", !on);
  for (const [m, b] of Object.entries(viewButtons)) b.setAttribute("aria-pressed", String(m === "globe"));
}

// Start sends the name round the Earth letter by letter, like type on a ring: across the front
// of the globe, round its side and out of sight behind it. The house button brings the letters
// back up from behind the Earth, one by one, into the title.
// Each letter is drawn twice: once over the map and once under it, where the Earth itself hides
// it (the map is see-through around the globe). A letter shows in one layer or the other.
const nameEl = document.querySelector<HTMLElement>(".home-name")!;
nameEl.replaceChildren(...[...nameEl.textContent!].map((ch) => el("span", {}, ch)));
const layers = [$("fly-front"), $("fly-back")];
const calm = matchMedia("(prefers-reduced-motion: reduce)");
const wait = (ms: number) => new Promise((done) => setTimeout(done, ms));
const LAP_MS = 2000; // one letter's whole trip
const GAP_MS = 55; // between one letter and the next
let orbiting = false; // an animation is running: Start and the house button wait for it

// The middle of the whole globe on screen, with the side panels in place or pushed away.
// The panel widths and the phone layout mirror the stylesheet (`.app`, `.stage`).
function globeCenter(panels: boolean) {
  const m = document.querySelector("main")!.getBoundingClientRect();
  const wide = !matchMedia("(max-width: 900px)").matches;
  const left = m.left + (panels && wide ? 300 : 0), right = m.right - (panels && wide ? 360 : 0);
  const bottom = wide ? m.bottom : m.top + innerHeight * (panels ? 0.6 : 1);
  return { x: (left + right) / 2, y: (m.top + bottom) / 2 };
}
type Point = ReturnType<typeof globeCenter>;

// One letter's trip from its place in the title (first frame) to behind the globe (last frame):
// it joins the ring at the globe's left edge, crosses the front, rounds the right edge and ends
// behind the middle. `behind` picks the layer under the map.
function letterPath(home: Point, g: Point, far: number, size: number, behind: boolean): Keyframe[] {
  const STEPS = 27; // the right edge falls exactly on step 18
  return Array.from({ length: STEPS + 1 }, (_, i) => {
    const u = i / STEPS, turn = ((-90 + 270 * u) * Math.PI) / 180;
    const k = Math.min(1, u / 0.35), join = k * k * (3 - 2 * k); // leaving the title for the ring
    // The ring is tipped toward the viewer: the front runs a little lower than the back.
    const ringX = g.x + far * Math.sin(turn), ringY = g.y + 0.12 * far * Math.cos(turn);
    const scale = 1 + (size * (0.75 + 0.25 * Math.cos(turn)) - 1) * join; // smaller on the far side
    return {
      // Each letter faces outward from the ring, so it turns edge-on as it rounds the side.
      transform: `translate(${home.x + (ringX - home.x) * join}px, ${home.y + (ringY - home.y) * join}px) translate(-50%, -50%) scale(${scale}) perspective(600px) rotateY(${turn * join}rad)`,
      opacity: i > 18 === behind ? 1 : 0,
    };
  });
}

// A copy of one letter of the name in a layer, with where that letter sits in the title.
function flyer(span: HTMLElement, layer: HTMLElement) {
  const type = getComputedStyle(nameEl), r = span.getBoundingClientRect();
  const letter = el("span", { className: "fly" }, span.textContent!);
  Object.assign(letter.style, { fontSize: type.fontSize, fontWeight: type.fontWeight, fontFamily: type.fontFamily });
  layer.append(letter);
  return { letter, home: { x: r.left + r.width / 2, y: r.top + r.height / 2 } };
}
const letters = () => [...nameEl.children] as HTMLElement[];
const landed = (runs: Promise<unknown>[]) => Promise.all(runs).then(() => layers.forEach((layer) => layer.replaceChildren()));

// Fly every letter out and round the globe. Resolves when the last one is behind it.
function flyName(g: Point) {
  const spans = letters();
  const far = Math.min(globe.roughRadius * 1.15, innerWidth * 0.46);
  const size = Math.min(1, 46 / parseFloat(getComputedStyle(nameEl).fontSize));
  return landed(
    spans.flatMap((span, i) =>
      layers.map((layer, n) => {
        const { letter, home } = flyer(span, layer);
        // The last letter leads, so the word reads left to right as it crosses the front.
        return letter.animate(letterPath(home, g, far, size, n === 1), {
          duration: LAP_MS, delay: (spans.length - 1 - i) * GAP_MS, fill: "both", easing: "cubic-bezier(0.4, 0, 0.6, 1)",
        }).finished;
      }),
    ),
  );
}

// Coming home: every letter rises from behind the Earth's horizon straight up into its place,
// first letter first. They travel in the layer under the map, so the Earth covers them at first.
function riseName() {
  return landed(
    letters().map((span, i) => {
      const { letter, home } = flyer(span, layers[1]);
      const at = (y: number, rest: string) => `translate(${home.x}px, ${y}px) translate(-50%, -50%) ${rest}`;
      return letter.animate(
        [
          { transform: at(innerHeight + 60, "scale(0.6) perspective(600px) rotateX(-70deg)"), opacity: 1 },
          { transform: at(home.y, "scale(1) perspective(600px) rotateX(0deg)"), opacity: 1 },
        ],
        { duration: 900, delay: i * 110, fill: "both", easing: "cubic-bezier(0.23, 1, 0.32, 1)" },
      ).finished;
    }),
  );
}

async function leaveHome() {
  if (orbiting) return;
  orbiting = true;
  const move = !calm.matches;
  if (move) document.body.classList.add("orbiting"); // the flying letters stand in for the name
  homeUi(false);
  globe.welcome(false, 1700);
  $("home-btn").focus();
  if (move) {
    await flyName(globeCenter(true));
    document.body.classList.remove("orbiting");
  }
  orbiting = false;
  try {
    if (!localStorage.getItem("tour-seen")) {
      localStorage.setItem("tour-seen", "1");
      startTour(tourBtn);
    }
  } catch {
    // Storage blocked (private window): the tour stays available from the button.
  }
}

async function goHome() {
  if (orbiting) return;
  orbiting = true;
  homeUi(true);
  if (!calm.matches) {
    document.body.classList.add("orbiting"); // the name, the greeting and Start wait for the letters
    globe.welcome(true, 1200);
    await wait(800); // the horizon is nearly in place before the first letter comes up
    await riseName();
    document.body.classList.remove("orbiting");
  } else globe.welcome(true, 0);
  setSpin(!calm.matches);
  $("start").focus();
  orbiting = false;
}
$("home-btn").onclick = goHome;
$("start").onclick = leaveHome;

// ---- Accessibility menu and language ----

const dialog = $<HTMLDialogElement>("settings");

// Everything that holds interface text, rebuilt in the current language.
function applyLanguage() {
  document.documentElement.lang = settings.lang;
  for (const node of document.querySelectorAll<HTMLElement>("[data-i18n]")) node.textContent = t(node.dataset.i18n as Key);
  for (const node of document.querySelectorAll<HTMLElement>("[data-i18n-label]")) node.title = node.ariaLabel = t(node.dataset.i18nLabel as Key);
  $("mode-seg").replaceChildren(
    ...(["simple", "technical"] as const).map((mode) => {
      const input = el("input", { type: "radio", name: "mode", checked: settings.mode === mode });
      input.onchange = () => {
        const flip = () => {
          settings.mode = mode;
          saveSettings(settings);
          document.documentElement.dataset.mode = mode;
          buildFilters();
          render();
        };
        // The two panels cross-fade between modes (see `view-transition-name` in the stylesheet).
        if (document.startViewTransition) document.startViewTransition(flip);
        else flip();
      };
      return el("label", {}, input, el("span", {}, t(`mode.${mode}`)));
    }),
  );
  buildFilters();
  buildCountries();
  buildWheel();
  showStatus();
  showLiveStatus();
  render();
  renderSettings(dialog, settings, onSetting);
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
homeUi(true);
globe.welcome(true, 0);
// The Earth turns by itself on the welcome screen; opening an area or the Auto-rotate button stops it.
setSpin(!calm.matches);
$("start").focus();

// ---- Tour ----

const tourBtn = $("tour-btn");
tourBtn.onclick = () => startTour(tourBtn);
