// Toolchain check: proves the frontend can read the backend's contract data (docs/04 C1, C2, C6).
// The frontend lane replaces this with the real viewer (F04).
import { Map } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

// Live backend by default; set VITE_DATA_BASE=./data/ for the static build.
const BASE = import.meta.env.VITE_DATA_BASE ?? "http://127.0.0.1:8765/";

type Layer = { id: string; kind: string; url: string; bounds: [number, number, number, number] };
type Area = { id: string; center: [number, number]; zoom_default: number; layers: Layer[] };
type Manifest = { synthetic: boolean; areas: Area[] };

const map = new Map({
  container: "map",
  style: "https://demotiles.maplibre.org/style.json",
  center: [0, 0],
  zoom: 1,
});

let shown: string | undefined;

async function load() {
  const manifest: Manifest = await (await fetch(new URL("manifest.json", BASE))).json();
  document.getElementById("banner")!.hidden = !manifest.synthetic;
  const area = manifest.areas[0];
  const layer = area?.layers.filter((l) => l.kind === "image_overlay").at(-1);
  if (!layer) return;
  if (shown) {
    map.removeLayer(shown);
    map.removeSource(shown);
  } else {
    map.jumpTo({ center: area.center, zoom: area.zoom_default });
  }
  const [w, s, e, n] = layer.bounds;
  map.addSource(layer.id, {
    type: "image",
    url: new URL(layer.url, BASE).href,
    coordinates: [[w, n], [e, n], [e, s], [w, s]],
  });
  map.addLayer({ id: layer.id, type: "raster", source: layer.id });
  shown = layer.id;
}

map.on("load", () => {
  load().catch((err) => console.error("manifest load failed", err));
  // Live updates exist only on the backend server, not on the static build.
  new EventSource(new URL("events", BASE)).addEventListener("manifest", () => load());
});
