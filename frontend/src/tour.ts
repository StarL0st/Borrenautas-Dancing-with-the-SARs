// Guided tour: a card at the bottom of the screen that outlines one part of the app per step.
import { el } from "./ui";

const STEPS: { target: string; title: string; text: string }[] = [
  {
    target: "#stage",
    title: "The globe",
    text: "Each glowing dot is an area. Drag to spin the globe, scroll or pinch to zoom, or use the arrow keys.",
  },
  {
    target: "#filters",
    title: "Filters",
    text: "Open a group and tick the kinds of change you care about. Only areas of those kinds stay marked on the globe.",
  },
  {
    target: "#coords",
    title: "Go to coordinates",
    text: "Type a latitude and longitude to fly straight to that spot. A pin marks it.",
  },
  {
    target: "#results",
    title: "Area list",
    text: "The marked areas as a list. Click one here, or its dot on the globe, to open it. Click again to close it.",
  },
  {
    target: "#detail",
    title: "Open areas",
    text: "Every area you open stacks up here as a tab you can scroll through, with its timeline and, when radar images exist, a date slider to watch the surface change.",
  },
  {
    target: "#toolbar",
    title: "Views",
    text: "Switch between the whole globe and a close-up view that skims low over the surface with the horizon ahead.",
  },
  {
    target: "#wheel",
    title: "View wheel",
    text: "Hold a button and drag: Zoom, Orbit, Pan, Walk, Look, Up/Down. Center puts the point you click next in the middle. Home brings the whole Earth back.",
  },
  {
    target: "#banner",
    title: "What is real",
    text: "This notice tells you when you are looking at example places or test data instead of real observations. Real radar images list their source under “Where this comes from”.",
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
