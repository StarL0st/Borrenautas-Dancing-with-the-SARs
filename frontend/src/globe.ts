// The globe and the zoomed-in map are one MapLibre map: the "globe" projection turns flat on
// its own as you zoom in.
import { Map, NavigationControl, setWorkerUrl, type GeoJSONSource, type StyleSpecification } from "maplibre-gl";
// MapLibre cannot find its worker file by itself once Vite bundles it, so hand it the URL.
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import "maplibre-gl/dist/maplibre-gl.css";
import type { AreaView, Layer } from "./logic";

setWorkerUrl(workerUrl);

const BASEMAP = "https://demotiles.maplibre.org/";
const HOME = { center: [-40, 20] as [number, number], zoom: 1.4 };

// The background layer is local, so if the basemap tiles fail the globe and overlays still draw.
const style: StyleSpecification = {
  version: 8,
  projection: { type: "globe" },
  sky: { "atmosphere-blend": ["interpolate", ["linear"], ["zoom"], 0, 1, 5, 1, 7, 0] },
  glyphs: `${BASEMAP}font/{fontstack}/{range}.pbf`,
  sources: { base: { type: "vector", url: `${BASEMAP}tiles/tiles.json` } },
  layers: [
    { id: "ocean", type: "background", paint: { "background-color": "#071a26" } },
    { id: "land", type: "fill", source: "base", "source-layer": "countries", paint: { "fill-color": "#103a4a" } },
    {
      id: "borders", type: "line", source: "base", "source-layer": "countries",
      paint: { "line-color": "#5fe3e0", "line-opacity": 0.45, "line-width": 0.7 },
    },
    {
      id: "grid", type: "line", source: "base", "source-layer": "geolines",
      paint: { "line-color": "#5fe3e0", "line-opacity": 0.2, "line-dasharray": [3, 3] },
    },
  ],
};

export function createGlobe(container: string, onPick: (id: string) => void) {
  const map = new Map({ container, style, ...HOME, attributionControl: { compact: true } });
  map.addControl(new NavigationControl());
  map.on("error", (e) => console.warn("map:", e.error?.message ?? e));

  const point = ["==", ["geometry-type"], "Point"] as ["==", ["geometry-type"], "Point"];
  // Dots fade out once you are close enough to see the area's outline and radar image.
  const fade = (max: number) => ["interpolate", ["linear"], ["zoom"], 7, max, 9, 0] as never;

  const ready = new Promise<void>((resolve) =>
    map.on("load", () => {
      map.addSource("areas", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      map.addLayer({
        id: "areas-box", type: "line", source: "areas", minzoom: 4,
        filter: ["==", ["geometry-type"], "Polygon"],
        paint: { "line-color": ["get", "color"], "line-width": 1.5 },
      });
      map.addLayer({
        id: "areas-halo", type: "circle", source: "areas", filter: point,
        paint: {
          "circle-radius": ["case", ["get", "selected"], 30, 18],
          "circle-color": ["get", "color"], "circle-blur": 1, "circle-opacity": fade(0.75),
        },
      });
      map.addLayer({
        id: "areas-core", type: "circle", source: "areas", filter: point,
        paint: {
          "circle-radius": 5, "circle-color": ["get", "color"], "circle-opacity": fade(1),
          "circle-stroke-color": "#ffffff", "circle-stroke-opacity": fade(1),
          "circle-stroke-width": ["case", ["get", "selected"], 2.5, 0.5],
        },
      });
      map.addLayer({
        id: "areas-label", type: "symbol", source: "areas", filter: point, maxzoom: 8,
        layout: {
          "text-field": ["get", "title"], "text-font": ["Open Sans Semibold"], "text-size": 12,
          "text-offset": [0, 1.3], "text-anchor": "top",
        },
        paint: { "text-color": "#e6f1f5", "text-halo-color": "#03060a", "text-halo-width": 1.5 },
      });
      // The halo is the click target so the dots are easy to hit on touch screens.
      map.on("click", "areas-halo", (e) => onPick(e.features![0].properties.id));
      map.on("mouseenter", "areas-halo", () => (map.getCanvas().style.cursor = "pointer"));
      map.on("mouseleave", "areas-halo", () => (map.getCanvas().style.cursor = ""));
      resolve();
    }),
  );

  return {
    async setAreas(shown: { area: AreaView; color: string }[], selectedId?: string) {
      await ready;
      map.getSource<GeoJSONSource>("areas")!.setData({
        type: "FeatureCollection",
        features: shown.flatMap(({ area, color }) => {
          const [w, s, e, n] = area.bbox;
          const properties = { id: area.id, title: area.title, color, selected: area.id === selectedId };
          return [
            { type: "Feature" as const, properties, geometry: { type: "Point" as const, coordinates: area.center } },
            {
              type: "Feature" as const, properties,
              geometry: { type: "Polygon" as const, coordinates: [[[w, s], [e, s], [e, n], [w, n], [w, s]]] },
            },
          ];
        }),
      });
    },

    // MapLibre skips the flight animation by itself when the user prefers reduced motion.
    async focus(area?: AreaView) {
      await ready;
      if (area) map.fitBounds(area.bbox, { padding: 48, maxZoom: 14 });
      else map.flyTo(HOME);
    },

    // Spin the globe so an area on the far side comes into view.
    async lookAt(area: AreaView) {
      await ready;
      map.flyTo({ center: area.center, zoom: HOME.zoom });
    },

    async showOverlay(layer: Layer | undefined, base: URL, opacity: number) {
      await ready;
      if (map.getLayer("overlay")) map.removeLayer("overlay");
      if (map.getSource("overlay")) map.removeSource("overlay");
      if (!layer?.bounds) return;
      const [w, s, e, n] = layer.bounds;
      map.addSource("overlay", {
        type: "image",
        url: new URL(layer.url, base).href,
        coordinates: [[w, n], [e, n], [e, s], [w, s]],
      });
      map.addLayer(
        { id: "overlay", type: "raster", source: "overlay", paint: { "raster-opacity": opacity, "raster-fade-duration": 0 } },
        "areas-box",
      );
    },

    async setOpacity(opacity: number) {
      await ready;
      if (map.getLayer("overlay")) map.setPaintProperty("overlay", "raster-opacity", opacity);
    },

    resize: () => map.resize(),
  };
}
