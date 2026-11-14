// Guided tour: a card at the bottom of the screen that outlines one part of the app per step.
import { t, type Key } from "./i18n";
import { el } from "./ui";

// [element to outline, text key]: the texts are `tour.<key>.title` and `tour.<key>.text`.
const STEPS: [string, string][] = [
  ["#stage", "globe"],
  ["#filters", "filters"],
  ["#coords", "coords"],
  ["#results", "areas"],
  ["#detail", "open"],
  ["#toolbar", "views"],
  ["#wheel", "wheel"],
  ["#settings-btn", "settings"],
  ["#banner", "banner"],
];

let close: (() => void) | undefined;

export function startTour(returnFocus?: HTMLElement) {
  close?.();
  let i = 0;
  let target: Element | null = null;

  const title = el("h2", { id: "tour-title" });
  const text = el("p");
  const count = el("span", { className: "muted" });
  const back = el("button", { type: "button", onclick: () => show(i - 1) }, t("tour.back"));
  const next = el("button", { type: "button", className: "primary", onclick: () => (i === STEPS.length - 1 ? end() : show(i + 1)) });
  const card = el(
    "div",
    { className: "tour", role: "dialog" },
    title,
    text,
    el("div", { className: "tour-actions" }, count, el("button", { type: "button", onclick: () => end() }, t("tour.skip")), back, next),
  );
  card.setAttribute("aria-labelledby", "tour-title");

  function show(n: number) {
    i = n;
    target?.classList.remove("tour-target");
    target = document.querySelector(STEPS[i][0]);
    target?.classList.add("tour-target");
    target?.scrollIntoView({ block: "nearest" });
    title.textContent = t(`tour.${STEPS[i][1]}.title` as Key);
    text.textContent = t(`tour.${STEPS[i][1]}.text` as Key);
    count.textContent = t("tour.count", { i: i + 1, n: STEPS.length });
    back.disabled = i === 0;
    next.textContent = i === STEPS.length - 1 ? t("tour.done") : t("tour.next");
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
