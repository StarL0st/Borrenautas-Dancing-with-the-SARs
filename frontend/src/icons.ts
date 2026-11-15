// One silhouette per filter type (24×24 grid, even-odd fill). The same shape is drawn two ways:
// filled with the group color when the type is switched on, outline only when it is off
// (see `.ticon` in style.css). Shapes are original and kept chunky so the fill reads at 20 px.

const P: Record<string, string> = {
  // Natural
  earthquakes: "M2.5 11.6 11 4.2l.8.6L10 9l2.4 3-2.2 4 1.4 4.5H4.5v-7.7ZM13.2 5.4l8.3 6.2-2 1.3v7.6h-6.1l-1.4-4.5 2.2-4-2.4-3Z",
  volcanoes: "M2 21 8.6 9H10l1 2 2-2h2.4L22 21ZM9 6.6c0-2 2-3 3.5-2 1-2 4.5-1.5 4 1-1.5 1.5-4.5.5-7.5 1Z",
  hurricanes:
    "M12 6a6 6 0 0 1 5.5 3.6C19 6 18 3 14.5 2 17 4 15.5 5.6 12 6ZM12 18a6 6 0 0 1-5.5-3.6C5 18 6 21 9.5 22 7 20 8.5 18.4 12 18ZM12 6a6 6 0 1 1 0 12 6 6 0 0 1 0-12Zm0 3.8a2.2 2.2 0 1 0 0 4.4 2.2 2.2 0 0 0 0-4.4Z",
  storms: "M6.5 15A4.5 4.5 0 0 1 6 6.1a5.5 5.5 0 0 1 10.6-1.1A4.5 4.5 0 0 1 18 15h-3.6l-2-.1L11 15ZM11.2 13 8 19.2h3.1L10 23l5.2-6.6h-3.1l2-3.4Z",
  floods:
    "M5 11.5 12 5.5l7 6V14H5ZM2 16c2 0 2-1.5 4-1.5S8 16 10 16s2-1.5 4-1.5 2 1.5 4 1.5 2-1.5 4-1.5V18c-2 0-2 1.5-4 1.5S16 18 14 18s-2 1.5-4 1.5S8 18 6 18s-2 1.5-4 1.5Z",
  landslides: "M2 21V8.5L14.5 21ZM17 13.5a2.2 2.2 0 1 1 0 4.4 2.2 2.2 0 0 1 0-4.4ZM20.6 18.4a1.6 1.6 0 1 1 0 3.2 1.6 1.6 0 0 1 0-3.2ZM12.6 9.2a1.9 1.9 0 1 1 0 3.8 1.9 1.9 0 0 1 0-3.8Z",
  sinkholes: "M2 9h6c1 0 1.5 1 2 2.5.6 1.8 1 2.5 2 2.5s1.4-.7 2-2.5c.5-1.5 1-2.5 2-2.5h6v4h-4.3c-.7 2.5-2.3 7-5.7 7s-5-4.5-5.7-7H2Z",
  wildfires: "M12 2c1 3.5 5.5 5.5 5.5 11.3A5.5 5.5 0 0 1 6.5 13.3c0-2.7 1.3-4.3 2.7-5.3.1 1.7.8 2.8 1.7 3.3C10.6 8.4 11 5 12 2Z",
  drought: "M12 2.5a4.3 4.3 0 1 1 0 8.6 4.3 4.3 0 0 1 0-8.6ZM2 14h20v7H2Zm6.4 0 1.7 2.6-1.1 4.4h1.6l1.2-4.4L10 14Zm7 0-1 3 1.4 4h1.4l-1.3-4 1-3Z",
  heat: "M10 4.5a2 2 0 0 1 4 0v8.9a4.5 4.5 0 1 1-4 0ZM17.5 4h4v2h-4Zm0 4h4v2h-4Z",
  cold:
    "M11 2h2v5.3l3.6-2.1 1 1.7L14 9l3.6 2.1-1 1.7L13 10.7v2.6l3.6 2.1-1 1.7L13 15V22h-2v-7l-3.6 2.1-1-1.7L11 13.3v-2.6l-3.6 2.1-1-1.7L10 9 6.4 6.9l1-1.7L11 7.3Z",
  dust: "M2.5 6.5h11a1.8 1.8 0 1 0-1.8-1.8h-2a3.8 3.8 0 1 1 3.8 3.8h-11ZM2.5 11h16a3 3 0 1 1-3 3h2a1 1 0 1 0 1-1h-16ZM2.5 16h9v2h-9Zm12 0h3v2h-3Z",
  marine: "M2 19c3 0 4.2-2 5-5 1-3.8 3.4-7.5 8.2-7.5 3.2 0 5.3 2 5.3 4.3-1.5-1-3.6-.9-4.6.6S15.2 14 17.2 14c1.1 0 2.2-.5 3.3-1.2C19.6 17 16.6 20 12 20c-3 0-4 .8-5 2H2Z",
  glaciers: "M2 20.5 9 7l3.2 5.5 2-3.2 7.8 11.2ZM7.2 10.6 9 7.2l2 3.6-1 .9-1-1-1 1Z",
  forecast: "M12 3a7 7 0 0 1 4.6 12.3L18 18.5H6l1.4-3.2A7 7 0 0 1 12 3ZM5 19.8h14V22H5Z",
  "sea-ice": "M2 15 6 11h5l2 2h5l4 2v3H2Z",
  // Polar types (drawn on the frontend branch; jopa-testing had left them out)
  "ice-sheets": "M3 14 7 6h9l5 8ZM2 16h20v3H2Z",
  permafrost: "M2 5h20v4H2ZM2 11h20v4H2ZM2 17h20v4H2Z",
  "glacial-lakes": "M3 13 9 4l4 6 2-2 6 5ZM2 15h20v2H2ZM4 19h16v2H4Z",
  // Caused by humans
  "induced-seismicity": "M10 2h4l4.2 18H20v2H4v-2h1.8ZM11.2 6h1.6l1.4 6.5H9.8Z",
  "oil-spills":
    "M6 3h8a1 1 0 0 1 1 1v10.5a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1ZM3 19.2c0-1.1 3-2 8-2s10 .9 10 2-4.5 2-10 2-8-.9-8-2ZM18.5 8.5c1 1.5 2 2.7 2 3.7a2 2 0 0 1-4 0c0-1 1-2.2 2-3.7Z",
  industrial: "M2 21V10l5 3v-3l5 3v-3l5 3V4h4v17Z",
  groundwater: "M3.5 7.5H13V4.5h3v3h4.5v4H16V21h-3v-9.5H3.5ZM7.2 14c1 1.5 2 2.7 2 3.7a2 2 0 0 1-4 0c0-1 1-2.2 2-3.7Z",
  subsidence: "M7 3h9v11.5H7ZM2 15h4.2l2 3h6.6l2-3H22v6H2Z",
  logging: "M5.5 14h13v5.2c0 1.6-2.9 2.8-6.5 2.8s-6.5-1.2-6.5-2.8ZM14.2 2.8l7 7-2.2 2.2-7-7Z",
  "coastal-loss": "M2 5h9.5l2 3.6-1.2 3.4 2 3.2-1.4 5.8H2ZM17 13.5a1.6 1.6 0 1 1 0 3.2 1.6 1.6 0 0 1 0-3.2ZM20.2 17.6a1.3 1.3 0 1 1 0 2.6 1.3 1.3 0 0 1 0-2.6Z",
  reservoirs: "M3 21v-2h4.2l3.6-8.3-5.6-1.9 1-2.9 13.3 4.3-1 2.9-4.2-1.4L12.3 19H15v2Z",
  // Land use
  deforestation: "M12 2l6.2 8h-2.6l4.2 6.2H13V22h-2v-5.8H4.2L8.4 10H5.8Z",
  urban: "M3 21V9h5V4h7v7h6v10Z",
  agriculture: "M11 22v-8C6 14 4 11 4 6c4 0 7 2 7 6 0-5 3-8 9-8 0 6-3 9-7 9v9Z",
};

// A generic pin for types without a drawing (a newer back end can send ids the app lacks).
const FALLBACK = "M12 2a7 7 0 0 1 7 7c0 5-7 13-7 13S5 14 5 9a7 7 0 0 1 7-7Zm0 4a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z";

const NS = "http://www.w3.org/2000/svg";

export const hasIcon = (type: string) => type in P;

/** The silhouette for a filter type, as an inline SVG colored by `currentColor`. */
export function icon(type: string, className = "ticon"): SVGSVGElement {
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("class", className);
  svg.setAttribute("aria-hidden", "true");
  const path = document.createElementNS(NS, "path");
  path.setAttribute("d", P[type] ?? FALLBACK);
  path.setAttribute("fill-rule", "evenodd");
  svg.append(path);
  return svg;
}
