// PLACEHOLDER DATA. The back end does not provide themed areas or past reports yet, so these
// stand in for them. Every one is flagged synthetic and the app shows a banner while any is on
// screen. Positions are arbitrary; nothing here describes a real event.
// Replace with back-end data once the contract carries themes and reports.
import { CATEGORIES } from "./categories";
import type { AreaView } from "./logic";

// [theme id, longitude, latitude]
const SPOTS: [string, number, number][] = [
  ["agriculture", -98, 39], ["agriculture", 77, 23],
  ["climate", -42, 72], ["climate", 90, 24],
  ["disasters", 138, 36], ["disasters", -72, -15],
  ["ecology", -60, -5], ["ecology", 23, -2],
  ["health", 116, 36], ["health", 8, 10],
  ["water", 32, 15], ["water", -112, 35],
  ["fires", 146, -34], ["fires", -120, 52],
];

export const SAMPLE_AREAS: AreaView[] = SPOTS.map(([cat, lon, lat], i) => {
  const label = CATEGORIES.find((c) => c.id === cat)!.label;
  return {
    id: `sample-${i + 1}`,
    title: `Sample area ${i + 1}`,
    summary: `Placeholder area for the ${label} theme. Real reports and radar layers will come from the back end.`,
    categories: [cat],
    center: [lon, lat],
    bbox: [lon - 1.5, lat - 1.5, lon + 1.5, lat + 1.5],
    synthetic: true,
    events: ["2026-01-01", "2026-01-13", "2026-01-25"].map((date, n) => ({
      date,
      title: `Placeholder report ${n + 1}`,
      text: "Report text will come from the back end.",
    })),
    layers: [],
    credits: [],
  };
});
