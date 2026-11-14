// View wheel: a round control with six buttons. Press a button and drag to use its tool, or
// focus it and use the arrow keys. "Center" and "Home" act on a plain click.
import type { Globe } from "./globe";
import { t } from "./i18n";
import { el } from "./ui";

type Tools = Globe["tools"];

// [tool, inner radius, outer radius, start angle, end angle]. Angles in degrees, 0 = right,
// clockwise; three buttons on the outer ring and three inside.
const WEDGES: [keyof Tools, number, number, number, number][] = [
  ["zoom", 62, 100, -150, -30],
  ["home", 62, 100, -30, 90],
  ["orbit", 62, 100, 90, 210],
  ["center", 0, 58, -150, -30],
  ["look", 0, 58, -30, 90],
  ["updown", 0, 58, 90, 210],
];

const SVG = "http://www.w3.org/2000/svg";
const at = (r: number, deg: number) => [r * Math.cos((deg * Math.PI) / 180), r * Math.sin((deg * Math.PI) / 180)];
const KEYS: Record<string, [number, number]> = { ArrowUp: [0, -24], ArrowDown: [0, 24], ArrowLeft: [-24, 0], ArrowRight: [24, 0] };

// Rebuilds the wheel inside `host`; call again after a language change.
export function createWheel(host: HTMLElement, tools: Tools, onClose: () => void) {
  const svg = document.createElementNS(SVG, "svg");
  svg.setAttribute("viewBox", "-104 -104 208 208");
  const hint = el("p", { className: "muted" }, t("wheel.hint"));

  for (const [tool, r0, r1, a0, a1] of WEDGES) {
    const isClick = tool === "center" || tool === "home";
    const help = t(`wheel.${tool}.hint`);
    const mid = (a0 + a1) / 2;
    const [x0, y0] = at(r1, a0), [x1, y1] = at(r1, a1), [x2, y2] = at(r0, a1), [x3, y3] = at(r0, a0);
    const [tx, ty] = at(r0 ? (r0 + r1) / 2 : 33, mid);

    const g = document.createElementNS(SVG, "g");
    g.setAttribute("role", "button");
    g.setAttribute("tabindex", "0");
    g.setAttribute("aria-label", isClick ? help : t("wheel.keys", { hint: help }));
    const path = document.createElementNS(SVG, "path");
    path.setAttribute("d", `M${x0} ${y0}A${r1} ${r1} 0 0 1 ${x1} ${y1}L${x2} ${y2}A${r0} ${r0} 0 0 0 ${x3} ${y3}Z`);
    const text = document.createElementNS(SVG, "text");
    text.setAttribute("x", String(tx));
    text.setAttribute("y", String(ty));
    // Outer labels follow the ring, turned whichever way keeps them upright; inner ones stay level.
    if (!r0) text.setAttribute("class", "inner");
    if (r0) text.setAttribute("transform", `rotate(${mid > 0 && mid < 180 ? mid - 90 : mid + 90} ${tx} ${ty})`);
    text.textContent = t(`wheel.${tool}`).toUpperCase();
    g.append(path, text);
    svg.append(g);

    const run = tools[tool] as (dx: number, dy: number) => void;
    let last: [number, number] | undefined;
    g.onpointerdown = (e) => {
      g.setPointerCapture(e.pointerId);
      last = [e.clientX, e.clientY];
    };
    g.onpointermove = (e) => {
      if (!last || isClick) return;
      run(e.clientX - last[0], e.clientY - last[1]);
      last = [e.clientX, e.clientY];
    };
    g.onpointerup = g.onpointercancel = () => (last = undefined);
    g.onclick = () => isClick && run(0, 0);
    g.onkeydown = (e) => {
      const step = KEYS[e.key];
      if (isClick ? e.key === "Enter" || e.key === " " : step) {
        e.preventDefault();
        run(...(step ?? [0, 0]));
      }
    };
    g.onpointerenter = g.onfocus = () => (hint.textContent = help);
  }

  const close = el("button", { type: "button", className: "wheel-close", title: t("wheel.close"), onclick: onClose });
  close.setAttribute("aria-label", t("wheel.close"));
  close.innerHTML = '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2 2l8 8M10 2l-8 8"/></svg>'; // fixed markup, no data
  host.replaceChildren(close, svg, hint);
}
