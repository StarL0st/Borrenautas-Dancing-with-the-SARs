// The visitor's own places: positions only ([longitude, latitude]), kept in this browser.
// Each is matched to an area when the page loads (logic.ts areaAt), so nothing else is stored.
export type Place = [number, number];

const KEY = "places";

export function loadPlaces(): Place[] {
  try {
    const v: unknown = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(v) ? v.filter((p): p is Place => Array.isArray(p) && p.length === 2 && p.every(Number.isFinite)) : [];
  } catch {
    return []; // private window, blocked storage, or a broken value: start empty
  }
}

export function savePlaces(places: Place[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(places));
  } catch {
    // the list then lasts until the page is closed
  }
}
