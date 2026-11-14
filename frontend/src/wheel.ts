// View wheel: a round control with eight buttons. Press a button and drag to use its tool, or
// focus it and use the arrow keys. "Center" and "Home" act on a plain click.
import type { Globe } from "./globe";
import { el } from "./ui";

type Tools = Globe["tools"];

// [tool, label, inner radius, outer radius, start angle, end angle, label rotation, what it does]
// Angles in degrees, 0 = right, clockwise.
const WEDGES: [keyof Tools, string, number, number, number, number, number, string][] = [
  ["zoom", "ZOOM", 62, 100, -135, -45, 0, "Zoom: drag up or down"],
  ["home", "HOME", 62, 100, -45, 45, 90, "Home: bring the whole Earth back to the middle"],
  ["pan", "PAN", 62, 100, 45, 135, 0, "Pan: drag to slide the view"],
  ["orbit", "ORBIT", 62, 100, 135, 225, -90, "Orbit: drag to circle around the Earth"],
  ["center", "CENTER", 0, 58, 180, 270, 0, "Center: then click a point on the globe to put it in the middle"],
  ["walk", "WALK", 0, 58, 270, 360, 0, "Walk: drag up to move forward, sideways to turn"],
  ["updown", "UP/DOWN", 0, 58, 0, 90, 0, "Up/Down: drag to tip the camera up to the horizon or down to the ground"],
  ["look", "LOOK", 0, 58, 90, 180, 0, "Look: drag to turn and tilt the camera"],
];

const SVG = "http://www.w3.org/2000/svg";
const at = (r: number, deg: number) => [r * Math.cos((deg * Math.PI) / 180), r * Math.sin((deg * Math.PI) / 180)];
const KEYS: Record<string, [number, number]> = { ArrowUp: [0, -24], ArrowDown: [0, 24], ArrowLeft: [-24, 0], ArrowRight: [24, 0] };

export function createWheel(host: HTMLElement, tools: Tools, onClose: () => void) {
  const svg = document.createElementNS(SVG, "svg");
  svg.setAttribute("viewBox", "-104 -104 208 208");
  const hint = el("p", { className: "muted" }, "Hold a button and drag, or use the arrow keys.");

  for (const [tool, label, r0, r1, a0, a1, turn, help] of WEDGES) {
    const isClick = tool === "center" || tool === "home";
    const [x0, y0] = at(r1, a0), [x1, y1] = at(r1, a1), [x2, y2] = at(r0, a1), [x3, y3] = at(r0, a0);
    const [tx, ty] = at((r0 + r1) / 2 + (r0 ? 0 : 6), (a0 + a1) / 2);

    const g = document.createElementNS(SVG, "g");
    g.setAttribute("role", "button");
    g.setAttribute("tabindex", "0");
    g.setAttribute("aria-label", isClick ? help : `${help}, or use the arrow keys`);
    const path = document.createElementNS(SVG, "path");
    path.setAttribute("d", `M${x0} ${y0}A${r1} ${r1} 0 0 1 ${x1} ${y1}L${x2} ${y2}A${r0} ${r0} 0 0 0 ${x3} ${y3}Z`);
    const text = document.createElementNS(SVG, "text");
    text.setAttribute("x", String(tx));
    text.setAttribute("y", String(ty));
    text.setAttribute("transform", `rotate(${turn} ${tx} ${ty})`);
    text.textContent = label;
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

  const close = el("button", { type: "button", className: "wheel-close", title: "Hide the view wheel", onclick: onClose }, "×");
  close.setAttribute("aria-label", "Hide the view wheel");
  host.append(close, svg, hint);
}
