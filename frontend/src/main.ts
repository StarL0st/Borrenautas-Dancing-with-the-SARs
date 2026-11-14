import "./style.css";
import { CATEGORIES } from "./categories";
import { createGlobe } from "./globe";
import {
  datesFor, inCategory, layerAt, polarizations, supportedVersion, toAreaView,
  type AreaView, type Layer, type Manifest,
} from "./logic";
import { SAMPLE_AREAS } from "./sample-areas";
import { startTour } from "./tour";
import { el } from "./ui";

// Live backend by default; set VITE_DATA_BASE=./data/ for the static build (contract C6).
const BASE = new URL(import.meta.env.VITE_DATA_BASE ?? "http://127.0.0.1:8765/", location.href);

const $ = (id: string) => document.getElementById(id)!;
const tabs = $("tabs"), topics = $("topics"), results = $("results"), status = $("status"), detail = $("detail");

let live: AreaView[] = [];
let cat = "all";
let selected: AreaView | undefined;
const view = { pol: "", date: "", opacity: 1 };

const areas = () => [...live, ...SAMPLE_AREAS];
const category = (id: string) => CATEGORIES.find((c) => c.id === id);
const colorOf = (a: AreaView) => category(cat === "all" ? a.categories[0] : cat)?.color ?? "#e6f1f5";

const globe = createGlobe("map", (id) => select(areas().find((a) => a.id === id)));

// ---- Left panel: themes and the list of areas ----

for (const c of [{ id: "all", label: "All themes", color: "#e6f1f5" }, ...CATEGORIES]) {
  const dot = el("span", { className: "dot" });
  dot.style.background = c.color;
  const tab = el("button", { type: "button", onclick: () => setCategory(c.id) }, dot, c.label);
  tab.dataset.cat = c.id;
  tabs.append(tab);
}

function setCategory(id: string) {
  cat = id;
  if (selected && !inCategory(selected, cat)) select(undefined, false);
  else renderBrowser();
  const first = areas().find((a) => inCategory(a, cat));
  if (!selected && first && cat !== "all") globe.lookAt(first);
}

function renderBrowser() {
  for (const tab of tabs.children) tab.setAttribute("aria-pressed", String((tab as HTMLElement).dataset.cat === cat));

  const c = category(cat);
  topics.replaceChildren(
    ...(c
      ? [el("p", { className: "muted" }, `${c.label} covers:`), el("ul", {}, ...c.topics.map((t) => el("li", {}, t)))]
      : [el("p", { className: "muted" }, "Pick a theme to light up only its areas.")]),
  );

  const shown = areas().filter((a) => inCategory(a, cat));
  results.replaceChildren(
    ...shown.map((a) => {
      const dates = a.events.map((e) => e.date);
      const dot = el("span", { className: "dot" });
      dot.style.background = colorOf(a);
      const row = el(
        "button",
        { type: "button", className: "result", onclick: () => select(a) },
        el("strong", {}, dot, a.title, ...(a.synthetic ? [el("span", { className: "tag" }, "sample")] : [])),
        el(
          "span",
          { className: "muted" },
          `${dates.length ? `${dates[0]} to ${dates.at(-1)}` : "No dates yet"} · ${a.events.length} reports · ${a.layers.length} radar images`,
        ),
      );
      if (a.id === selected?.id) row.setAttribute("aria-current", "true");
      return el("li", {}, row);
    }),
  );
  if (!shown.length) results.append(el("li", { className: "muted" }, "No areas for this theme yet."));

  $("banner").hidden = !shown.some((a) => a.synthetic);
  globe.setAreas(shown.map((area) => ({ area, color: colorOf(area) })), selected?.id);
}

// ---- Right panel: one area ----

function select(a: AreaView | undefined, moveFocus = true) {
  selected = a;
  view.pol = a ? (polarizations(a.layers)[0] ?? "") : "";
  view.date = a ? (datesFor(a.layers, view.pol).at(-1) ?? "") : "";
  renderBrowser();
  renderDetail();
  globe.focus(a);
  if (moveFocus) detail.querySelector<HTMLElement>("h2")?.focus();
}

function renderDetail() {
  const a = selected;
  if (!a) {
    globe.showOverlay(undefined, BASE, 1);
    detail.replaceChildren(
      el("h2", { tabIndex: -1 }, "Pick an area"),
      el("p", { className: "muted" }, "Choose a glowing dot on the globe, or an area from the list, to see its timeline and radar images."),
    );
    return;
  }

  const heading = el("h2", { tabIndex: -1 }, a.title);
  const chips = el("p", {}, ...a.categories.map((id) => el("span", { className: "tag" }, category(id)?.label ?? id)));
  if (a.synthetic) chips.append(el("span", { className: "tag warn" }, "sample data"));

  detail.replaceChildren(
    el("button", { type: "button", onclick: () => select(undefined) }, "← Back to the globe"),
    heading,
    chips,
    el("p", {}, a.summary),
    ...radarSection(a),
    el("h3", {}, "Timeline"),
    a.events.length
      ? el("ol", { className: "timeline" }, ...a.events.map((e) => el("li", {}, el("time", { dateTime: e.date }, e.date), el("strong", {}, e.title), el("p", { className: "muted" }, e.text))))
      : el("p", { className: "muted" }, "No reports yet."),
    ...(a.credits.length ? [el("h3", {}, "Credits"), el("ul", {}, ...a.credits.map((c) => el("li", { className: "muted" }, c)))] : []),
  );
}

function radarSection(a: AreaView): Node[] {
  if (!a.layers.length) {
    globe.showOverlay(undefined, BASE, 1);
    return [el("h3", {}, "Radar images"), el("p", { className: "muted" }, "No radar images for this area yet.")];
  }
  const info = el("div");
  const dateOut = el("output", {}, view.date);
  const slider = el("input", { type: "range", id: "date", min: "0", step: "1" });
  const polSelect = el("select", { id: "pol" }, ...polarizations(a.layers).map((p) => el("option", { value: p, selected: p === view.pol }, p)));

  // The slider moves over the available dates only, so it cannot land on a gap.
  const setDates = () => {
    const dates = datesFor(a.layers, view.pol);
    if (!dates.includes(view.date)) view.date = dates.at(-1) ?? "";
    slider.max = String(Math.max(dates.length - 1, 0));
    slider.value = String(dates.indexOf(view.date));
    slider.disabled = dates.length < 2;
    update();
  };
  const update = () => {
    dateOut.textContent = view.date;
    slider.setAttribute("aria-valuetext", view.date);
    const layer = layerAt(a.layers, view.pol, view.date);
    globe.showOverlay(layer, BASE, view.opacity);
    info.replaceChildren(...(layer ? layerInfo(layer) : []));
  };
  slider.oninput = () => {
    view.date = datesFor(a.layers, view.pol)[+slider.value];
    update();
  };
  polSelect.onchange = () => {
    view.pol = polSelect.value;
    setDates();
  };
  const opacity = el("input", { type: "range", id: "opacity", min: "0", max: "1", step: "0.05", value: String(view.opacity) });
  opacity.oninput = () => globe.setOpacity((view.opacity = +opacity.value));

  setDates();
  return [
    el("h3", {}, "Radar images"),
    el("label", { htmlFor: "pol" }, "Polarization (how the radar wave is sent and received)"), polSelect,
    el("label", { htmlFor: "date" }, "Date: ", dateOut), slider,
    el("label", { htmlFor: "opacity" }, "Image opacity"), opacity,
    info,
  ];
}

function layerInfo(l: Layer): Node[] {
  const out: Node[] = [el("p", {}, l.description)];
  if (l.value_range) {
    const [min, max] = l.value_range;
    // shortcut: only the "gray" colormap has a color bar; others show the range as text. Add ramps as the back end adds colormaps.
    if (l.colormap === "gray") out.push(el("div", { className: "ramp" }));
    out.push(el("p", { className: "legend" }, el("span", {}, `${min} ${l.units}`), el("span", {}, `${max} ${l.units}`)));
  }
  const p = l.provenance;
  const row = (k: string, v: Node | string) => [el("dt", {}, k), el("dd", {}, v)];
  out.push(
    el(
      "details",
      {},
      el("summary", {}, "Where this comes from"),
      el(
        "dl",
        {},
        ...row("Product", l.product),
        ...row("Polarization", l.polarization ?? "none"),
        ...row("Data maturity", l.maturity),
        ...row("Source granules", p.source_granules.join(", ") || "none (synthetic)"),
        ...row("Processing steps", el("ol", {}, ...p.steps.map((s) => el("li", {}, s)))),
        ...row("Parameters", JSON.stringify(p.params)),
        ...row("Software", JSON.stringify(p.software)),
        ...row("Credit", p.attribution),
      ),
    ),
  );
  return out;
}

// ---- Live data from the back end (optional: the app works without it) ----

async function loadLive() {
  try {
    const res = await fetch(new URL("manifest.json", BASE));
    if (!res.ok) throw new Error(String(res.status));
    const manifest: Manifest = await res.json();
    if (supportedVersion(manifest.contract_version)) {
      live = manifest.areas.map(toAreaView);
      status.className = "muted";
      status.textContent = `Radar data connected: ${live.length} area(s).`;
    } else {
      live = [];
      status.className = "error";
      status.textContent = `The radar data is in a newer format (version ${manifest.contract_version}) that this app cannot read, so it is not shown.`;
    }
  } catch {
    live = [];
    status.className = "muted";
    status.textContent = "Radar data server not connected. Showing sample areas only.";
  }
  // Keep the open area open across refreshes, without stealing keyboard focus.
  if (selected) select(areas().find((a) => a.id === selected!.id), false);
  else renderBrowser();
}

renderBrowser();
renderDetail();
loadLive();

// Live updates exist only on the back-end server, not on the static build: give up quietly there.
const events = new EventSource(new URL("events", BASE));
events.addEventListener("manifest", loadLive);
events.onerror = () => events.readyState === EventSource.CONNECTING || events.close();

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
