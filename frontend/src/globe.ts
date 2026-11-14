// The globe and the zoomed-in map are one MapLibre map: the "globe" projection turns flat on
// its own as you zoom in.
import { Map, Marker, NavigationControl, Popup, setWorkerUrl, type GeoJSONSource, type StyleSpecification } from "maplibre-gl";
// MapLibre cannot find its worker file by itself once Vite bundles it, so hand it the URL.
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import "maplibre-gl/dist/maplibre-gl.css";
import type { AreaView, EventFeature, Layer } from "./logic";
import { el } from "./ui";

setWorkerUrl(workerUrl);

const BASEMAP = "https://demotiles.maplibre.org/";
const MAX_PITCH = 80;

export type ViewMode = "globe" | "closeup";
// Whole Earth seen from far away, or a low tilted camera with the curved horizon in view.
const HOME: Record<ViewMode, { center: [number, number]; zoom: number; pitch: number; bearing: number }> = {
  globe: { center: [-40, 20], zoom: 1.4, pitch: 0, bearing: 0 },
  closeup: { center: [-40, 20], zoom: 3.6, pitch: 70, bearing: 0 },
};

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
  const map = new Map({ container, style, ...HOME.globe, maxPitch: MAX_PITCH, attributionControl: { compact: true } });
  map.addControl(new NavigationControl());
  map.on("error", (e) => console.warn("map:", e.error?.message ?? e));

  let mode: ViewMode = "globe";
  let picking = false; // the wheel's "Center" tool is waiting for a click on the globe
  const overlays = new Set<string>();
  const marker = new Marker({ color: "#5fe3e0" });

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
          "circle-radius": ["case", ["get", "open"], 30, 18],
          "circle-color": ["get", "color"], "circle-blur": 1, "circle-opacity": fade(0.75),
        },
      });
      map.addLayer({
        id: "areas-core", type: "circle", source: "areas", filter: point,
        paint: {
          "circle-radius": 5, "circle-color": ["get", "color"], "circle-opacity": fade(1),
          "circle-stroke-color": "#ffffff", "circle-stroke-opacity": fade(1),
          "circle-stroke-width": ["case", ["get", "open"], 2.5, 0.5],
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
      // Detected changes (events.geojson): outlines when close, dots at every zoom.
      const empty = { type: "FeatureCollection" as const, features: [] };
      map.addSource("events", { type: "geojson", data: empty });
      map.addSource("event-points", { type: "geojson", data: empty });
      map.addLayer({
        id: "events-fill", type: "fill", source: "events", minzoom: 8,
        paint: { "fill-color": ["get", "color"], "fill-opacity": 0.25 },
      }, "areas-box");
      map.addLayer({
        id: "events-line", type: "line", source: "events", minzoom: 8,
        paint: { "line-color": ["get", "color"], "line-width": 1.5 },
      }, "areas-box");
      map.addLayer({
        id: "events-dot", type: "circle", source: "event-points",
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 3, 2, 10, 6],
          "circle-color": ["get", "color"], "circle-stroke-color": "#03060a", "circle-stroke-width": 1,
        },
      });
      for (const layer of ["events-fill", "events-dot"]) {
        map.on("click", layer, (e) => picking || showEvent(e.features![0].properties as EventFeature["properties"], e.lngLat));
        map.on("mouseenter", layer, () => (map.getCanvas().style.cursor = "pointer"));
        map.on("mouseleave", layer, () => (map.getCanvas().style.cursor = ""));
      }
      // The halo is the click target so the dots are easy to hit on touch screens.
      map.on("click", "areas-halo", (e) => picking || onPick(e.features![0].properties.id));
      map.on("mouseenter", "areas-halo", () => (map.getCanvas().style.cursor = "pointer"));
      map.on("mouseleave", "areas-halo", () => (map.getCanvas().style.cursor = picking ? "crosshair" : ""));
      resolve();
    }),
  );

  const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

  const popup = new Popup({ maxWidth: "320px" });
  // Built from DOM nodes, never HTML strings: event text comes from the data.
  function showEvent(p: EventFeature["properties"], at: { lng: number; lat: number }) {
    popup
      .setLngLat(at)
      .setDOMContent(
        el(
          "div",
          { className: "event-popup" },
          el("strong", {}, p.title),
          el("p", { className: "muted" }, `${p.from} to ${p.to} · ${p.area_km2} km² · confidence ${Math.round(p.confidence * 100)}% · ${p.maturity} data`),
          el("p", {}, p.summary),
        ),
      )
      .addTo(map);
  }

  return {
    async setAreas(shown: { area: AreaView; color: string }[], openIds: string[]) {
      await ready;
      map.getSource<GeoJSONSource>("areas")!.setData({
        type: "FeatureCollection",
        features: shown.flatMap(({ area, color }) => {
          const [w, s, e, n] = area.bbox;
          const properties = { id: area.id, title: area.title, color, open: openIds.includes(area.id) };
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

    // Events already carry their display color; `shown` is the subset that passes the filters.
    async setEvents(shown: (EventFeature & { properties: { color: string } })[]) {
      await ready;
      map.getSource<GeoJSONSource>("events")!.setData({ type: "FeatureCollection", features: shown as never });
      map.getSource<GeoJSONSource>("event-points")!.setData({
        type: "FeatureCollection",
        features: shown.map((f) => ({
          type: "Feature" as const, properties: f.properties,
          geometry: { type: "Point" as const, coordinates: [f.properties.lon, f.properties.lat] },
        })),
      });
    },

    // MapLibre skips flight animations by itself when the user prefers reduced motion.
    async focus(area: AreaView) {
      await ready;
      map.fitBounds(area.bbox, { padding: 48, maxZoom: 14 });
    },

    async goTo(lng: number, lat: number) {
      await ready;
      marker.setLngLat([lng, lat]).addTo(map);
      map.flyTo({ center: [lng, lat], zoom: 8 });
    },

    setView(next: ViewMode) {
      mode = next;
      const { zoom, pitch } = HOME[mode];
      // Keep looking at the same place; only the camera height and tilt change.
      map.easeTo({ pitch, bearing: 0, zoom: mode === "closeup" ? Math.max(map.getZoom(), zoom) : Math.min(map.getZoom(), zoom) });
    },

    // One radar image per open area. `undefined` removes that area's image.
    async showOverlay(areaId: string, layer: Layer | undefined, base: URL, opacity: number) {
      await ready;
      const id = `overlay-${areaId}`;
      if (map.getLayer(id)) map.removeLayer(id);
      if (map.getSource(id)) map.removeSource(id);
      overlays.delete(areaId);
      if (!layer?.bounds) return;
      const [w, s, e, n] = layer.bounds;
      map.addSource(id, {
        type: "image",
        url: new URL(layer.url, base).href,
        coordinates: [[w, n], [e, n], [e, s], [w, s]],
      });
      map.addLayer({ id, type: "raster", source: id, paint: { "raster-opacity": opacity, "raster-fade-duration": 0 } }, "areas-box");
      overlays.add(areaId);
    },

    async setOpacity(areaId: string, opacity: number) {
      await ready;
      if (map.getLayer(`overlay-${areaId}`)) map.setPaintProperty(`overlay-${areaId}`, "raster-opacity", opacity);
    },

    async keepOverlays(areaIds: string[]) {
      await ready;
      for (const id of [...overlays]) if (!areaIds.includes(id)) await this.showOverlay(id, undefined, new URL(location.href), 1);
    },

    // View wheel tools. Drag tools take the pointer movement in pixels.
    tools: {
      zoom: (_dx: number, dy: number) => map.setZoom(map.getZoom() - dy * 0.02),
      // Circle the camera around the Earth: sideways changes longitude, up and down latitude.
      orbit: (dx: number, dy: number) => {
        const degPerPx = 360 / (512 * 2 ** map.getZoom()), c = map.getCenter();
        map.setCenter([c.lng - dx * degPerPx, clamp(c.lat + dy * degPerPx, -85, 85)]);
      },
      pan: (dx: number, dy: number) => map.panBy([-dx, -dy], { animate: false }),
      // Turn and tilt the camera without moving the spot it looks at.
      look: (dx: number, dy: number) =>
        map.jumpTo({ bearing: map.getBearing() + dx * 0.4, pitch: clamp(map.getPitch() - dy * 0.3, 0, MAX_PITCH) }),
      // Tip the camera up toward the horizon or down toward the ground.
      updown: (_dx: number, dy: number) => map.setPitch(clamp(map.getPitch() - dy * 0.4, 0, MAX_PITCH)),
      // Move forward or back in the direction the camera faces; sideways drag turns.
      walk: (dx: number, dy: number) => {
        map.setBearing(map.getBearing() + dx * 0.4);
        map.panBy([0, dy], { animate: false });
      },
      // The next click on the globe becomes the middle of the view.
      center: () => {
        picking = true;
        map.getCanvas().style.cursor = "crosshair";
        map.once("click", (e) => {
          picking = false;
          map.getCanvas().style.cursor = "";
          map.easeTo({ center: e.lngLat });
        });
      },
      // Replaces Revit's Rewind: bring the whole Earth back to the middle.
      home: () => map.flyTo(HOME[mode]),
    },
  };
}

export type Globe = ReturnType<typeof createGlobe>;
