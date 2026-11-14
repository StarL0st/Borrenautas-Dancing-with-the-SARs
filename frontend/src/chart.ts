// A small line chart of values over dates, with a hover readout and a table view.
import { ticks } from "./logic";
import { el } from "./ui";

export type Series = { label: string; points: { date: string; value: number }[] };

// Checked with the dataviz palette validator against the card surface (#031927, dark):
// lightness band, chroma, colorblind separation and 3:1 contrast all pass.
// shortcut: three colors, so at most three lines per chart; fold extra series into small
// multiples if the back end ever sends more per unit.
const COLORS = ["#3987e5", "#d95926", "#199e70"];

const SVG = "http://www.w3.org/2000/svg";
const svg = (tag: string, attrs: Record<string, string | number>) => {
  const node = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  return node;
};
const swatch = (color: string) => {
  const s = el("span", { className: "swatch" });
  s.style.background = color;
  return s;
};

export function chart(all: Series[], text: { caption: string; table: string; date: string; units: string }) {
  const series = all.slice(0, COLORS.length);
  const dates = [...new Set(series.flatMap((s) => s.points.map((p) => p.date)))].sort();
  const values = series.flatMap((s) => s.points.map((p) => p.value));
  const yTicks = ticks(Math.min(...values), Math.max(...values), 3);
  const lo = yTicks[0], hi = yTicks.at(-1)!;
  const digits = hi - lo < 2 ? 2 : 1;
  const fmt = (v: number | undefined) => (v === undefined ? "–" : v.toFixed(digits));

  const W = 280, H = 150, L = 38, R = 40, T = 10, B = 24; // about one unit per screen pixel in a tab
  const t0 = Date.parse(dates[0]), t1 = Date.parse(dates.at(-1)!);
  const x = (date: string) => (t1 > t0 ? L + ((Date.parse(date) - t0) / (t1 - t0)) * (W - L - R) : (L + W - R) / 2);
  const y = (v: number) => (hi > lo ? T + (1 - (v - lo) / (hi - lo)) * (H - T - B) : (T + H - B) / 2);

  const plot = svg("svg", { viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": text.caption });
  for (const v of yTicks) {
    plot.append(svg("line", { x1: L, x2: W - R, y1: y(v), y2: y(v), class: "grid" }));
    const label = svg("text", { x: L - 6, y: y(v), class: "axis", "text-anchor": "end", "dominant-baseline": "middle" });
    label.textContent = fmt(v);
    plot.append(label);
  }
  for (const [date, anchor] of dates.length > 1 ? [[dates[0], "start"], [dates.at(-1)!, "end"]] : [[dates[0], "middle"]]) {
    const label = svg("text", { x: x(date), y: H - 6, class: "axis", "text-anchor": anchor });
    label.textContent = date;
    plot.append(label);
  }
  const cross = svg("line", { y1: T, y2: H - B, class: "cross", visibility: "hidden" });
  plot.append(cross);

  // Name each line at its right end; push labels apart when two lines end close together.
  const ends = series
    .map((s, i) => ({ s, i, at: y(s.points.at(-1)!.value) }))
    .sort((a, b) => a.at - b.at);
  for (let k = 1; k < ends.length; k++) ends[k].at = Math.max(ends[k].at, ends[k - 1].at + 12);

  for (const { s, i, at } of ends) {
    plot.append(svg("polyline", { points: s.points.map((p) => `${x(p.date)},${y(p.value)}`).join(" "), class: "line", stroke: COLORS[i] }));
    for (const p of s.points) plot.append(svg("circle", { cx: x(p.date), cy: y(p.value), r: 4, class: "mark", fill: COLORS[i] }));
    const label = svg("text", { x: W - R + 8, y: at, class: "end", "dominant-baseline": "middle" });
    label.textContent = s.label;
    plot.append(label);
  }

  // Hover: a line at the nearest date and a readout of every series there.
  const tip = el("div", { className: "chart-tip", hidden: true });
  const valueAt = (s: Series, date: string) => s.points.find((p) => p.date === date)?.value;
  plot.onpointermove = (e) => {
    const box = plot.getBoundingClientRect();
    const px = ((e.clientX - box.left) / box.width) * W;
    const date = dates.reduce((best, d) => (Math.abs(x(d) - px) < Math.abs(x(best) - px) ? d : best));
    cross.setAttribute("x1", String(x(date)));
    cross.setAttribute("x2", String(x(date)));
    cross.setAttribute("visibility", "visible");
    tip.replaceChildren(
      el("strong", {}, date),
      ...series.map((s, i) => el("div", {}, swatch(COLORS[i]), `${s.label}: ${fmt(valueAt(s, date))} ${text.units}`)),
    );
    tip.hidden = false;
    // Keep the readout on the side of the line with more room.
    const left = x(date) / W;
    tip.style.left = left < 0.5 ? `${left * 100 + 3}%` : "";
    tip.style.right = left < 0.5 ? "" : `${(1 - left) * 100 + 3}%`;
  };
  plot.onpointerleave = () => {
    cross.setAttribute("visibility", "hidden");
    tip.hidden = true;
  };

  return el(
    "figure",
    { className: "chart" },
    el("figcaption", { className: "muted" }, text.caption),
    ...(series.length > 1 ? [el("div", { className: "legend-row" }, ...series.map((s, i) => el("span", {}, swatch(COLORS[i]), s.label)))] : []),
    el("div", { className: "chart-plot" }, plot, tip),
    el(
      "details",
      {},
      el("summary", {}, text.table),
      el(
        "table",
        {},
        el("thead", {}, el("tr", {}, el("th", {}, text.date), ...series.map((s) => el("th", {}, `${s.label} (${text.units})`)))),
        el("tbody", {}, ...dates.map((d) => el("tr", {}, el("td", {}, d), ...series.map((s) => el("td", {}, fmt(valueAt(s, d))))))),
      ),
    ),
  );
}
