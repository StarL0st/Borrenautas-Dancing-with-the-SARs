// Where a piece of data comes from, said the same way everywhere (jopa-testing).
//
// Four kinds, each with its own shape and color AND its name in words, so they are never told
// apart by color alone:
//   nisar      NISAR radar (GCOV backscatter, GUNW ground motion, SME2 soil moisture, and what the
//              back end derives from them)
//   satellite  other satellites (NASA GIBS: HLS, VIIRS, MODIS), used only as context
//   feed       live reports from public alert services (USGS, NASA EONET, GDACS, NOAA)
//   record     published records (studies, agency reports, news of past disasters)
import { t, type Key } from "./i18n";
import { el } from "./ui";

export type Origin = "nisar" | "satellite" | "feed" | "record";

const NAME: Record<Origin, Key> = {
  nisar: "origin.nisar",
  satellite: "origin.satellite",
  feed: "origin.feed",
  record: "origin.record",
};

// When the zone notes and the history list were last checked against their sources.
export const RECORDS_CHECKED = "2026-11-14";

/** "2026-08-14", or "2026-08-14 to 2026-08-26" for a range (a change between two passes). */
export function when(date?: string | [string, string] | null): string {
  if (!date) return "";
  if (Array.isArray(date)) return date[0] === date[1] ? date[0] : t("origin.span", { from: date[0], to: date[1] });
  return date;
}

/**
 * A badge: shape, kind, what exactly (product, layer, agency) and when.
 * `date` is already worded ("taken 2026-08-14"), or empty to leave it out.
 */
export function originBadge(origin: Origin, what = "", date = "", opts: { synthetic?: boolean; compact?: boolean } = {}): HTMLElement {
  const parts = [what, date].filter(Boolean).join(" · ");
  const badge = el(
    "span",
    { className: `origin o-${origin}${opts.compact ? " compact" : ""}` },
    el("i", { className: "shape" }),
    el("b", {}, t(NAME[origin])),
    ...(parts && !opts.compact ? [el("span", {}, parts)] : []),
    ...(opts.synthetic ? [el("em", {}, t("origin.synthetic"))] : []),
  );
  if (opts.compact && parts) badge.title = parts;
  return badge;
}

/** The key at the top of a card: the kinds that card uses. */
export function originKey(kinds: Origin[]): HTMLElement {
  return el("p", { className: "origin-key" }, el("span", { className: "muted" }, t("origin.key")), ...kinds.map((k) => originBadge(k, "", "", { compact: true })));
}
