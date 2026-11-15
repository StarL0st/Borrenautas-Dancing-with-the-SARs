// Before/after comparator with zoom and a change-percentage control (jopa-testing).
//
// Two pictures of the same place on two dates, drawn on canvases so the change can be measured
// pixel by pixel (compare-core.ts). A divider swipes between them; zoom with the buttons, the
// wheel, a double-click or the keyboard; drag to move. "Mark what changed" paints the pixels
// whose brightness changed by more than the chosen percentage and says how much of the view did.
//
// Pixels can only be read when the server allows it (CORS): NASA GIBS and the team's storage do.
// When a server does not, the comparator still swipes and zooms and says change cannot be measured.
import { changeMap, isCloud, pctToDb, viewRect, type Decode } from "./compare-core";
import { t } from "./i18n";
import { el } from "./ui";

export type Picture = { url: string; date: string; decode: Decode };
export type CompareState = { z: number; cx: number; cy: number; swipe: number; mark: boolean; pct: number };
type Rect = [number, number, number, number];

export type CompareOptions = {
  id: string; // unique per card, for the controls' ids
  kind: "radar" | "optical";
  before: Picture;
  after: Picture;
  state: CompareState; // kept by the caller, so the view survives the card being rebuilt
  technical: boolean; // Technical mode also says the threshold in dB
  basic?: boolean; // Simple mode's guide: no threshold slider, no help text, a plainer result
  /** Sharper pictures of a zoomed-in part, when the source can make them (GIBS can). */
  sharper?: (rect: Rect) => { before: string; after: string } | undefined;
  origin: (Node | string)[]; // the source badges, shown under the pictures
};

export const newCompareState = (kind: "radar" | "optical"): CompareState => ({
  z: 1, cx: 0.5, cy: 0.5, swipe: 50, mark: true, pct: kind === "radar" ? 50 : 30,
});

const MAX_ZOOM = 8;
const W = 480; // canvas width in pixels; the height follows the picture
const BRIGHTER = [86, 180, 233]; // Okabe-Ito sky blue
const DARKER = [213, 94, 0]; // Okabe-Ito vermillion

function load(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(url));
    img.src = url;
  });
}

const fmt = (n: number) => (n >= 10 ? n.toFixed(0) : n.toFixed(1));

export function comparator(o: CompareOptions): HTMLElement {
  const s = o.state;
  const afterC = el("canvas", { className: "cmp-after" });
  const beforeC = el("canvas", { className: "cmp-before" });
  const overlay = el("canvas", { className: "cmp-marks" });
  const canvases = [afterC, beforeC, overlay];
  const line = el("span", { className: "cmp-line" });
  const tagBefore = el("span", { className: "tag-before" }, `${t("cmp.before")} · ${o.before.date}`);
  const tagAfter = el("span", { className: "tag-now" }, `${t("cmp.after")} · ${o.after.date}`);
  const frame = el("div", { className: "cmp-frame", tabIndex: 0 }, afterC, beforeC, overlay, line, tagBefore, tagAfter);
  frame.setAttribute("role", "img");
  frame.setAttribute("aria-label", `${t("cmp.before")} ${o.before.date}, ${t("cmp.after")} ${o.after.date}. ${t("cmp.help")}`);

  const status = el("p", { className: "muted" }, t("cmp.loading"));
  const zoomOut = el("button", { type: "button", className: "icon-btn", title: t("cmp.zoomout") }, "−");
  const zoomOutput = el("output", { className: "cmp-zoom" });
  const zoomIn = el("button", { type: "button", className: "icon-btn", title: t("cmp.zoomin") }, "+");
  const reset = el("button", { type: "button" }, t("cmp.reset"));
  zoomOut.setAttribute("aria-label", t("cmp.zoomout"));
  zoomIn.setAttribute("aria-label", t("cmp.zoomin"));

  const swipe = el("input", { type: "range", min: "0", max: "100", step: "1", value: String(s.swipe), id: `cmp-swipe-${o.id}` });
  swipe.setAttribute("aria-label", t("cmp.swipe"));
  const mark = el("input", { type: "checkbox", checked: s.mark, id: `cmp-mark-${o.id}` });
  const pct = el("input", { type: "range", min: "5", max: "90", step: "5", value: String(s.pct), id: `cmp-pct-${o.id}` });
  const pctLabel = el("label", { htmlFor: pct.id });
  const stats = el("p", { className: "cmp-stats" });
  stats.setAttribute("role", "status");
  const legend = el(
    "p",
    { className: "cmp-legend" },
    el("span", { className: "sw up" }), t("cmp.brighter"), " ",
    el("span", { className: "sw down" }), t("cmp.darker"),
  );

  let imgs: { before: HTMLImageElement; after: HTMLImageElement } | undefined;
  let sharp: { key: string; before: HTMLImageElement; after: HTMLImageElement } | undefined;
  let readable = true;
  const keyOf = (r: Rect) => r.map((v) => v.toFixed(4)).join(",");

  const setSwipe = () => {
    s.swipe = +swipe.value;
    frame.style.setProperty("--x", `${s.swipe}%`);
  };

  const setPctLabel = () => {
    const p = s.pct / 100;
    pctLabel.textContent = o.technical && o.kind === "radar"
      ? t("cmp.thresholdDb", { pct: s.pct, db: pctToDb(p).toFixed(1) })
      : t("cmp.threshold", { pct: s.pct });
    pct.setAttribute("aria-valuetext", pctLabel.textContent);
  };

  // Marks are measured on what is on screen, a moment after the view stops moving.
  let marksTimer = 0;
  const scheduleMarks = () => {
    clearTimeout(marksTimer);
    marksTimer = window.setTimeout(paintMarks, 90);
  };
  function paintMarks() {
    const g = overlay.getContext("2d")!;
    g.clearRect(0, 0, overlay.width, overlay.height);
    pct.disabled = !s.mark || !readable;
    legend.hidden = !s.mark || !readable;
    if (!imgs) return;
    if (!readable) {
      stats.textContent = t("cmp.nostats");
      return;
    }
    if (!s.mark) {
      stats.textContent = "";
      return;
    }
    const w = overlay.width, h = overlay.height;
    let b: ImageData, a: ImageData;
    try {
      b = beforeC.getContext("2d", { willReadFrequently: true })!.getImageData(0, 0, w, h);
      a = afterC.getContext("2d", { willReadFrequently: true })!.getImageData(0, 0, w, h);
    } catch {
      readable = false; // the server did not allow reading its pixels
      mark.disabled = true;
      paintMarks();
      return;
    }
    const { codes, stats: n } = changeMap(b.data, a.data, w, h, o.before.decode, o.after.decode, s.pct / 100, o.kind === "optical");
    const out = g.createImageData(w, h);
    for (let i = 0; i < codes.length; i++) {
      const c = codes[i] === 1 ? BRIGHTER : codes[i] === 2 ? DARKER : undefined;
      if (!c) continue;
      out.data.set(c, i * 4);
      out.data[i * 4 + 3] = 200;
    }
    g.putImageData(out, 0, 0);
    if (!n.valid) {
      stats.textContent = t("cmp.nostats");
      return;
    }
    const up = (100 * n.brighter) / n.valid, down = (100 * n.darker) / n.valid;
    // Photos: the share of the view that is cloud in either picture (left out of the count).
    let clouds = 0;
    if (o.kind === "optical") {
      for (let i = 0; i < b.data.length; i += 4) {
        if (isCloud(b.data[i], b.data[i + 1], b.data[i + 2]) || isCloud(a.data[i], a.data[i + 1], a.data[i + 2])) clouds++;
      }
      clouds = (100 * clouds) / (w * h);
    }
    if (o.basic) {
      // Too cloudy to count fairly: say why instead of showing a number that clouds made up.
      stats.textContent = clouds > 10 ? t("cmp.kidclouds") : t("cmp.kidstats", { n: Math.max(up + down > 0 ? 1 : 0, Math.round(up + down)) });
      return;
    }
    stats.textContent = t("cmp.stats", { pct: fmt(up + down), up: fmt(up), down: fmt(down) }) + (clouds >= 1 ? ` ${t("cmp.clouds", { pct: fmt(clouds) })}` : "");
  }

  // Sharper pictures for the zoomed-in part, once the view has rested.
  let sharpTimer = 0;
  const scheduleSharp = (rect: Rect) => {
    clearTimeout(sharpTimer);
    if (!o.sharper || s.z < 1.5) return;
    const key = keyOf(rect);
    if (sharp?.key === key) return;
    sharpTimer = window.setTimeout(() => {
      const urls = o.sharper!(rect);
      if (!urls) return;
      Promise.all([load(urls.before), load(urls.after)])
        .then(([before, after]) => {
          if (keyOf(viewRect(s.z, s.cx, s.cy)) !== key) return; // the view moved on meanwhile
          sharp = { key, before, after };
          draw();
        })
        .catch(() => undefined); // the blurrier zoom stays
    }, 450);
  };

  function draw() {
    if (!imgs) return;
    const rect = viewRect(s.z, s.cx, s.cy);
    [s.cx, s.cy] = [(rect[0] + rect[2]) / 2, (rect[1] + rect[3]) / 2];
    const useSharp = sharp && sharp.key === keyOf(rect) ? sharp : undefined;
    for (const [c, img, hd] of [[beforeC, imgs.before, useSharp?.before], [afterC, imgs.after, useSharp?.after]] as const) {
      const g = c.getContext("2d", { willReadFrequently: true })!;
      g.clearRect(0, 0, c.width, c.height);
      // Radar pixels stay square when zoomed in: they are the measurement, not a photo.
      g.imageSmoothingEnabled = !(o.kind === "radar" && s.z >= 3);
      if (hd) g.drawImage(hd, 0, 0, c.width, c.height);
      else {
        const nw = img.naturalWidth, nh = img.naturalHeight;
        g.drawImage(img, rect[0] * nw, rect[1] * nh, (rect[2] - rect[0]) * nw, (rect[3] - rect[1]) * nh, 0, 0, c.width, c.height);
      }
    }
    zoomOutput.textContent = t("cmp.zoom", { n: fmt(s.z) }) + (useSharp ? ` · ${t("cmp.sharp")}` : "");
    zoomOut.disabled = s.z <= 1;
    zoomIn.disabled = s.z >= MAX_ZOOM;
    frame.classList.toggle("zoomed", s.z > 1);
    scheduleMarks();
    scheduleSharp(rect);
  }

  // Zoom by `factor`, keeping the picture point under (fx, fy) (0..1 of the frame) in place.
  function zoomAt(factor: number, fx = 0.5, fy = 0.5) {
    const [x0, y0] = viewRect(s.z, s.cx, s.cy);
    const u = x0 + fx / s.z, v = y0 + fy / s.z;
    s.z = Math.min(MAX_ZOOM, Math.max(1, s.z * factor));
    s.cx = u - (fx - 0.5) / s.z;
    s.cy = v - (fy - 0.5) / s.z;
    draw();
  }

  const at = (e: MouseEvent) => {
    const r = frame.getBoundingClientRect();
    return [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height] as const;
  };

  frame.addEventListener("wheel", (e) => {
    e.preventDefault();
    zoomAt(e.deltaY < 0 ? 1.25 : 0.8, ...at(e));
  }, { passive: false });
  frame.ondblclick = (e) => zoomAt(2, ...at(e));

  // Drag: moves the picture when zoomed in, the divider when not.
  let drag: { x: number; y: number; cx: number; cy: number } | undefined;
  frame.onpointerdown = (e) => {
    frame.setPointerCapture(e.pointerId);
    drag = { x: e.clientX, y: e.clientY, cx: s.cx, cy: s.cy };
    if (s.z <= 1) {
      swipe.value = String(Math.round(at(e)[0] * 100));
      setSwipe();
    }
  };
  frame.onpointermove = (e) => {
    if (!drag) return;
    const r = frame.getBoundingClientRect();
    if (s.z <= 1) {
      swipe.value = String(Math.round(Math.min(1, Math.max(0, at(e)[0])) * 100));
      setSwipe();
      return;
    }
    s.cx = drag.cx - (e.clientX - drag.x) / r.width / s.z;
    s.cy = drag.cy - (e.clientY - drag.y) / r.height / s.z;
    draw();
  };
  frame.onpointerup = frame.onpointercancel = () => (drag = undefined);

  frame.onkeydown = (e) => {
    const step = 0.1 / s.z;
    const moves: Record<string, () => void> = {
      "+": () => zoomAt(1.5), "=": () => zoomAt(1.5), "-": () => zoomAt(1 / 1.5), "0": () => resetView(),
      ArrowLeft: () => ((s.cx -= step), draw()), ArrowRight: () => ((s.cx += step), draw()),
      ArrowUp: () => ((s.cy -= step), draw()), ArrowDown: () => ((s.cy += step), draw()),
    };
    if (!moves[e.key]) return;
    e.preventDefault();
    moves[e.key]();
  };

  const resetView = () => {
    s.z = 1;
    s.cx = s.cy = 0.5;
    draw();
  };
  zoomIn.onclick = () => zoomAt(1.5);
  zoomOut.onclick = () => zoomAt(1 / 1.5);
  reset.onclick = resetView;
  swipe.oninput = setSwipe;
  mark.onchange = () => {
    s.mark = mark.checked;
    paintMarks();
  };
  pct.oninput = () => {
    s.pct = +pct.value;
    setPctLabel();
    scheduleMarks();
  };

  setSwipe();
  setPctLabel();
  frame.hidden = true;
  Promise.all([load(o.before.url), load(o.after.url)])
    .then(([before, after]) => {
      imgs = { before, after };
      const h = Math.max(60, Math.round((W * before.naturalHeight) / before.naturalWidth));
      for (const c of canvases) [c.width, c.height] = [W, h];
      frame.hidden = false;
      status.textContent = "";
      draw();
    })
    .catch(() => (status.textContent = t("cmp.loadfailed")));

  return el(
    "div",
    { className: "cmp" },
    status,
    frame,
    el(
      "div",
      { className: "cmp-row" },
      zoomOut, zoomOutput, zoomIn, reset,
      el("label", { htmlFor: swipe.id, className: "cmp-swipe" }, el("span", { className: "muted" }, t("cmp.before")), swipe, el("span", { className: "muted" }, t("cmp.after"))),
    ),
    el("div", { className: "cmp-row" }, el("label", { className: "check", htmlFor: mark.id }, mark, " ", t("cmp.mark"))),
    ...(o.basic ? [] : [pctLabel, pct]),
    legend,
    stats,
    ...(o.basic ? [] : [el("p", { className: "muted small" }, t("cmp.help"), " ", t(o.kind === "radar" ? "cmp.radar" : "cmp.optical"))]),
    el("p", { className: "origin-line" }, ...o.origin),
  );
}
