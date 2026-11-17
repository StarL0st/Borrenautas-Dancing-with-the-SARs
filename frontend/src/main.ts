import "@fontsource/ibm-plex-sans/latin-400.css";
import "@fontsource/ibm-plex-sans/latin-600.css";
import "@fontsource/ibm-plex-mono/latin-400.css";
import "./style.css";
import { chart, type Series } from "./chart";
import { exampleAreas } from "./example-areas";
import { GROUPS, groupLabel, isType, shortLabel, shortLabelIn, typeColor, typeLabel } from "./filters";
import { createGlobe, eventInfo, liveInfo, type CityRow, type MarkerKind, type ViewMode } from "./globe";
import { setLang, t, tIn, type Key, type Lang } from "./i18n";
import { icon } from "./icons";
import { originBadge, originKey, RECORDS_CHECKED, when } from "./origin";
import type { ReportEnv, ReportInput } from "./report";
import { contentKey, diffSnapshots, type Change, type ReportSnapshot } from "./report-core";
import { CLASSES, RAMPS } from "./legend";
import { topicsFor, TOPICS } from "./explain";
import { explainer, sourceLinks } from "./explain-view";
import type { RefId } from "./sources";
import { KID_FOUND, KID_TYPES, kidFact } from "./kid";
import {
  distanceKm, HISTORY, topHistory, tx, zoneHistory, zoneNote, type HistoryEvent, type Source,
} from "./mexico";
import citiesUrl from "./assets/cities.json?url";
import countriesUrl from "./assets/countries.json?url";
import {
  ago, areaAt, datesFor, flags, inFilter, inside, layerAt, overlaps, topEvents, liveList, liveShown, liveWhere, polarizations, readFriendly, severityOf, SOURCE_SHORT, stubView, supportedVersion, toAreaView,
  type AreaView, type Friendly, type EventFeature, type IndexArea, type Layer, type LiveFeature, type Manifest, type ManifestArea,
} from "./logic";
import { findClear, gibsUrl, isoDay, SAT_LAYERS, viewBox, type Found } from "./satview";
import { comparator, newCompareState, type CompareState, type Picture } from "./compare";
import { opticalDecode, radarDecode, subBox } from "./compare-core";
import { collectLive, LIVE_MINUTES, recent } from "./livefeeds";
import { livePlace, liveTitle, setCountryNames } from "./live-text";
import { loadPlaces, savePlaces } from "./places";
import { loadSettings, renderSettings, saveSettings, type Settings } from "./settings";
import { startTour } from "./tour";
import { el } from "./ui";
import { createWheel } from "./wheel";

// Live backend by default; set VITE_DATA_BASE=./data/ for the static build (contract C6).
const BASE = new URL(import.meta.env.VITE_DATA_BASE ?? "http://127.0.0.1:8765/", location.href);
// Deployed, files come from storage (BASE) and calls go to the server: set VITE_API_BASE too.
const API = new URL(import.meta.env.VITE_API_BASE ?? BASE, location.href);

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
// Contract 0.7: the page starts from index.json and fetches an area's own files when the area
// is opened or looked at up close. `loaded` holds those; without index.json (an older back
// end) everything comes at once, as before.
let lazy = false;
const loaded = new Map<string, { view: AreaView; features: EventFeature[] }>();
const loading = new Map<string, Promise<void>>();
const LOAD_ZOOM = 7; // from here in, areas in view load by themselves
const closed = new Set<string>(); // areas the visitor closed: their detections leave the map until reopened
const SUGGESTED = ["mexico", "chapala", "yucatan", "villahermosa"]; // listed until the visitor has places
let places = loadPlaces(); // the visitor's own places, positions only
let liveEvents: LiveFeature[] = []; // live.geojson: public disaster feeds, not radar detections
let liveUpdated = ""; // its generated_at, or "" when the feeds are not available
let manifestAt = ""; // the radar results' generated_at (manifest.json)
let liveEvery = 0; // how often the back end refreshes live.geojson, in minutes (0: unknown)
const ticked = new Set(GROUPS.flatMap((g) => g.items)); // filter types switched on
let stagger = true; // the area list cascades in while the page loads, not on later updates
let opened: string[] = []; // area ids open as tabs, newest first
let entering: string | undefined; // the tab that was just opened, so only it animates in
const collapsed = new Set<string>();
const views = new Map<string, { pol: string; date: string; opacity: number }>(); // radar settings per area
const seriesCache = new Map<string, Promise<[string, Series[]][]>>(); // chart data per area, by unit
const friendlyCache = new Map<string, Promise<Friendly | undefined>>(); // C8 cards per area

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

// The marker last clicked on the globe: the events it stands for are listed in the right panel.
let cluster: { kind: MarkerKind; ids: string[] } | undefined;
const CLUSTER_ROWS = 40;
const globe = createGlobe("map", settings.texture, toggle, (kind, ids) => {
  cluster = { kind, ids };
  setSpin(false); // or the group would drift away while its list is read
  showPanel("detail", true);
  render();
  $("detail").scrollTop = 0;
});
// The home, auto-rotate and view wheel squares join MapLibre's own column of + and - buttons.
const column = document.querySelector(".maplibregl-ctrl-top-right")!;
column.prepend($("ctrl-home"));
column.append($("ctrl-view"));

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

// ---- Left panel: country search ----

// Natural Earth outlines (public domain), with each country's name in the three languages.
type Country = { id: string; en: string; es: string; de: string; fr: string; ja: string; at: [number, number]; polys: number[][][][] };
let countries: Country[] = [];
const picked = new Set<string>(); // ids of the countries searched for; empty means everywhere
const inPicked = (lon: number, lat: number) => !picked.size || countries.some((c) => picked.has(c.id) && inside(lon, lat, c.polys));
const countrySearch = $<HTMLInputElement>("country-search");

function buildCountries() {
  const chosen = countries.filter((c) => picked.has(c.id));
  countrySearch.placeholder = t("country.search");
  suggestCountries();
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
// Our own suggestions under the box: phones show a <datalist> badly or not at all.
function suggestCountries() {
  const typed = countrySearch.value.trim().toLowerCase();
  const name = (c: Country) => c[settings.lang].toLowerCase();
  const open = countries.filter((c) => !picked.has(c.id) && name(c).includes(typed));
  const hits = typed ? [...open.filter((c) => name(c).startsWith(typed)), ...open.filter((c) => !name(c).startsWith(typed))].slice(0, 6) : [];
  $("country-names").replaceChildren(
    ...hits.map((c) => el("li", {}, el("button", { type: "button", className: "chip", onclick: () => ((countrySearch.value = ""), pickCountry(c, true)) }, c[settings.lang]))),
  );
}
countrySearch.oninput = suggestCountries;
$<HTMLFormElement>("country-form").onsubmit = (e) => {
  e.preventDefault();
  searchCountry(true);
};
fetch(countriesUrl)
  .then((r) => r.json())
  .then((list: Country[]) => {
    countries = list;
    setCountryNames(list); // news titles name countries in the reader's language
    buildCountries();
    render();
  })
  .catch(() => (countrySearch.disabled = true)); // without the outlines there is nothing to search

// City names on the globe; without the file the globe simply has none.
let cities: CityRow[] = [];
fetch(citiesUrl)
  .then((r) => r.json())
  .then((rows: CityRow[]) => globe.setCities((cities = rows), settings.lang))
  .catch(() => {});

// ---- Left panel: coordinates ----

$<HTMLFormElement>("coords").onsubmit = (e) => {
  e.preventDefault(); // the browser has already checked both numbers are present and in range
  setSpin(false);
  const lon = +$<HTMLInputElement>("lon").value, lat = +$<HTMLInputElement>("lat").value;
  globe.goTo(lon, lat);
};

// Ask the back end to process the typed place (needs `serve --jobs`). It shows up when ready:
// the server pushes a manifest event and the app reloads.
$("process").onclick = async () => {
  const form = $<HTMLFormElement>("coords");
  if (!form.reportValidity()) return;
  const lat = +$<HTMLInputElement>("lat").value, lon = +$<HTMLInputElement>("lon").value;
  // Already there (a city, a place someone asked for): open it, nothing to process.
  const known = lazy ? areaAt(lon, lat, areas()) : undefined;
  if (known) {
    addPlace(lon, lat);
    setStatus("status.known", { name: known.title });
    if (opened.includes(known.id)) render();
    else toggle(known.id);
    return;
  }
  setStatus("status.asking");
  try {
    const res = await fetch(new URL("sites", API), {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ lat, lon }),
    });
    if (res.status === 202 || res.status === 200) {
      // 200: cached (contract 0.5); "empty" means NISAR has nothing there.
      const answer = (await res.json().catch(() => ({}))) as { empty?: boolean };
      if (answer.empty) return setStatus("status.empty");
      setStatus("status.accepted");
      addPlace(lon, lat);
      await loadLive(); // a cached place is in the index already
    }
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

  // The list holds the visitor's own places (and whole countries); until there are any, a few
  // suggestions. Places other visitors asked for are never listed, and are drawn only once
  // their files are loaded (zoomed in over them).
  const mineIds = new Set(places.map((p) => areaAt(...p, areas())?.id));
  const waiting = lazy ? places.filter((p) => !areaAt(...p, areas())) : [];
  const own = mineIds.size > 0 || waiting.length > 0;
  const listed = !lazy ? shown : shown.filter((a) => a.kind === "mosaic" || (own ? mineIds.has(a.id) : SUGGESTED.includes(a.id)));
  const onGlobe = shown.filter((a) => !a.requested || mineIds.has(a.id) || loaded.has(a.id));

  results.replaceChildren(
    ...(lazy ? [el("li", { className: "muted" }, t(own ? "list.mine" : "list.suggested"))] : []),
    ...listed.map((a, n) => {
      const dates = a.stub ? a.stub.dates : a.events.map((e) => e.date).sort();
      const when = dates.length ? t("list.dates", { from: dates[0], to: dates.at(-1)! }) : t("list.nodates");
      const count = a.stub ? a.stub.layers : a.layers.length;
      const row = el(
        "button",
        { type: "button", className: "result", onclick: () => toggle(a.id) },
        el("strong", {}, dot(colorOf(a)), a.title),
        el("span", { className: "muted" }, a.example ? t("list.example") : `${when} · ${t("list.images", { n: count })}`),
      );
      row.setAttribute("aria-pressed", String(opened.includes(a.id)));
      const li = el("li", { className: stagger ? "stagger result-row" : "result-row" }, row);
      if (mineIds.has(a.id)) li.append(removeButton(a.title, (p) => areaAt(...p, areas())?.id === a.id));
      li.style.setProperty("--i", String(Math.min(n, 12)));
      return li;
    }),
    // Asked for, not processed yet: it turns into an area when the back end is done.
    ...waiting.map((p) =>
      el(
        "li",
        { className: "result-row" },
        el("span", { className: "result muted" }, t("list.pending", { lat: p[1].toFixed(2), lon: p[0].toFixed(2) })),
        removeButton(`${p[1].toFixed(2)}, ${p[0].toFixed(2)}`, (q) => q === p),
      ),
    ),
  );
  if (!listed.length && !waiting.length) results.append(el("li", { className: "muted" }, t("list.none")));

  const notes = [shown.some((a) => a.example) && t("banner.example"), shown.some((a) => a.synthetic) && t("banner.synthetic")].filter(Boolean);
  banner.hidden = !notes.length;
  banner.textContent = notes.join(" ");

  globe.setAreas(onGlobe.map((area) => ({ area, color: colorOf(area) })), opened);
  globe.setEvents(
    reports.filter((e) => eventShown(e) && !closed.has(e.properties.area_id) && inPicked(e.properties.lon, e.properties.lat)).map((e) => ({ ...e, properties: { ...e.properties, color: typeColor(e.properties.category) } })),
  );
  renderLiveList();
  // The globe shows exactly what the list shows: filters, time window, danger level, Mexico.
  globe.setLive(
    liveToggle.checked
      ? liveHere().filter((f) => liveShown(f, ticked, isType)).map((f) => ({ ...f, properties: { ...f.properties, color: typeColor(f.properties.category) } }))
      : [],
  );
  globe.keepOverlays(opened);
  timebar.replaceChildren(); // each open area's card puts its date slider back
  $("detail-title").textContent = $("tab-detail").textContent = t(simple() ? "kid.panel" : "h.open");
  $("detail").dataset.i18nLabel = simple() ? "kid.panel" : "h.open";
  const group = clusterCard();
  if (simple()) {
    // Simple mode: a guide written for a 10-year-old, one place at a time.
    const a = shown.find((x) => x.id === opened[0]);
    cards.replaceChildren(...(group ? [group] : []), a ? kidCard(a) : kidWelcome());
  } else {
    cards.replaceChildren(
      ...(group ? [group] : []),
      ...(opened.length ? opened.map((id) => card(shown.find((a) => a.id === id)!)) : group ? [] : [el("p", { className: "muted" }, t("cards.empty"))]),
    );
  }
  entering = undefined;
}

// The events behind the clicked marker, each with its details and a way to go to it.
function clusterCard(): HTMLElement | undefined {
  if (!cluster) return void globe.setGhosts([], false);
  const { kind, ids } = cluster;
  const wanted = new Set(ids);
  const items =
    kind === "live"
      ? liveEvents.filter((f) => wanted.has(f.properties.id)).map((f) => ({ p: f.properties, info: () => liveInfo(f.properties), zoom: 6 }))
      : reports.filter((f) => wanted.has(f.properties.id)).map((f) => ({ p: f.properties, info: () => eventInfo(f.properties), zoom: 11 }));
  if (!items.length) return void ((cluster = undefined), globe.setGhosts([], false)); // the data moved on
  const closer = (label: string, className = "") => {
    const b = el("button", { type: "button", className }, label);
    b.setAttribute("aria-label", t("card.close"));
    b.onclick = () => {
      cluster = undefined;
      render();
    };
    return b;
  };
  const close = closer(t("card.close"));
  // Where each of them is, as small dots on the map, until the list is closed.
  globe.setGhosts(items.map(({ p }) => ({ lon: p.lon, lat: p.lat, color: typeColor(p.category) })), kind === "live");
  return el(
    "section",
    { className: `card cluster ${kind}` },
    el(
      "h3",
      {},
      typeIcon(items[0].p.category),
      el("span", {}, t(kind === "live" ? "cluster.live" : "cluster.radar", { n: items.length, type: shortLabel(items[0].p.category) })),
      closer("×", "remove"), // a long list: closing must not need scrolling to its end
    ),
    ...items.slice(0, CLUSTER_ROWS).map(({ p, info, zoom }) => {
      const go = el("button", { type: "button", className: "link" }, t("cluster.go"));
      go.onclick = () => {
        setSpin(false);
        globe.goTo(p.lon, p.lat, zoom);
      };
      return el("div", { className: "cluster-item" }, info(), go);
    }),
    ...(items.length > CLUSTER_ROWS ? [el("p", { className: "muted" }, t("cluster.more", { n: items.length - CLUSTER_ROWS }))] : []),
    el("p", { className: "actions" }, close),
  );
}

// ---- The visitor's own places (places.ts) ----

// Remember a position, unless one already kept stands for the same area (or the same spot).
function addPlace(lon: number, lat: number) {
  const id = areaAt(lon, lat, areas())?.id;
  const same = (p: [number, number]) => (id ? areaAt(...p, areas())?.id === id : Math.abs(p[0] - lon) < 0.01 && Math.abs(p[1] - lat) < 0.01);
  if (places.some(same)) return;
  places = [...places, [+lon.toFixed(4), +lat.toFixed(4)]];
  savePlaces(places);
}

function removeButton(name: string, gone: (p: [number, number]) => boolean): HTMLElement {
  const b = el("button", { type: "button", className: "remove", textContent: "×" });
  b.setAttribute("aria-label", t("list.remove", { name }));
  b.title = t("list.remove", { name });
  b.onclick = () => {
    places = places.filter((p) => !gone(p));
    savePlaces(places);
    render();
  };
  return b;
}

// ---- Loading an area's own files (contract 0.7) ----

const getJson = <T>(path: string): Promise<T | undefined> =>
  fetch(new URL(path, BASE), { cache: "no-store" }).then((r) => (r.ok ? (r.json() as Promise<T>) : undefined)).catch(() => undefined);

function loadArea(id: string): Promise<void> {
  if (!lazy || loaded.has(id)) return Promise.resolve();
  let job = loading.get(id);
  if (!job) {
    job = Promise.all([
      getJson<ManifestArea & { requested?: boolean; kind?: string }>(`areas/${id}/area.json`),
      getJson<{ features?: EventFeature[] }>(`areas/${id}/events.geojson`), // none yet: no events
    ])
      .then(([area, events]) => {
        if (!area) return;
        const features = events?.features ?? [];
        loaded.set(id, { view: { ...toAreaView(area, features), ...flags(area) }, features });
        live = live.map((a) => (a.id === id ? loaded.get(id)!.view : a));
        reports = [...loaded.values()].flatMap((l) => l.features);
      })
      .finally(() => loading.delete(id));
    loading.set(id, job);
  }
  return job;
}

// Zoomed in: the areas in view load by themselves, so their detections and outlines appear.
globe.onView((zoom, box) => {
  if (!lazy || zoom < LOAD_ZOOM) return;
  const todo = live.filter((a) => a.stub && a.kind !== "mosaic" && overlaps(a.bbox, box));
  if (todo.length) Promise.all(todo.map((a) => loadArea(a.id))).then(render);
});

// Clicking a dot or a list row opens the area as a tab; clicking again closes it.
function toggle(id: string) {
  const a = areas().find((x) => x.id === id);
  if (!a) return;
  if (a.stub) {
    // Its files are not here yet: fetch them, then open (a failed fetch leaves it closed).
    loadArea(id).then(() => loaded.has(id) && toggle(id));
    return;
  }
  if (lazy && !opened.includes(id) && a.kind !== "mosaic") addPlace(...a.center);
  if (simple()) {
    // Simple mode's guide shows one place at a time; clicking it again goes back to the welcome.
    opened = opened[0] === id ? [] : [id];
    if (opened.length) closed.delete(id);
    else closed.add(id);
    showPanel("detail", true);
    if (opened.length) {
      setSpin(false);
      globe.focus(a);
    }
    render();
    $("detail").scrollTop = 0;
    return;
  }
  const opening = !opened.includes(id);
  opened = opening ? [id, ...opened] : opened.filter((x) => x !== id);
  if (opening) closed.delete(id);
  else closed.add(id);
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

  // Technical mode only (Simple mode has its own panel, kidCard). The timeline keeps the 5 most
  // important rows; everything is in the PDF report.
  const top = topEvents(a.events, TOP_N);
  const timeline = top.map((e) =>
    el(
      "li",
      {},
      el("time", { dateTime: e.date }, e.date),
      originBadge("nisar", "", "", { compact: true, synthetic: a.synthetic }),
      el("strong", {}, e.title ?? t("timeline.pass")),
      el(
        "p",
        { className: "muted" },
        e.pols
          ? t("timeline.pols", { list: e.pols.join(", ") })
          : [e.text, e.confidence !== undefined && t("timeline.confidence", { pct: Math.round(e.confidence * 100) })].filter(Boolean).join(" "),
      ),
    ),
  );
  const changes = a.events.filter((e) => !e.pols).length;

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
    el("p", {}, pdfLinks(a)),
    pdfStatus(a),
    tags,
    originKey(a.layers.length ? ["nisar", "satellite", "record"] : ["satellite", "record"]),
    el("p", {}, a.summary),
    friendlySection(a),
    ...radarSection(a),
    whySection(a),
    ...radarCompare(a),
    satSection(a),
    chartSection(a),
    ...changesSection(a, true),
    // "The 5 most important" only when there were more to choose from.
    el("h4", {}, a.events.length > TOP_N ? t(changes ? "card.top" : "card.toppasses", { n: TOP_N }) : t("card.timeline")),
    timeline.length ? el("ol", { className: "timeline" }, ...timeline) : el("p", { className: "muted" }, t("card.noreports")),
    ...(a.events.length > timeline.length ? [moreInReport(a, a.events.length - timeline.length)] : []),
    ...historySection(a),
    ...(a.credits.length ? [el("h4", {}, t("card.credits")), el("ul", {}, ...a.credits.map((c) => el("li", { className: "muted" }, c)))] : []),
  );
  box.ontoggle = () => (box.open ? collapsed.delete(a.id) : collapsed.add(a.id));
  return box;
}

function radarSection(a: AreaView): Node[] {
  if (!a.layers.length) return [el("h4", {}, t("card.radar")), el("p", { className: "note" }, originBadge("nisar"), " ", t("origin.nonisar"))];

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

// ---- Simple mode's guide (words in kid.ts and i18n.ts "kid.*") ----

const kidDate = (d: string) => new Date(`${d.slice(0, 10)}T12:00:00Z`).toLocaleDateString(lang(), { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

// A numbered question with its answer.
function kidQ(n: number, title: Key, ...body: (Node | string)[]): HTMLElement {
  return el("section", { className: "kid-q" }, el("h4", {}, el("span", { className: "kid-n" }, String(n)), t(title)), ...body);
}

function kidWords(): HTMLElement {
  return el("ul", { className: "kid-words" }, ...(["kid.word.radar", "kid.word.satellite", "kid.word.echo"] as Key[]).map((k) => el("li", {}, t(k))));
}

// Nothing open yet: what this is and how to use it.
function kidWelcome(): HTMLElement {
  const colors: [string, Key][] = [["natural", "kid.color.natural"], ["human", "kid.color.human"], ["land", "kid.color.land"]];
  return el(
    "div",
    { className: "kid" },
    el("p", { className: "kid-hello" }, t("kid.hello")),
    el("p", { className: "kid-big" }, t("kid.intro")),
    kidQ(1, "kid.how", el("ol", { className: "kid-steps" }, el("li", {}, t("kid.step1")), el("li", {}, t("kid.step2")), el("li", {}, t("kid.step3")))),
    kidQ(2, "kid.colors", el("ul", { className: "kid-list" }, ...colors.map(([g, k]) => el("li", {}, dot(GROUPS.find((x) => x.id === g)!.color), t(k))))),
    kidQ(3, "kid.nisar.title", el("p", {}, originBadge("nisar")), el("p", {}, t("kid.nisar")), sourceLinks(["nisarFacts", "cdmx"])),
    kidQ(4, "kid.q.words", kidWords()),
  );
}

function kidCard(a: AreaView): HTMLElement {
  const L = lang();
  // What the radar found, by kind, most first.
  const counts = new Map<string, number>();
  for (const e of reports) if (e.properties.area_id === a.id) counts.set(e.properties.category, (counts.get(e.properties.category) ?? 0) + 1);
  const found = [...counts].sort((p, q) => q[1] - p[1]).slice(0, 4);
  const days = [...new Set(a.layers.filter((l) => l.role === "backscatter").map((l) => l.date ?? ""))].filter(Boolean).sort();
  const span = radarSpan(a);

  const saw: Node[] = !a.layers.length
    ? [el("p", {}, t("kid.saw.noradar"))]
    : [
        ...(days.length ? [el("p", {}, t("kid.saw.visits", { n: days.length, from: kidDate(days[0]), to: kidDate(days.at(-1)!) }))] : []),
        ...(found.length
          ? [
              el("p", {}, t("kid.saw.found")),
              el(
                "ul",
                { className: "kid-list" },
                ...found.map(([k, n]) => {
                  const words = KID_FOUND[k] ?? KID_FOUND.other;
                  return el("li", {}, typeIcon(k), tx(n === 1 ? words.one : words.many, L).replace("{n}", String(n)));
                }),
              ),
              el("p", { className: "muted" }, t("kid.saw.maybe")),
            ]
          : [el("p", {}, t("kid.saw.none"))]),
      ];

  // Section 3: the child picks the kind of picture and how far back; the comparison follows.
  const satLine = el("li", {}, originBadge("satellite"), " ", t("kid.src.satellite.plain"));
  const look = kidLook(a, satLine);

  const close = el("button", { type: "button", className: "link" }, "← ", t("kid.close"));
  close.onclick = () => {
    opened = [];
    render();
  };
  const more = el("button", { type: "button" }, t("kid.more"));
  more.onclick = () => {
    setMode("technical");
    if (!opened.includes(a.id)) toggle(a.id);
  };
  return el(
    "div",
    { className: "kid" },
    close,
    el("p", { className: "muted" }, t("kid.visiting")),
    el("h3", { className: "kid-title" }, dot(colorOf(a)), a.title),
    kidQ(1, "kid.q.what", el("p", {}, t("kid.watch")), el("ul", { className: "kid-list" }, ...a.types.map((k) => el("li", {}, typeIcon(k), KID_TYPES[k] ? tx(KID_TYPES[k], L) : shortLabel(k))))),
    kidQ(2, "kid.q.saw", ...saw),
    kidQ(3, "kid.q.look", look),
    kidQ(4, "kid.q.fact", el("p", { className: "kid-fact" }, tx(kidFact(a.types), L)), sourceLinks(kidFact(a.types).refs)),
    kidQ(
      5,
      "kid.q.where",
      el(
        "ul",
        { className: "kid-src" },
        el("li", {}, originBadge("nisar"), " ", span ? t("kid.src.nisar", { date: kidDate(span[1]) }) : t("kid.src.nonisar")),
        satLine,
        el("li", {}, originBadge("record"), " ", t("kid.src.record", { date: kidDate(RECORDS_CHECKED) })),
      ),
    ),
    kidQ(6, "kid.q.words", kidWords()),
    el("p", { className: "kid-actions" }, pdfLinks(a, { open: "kid.pdf.open", save: "kid.pdf" }), more),
  );
}

// Kinds of picture the guide offers, each described only as its NASA source describes it.
type KidPic = { id: string; label: Key; help: Key; refs: RefId[] };
const KID_MONTHS = [1, 3, 6, 12, 24, 60];
const kidCompare = new Map<string, CompareState>(); // zoom and divider, per area and kind of picture
const kidViews = new Map<string, { pic: string; months: number }>();
const isRadarPicture = (l: Layer) => l.role === "backscatter" && l.colormap === "gray" && !!l.value_range;

function kidPics(a: AreaView): KidPic[] {
  const wide = a.bbox[2] - a.bbox[0] > 1.5; // the 30 m photos only cover a city-sized box
  return [
    ...(a.layers.some(isRadarPicture) ? [{ id: "radar", label: "kid.pic.radar", help: "kid.pic.radar.help", refs: ["nisarFacts", "cdmx", "sarImage"] } as KidPic] : []),
    ...(wide ? [] : [{ id: "hls", label: "kid.pic.sharp", help: "kid.pic.sharp.help", refs: ["hls"] } as KidPic]),
    { id: "viirs", label: "kid.pic.wide", help: "kid.pic.wide.help", refs: ["gibs"] },
    { id: "fire", label: "kid.pic.fire", help: "kid.pic.fire.help", refs: ["modisNrt", "fireTutorial"] },
    { id: "ndvi", label: "kid.pic.plants", help: "kid.pic.plants.help", refs: ["ndvi"] },
  ];
}

const kidMonths = (n: number) =>
  n === 1 ? t("kid.when.month") : n < 12 ? t("kid.when.months", { n }) : n === 12 ? t("kid.when.year") : t("kid.when.years", { n: n / 12 });

// A row of big choice buttons (one radio group), like the mode switch.
function kidChoices<T extends string | number>(name: string, legend: Key, items: [T, string][], current: T, pick: (v: T) => void): HTMLElement {
  const box = el("fieldset", { className: "kid-choices" }, el("legend", {}, t(legend)));
  for (const [value, label] of items) {
    const input = el("input", { type: "radio", name, value: String(value), checked: value === current });
    input.onchange = () => pick(value);
    box.append(el("label", {}, input, el("span", {}, label)));
  }
  return box;
}

// The radar pair for "how far back": the latest pass, and the last pass at least that long before
// it (or the first pass, when NISAR's record here is shorter).
function kidRadarPair(a: AreaView, months: number) {
  // HV answers to plants, HH to water and buildings (the same choice as the Technical comparator).
  const groups = polarizations(a.layers.filter(isRadarPicture));
  const plants = a.types.some((x) => PLANT_TYPES.includes(x));
  const group = plants && groups.includes("HV backscatter") ? "HV backscatter" : groups.includes("HH backscatter") ? "HH backscatter" : groups[0];
  const dates = datesFor(a.layers.filter(isRadarPicture), group);
  if (dates.length < 2) return undefined;
  const latest = dates.at(-1)!;
  const target = new Date(Date.parse(latest) - months * 30.44 * 86400000).toISOString().slice(0, 10);
  const before = [...dates].reverse().find((d) => d <= target) ?? dates[0];
  return { before: layerAt(a.layers, group, before)!, after: layerAt(a.layers, group, latest)!, short: before === dates[0] && dates[0] > target };
}

function kidLook(a: AreaView, satLine: HTMLElement): HTMLElement {
  const pics = kidPics(a);
  const v = kidViews.get(a.id) ?? { pic: pics.find((p) => p.id !== "radar")!.id, months: 12 };
  if (!pics.some((p) => p.id === v.pic)) v.pic = pics[0].id;
  kidViews.set(a.id, v);
  const help = el("div");
  const holder = el("div");
  let run = 0;
  const load = () => {
    const mine = ++run;
    const pic = pics.find((p) => p.id === v.pic)!;
    help.replaceChildren(el("p", {}, t(pic.help)), sourceLinks(pic.refs));
    const key = `${a.id}|${pic.id}`;
    const state = kidCompare.get(key) ?? newCompareState(pic.id === "radar" ? "radar" : "optical");
    kidCompare.set(key, state);
    const show = (before: Picture, after: Picture, kind: "radar" | "optical", note?: string) =>
      holder.replaceChildren(
        el("p", {}, t("kid.look.help2")),
        ...(note ? [el("p", { className: "muted" }, note)] : []),
        comparator({ id: `kid-${a.id}`, kind, state, technical: false, basic: true, before, after, origin: [] }),
      );
    if (pic.id === "radar") {
      const pair = kidRadarPair(a, v.months);
      if (!pair) return holder.replaceChildren(el("p", { className: "muted" }, t("kid.look.oneradar")));
      const d = (l: Layer) => l.date ?? "";
      show(
        { url: new URL(pair.before.url, BASE).href, date: kidDate(d(pair.before)), decode: radarDecode(...pair.before.value_range!) },
        { url: new URL(pair.after.url, BASE).href, date: kidDate(d(pair.after)), decode: radarDecode(...pair.after.value_range!) },
        "radar",
        pair.short ? t("kid.look.radarspan", { date: kidDate(d(pair.before)) }) : undefined,
      );
      return;
    }
    holder.replaceChildren(el("p", { className: "muted" }, t("kid.look.finding")));
    // Photos: look longer for clear days; the plant map and the fire view need no cloud-free day.
    satPair(a, pic.id, v.months, pic.id === "hls" || pic.id === "viirs").then(([now, old]) => {
      if (mine !== run) return; // a newer choice replaced this one
      if (!now || !old) return holder.replaceChildren(el("p", { className: "muted" }, t("kid.look.none")));
      show({ url: old.url, date: kidDate(old.date), decode: opticalDecode }, { url: now.url, date: kidDate(now.date), decode: opticalDecode }, "optical");
      satLine.replaceChildren(originBadge("satellite"), " ", t("kid.src.satellite", { before: kidDate(old.date), now: kidDate(now.date) }));
    });
  };
  const picRow = kidChoices(`kid-pic-${a.id}`, "kid.pic.title", pics.map((p) => [p.id, t(p.label)] as [string, string]), v.pic, (id) => {
    v.pic = id;
    load();
  });
  const whenRow = kidChoices(`kid-when-${a.id}`, "kid.when.title", KID_MONTHS.map((n) => [n, kidMonths(n)] as [number, string]), v.months, (n) => {
    v.months = n;
    load();
  });
  load();
  return el("div", {}, picRow, help, whenRow, holder);
}

// ---- Full report as a PDF (report.ts, loaded only when asked for) ----

const TOP_N = 5; // timelines in the card keep this many rows; the PDF has them all

// One PDF per area, made only when someone presses "Make report": building it blocks the page for a
// while (seconds on a phone) and fetches pictures, so it never runs in the background. Each is made
// from a snapshot of everything it shows; made again, it becomes a new version listing what is new.
// `url` points at the file in this page (a blob URL), so the links can open or save it at once.
type Pdf = { snap: ReportSnapshot; key: string; version: number; made: string; blob: Blob; url: string; changes: string[] };
const pdfs = new Map<string, Pdf>();
const pdfJobs = new Map<string, Promise<Pdf | undefined>>();
const pdfFailed = new Set<string>(); // areas whose last attempt failed: their link offers a retry
let pdfEnv: ReportEnv | undefined;

// "radar", "changes"... in words, for the card and the PDF's "what is new" box.
function changeText(c: Change): string {
  switch (c.kind) {
    case "lang": return t("pdf.ch.lang");
    case "radar": return t("pdf.ch.radar", { added: c.added, removed: c.removed, latest: c.latest || "-" });
    case "changes": return t("pdf.ch.changes", { from: c.from, to: c.to });
    case "live": return t("pdf.ch.live", { n: c.n });
    case "satellite": return t("pdf.ch.satellite", { date: c.date || "-" });
    case "series": return t("pdf.ch.series");
    case "area": return t("pdf.ch.area");
  }
}

/** The newest PDF of an area: the kept one if its data has not changed, else a new version. */
function updatePdf(a: AreaView): Promise<Pdf | undefined> {
  const running = pdfJobs.get(a.id);
  if (running) return running;
  const job = (async () => {
    const mod = await import("./report");
    const l = pdfLang();
    pdfEnv = { base: BASE, typeName: (id) => shortLabelIn(l, id), satName: gibsName, text: (key) => tIn(l, key) };
    const snap = await mod.snapshotReport(reportInput(a));
    const key = contentKey(snap);
    const old = pdfs.get(a.id);
    if (old && old.key === key) return old;
    const changes = old ? diffSnapshots(old.snap, snap).map(changeText) : [];
    const made = new Date().toISOString();
    const version = (old?.version ?? 0) + 1;
    const blob = await mod.renderReport(snap, pdfEnv, { version, made, replaces: old?.version, changes });
    const pdf: Pdf = { snap, key, version, made, blob, url: URL.createObjectURL(blob), changes };
    pdfs.set(a.id, pdf); // the old version's file is dropped here
    // A tab may still be reading the old version: let it go a little later.
    if (old) setTimeout(() => URL.revokeObjectURL(old.url), 5 * 60 * 1000);
    return pdf;
  })()
    .then((pdf) => {
      pdfFailed.delete(a.id);
      return pdf;
    })
    .catch((err) => {
      console.error(err);
      pdfFailed.add(a.id);
      return pdfs.get(a.id);
    })
    .finally(() => {
      pdfJobs.delete(a.id);
      showPdfStatus(a.id); // the links point at the new file only now
    });
  pdfJobs.set(a.id, job);
  // Busy at once: fetching the pictures takes a while before any drawing starts.
  showPdfStatus(a.id, pdfs.has(a.id) ? "pdf.updating" : "pdf.making");
  return job;
}

const hhmm = (iso: string) => new Date(iso).toLocaleString(lang(), { dateStyle: "short", timeStyle: "short" });

// The line under the report button: which version, when, and what changed last time.
function pdfStatusText(id: string, busy?: Key): string {
  const pdf = pdfs.get(id);
  if (busy) return t(busy, { v: (pdf?.version ?? 0) + 1 });
  if (!pdf) return "";
  const head = t("pdf.ready", { v: pdf.version, time: hhmm(pdf.made) });
  return pdf.version > 1 && pdf.changes.length ? `${head} ${t("pdf.new", { old: pdf.version - 1, list: pdf.changes.join("; ") })}` : head;
}
function showPdfStatus(id: string, busy?: Key) {
  for (const node of document.querySelectorAll<HTMLElement>(`[data-pdf-status="${CSS.escape(id)}"]`)) node.textContent = pdfStatusText(id, busy);
  for (const box of document.querySelectorAll<HTMLElement>(`[data-pdf-links="${CSS.escape(id)}"]`)) fillPdfLinks(box, id, !!busy || pdfJobs.has(id));
}
const pdfStatus = (a: AreaView) => {
  const p = el("p", { className: "muted pdf-status" }, pdfStatusText(a.id, pdfJobs.has(a.id) ? "pdf.making" : undefined));
  p.dataset.pdfStatus = a.id;
  p.setAttribute("role", "status");
  return p;
};

// The report's controls. First one button, "Make report"; once the file is made it becomes "Read",
// which opens a reader inside the page (reader.ts) that works in every browser, even those that block
// new tabs or have no PDF viewer, and "Download" appears next to it. Download is a plain link to the
// finished file: browsers (Safari above all) refuse a download that does not start at the click itself.
type LinkLabels = { open: Key; save?: Key };
function pdfLinks(a: AreaView, labels: LinkLabels = { open: "report.open", save: "report.download" }): HTMLElement {
  const box = el("span", { className: "report-links" });
  box.dataset.pdfLinks = a.id;
  box.dataset.open = labels.open;
  if (labels.save) box.dataset.save = labels.save;
  const read = el("button", { type: "button", className: "primary" });
  read.onclick = () => readPdf(a.id);
  box.append(read);
  if (labels.save) box.append(el("a", { className: "btn" }));
  fillPdfLinks(box, a.id, pdfJobs.has(a.id));
  return box;
}

const pdfName = (id: string, pdf: Pdf) => `gigas-${id}-v${pdf.version}-${pdf.made.slice(0, 10)}.pdf`;

async function readPdf(id: string) {
  const a = areas().find((x) => x.id === id);
  const pdf = pdfs.get(id);
  if (!a) return;
  if (!pdf) {
    updatePdf(a); // not made yet, or failed: make it; the button turns into "Read" when it is ready
    return;
  }
  const { openReader } = await import("./reader");
  openReader({ title: a.title, subtitle: pdfStatusText(id), url: pdf.url, fileName: pdfName(id, pdf) });
}

function fillPdfLinks(box: HTMLElement, id: string, busy: boolean) {
  const pdf = pdfs.get(id);
  const ready = !!pdf && !busy; // while a newer version is being made, the old one is not offered
  const read = box.querySelector("button")!;
  const save = box.querySelector("a");
  read.disabled = busy;
  read.textContent = busy ? t("report.preparing") : ready ? t(box.dataset.open as Key) : pdfFailed.has(id) ? t("report.failed") : t("report.make");
  if (save) {
    save.hidden = !ready;
    save.textContent = t(box.dataset.save as Key);
    if (ready) {
      save.href = pdf.url;
      save.download = pdfName(id, pdf);
    } else save.removeAttribute("href");
  }
}

// Everything the report needs about one area. The satellite pictures are the ones the card
// shows (same layer and months), so the PDF matches the page.
function reportInput(a: AreaView): ReportInput {
  const wide = a.bbox[2] - a.bbox[0] > 1.5;
  const v = satViews.get(a.id);
  return {
    area: a,
    events: reports.filter((e) => e.properties.area_id === a.id).map((e) => e.properties),
    live: liveEvents.map((f) => f.properties).filter((p) => distanceKm([p.lon, p.lat], a.center) <= 300),
    lang: pdfLang(),
    asOf: { radar: manifestAt, live: liveUpdated },
    series: () => loadSeries(a),
    friendly: () => loadFriendly(a),
    satellite: () => satPair(a, v?.layer ?? (wide ? "viirs" : "hls"), MONTHS[v?.ago ?? 3]).then(([now, old]) => [old, now]),
  };
}

function moreInReport(a: AreaView, n: number): Node {
  return el("p", { className: "muted more-report" }, t("card.more", { n }), " ", pdfLinks(a, { open: "report.short" }));
}

// ---- Why the radar sees changes (explain.ts) ----

// In each card: the ideas behind this area's kind of change, folded until asked for.
function whySection(a: AreaView): Node {
  const box = el("details", { className: "why" }, el("summary", {}, t("why.here")));
  // Built on first opening: the drawings are not needed until then.
  box.ontoggle = () => {
    if (!box.open || box.childElementCount > 1) return;
    box.append(
      el("p", { className: "muted" }, t("why.intro")),
      explainer(topicsFor(a.types), lang()),
      el("button", { type: "button", className: "link", onclick: () => openSheet() }, t("why.all")),
    );
  };
  return box;
}

const sheet = $<HTMLDialogElement>("sheet");
// The decision log is not on the page: it lives in the repository (frontend/DECISIONS.md).
function openSheet() {
  const title = el("h2", { id: "sheet-title" }, t("why.title"));
  const close = el("button", { type: "button", onclick: () => sheet.close() }, t("dialog.close"));
  const body = [el("p", { className: "muted" }, t("why.intro")), explainer(TOPICS.map((x) => x.id), lang())];
  sheet.replaceChildren(el("div", { className: "settings-head" }, title, close), el("div", { className: "sheet-body" }, ...body));
  if (!sheet.open) sheet.showModal();
  close.focus();
}
// A click on the backdrop closes it. (Braces: an onclick that returns false would cancel every
// click inside the dialog.)
sheet.onclick = (e) => {
  if (e.target === sheet) sheet.close();
};
$("explain-btn").onclick = () => openSheet();

// ---- Before/after comparator on NISAR radar pictures (compare.ts) ----

const radarCmp = new Map<string, { group: string; before: string; after: string; view: CompareState }>();
const PLANT_TYPES = ["deforestation", "logging", "wildfires", "agriculture"];

function radarCompare(a: AreaView): Node[] {
  // Only the plain backscatter pictures: their gray levels map back to dB (value_range).
  const isPicture = (l: Layer) => l.role === "backscatter" && l.colormap === "gray" && !!l.value_range;
  const groups = polarizations(a.layers.filter(isPicture));
  if (!groups.length) return [];
  // HV answers to plants, HH to water and buildings: start with the one the area is about.
  const first = groups.includes("HV backscatter") && a.types.some((x) => PLANT_TYPES.includes(x)) ? "HV backscatter" : groups[0];
  const st = radarCmp.get(a.id) ?? { group: first, before: "", after: "", view: newCompareState("radar") };
  radarCmp.set(a.id, st);
  if (!groups.includes(st.group)) st.group = first;

  const head = [el("h4", {}, t("cmp.title")), el("p", {}, originBadge("nisar", "", t("origin.taken", { date: when(radarSpan(a)) }), { synthetic: a.synthetic }))];
  const holder = el("div");
  const groupSel = el("select", { id: `cmp-group-${a.id}` }, ...groups.map((g) => el("option", { value: g, selected: g === st.group }, g)));
  const beforeSel = el("select", { id: `cmp-before-${a.id}` });
  const afterSel = el("select", { id: `cmp-after-${a.id}` });

  const build = () => {
    const dates = datesFor(a.layers.filter(isPicture), st.group);
    if (dates.length < 2) {
      holder.replaceChildren(el("p", { className: "muted" }, t("cmp.nodates")));
      return;
    }
    if (!dates.includes(st.before)) st.before = dates[0];
    if (!dates.includes(st.after) || st.after <= st.before) st.after = dates.at(-1)!;
    beforeSel.replaceChildren(...dates.slice(0, -1).map((d) => el("option", { value: d, selected: d === st.before }, d)));
    afterSel.replaceChildren(...dates.filter((d) => d > st.before).map((d) => el("option", { value: d, selected: d === st.after }, d)));
    const lb = layerAt(a.layers, st.group, st.before)!, la = layerAt(a.layers, st.group, st.after)!;
    const what = (l: Layer) => `${l.product} ${l.polarization ?? ""} · ${l.maturity}`;
    holder.replaceChildren(
      ...(lb.maturity !== la.maturity ? [el("p", { className: "note" }, t("cmp.maturity", { a: lb.maturity, b: la.maturity }))] : []),
      comparator({
        id: `radar-${a.id}`, kind: "radar", state: st.view, technical: !simple(),
        before: { url: new URL(lb.url, BASE).href, date: st.before, decode: radarDecode(...lb.value_range!) },
        after: { url: new URL(la.url, BASE).href, date: st.after, decode: radarDecode(...la.value_range!) },
        origin: [
          originBadge("nisar", what(lb), `${t("cmp.before")}: ${t("origin.taken", { date: st.before })}`, { synthetic: lb.synthetic }),
          " ",
          originBadge("nisar", what(la), `${t("cmp.after")}: ${t("origin.taken", { date: st.after })}`, { synthetic: la.synthetic }),
        ],
      }),
    );
  };
  groupSel.onchange = () => {
    st.group = groupSel.value;
    build();
  };
  beforeSel.onchange = () => {
    st.before = beforeSel.value;
    build();
  };
  afterSel.onchange = () => {
    st.after = afterSel.value;
    build();
  };
  build();
  // Simple mode compares the first and the latest pass of the most telling picture.
  if (simple()) return [...head, holder];
  return [
    ...head,
    el(
      "div",
      { className: "cmp-pick" },
      el("label", { htmlFor: groupSel.id }, t("cmp.layer"), groupSel),
      el("label", { htmlFor: beforeSel.id }, t("cmp.before"), beforeSel),
      el("label", { htmlFor: afterSel.id }, t("cmp.after"), afterSel),
    ),
    holder,
  ];
}

function layerInfo(l: Layer): Node[] {
  const what = [l.product === "derived" ? l.group : `${l.product} ${l.group ?? l.polarization ?? ""}`, l.maturity].filter(Boolean).join(" · ");
  const out: Node[] = [
    el("p", {}, originBadge("nisar", what, t("origin.taken", { date: when(l.date_range ?? l.date) }), { synthetic: l.synthetic })),
    el("p", {}, l.description),
  ];
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

// First and last date over every line of every chart.
function seriesSpan(groups: [string, Series[]][]): [string, string] | undefined {
  const dates = groups.flatMap(([, ss]) => ss.flatMap((x) => x.points.map((p) => p.date))).sort();
  return dates.length ? [dates[0], dates.at(-1)!] : undefined;
}

function chartSection(a: AreaView): Node {
  const box = el("div");
  if (a.series.length) {
    loadSeries(a).then((groups) => {
      if (!groups.length) return;
      box.replaceChildren(
        el("h4", {}, t("chart.title")),
        el("p", {}, originBadge("nisar", "", t("origin.taken", { date: when(seriesSpan(groups)) }), { synthetic: a.synthetic })),
        ...groups.map(([units, series]) => chart(series, { caption: t("chart.caption", { units }), table: t("chart.table"), date: t("chart.date"), units })),
      );
    });
  }
  return box;
}

// ---- What the radar found, in plain words (contract C8 friendly cards) ----

// Made by the back end for every area, new lookups included, so every place is described from its
// own data. The sentences come in English only (the contract has no translations); the kind names
// and level words are the page's own.
function loadFriendly(a: AreaView): Promise<Friendly | undefined> {
  if (!a.friendly) return Promise.resolve(undefined);
  let pending = friendlyCache.get(a.id);
  if (!pending) {
    pending = fetch(new URL(a.friendly, BASE))
      .then((res) => (res.ok ? res.json() : undefined))
      .then(readFriendly)
      .catch(() => undefined); // a missing or broken file leaves the section out
    friendlyCache.set(a.id, pending);
  }
  return pending;
}

function friendlySection(a: AreaView): Node {
  const box = el("div");
  loadFriendly(a).then((f) => {
    if (!f) return;
    const num = new Intl.NumberFormat(lang(), { maximumFractionDigits: 1 });
    const rows = f.cards.map((c) => {
      const level = Math.max(0, Math.min(3, c.level));
      const size = c.number ? `${num.format(c.number.value)} ${c.number.unit === "km2" ? "km²" : c.number.unit}` : "";
      const span = level && c.places !== undefined && c.from && c.to ? t("friendly.span", { places: c.places, from: c.from, to: c.to }) : "";
      return el(
        "li",
        { className: `level-${level}` },
        el("strong", {}, typeIcon(c.category), isType(c.category) ? typeLabel(c.category) : c.label),
        " ", el("span", { className: "tag" }, t(`friendly.level.${level}` as Key)),
        el("p", {}, c.headline),
        ...(size || span ? [el("p", { className: "muted" }, [size, span].filter(Boolean).join(" · "))] : []),
      );
    });
    box.replaceChildren(
      el("h4", {}, t("friendly.title")),
      el("p", {}, originBadge("nisar", "", "", { compact: true, synthetic: a.synthetic }), " ", el("span", { className: `tag status-${f.status}` }, t(`friendly.${f.status}` as Key)), " ", f.headline),
      ...(rows.length ? [el("ul", { className: "friendly" }, ...rows)] : []),
      // The contract says these notes (data maturity, "a hypothesis, not confirmed") must be shown.
      el("ul", { className: "muted small friendly-notes" }, ...f.data_notes.map((n) => el("li", {}, n)), el("li", {}, t("friendly.note"))),
    );
  });
  return box;
}

// ---- Zone notes, history, satellite view (jopa-testing; data in mexico.ts, satview.ts) ----

const lang = () => settings.lang;
// The PDF's built-in fonts only draw Western European letters: a Japanese page gets an English report.
const pdfLang = (): Lang => (settings.lang === "ja" ? "en" : settings.lang);

// First and last date of the area's radar pictures.
function radarSpan(a: AreaView): [string, string] | undefined {
  const dates = a.layers.flatMap((l) => l.date_range ?? (l.date ? [l.date] : [])).sort();
  return dates.length ? [dates[0], dates.at(-1)!] : undefined;
}

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
  const note = zoneNote(a.id);
  if (!note) return [];
  return [
    ...(heading ? [el("h4", {}, t("zone.changes"))] : []),
    el("p", {}, originBadge("record", "", t("origin.checked", { date: RECORDS_CHECKED }))),
    el("p", {}, tx(note.changes, lang())),
    el("h5", {}, t("zone.nature")),
    el("p", {}, tx(note.nature, lang())),
    el("details", {}, el("summary", {}, t("zone.sources")), sourceList(note.sources)),
  ];
}

const sevLabel = (n: number) => t(`sev.${Math.max(0, Math.min(3, n))}` as Key);

function historyItem(e: HistoryEvent): HTMLDetailsElement {
  return el(
    "details",
    { className: "hist" },
    el("summary", {}, el("time", { dateTime: e.date }, e.date.slice(0, 4)), typeIcon(e.type), el("strong", {}, tx(e.title, lang()))),
    el("p", {}, tx(e.impact, lang())),
    ...(e.seenBy?.length ? [el("p", { className: "muted" }, originBadge("satellite", "", t("zone.seenby", { list: e.seenBy.join(" · ") })))] : []),
    sourceList(e.sources),
  );
}

// Remarkable events that touched this zone: a strip of years with one mark per event (click a
// mark to open its row), then the rows, oldest first.
function historySection(a: AreaView): Node[] {
  const all = zoneHistory(HISTORY, a.bbox);
  const events = topHistory(all, TOP_N);
  const head = el("h4", {}, all.length > TOP_N ? t("zone.history.top", { n: TOP_N }) : t("zone.history"));
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
  const origin = el("p", {}, originBadge("record", "", t("origin.checked", { date: RECORDS_CHECKED })));
  return [
    head, origin, strip, axis,
    el("ol", { className: "timeline history" }, ...items.map((d) => el("li", {}, d))),
    ...(all.length > events.length ? [moreInReport(a, all.length - events.length)] : []),
  ];
}

// Satellite view (from the `jopa-testing` branch): "now" and "before" pictures from NASA GIBS in the
// before/after comparator (compare.ts). Searches are
// cached, because the cards are rebuilt on every filter change.
const MONTHS = [1, 3, 6, 12, 24, 60, 120];
const satViews = new Map<string, { layer: string; ago: number; swipe: number }>();
const satCache = new Map<string, Promise<Found | undefined>>();
const satCompare = new Map<string, CompareState>(); // zoom, divider and threshold per area

// Which satellite a GIBS layer is, in a few words. Only HLS states its pixel size (30 m, NASA
// Earthdata); the others are named without one.
const gibsName = (layer: string) =>
  layer.startsWith("HLS_S30") ? "HLS · Sentinel-2 · 30 m"
  : layer.startsWith("HLS_L30") ? "HLS · Landsat 8/9 · 30 m"
  : layer.startsWith("VIIRS_NOAA20") ? "VIIRS · NOAA-20"
  : layer.includes("NDVI") ? "MODIS Terra · NDVI"
  : layer.startsWith("MODIS") ? "MODIS Terra · 7-2-1"
  : layer;

// `clear`: look longer for a day with almost no clouds (Simple mode's guide).
function satFind(layerId: string, bbox: AreaView["bbox"], from: Date, clear = false): Promise<Found | undefined> {
  const layer = SAT_LAYERS.find((l) => l.id === layerId) ?? SAT_LAYERS[0];
  const key = `${layer.id}|${bbox.join(",")}|${isoDay(from)}|${clear}`;
  let found = satCache.get(key);
  if (!found) {
    found = clear
      ? findClear(layer, bbox, from, layer.daily ? 30 : 45, undefined, 0.08).then((f) => f ?? satFind(layerId, bbox, from))
      : findClear(layer, bbox, from, layer.daily ? 12 : 60);
    satCache.set(key, found);
  }
  return found;
}

// The "now" and "before" pictures: `months` apart, the newest a day ago (GIBS publishes about a
// day late). The sharp 30 m pictures skip many days and the open sea: fall back to the daily ones.
function satPair(a: AreaView, id: string, months: number, clear = false): Promise<[Found | undefined, Found | undefined]> {
  const today = new Date(Date.now() - 86400000);
  const then = new Date(today.getTime() - months * 30.44 * 86400000);
  const pair = (layer: string) => Promise.all([satFind(layer, a.bbox, today, clear), satFind(layer, a.bbox, then, clear)]);
  return pair(id).then((found) => (id === "hls" && !(found[0] && found[1]) ? pair("viirs") : found));
}

function satSection(a: AreaView): Node {
  const wide = a.bbox[2] - a.bbox[0] > 1.5; // a region or the whole country: daily VIIRS, not 30 m HLS
  const v = satViews.get(a.id) ?? { layer: wide ? "viirs" : "hls", ago: 3, swipe: 50 };
  satViews.set(a.id, v);
  const layerId = () => (simple() ? (wide ? "viirs" : "hls") : v.layer);

  const status = el("p", { className: "muted" });
  const holder = el("div"); // the comparator, once both pictures are found
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
    holder.replaceChildren();
    status.textContent = t("sat.finding");
    const id = layerId();
    satPair(a, id, MONTHS[+ago.value]).then(([now, old]) => {
      if (mine !== run) return; // a newer choice replaced this one
      if (!now || !old) {
        status.textContent = t("sat.none", { n: id === "hls" ? 60 : 12 });
        return;
      }
      status.textContent = "";
      const layer = SAT_LAYERS.find((l) => l.layers.includes(now.layer)) ?? SAT_LAYERS[0];
      const box = viewBox(a.bbox, layer);
      const state = satCompare.get(a.id) ?? newCompareState("optical");
      satCompare.set(a.id, state);
      holder.replaceChildren(
        comparator({
          id: `sat-${a.id}`, kind: "optical", state, technical: !simple(),
          before: { url: old.url, date: old.date, decode: opticalDecode },
          after: { url: now.url, date: now.date, decode: opticalDecode },
          sharper: (rect) => ({ before: gibsUrl(old.layer, subBox(box, rect), old.date, 640), after: gibsUrl(now.layer, subBox(box, rect), now.date, 640) }),
          origin: [
            originBadge("satellite", `NASA GIBS · ${gibsName(old.layer)}`, `${t("cmp.before")}: ${t("origin.taken", { date: old.date })}`),
            " ",
            originBadge("satellite", `NASA GIBS · ${gibsName(now.layer)}`, `${t("cmp.after")}: ${t("origin.taken", { date: now.date })}`),
          ],
        }),
      );
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
    holder,
    el("p", { className: "muted small" }, t("sat.note")),
  );
}

// ---- Live data from the back end (optional: the app works without it) ----

async function loadLive() {
  seriesCache.clear();
  friendlyCache.clear();
  try {
    const index = await getJson<{ contract_version: string; generated_at?: string; areas: IndexArea[] }>("index.json");
    if (index && supportedVersion(index.contract_version)) {
      lazy = true;
      manifestAt = index.generated_at ?? "";
      const again = [...new Set([...opened, ...loaded.keys()])]; // what is on screen is fetched again
      loaded.clear();
      live = index.areas.map(stubView);
      reports = [];
      await Promise.all(again.map(loadArea));
      setStatus("status.connected", { areas: live.filter((a) => !a.requested).length, events: index.areas.reduce((n, a) => n + (a.events ?? 0), 0) });
      render();
      stagger = false;
      return;
    }
    lazy = false;
    const res = await fetch(new URL("manifest.json", BASE), { cache: "no-store" }); // never an old copy
    if (!res.ok) throw new Error(String(res.status));
    const manifest: Manifest & { generated_at?: string } = await res.json();
    manifestAt = manifest.generated_at ?? res.headers.get("last-modified") ?? "";
    if (supportedVersion(manifest.contract_version)) {
      // events.geojson is optional (older back ends have none); the areas still load without it.
      reports = await fetch(new URL("events.geojson", BASE), { cache: "no-store" })
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

// The radar results can change at any time (a new pass processed). A back end pushes "manifest";
// without one (files on storage), look every 5 minutes and reload only when they changed.
async function checkManifest() {
  try {
    const res = await fetch(new URL(lazy ? "index.json" : "manifest.json", BASE), { cache: "no-store" });
    const m = res.ok ? ((await res.json()) as { generated_at?: string }) : undefined;
    const at = m?.generated_at ?? res.headers.get("last-modified") ?? "";
    if (at && at !== manifestAt) loadLive();
  } catch {
    // offline: try again next time
  }
}
setInterval(checkManifest, 5 * 60 * 1000);
// While a place the visitor asked for is still being processed, look every 15 seconds.
// shortcut: a place NISAR has no data for stays "processing" until removed by hand; ask
// GET /sites/<id> for its state if that confuses people.
setInterval(() => lazy && places.some((p) => !areaAt(...p, areas())) && checkManifest(), 15 * 1000);

// ---- Live disaster feeds (live.geojson; optional, like everything from the back end) ----

liveToggle.onchange = render;
// Simple mode lists fewer events at a time.
const livePage = () => (simple() ? 6 : LIVE_PAGE);
const liveHere = () => liveEvents.filter((f) => inPicked(f.properties.lon, f.properties.lat));
liveMore.onclick = () => {
  liveLimit += livePage();
  renderLiveList();
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
      el("strong", {}, typeIcon(p.category), liveTitle(p, settings.lang, shortLabel)),
      el("span", { className: "where" }, livePlace(liveWhere(p), settings.lang)),
      el("span", { className: "muted" }, `${shortLabel(p.category)} · ${fmt.format(...ago(p.date, now))} · ${SOURCE_SHORT[p.source] ?? p.source}`),
      ...(sev >= 2 ? [el("span", { className: `sev s${sev}` }, sevLabel(sev))] : []),
    ),
  );
}

// "Happening now": every event that passes the filters, newest first.
function renderLiveList() {
  const now = Date.now();
  const on = liveToggle.checked;
  const rows = on ? liveList(liveHere(), ticked, isType) : [];
  const fmt = new Intl.RelativeTimeFormat(settings.lang, { numeric: "auto" });
  liveListEl.replaceChildren(...rows.slice(0, liveLimit).map((f) => liveRow(f, now, fmt)));
  if (on && liveUpdated && !rows.length) liveListEl.append(el("li", { className: "muted" }, t("live.none")));
  const left = rows.length - liveLimit;
  liveMore.hidden = left <= 0;
  liveMore.textContent = t("live.showmore", { n: Math.min(left, livePage()) });
}

function showLiveStatus() {
  $("live-origin").replaceChildren(originBadge("feed", "USGS · NASA EONET · GDACS · NOAA"), " ", t("live.notnisar"));
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
const events = new EventSource(new URL("events", API));
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

// On a phone the two panels share the space under the globe: tabs pick one, showing it hides the other,
// and pressing the open one again hides it so the globe takes the whole screen.
const phone = matchMedia("(max-width: 900px)");
function showPanel(id: "nav" | "detail", on: boolean) {
  $(id).inert = !on;
  $(id).parentElement!.classList.toggle(`no-${id}`, !on);
  $(`${id}-toggle`).setAttribute("aria-expanded", String(on));
  $(`tab-${id}`).setAttribute("aria-pressed", String(on));
  if (on && phone.matches) showPanel(id === "nav" ? "detail" : "nav", false);
  fitReading();
}

// Phone: scrolling down the open panel gives it most of the screen (the globe shrinks to a strip,
// see `.reading` in the stylesheet); back at the top the globe returns.
function fitReading() {
  const app = document.querySelector("main")!, panel = [$("nav"), $("detail")].find((p) => !p.inert);
  if (!panel || panel.scrollTop < 1) app.classList.remove("reading");
  // Only when the panel would still scroll once taller, or the grown panel would snap back to the top.
  else if (panel.scrollTop > 40 && panel.scrollHeight - panel.clientHeight > innerHeight * 0.3 + 40) app.classList.add("reading");
}
for (const id of ["nav", "detail"]) $(id).addEventListener("scroll", fitReading, { passive: true });
for (const id of ["nav", "detail"] as const) {
  $(`${id}-toggle`).onclick = () => showPanel(id, $(`${id}-toggle`).getAttribute("aria-expanded") !== "true");
  $(`tab-${id}`).onclick = () => showPanel(id, $(`tab-${id}`).getAttribute("aria-pressed") !== "true");
}

// ---- Welcome screen: the Earth's horizon turning under the title, until Start ----

// Everything but the camera: the page waits behind the welcome screen, inert.
function homeUi(on: boolean) {
  document.body.classList.toggle("at-home", on);
  for (const part of document.querySelectorAll<HTMLElement>("header, main")) part.inert = on;
  // Detail first, so on a phone the filters are the tab left showing.
  showPanel("detail", !on);
  showPanel("nav", !on);
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
// The map area once the panels are in (or out): its middle, where the globe sits, and its size.
function mapArea(panels: boolean) {
  const m = document.querySelector("main")!.getBoundingClientRect();
  const wide = !phone.matches;
  const left = m.left + (panels && wide ? 300 : 0), right = m.right - (panels && wide ? 360 : 0);
  const bottom = wide ? m.bottom : m.top + innerHeight * (panels ? 0.5 : 1);
  return { x: (left + right) / 2, y: (m.top + bottom) / 2, w: right - left, h: bottom - m.top };
}
function globeCenter(panels: boolean) {
  const { x, y } = mapArea(panels);
  return { x, y };
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
// `radius`: the globe's radius on screen when the camera has pulled back (globe.welcome).
function flyName(g: Point, radius: number) {
  const spans = letters();
  const far = Math.min(radius * 1.15, innerWidth * 0.46);
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
  // On a phone the open credits cover the date slider; folded, they stay one tap away on the (i).
  if (phone.matches) document.querySelector(".maplibregl-ctrl-attrib")?.classList.remove("maplibregl-compact-show");
  // The camera pulls back until the whole globe fits the map area, and the letters circle its edge.
  const radius = globe.welcome(false, 1700, mapArea(true));
  $("home-btn").focus();
  if (move) {
    await flyName(globeCenter(true), radius);
    document.body.classList.remove("orbiting");
  }
  orbiting = false;
  try {
    if (!localStorage.getItem("tour-seen")) {
      localStorage.setItem("tour-seen", "1");
      askTour();
    }
  } catch {
    // Storage blocked (private window): the tour stays available from the button.
  }
}

// First visit: the tour starts the newcomer in Simple mode, "I know what I am doing" goes to Technical.
// Later visits keep the last mode (saved with the settings).
function askTour() {
  const ask = el(
    "dialog",
    { className: "sheet ask" },
    el(
      "form",
      { method: "dialog", className: "sheet-body" },
      el("h2", {}, t("ask.title")),
      el("p", {}, t("ask.text")),
      el("div", { className: "tour-actions" }, el("button", { value: "no" }, t("ask.no")), el("button", { value: "yes", className: "primary" }, t("ask.yes"))),
    ),
  );
  ask.onclose = () => {
    ask.remove();
    const yes = ask.returnValue === "yes"; // Escape counts as no
    setMode(yes ? "simple" : "technical"); // at once: the tour leaves out what Simple mode hides
    if (yes) startTour(tourBtn);
  };
  document.body.append(ask);
  ask.showModal();
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
      const input = el("input", { type: "radio", name: "mode", value: mode, checked: settings.mode === mode });
      input.onchange = () => setMode(mode, true);
      return el("label", {}, input, el("span", {}, t(`mode.${mode}`)));
    }),
  );
  buildFilters();
  buildCountries();
  buildWheel();
  globe.setCities(cities, settings.lang);
  showStatus();
  showLiveStatus();
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
    liveLimit = livePage(); // Simple mode lists fewer events at a time
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
if (phone.matches) showWheel(false); // it would cover most of a phone's small globe; the button brings it back
liveLimit = livePage();
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
