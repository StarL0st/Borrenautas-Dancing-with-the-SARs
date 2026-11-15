// Satellite pictures of a zone "now" and "before", from NASA GIBS (Global Imagery Browse
// Services): public, no key, CORS-enabled WMS. Taken from the `jopa-testing` branch.
//
// A satellite does not see every place every day (HLS: every 2-3 days) and clouds hide many
// passes, so `findClear` walks back day by day, checks a tiny thumbnail and keeps the first
// picture with data and few clouds.

export type SatLayer = { id: string; layers: string[]; maxSpanDeg: number; daily: boolean };

// shortcut: thresholds and spans tuned by eye on a few Mexican cities (2026-11-14).
export const SAT_LAYERS: SatLayer[] = [
  // Harmonized Landsat 8/9 + Sentinel-2, 30 m: streets and fields are visible.
  { id: "hls", layers: ["HLS_S30_Nadir_BRDF_Adjusted_Reflectance", "HLS_L30_Nadir_BRDF_Adjusted_Reflectance"], maxSpanDeg: 1.5, daily: false },
  // VIIRS on NOAA-20, 375 m, every day: whole regions, storms and smoke.
  { id: "viirs", layers: ["VIIRS_NOAA20_CorrectedReflectance_TrueColor"], maxSpanDeg: 40, daily: true },
  // MODIS bands 7-2-1: burn scars red-brown, water dark blue, plants green.
  { id: "fire", layers: ["MODIS_Terra_CorrectedReflectance_Bands721"], maxSpanDeg: 40, daily: true },
  // MODIS 8-day vegetation index: where plants are green and healthy.
  { id: "ndvi", layers: ["MODIS_Terra_NDVI_8Day"], maxSpanDeg: 40, daily: true },
];

const WMS = "https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi";

/** A GIBS GetMap URL. WMS 1.3.0 with EPSG:4326 takes the box as south,west,north,east. */
export function gibsUrl(layer: string, [w, s, e, n]: [number, number, number, number], date: string, px = 512): string {
  const wide = e - w, tall = n - s;
  const width = wide >= tall ? px : Math.max(64, Math.round((px * wide) / tall));
  const height = tall >= wide ? px : Math.max(64, Math.round((px * tall) / wide));
  const q = new URLSearchParams({
    SERVICE: "WMS", REQUEST: "GetMap", VERSION: "1.3.0", LAYERS: layer, STYLES: "", CRS: "EPSG:4326",
    BBOX: [s, w, n, e].join(","), WIDTH: String(width), HEIGHT: String(height), FORMAT: "image/jpeg", TIME: date,
  });
  return `${WMS}?${q}`;
}

/** The area's box, shrunk around its center to what the layer can show sharply. */
export function viewBox(bbox: [number, number, number, number], layer: SatLayer): [number, number, number, number] {
  const [w, s, e, n] = bbox;
  const cx = (w + e) / 2, cy = (s + n) / 2;
  const half = Math.min(Math.max(e - w, n - s, 0.08), layer.maxSpanDeg) / 2;
  return [cx - half, cy - half, cx + half, cy + half];
}

export const isoDay = (d: Date) => d.toISOString().slice(0, 10);

function load(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous"; // GIBS sends CORS headers, so the pixels can be read
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(url));
    img.src = url;
  });
}

// Share of pixels that are empty (no pass: black) and cloud (very bright, gray-white).
function look(img: HTMLImageElement): { empty: number; cloud: number } {
  const c = document.createElement("canvas");
  c.width = c.height = 32;
  const g = c.getContext("2d", { willReadFrequently: true })!;
  g.drawImage(img, 0, 0, 32, 32);
  const d = g.getImageData(0, 0, 32, 32).data;
  let empty = 0, cloud = 0;
  for (let i = 0; i < d.length; i += 4) {
    const [r, gr, b] = [d[i], d[i + 1], d[i + 2]];
    const max = Math.max(r, gr, b), min = Math.min(r, gr, b);
    if (max < 12) empty++;
    else if (min > 185 && max - min < 30) cloud++;
  }
  const n = d.length / 4;
  return { empty: empty / n, cloud: cloud / n };
}

export type Found = { url: string; date: string; layer: string };

/**
 * The newest clear picture on or before `from`, looking back at most `days` days.
 * Resolves undefined when none is found. `signal` stops the search (the tab was closed).
 */
export async function findClear(
  layer: SatLayer, bbox: [number, number, number, number], from: Date, days: number, signal?: AbortSignal,
): Promise<Found | undefined> {
  const box = viewBox(bbox, layer);
  // Daily layers are complete every day; the 8-day vegetation index needs no cloud check.
  const strict = layer.id === "hls";
  for (let i = 0; i < days; i++) {
    if (signal?.aborted) return undefined;
    const day = new Date(from.getTime() - i * 86400000);
    const date = isoDay(day);
    for (const name of layer.layers) {
      try {
        const thumb = await load(gibsUrl(name, box, date, 48));
        const { empty, cloud } = look(thumb);
        if (empty > 0.25) continue; // no pass that day
        if (layer.id !== "ndvi" && cloud > (strict ? 0.3 : 0.6)) continue;
        return { url: gibsUrl(name, box, date, 640), date, layer: name };
      } catch {
        // one missing tile is not the end of the search
      }
    }
  }
  return undefined;
}
