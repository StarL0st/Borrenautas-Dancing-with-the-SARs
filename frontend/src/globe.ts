// The globe and the zoomed-in map are one MapLibre map: the "globe" projection turns flat on
// its own as you zoom in.
import { Map, Marker, NavigationControl, Popup, setWorkerUrl, type GeoJSONSource, type StyleSpecification } from "maplibre-gl";
// MapLibre cannot find its worker file by itself once Vite bundles it, so hand it the URL.
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import "maplibre-gl/dist/maplibre-gl.css";
import { t } from "./i18n";
import { typeLabel } from "./filters";
import { liveWhere, type AreaView, type EventFeature, type Layer, type LiveFeature } from "./logic";
import { satelliteLayer } from "./satellite";
import { el } from "./ui";

setWorkerUrl(workerUrl);

const BASEMAP = "https://demotiles.maplibre.org/";
const MAX_PITCH = 80;

export type ViewMode = "globe" | "closeup";
// Whole Earth seen from far away, or a low tilted camera with the curved horizon in view.
const HOME: Record<ViewMode, { center: [number, number]; zoom: number; pitch: number; bearing: number }> = {
  globe: { center: [-40, 20], zoom: 1.4, pitch: 0, bearing: 0 },
  closeup: { center: [-40, 20], zoom: 3.6, pitch: 76, bearing: 0 },
};

// How the Earth is drawn. Each texture is a set of basemap layers switched on together.
export type Texture = "sentinel" | "hologram" | "street";
const BASE_LAYERS = ["sentinel", "street", "land", "borders", "grid"];
const TEXTURES: Record<Texture, { show: string[]; ocean: string; border: string }> = {
  sentinel: { show: ["sentinel", "borders"], ocean: "#02101c", border: "#ffffff" },
  hologram: { show: ["land", "borders", "grid"], ocean: "#071a26", border: "#5fe3e0" },
  street: { show: ["street"], ocean: "#aad3df", border: "#5fe3e0" },
};
const WELCOME_DROP = 0.36; // how far down the welcome screen pushes the horizon, as a share of the height
const SPIN_PX_PER_S = 24; // auto-rotate speed on screen: about one turn a minute when zoomed out

// The background layer is local, so if the basemap tiles fail the globe and overlays still draw.
const style: StyleSpecification = {
  version: 8,
  projection: { type: "globe" },
  sky: { "atmosphere-blend": ["interpolate", ["linear"], ["zoom"], 0, 1, 5, 1, 7, 0] },
  glyphs: `${BASEMAP}font/{fontstack}/{range}.pbf`,
  sources: {
    base: { type: "vector", url: `${BASEMAP}tiles/tiles.json` },
    // Sentinel-2 cloudless: a cloud-free mosaic of Copernicus Sentinel-2 images by EOX (public,
    // no key, CC BY 4.0 for this 2016 edition). Sharp down to zoom 14, stretched beyond.
    sentinel: {
      type: "raster", tileSize: 256, maxzoom: 14,
      tiles: ["https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless_3857/default/g/{z}/{y}/{x}.jpg"],
      attribution: '<a href="https://s2maps.eu">Sentinel-2 cloudless</a> by EOX IT Services GmbH (contains modified Copernicus Sentinel data 2016)',
    },
    // shortcut: the public OpenStreetMap tile server is for light use only; switch to a hosted
    // tile service before sending real traffic to the app.
    street: {
      type: "raster", tileSize: 256, maxzoom: 19, tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    },
  },
  // Basemap layers start hidden; `setTexture` switches on the chosen set, so unused tiles never load.
  layers: [
    { id: "ocean", type: "background", paint: { "background-color": "#02101c" } },
    { id: "sentinel", type: "raster", source: "sentinel", layout: { visibility: "none" } },
    { id: "street", type: "raster", source: "street", layout: { visibility: "none" } },
    {
      id: "land", type: "fill", source: "base", "source-layer": "countries", layout: { visibility: "none" },
      paint: { "fill-color": "#103a4a" },
    },
    {
      id: "borders", type: "line", source: "base", "source-layer": "countries", layout: { visibility: "none" },
      paint: { "line-color": "#5fe3e0", "line-opacity": 0.45, "line-width": 0.7 },
    },
    {
      id: "grid", type: "line", source: "base", "source-layer": "geolines", layout: { visibility: "none" },
      paint: { "line-color": "#5fe3e0", "line-opacity": 0.2, "line-dasharray": [3, 3] },
    },
  ],
};

export function createGlobe(container: string, texture: Texture, onPick: (id: string) => void) {
  const map = new Map({ container, style, ...HOME.closeup, maxPitch: MAX_PITCH, attributionControl: { compact: true } });
  map.addControl(new NavigationControl());
  map.on("error", (e) => console.warn("map:", e.error?.message ?? e));

  let mode: ViewMode = "globe";
  let picking = false; // the wheel's "Center" tool is waiting for a click on the globe
  let spinFrameId = 0, lastFrame = 0; // auto-rotate: 0 means off
  const overlays = new Set<string>();
  const marker = new Marker({ color: "#ef946c" });

  const point = ["==", ["geometry-type"], "Point"] as ["==", ["geometry-type"], "Point"];
  // Dots fade out once you are close enough to see the area's outline and radar image.
  const fade = (max: number) => ["interpolate", ["linear"], ["zoom"], 7, max, 9, 0] as never;

  const ready = new Promise<void>((resolve) =>
    map.on("load", () => {
      // Countries picked in the search: a light blue wash and outline, under everything else.
      map.addSource("picked", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      map.addLayer({ id: "picked-fill", type: "fill", source: "picked", paint: { "fill-color": "#8eb1c7", "fill-opacity": 0.3 } });
      map.addLayer({ id: "picked-line", type: "line", source: "picked", paint: { "line-color": "#fefdff", "line-width": 1.5 } });
      map.addSource("areas", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      map.addLayer({
        id: "areas-box", type: "line", source: "areas", minzoom: 4,
        filter: ["==", ["geometry-type"], "Polygon"],
        paint: { "line-color": ["get", "color"], "line-width": 1.5 },
      });
      map.addLayer({
        id: "areas-halo", type: "circle", source: "areas", filter: point,
        paint: {
          "circle-radius": ["case", ["get", "open"], 16, 12],
          "circle-color": ["get", "color"], "circle-opacity": fade(0.25),
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
        paint: { "text-color": "#fefdff", "text-halo-color": "#010d15", "text-halo-width": 1.5 },
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
          "circle-color": ["get", "color"], "circle-stroke-color": "#010d15", "circle-stroke-width": 1,
        },
      });
      for (const layer of ["events-fill", "events-dot"]) {
        map.on("click", layer, (e) => picking || showEvent(e.features![0].properties as EventFeature["properties"], e.lngLat));
        map.on("mouseenter", layer, () => (map.getCanvas().style.cursor = "pointer"));
        map.on("mouseleave", layer, () => (map.getCanvas().style.cursor = ""));
      }
      // Live events (live.geojson): hollow rings, so they never read as radar detections.
      map.addSource("live", { type: "geojson", data: empty });
      map.addLayer({
        id: "live-ring", type: "circle", source: "live",
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 2, 3.5, 8, 7],
          "circle-color": ["get", "color"], "circle-opacity": 0.15,
          "circle-stroke-color": ["get", "color"], "circle-stroke-width": 1.5,
        },
      }, "areas-halo");
      map.on("click", "live-ring", (e) => picking || showLive(e.features![0].properties as LiveFeature["properties"], e.lngLat));
      map.on("mouseenter", "live-ring", () => (map.getCanvas().style.cursor = "pointer"));
      map.on("mouseleave", "live-ring", () => (map.getCanvas().style.cursor = ""));
      // The halo is the click target so the dots are easy to hit on touch screens.
      map.on("click", "areas-halo", (e) => picking || onPick(e.features![0].properties.id));
      map.on("mouseenter", "areas-halo", () => (map.getCanvas().style.cursor = "pointer"));
      map.on("mouseleave", "areas-halo", () => (map.getCanvas().style.cursor = picking ? "crosshair" : ""));
      map.addLayer(satelliteLayer(map));
      resolve();
    }),
  );

  const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
  const degPerPx = () => 360 / (512 * 2 ** map.getZoom());

  function applyTexture(next: Texture) {
    const { show, ocean, border } = TEXTURES[next];
    for (const id of BASE_LAYERS) map.setLayoutProperty(id, "visibility", show.includes(id) ? "visible" : "none");
    map.setPaintProperty("ocean", "background-color", ocean);
    map.setPaintProperty("borders", "line-color", border);
  }
  ready.then(() => applyTexture(texture));

  // The Earth turns west to east, so the view drifts toward smaller longitudes.
  function spinFrame(now: number) {
    const dt = Math.min(now - lastFrame, 100);
    lastFrame = now;
    // Leave the camera alone while the user drags or a flight is running.
    if (!map.isMoving()) {
      const c = map.getCenter();
      map.jumpTo({ center: [c.lng - (dt / 1000) * SPIN_PX_PER_S * degPerPx(), c.lat] });
    }
    spinFrameId = requestAnimationFrame(spinFrame);
  }

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
          el(
            "p",
            { className: "muted" },
            // Simple mode leaves out the confidence figure and the data maturity.
            t(document.documentElement.dataset.mode === "simple" ? "popup.meta.simple" : "popup.meta", {
              from: p.from, to: p.to, km: p.area_km2, pct: Math.round(p.confidence * 100), maturity: p.maturity,
            }),
          ),
          el("p", {}, p.summary),
        ),
      )
      .addTo(map);
  }

  // Live events name their source and link to it; text is set as text, never as HTML.
  function showLive(p: LiveFeature["properties"], at: { lng: number; lat: number }) {
    const link = /^https?:\/\//.test(p.url)
      ? el("a", { href: p.url, target: "_blank", rel: "noopener noreferrer" }, t("live.more"))
      : null;
    popup
      .setLngLat(at)
      .setDOMContent(
        el(
          "div",
          { className: "event-popup" },
          el("strong", {}, p.title),
          el("p", {}, liveWhere(p)),
          el("p", { className: "muted" }, `${p.date} · ${typeLabel(p.category)}`),
          p.detail ? el("p", {}, p.detail) : "",
          el("p", { className: "muted" }, t("live.source", { source: p.credit })),
          link ?? "",
        ),
      )
      .addTo(map);
  }

  return {
    // `shown` already passed the filters and carries its display color.
    async setLive(shown: (LiveFeature & { properties: { color: string } })[]) {
      await ready;
      map.getSource<GeoJSONSource>("live")!.setData({ type: "FeatureCollection", features: shown as never });
    },

    // Outlines of the countries picked in the search, as MultiPolygon coordinates.
    async setCountries(shapes: number[][][][][]) {
      await ready;
      map.getSource<GeoJSONSource>("picked")!.setData({
        type: "FeatureCollection",
        features: shapes.map((coordinates) => ({ type: "Feature" as const, properties: {}, geometry: { type: "MultiPolygon" as const, coordinates } })),
      });
    },

    // Turn the globe to a country, close enough to see it whole.
    lookAt(center: [number, number]) {
      map.flyTo({ center, zoom: Math.min(Math.max(map.getZoom(), 2.5), 4) });
    },

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

    // From the "Happening now" list: fly there and open the same popup as a click on the ring.
    async openLive(p: LiveFeature["properties"]) {
      await ready;
      map.flyTo({ center: [p.lon, p.lat], zoom: Math.max(map.getZoom(), 4) });
      map.once("moveend", () => showLive(p, { lng: p.lon, lat: p.lat }));
    },

    async goTo(lng: number, lat: number) {
      await ready;
      marker.setLngLat([lng, lat]).addTo(map);
      map.flyTo({ center: [lng, lat], zoom: 8 });
    },

    setView(next: ViewMode) {
      mode = next;
      const { zoom, pitch } = HOME[mode];
      // Keep looking at the same place. Going back to the globe view only levels the camera: the
      // zoom stays where it was.
      map.easeTo({ pitch, bearing: 0, ...(mode === "closeup" && { zoom: Math.max(map.getZoom(), zoom) }) });
    },

    // The welcome screen skims the surface with the Earth's curve low on the screen; leaving it
    // swings a sixth of a turn round to the whole globe. MapLibre jumps instead for reduced motion.
    // About the globe's radius on screen in the whole-Earth view, in pixels (it varies a little
    // with the window size), for planning a path round it.
    roughRadius: (0.85 * 512 * 2 ** HOME.globe.zoom) / (2 * Math.PI * Math.cos((HOME.globe.center[1] * Math.PI) / 180)),

    welcome(on: boolean, duration: number) {
      popup.remove();
      mode = "globe";
      const lng = map.getCenter().lng;
      if (on) map.easeTo({ ...HOME.closeup, center: [lng, 20], padding: { top: map.getContainer().clientHeight * WELCOME_DROP }, duration });
      else map.easeTo({ ...HOME.globe, center: [lng - 60, 20], padding: { top: 0 }, duration });
    },

    async setTexture(next: Texture) {
      await ready;
      applyTexture(next);
    },

    setSpin(on: boolean) {
      cancelAnimationFrame(spinFrameId);
      spinFrameId = 0;
      if (!on) return;
      lastFrame = performance.now();
      spinFrameId = requestAnimationFrame(spinFrame);
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
      map.addLayer({ id, type: "raster", source: id, paint: { "raster-opacity": opacity, "raster-fade-duration": 0 } }, "events-fill");
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
        const c = map.getCenter();
        map.setCenter([c.lng - dx * degPerPx(), clamp(c.lat + dy * degPerPx(), -85, 85)]);
      },
      // Turn and tilt the camera without moving the spot it looks at.
      look: (dx: number, dy: number) =>
        map.jumpTo({ bearing: map.getBearing() + dx * 0.4, pitch: clamp(map.getPitch() - dy * 0.3, 0, MAX_PITCH) }),
      // Tip the camera up toward the horizon or down toward the ground.
      updown: (_dx: number, dy: number) => map.setPitch(clamp(map.getPitch() - dy * 0.4, 0, MAX_PITCH)),
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
      // Bring the whole Earth back to the middle.
      home: () => map.flyTo(HOME[mode]),
    },
  };
}

export type Globe = ReturnType<typeof createGlobe>;
