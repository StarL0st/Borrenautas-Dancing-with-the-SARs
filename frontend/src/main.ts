import "./style.css";
import { EXAMPLE_AREAS } from "./example-areas";
import { GROUPS, typeLabel } from "./filters";
import { createGlobe, type ViewMode } from "./globe";
import {
  datesFor, inFilter, layerAt, polarizations, supportedVersion, toAreaView,
  type AreaView, type EventFeature, type Layer, type Manifest,
} from "./logic";
import { startTour } from "./tour";
import { el } from "./ui";
import { createWheel } from "./wheel";

// Live backend by default; set VITE_DATA_BASE=./data/ for the static build (contract C6).
const BASE = new URL(import.meta.env.VITE_DATA_BASE ?? "http://127.0.0.1:8765/", location.href);

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const filters = $("filters"), results = $("results"), status = $("status"), cards = $("cards"), banner = $("banner");

let live: AreaView[] = [];
let reports: EventFeature[] = []; // detected changes from events.geojson (contract 0.3)
const ticked = new Set(GROUPS.flatMap((g) => g.items.map((i) => i.id))); // filter types switched on
let opened: string[] = []; // area ids open as tabs, newest first
const collapsed = new Set<string>();
const views = new Map<string, { pol: string; date: string; opacity: number }>(); // radar settings per area

const areas = () => [...live, ...EXAMPLE_AREAS];
const colorOf = (a: AreaView) =>
  GROUPS.find((g) => g.items.some((i) => ticked.has(i.id) && a.types.includes(i.id)))?.color ?? "#e6f1f5";
const categoryColor = (c: string) => GROUPS.find((g) => g.items.some((i) => i.id === c))?.color ?? "#e6f1f5";
// Like areas: an event whose categories are not filters ("other") is always shown.
const eventShown = (e: EventFeature) => {
  const cats = e.properties.categories.split(",").filter((c) => GROUPS.some((g) => g.items.some((i) => i.id === c)));
  return !cats.length || cats.some((c) => ticked.has(c));
};
const dot = (color: string) => {
  const d = el("span", { className: "dot" });
  d.style.background = color;
  return d;
};

const globe = createGlobe("map", toggle);

// ---- Left panel: filters ----

for (const g of GROUPS) {
  const all = el("input", { type: "checkbox", checked: true });
  const boxes = g.items.map((item) => {
    const box = el("input", { type: "checkbox", checked: true });
    box.onchange = () => {
      if (box.checked) ticked.add(item.id);
      else ticked.delete(item.id);
      const n = boxes.filter((b) => b.checked).length;
      all.checked = n === boxes.length;
      all.indeterminate = n > 0 && n < boxes.length;
      render();
    };
    return box;
  });
  all.onchange = () => {
    for (const [i, box] of boxes.entries()) {
      box.checked = all.checked;
      if (all.checked) ticked.add(g.items[i].id);
      else ticked.delete(g.items[i].id);
    }
    render();
  };
  filters.append(
    el(
      "details",
      { open: g === GROUPS[0] },
      el("summary", {}, dot(g.color), g.label),
      el("label", { className: "check all" }, all, "Select all"),
      ...boxes.map((box, i) => el("label", { className: "check" }, box, g.items[i].label)),
    ),
  );
}

// ---- Left panel: coordinates ----

$<HTMLFormElement>("coords").onsubmit = (e) => {
  e.preventDefault(); // the browser has already checked both numbers are present and in range
  globe.goTo(+$<HTMLInputElement>("lon").value, +$<HTMLInputElement>("lat").value);
};

// Ask the back end to process the typed place (needs `serve --jobs`). It shows up when ready:
// the server pushes a manifest event and the app reloads.
$("process").onclick = async () => {
  const form = $<HTMLFormElement>("coords");
  if (!form.reportValidity()) return;
  const lat = +$<HTMLInputElement>("lat").value, lon = +$<HTMLInputElement>("lon").value;
  status.className = "muted";
  status.textContent = "Asking the radar data server to process this place...";
  try {
    const res = await fetch(new URL("sites", BASE), {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ lat, lon }),
    });
    status.textContent =
      res.status === 202 ? "Processing this place. It appears on the globe when ready (a few minutes)."
      : res.status === 404 ? "This radar data server does not process new places."
      : res.status === 401 ? "Processing new places needs an access token on this server."
      : `The server could not take the request (${res.status}).`;
  } catch {
    status.textContent = "Radar data server not connected.";
  }
};

// ---- Area list, dots and open tabs ----

function render() {
  const shown = areas().filter((a) => inFilter(a, ticked));
  opened = opened.filter((id) => shown.some((a) => a.id === id));

  results.replaceChildren(
    ...shown.map((a) => {
      const dates = a.events.map((e) => e.date);
      const row = el(
        "button",
        { type: "button", className: "result", onclick: () => toggle(a.id) },
        el("strong", {}, dot(colorOf(a)), a.title),
        el(
          "span",
          { className: "muted" },
          a.example
            ? "Example location · no data yet"
            : `${dates.length ? `${dates[0]} to ${dates.at(-1)}` : "No dates yet"} · ${a.layers.length} radar images`,
        ),
      );
      row.setAttribute("aria-pressed", String(opened.includes(a.id)));
      return el("li", {}, row);
    }),
  );
  if (!shown.length) results.append(el("li", { className: "muted" }, "No areas match the ticked filters."));

  const notes = [
    shown.some((a) => a.example) && "Example locations are real places with no radar data or reports loaded yet.",
    shown.some((a) => a.synthetic) && "Radar images shown are synthetic test data, not real observations.",
  ].filter(Boolean);
  banner.hidden = !notes.length;
  banner.textContent = notes.join(" ");

  globe.setAreas(shown.map((area) => ({ area, color: colorOf(area) })), opened);
  globe.setEvents(
    reports.filter(eventShown).map((e) => ({ ...e, properties: { ...e.properties, color: categoryColor(e.properties.category) } })),
  );
  globe.keepOverlays(opened);
  cards.replaceChildren(
    ...(opened.length
      ? opened.map((id) => card(shown.find((a) => a.id === id)!))
      : [el("p", { className: "muted" }, "Click a dot on the globe, or an area in the list, to open it here. Click it again to close it.")]),
  );
}

// Clicking a dot or a list row opens the area as a tab; clicking again closes it.
function toggle(id: string) {
  const a = areas().find((x) => x.id === id);
  if (!a) return;
  const opening = !opened.includes(id);
  opened = opening ? [id, ...opened] : opened.filter((x) => x !== id);
  if (opening) {
    collapsed.delete(id);
    globe.focus(a);
  }
  render();
  if (opening) cards.querySelector<HTMLElement>("summary")?.focus();
}

function card(a: AreaView) {
  const tags = el("p", {}, ...a.types.map((t) => el("span", { className: "tag" }, typeLabel(t))));
  if (a.example) tags.append(el("span", { className: "tag warn" }, "example location"));
  if (a.synthetic) tags.append(el("span", { className: "tag warn" }, "synthetic test data"));

  const box = el(
    "details",
    { className: "card", open: !collapsed.has(a.id) },
    el("summary", {}, dot(colorOf(a)), a.title),
    el(
      "p",
      { className: "actions" },
      el("button", { type: "button", onclick: () => globe.focus(a) }, "Show on globe"),
      el("button", { type: "button", onclick: () => toggle(a.id) }, "Close"),
    ),
    tags,
    el("p", {}, a.summary),
    ...radarSection(a),
    el("h4", {}, "Timeline"),
    a.events.length
      ? el("ol", { className: "timeline" }, ...a.events.map((e) => el("li", {}, el("time", { dateTime: e.date }, e.date), el("strong", {}, e.title), el("p", { className: "muted" }, e.text))))
      : el("p", { className: "muted" }, "No reports yet. They will come from the back end."),
    ...(a.credits.length ? [el("h4", {}, "Credits"), el("ul", {}, ...a.credits.map((c) => el("li", { className: "muted" }, c)))] : []),
  );
  box.ontoggle = () => (box.open ? collapsed.delete(a.id) : collapsed.add(a.id));
  return box;
}

function radarSection(a: AreaView): Node[] {
  if (!a.layers.length) return [el("h4", {}, "Radar images"), el("p", { className: "muted" }, "No radar images for this area yet.")];

  const pols = polarizations(a.layers);
  const v = views.get(a.id) ?? { pol: pols[0], date: "", opacity: 1 };
  views.set(a.id, v);
  if (!pols.includes(v.pol)) v.pol = pols[0];

  const info = el("div");
  const dateOut = el("output", {}, v.date);
  const slider = el("input", { type: "range", id: `date-${a.id}`, min: "0", step: "1" });
  const polSelect = el("select", { id: `pol-${a.id}` }, ...pols.map((p) => el("option", { value: p, selected: p === v.pol }, p)));

  // The slider moves over the available dates only, so it cannot land on a gap.
  const setDates = () => {
    const dates = datesFor(a.layers, v.pol);
    if (!dates.includes(v.date)) v.date = dates.at(-1) ?? "";
    slider.max = String(Math.max(dates.length - 1, 0));
    slider.value = String(dates.indexOf(v.date));
    slider.disabled = dates.length < 2;
    update();
  };
  const update = () => {
    dateOut.textContent = v.date;
    slider.setAttribute("aria-valuetext", v.date);
    const layer = layerAt(a.layers, v.pol, v.date);
    globe.showOverlay(a.id, layer, BASE, v.opacity);
    info.replaceChildren(...(layer ? layerInfo(layer) : []));
  };
  slider.oninput = () => {
    v.date = datesFor(a.layers, v.pol)[+slider.value];
    update();
  };
  polSelect.onchange = () => {
    v.pol = polSelect.value;
    setDates();
  };
  const opacity = el("input", { type: "range", id: `opacity-${a.id}`, min: "0", max: "1", step: "0.05", value: String(v.opacity) });
  opacity.oninput = () => globe.setOpacity(a.id, (v.opacity = +opacity.value));

  setDates();
  return [
    el("h4", {}, "Radar images"),
    el("label", { htmlFor: polSelect.id }, "Layer (radar image per polarization, detected change, ground motion, soil moisture)"), polSelect,
    el("label", { htmlFor: slider.id }, "Date: ", dateOut), slider,
    el("label", { htmlFor: opacity.id }, "Image opacity"), opacity,
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
  const row = (k: string, val: Node | string) => [el("dt", {}, k), el("dd", {}, val)];
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
      // events.geojson is optional (older back ends have none); the areas still load without it.
      reports = await fetch(new URL("events.geojson", BASE))
        .then((r) => (r.ok ? r.json() : { features: [] }))
        .then((g) => g.features ?? [])
        .catch(() => []);
      live = manifest.areas.map((a) => toAreaView(a, reports));
      status.className = "muted";
      status.textContent = `Radar data connected: ${live.length} area(s), ${reports.length} detected change(s).`;
    } else {
      live = [];
      status.className = "error";
      status.textContent = `The radar data is in a newer format (version ${manifest.contract_version}) that this app cannot read, so it is not shown.`;
    }
  } catch {
    live = [];
    reports = [];
    status.className = "muted";
    status.textContent = "Radar data server not connected. Showing example locations only.";
  }
  render();
}

render();
loadLive();

// Live updates exist only on the back-end server, not on the static build: give up quietly there.
const events = new EventSource(new URL("events", BASE));
events.addEventListener("manifest", loadLive);
events.onerror = () => events.readyState === EventSource.CONNECTING || events.close();

// ---- View switch and view wheel ----

const viewButtons: Record<ViewMode, HTMLElement> = { globe: $("view-globe"), closeup: $("view-closeup") };
for (const [mode, button] of Object.entries(viewButtons) as [ViewMode, HTMLElement][]) {
  button.onclick = () => {
    globe.setView(mode);
    for (const [m, b] of Object.entries(viewButtons)) b.setAttribute("aria-pressed", String(m === mode));
  };
}

const wheel = $("wheel"), wheelBtn = $("wheel-btn");
const showWheel = (on: boolean) => {
  wheel.hidden = !on;
  wheelBtn.setAttribute("aria-pressed", String(on));
};
wheelBtn.onclick = () => showWheel(!!wheel.hidden);
createWheel(wheel, globe.tools, () => {
  showWheel(false);
  wheelBtn.focus();
});

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
