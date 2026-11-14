// Guided tour: a card at the bottom of the screen that outlines one part of the app per step.
import { el } from "./ui";

const STEPS: { target: string; title: string; text: string }[] = [
  {
    target: "#map",
    title: "The globe",
    text: "Each glowing dot is an area being watched by radar. Drag to spin the globe, scroll or pinch to zoom, or use the arrow keys.",
  },
  {
    target: "#tabs",
    title: "Themes",
    text: "Pick a theme, such as Agriculture or Wildland Fires, and only the areas for that theme stay lit.",
  },
  {
    target: "#results",
    title: "Area list",
    text: "The same areas as a list, with their dates. Choose one here or click its dot on the globe.",
  },
  {
    target: "#detail",
    title: "Area details",
    text: "The globe zooms in to the area. Here you get its timeline of past reports and, when radar images exist, a date slider to watch the surface change.",
  },
  {
    target: "#banner",
    title: "Sample data",
    text: "While this banner shows, some of what you see is placeholder data, not real observations. Real radar layers list their source under “Where this comes from”.",
  },
];

let close: (() => void) | undefined;

export function startTour(returnFocus?: HTMLElement) {
  close?.();
  let i = 0;
  let target: Element | null = null;

  const title = el("h2", { id: "tour-title" });
  const text = el("p");
  const count = el("span", { className: "muted" });
  const back = el("button", { type: "button", onclick: () => show(i - 1) }, "Back");
  const next = el("button", { type: "button", className: "primary", onclick: () => (i === STEPS.length - 1 ? end() : show(i + 1)) });
  const card = el(
    "div",
    { className: "tour", role: "dialog" },
    title,
    text,
    el("div", { className: "tour-actions" }, count, el("button", { type: "button", onclick: () => end() }, "Skip"), back, next),
  );
  card.setAttribute("aria-labelledby", "tour-title");

  function show(n: number) {
    i = n;
    target?.classList.remove("tour-target");
    target = document.querySelector(STEPS[i].target);
    target?.classList.add("tour-target");
    target?.scrollIntoView({ block: "nearest" });
    title.textContent = STEPS[i].title;
    text.textContent = STEPS[i].text;
    count.textContent = `${i + 1} of ${STEPS.length}`;
    back.disabled = i === 0;
    next.textContent = i === STEPS.length - 1 ? "Done" : "Next";
    next.focus();
  }

  const onKey = (e: KeyboardEvent) => e.key === "Escape" && end();

  function end() {
    target?.classList.remove("tour-target");
    card.remove();
    document.removeEventListener("keydown", onKey);
    close = undefined;
    returnFocus?.focus();
  }

  close = end;
  document.addEventListener("keydown", onKey);
  document.body.append(card);
  show(0);
}
