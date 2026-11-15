// Drawings and cards for the radar explainer (data in explain.ts).
import { TOPICS, type Topic } from "./explain";
import { tx } from "./mexico";
import { el } from "./ui";

// ---- Drawings: a satellite top left, its beam, the ground and what comes back ----

const NS = "http://www.w3.org/2000/svg";
function svg(tag: string, attrs: Record<string, string | number>): SVGElement {
  const node = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  return node;
}
const path = (d: string, cls: string) => svg("path", { d, class: cls });

const SCENES: Record<string, () => SVGElement[]> = {
  basics: () => [
    path("M0 74 Q20 70 40 74 T80 74 T120 74 T160 74 V90 H0Z", "ground"),
    path("M24 16 L84 72", "beam"),
    path("M84 72 L30 20", "echo strong"),
    path("M84 72 L120 52 M84 72 L104 46 M84 72 L134 66", "echo faint"),
  ],
  water: () => [
    path("M0 74 H160 V90 H0Z", "water"),
    path("M24 16 L84 74", "beam"),
    path("M84 74 L144 18", "echo away"),
  ],
  structure: () => [
    path("M0 74 H160 V90 H0Z", "ground"),
    path("M96 34 H118 V74 H96Z", "building"),
    path("M24 16 L80 74", "beam"),
    path("M80 74 L96 58 L28 20", "echo strong"),
  ],
  plants: () => [
    path("M0 74 H160 V90 H0Z", "ground"),
    path("M88 74 V54", "trunk"),
    svg("circle", { cx: 88, cy: 44, r: 18, class: "canopy" }),
    path("M24 16 L80 40", "beam"),
    path("M80 40 L92 50 L84 36 L96 42 M84 36 L30 20", "echo strong"),
    path("M96 42 L130 30 M92 50 L120 64", "echo faint"),
  ],
  moisture: () => [
    path("M0 74 Q20 70 40 74 T80 74 T120 74 T160 74 V90 H0Z", "ground wet"),
    svg("circle", { cx: 60, cy: 82, r: 2, class: "drop" }),
    svg("circle", { cx: 100, cy: 84, r: 2, class: "drop" }),
    svg("circle", { cx: 130, cy: 81, r: 2, class: "drop" }),
    path("M24 16 L84 72", "beam"),
    path("M84 72 L30 20", "echo strong thick"),
  ],
  motion: () => [
    path("M0 66 H160", "ground-line"),
    path("M0 78 H160", "ground-line later"),
    path("M24 16 L84 66", "beam"),
    path("M24 16 Q34 21 40 30 T56 44 T72 58 T84 66", "wave"),
    path("M22 18 Q32 26 40 34 T58 50 T76 66 T86 78", "wave later"),
  ],
  fooled: () => [
    path("M0 74 Q8 68 16 74 T32 74 T48 74 T64 74 T80 74 H160 V90 H0Z", "water"),
    path("M100 52 l-3 8 M110 50 l-3 8 M120 54 l-3 8 M130 50 l-3 8", "rain"),
    path("M24 16 L40 74", "beam"),
    path("M40 74 L28 22", "echo faint"),
  ],
};

function scene(id: string): SVGSVGElement {
  const root = svg("svg", { viewBox: "0 0 160 90", class: "why-art", "aria-hidden": "true" }) as SVGSVGElement;
  root.append(
    svg("rect", { x: 12, y: 8, width: 12, height: 8, rx: 1, class: "sat" }),
    svg("rect", { x: 2, y: 10, width: 9, height: 4, class: "panel" }),
    svg("rect", { x: 25, y: 10, width: 9, height: 4, class: "panel" }),
    ...(SCENES[id]?.() ?? []),
  );
  return root;
}

/** The chosen ideas as small illustrated cards, in `lang`. */
export function explainer(ids: string[], lang: string): HTMLElement {
  return el(
    "div",
    { className: "why-list" },
    ...ids.map((id) => TOPICS.find((x) => x.id === id)).filter((x): x is Topic => !!x).map((x) =>
      el(
        "figure",
        { className: "why-card" },
        scene(x.id),
        el(
          "figcaption",
          {},
          el("strong", {}, tx(x.title, lang)),
          el("p", {}, tx(x.text, lang)),
          el("p", { className: "why-looks" }, tx(x.looks, lang)),
        ),
      ),
    ),
  );
}
