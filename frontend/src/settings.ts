// Accessibility menu: a list of settings on the left, an explanation of the one in focus on
// the right. Choices are remembered in this browser.
import type { Texture } from "./globe";
import { LANGS, t, type Key, type Lang } from "./i18n";
import { el } from "./ui";

export type Settings = { lang: Lang; wheel: "large" | "medium" | "small"; texture: Texture; mode: "simple" | "technical" };

const OPTIONS: { [K in keyof Settings]: readonly Settings[K][] } = {
  lang: ["en", "es", "de"],
  wheel: ["large", "medium", "small"],
  texture: ["sentinel", "hologram", "street"],
  mode: ["simple", "technical"],
};
const KEYS = Object.keys(OPTIONS) as (keyof Settings)[];
// The menu's rows. Mode has its own switch in the header.
type Row = "lang" | "wheel" | "texture";
const ROWS: Row[] = ["lang", "wheel", "texture"];

export function loadSettings(): Settings {
  const out: Record<string, string> = { lang: "en", wheel: "medium", texture: "sentinel", mode: "simple" };
  try {
    const saved = JSON.parse(localStorage.getItem("settings") ?? "{}") ?? {};
    // Only known values are accepted: storage can hold anything.
    for (const k of KEYS) if ((OPTIONS[k] as readonly string[]).includes(saved[k])) out[k] = saved[k];
  } catch {
    // No storage or unreadable value: defaults.
  }
  return out as Settings;
}

export function saveSettings(settings: Settings) {
  try {
    localStorage.setItem("settings", JSON.stringify(settings));
  } catch {
    // Storage blocked: the choice still applies until the page closes.
  }
}

const optionLabel = (key: Row, value: string) =>
  key === "lang" ? LANGS[value as Lang] : t(`${key === "wheel" ? "size" : "tex"}.${value}` as Key);

// Rebuilds the menu inside `dialog`; call again after a language change.
export function renderSettings(dialog: HTMLDialogElement, settings: Settings, onChange: (key: keyof Settings) => void) {
  const helpTitle = el("h3"), helpText = el("p", { id: "settings-help" });
  const showHelp = (key: Row) => {
    helpTitle.textContent = t(`set.${key}`);
    helpText.textContent = t(`set.${key}.help`);
  };

  const rows = ROWS.map((key) => {
    const row = el(
      "fieldset",
      { className: "setting" },
      el("legend", {}, t(`set.${key}`)),
      el(
        "div",
        { className: "seg" },
        ...OPTIONS[key].map((value) => {
          const input = el("input", { type: "radio", name: key, value, checked: settings[key] === value });
          input.onchange = () => {
            (settings as Record<string, string>)[key] = value;
            saveSettings(settings);
            onChange(key);
          };
          return el("label", {}, input, el("span", {}, optionLabel(key, value)));
        }),
      ),
    );
    row.setAttribute("aria-describedby", "settings-help");
    row.addEventListener("focusin", () => showHelp(key));
    row.onpointerenter = () => showHelp(key);
    return row;
  });
  showHelp("lang");

  dialog.replaceChildren(
    el(
      "form",
      { method: "dialog", className: "settings-head" },
      el("h2", { id: "settings-title" }, t("set.title")),
      el("button", { type: "submit" }, t("set.close")),
    ),
    el("div", { className: "settings-body" }, el("div", { className: "settings-rows" }, ...rows), el("div", { className: "settings-help" }, helpTitle, helpText)),
  );
}
