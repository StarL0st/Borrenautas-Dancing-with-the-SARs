// The full report of one area as a PDF (jopa-testing). Loaded only when someone asks for it, so
// the PDF library (jsPDF, about 350 kB) never slows the page down.
//
// Layout: a cover with the area, its key numbers and the contents, then numbered sections, each
// starting with a heading; every picture and table says where its data come from and when.
// Text is in English or Spanish (German falls back to English, as in mexico.ts). The built-in PDF
// fonts only know Western European letters, so other characters are replaced (`clean`).
import { jsPDF } from "jspdf";
import { autoTable } from "jspdf-autotable";
import type { Series } from "./chart";
import { DECISIONS } from "./decisions";
import { TOPICS, topicsFor } from "./explain";
import { t } from "./i18n";
import { CLASSES } from "./legend";
import { datesFor, importance, layerAt, liveWhere, SOURCE_SHORT, ticks, type AreaView, type EventFeature, type Friendly, type Layer, type LiveFeature } from "./logic";
import { tx, zoneHistory, zoneNote, HISTORY, type Source } from "./mexico";
import { RECORDS_CHECKED } from "./origin";
import type { ReportMeta, ReportSnapshot } from "./report-core";
import type { Found } from "./satview";
import { REFS, SOURCES_CHECKED, type RefId } from "./sources";
import { clean, fill } from "./pdf-text";

// What the page hands over: the data, and how to fetch the parts that take time.
export type ReportInput = {
  area: AreaView;
  events: EventFeature["properties"][]; // this area's detected changes
  live: LiveFeature["properties"][]; // live reports near the area
  lang: string;
  asOf: ReportSnapshot["asOf"];
  series: () => Promise<[string, Series[]][]>;
  satellite: () => Promise<[Found | undefined, Found | undefined]>; // before, now
  friendly: () => Promise<Friendly | undefined>; // C8 cards, when the back end made them
};

// How to word and find things; not part of the content.
export type ReportEnv = {
  base: URL; // where the radar pictures are
  typeName: (type: string) => string; // filter type names in the page's language
  satName: (layer: string) => string; // "HLS · Landsat 8/9 · 30 m"
};

/** Everything the report shows, fetched now. Compare snapshots with report-core.ts. */
export async function snapshotReport(input: ReportInput): Promise<ReportSnapshot> {
  const [sat, series, friendly] = await Promise.all([
    input.satellite().catch(() => [undefined, undefined] as [undefined, undefined]),
    input.series().catch(() => [] as [string, Series[]][]),
    input.friendly().catch(() => undefined),
  ]);
  return { area: input.area, events: input.events, live: input.live, lang: input.lang, asOf: input.asOf, sat, series, friendly };
}

// ---- Words ----

type Words = Record<keyof typeof EN, string>;
const EN = {
  title: "Area report",
  made: "Version {v} · made {date} with G.I.G.A.S",
  asOf: "Data as of: NISAR results published {radar}; live reports {live}; satellite photos {sat}.",
  whatsNew: "What is new since version {n}",
  summaryFrom: "Area description from the project's list of study areas.",
  rulesText: "Each description below is written by the app's detection rules from the radar measurements.",
  sRefs: "References",
  refsIntro: "Every explanation in this report cites one of these. Each page was opened and read on {date}. Numbers that are the app's own rules cite the project's code.",
  dataCredits: "Data citations",
  subtitle: "What the NISAR radar saw from space, with context from other satellites, alert services and published records.",
  glance: "At a glance",
  passes: "Radar dates",
  changes: "Detected changes",
  kinds: "Main kinds of change",
  maturity: "NISAR data maturity",
  none: "none",
  noRadar: "There is no NISAR radar data for this place yet. Everything in this report comes from other sources.",
  contents: "Contents",
  page: "Page {n} of {total}",
  sSources: "Where the data come from",
  sPictures: "Pictures: before and after",
  sChanges: "Detected changes",
  sTrends: "Change over time",
  sZone: "Background notes (written by the team for this place)",
  sHistory: "Remarkable past events nearby (hand-picked list)",
  sFriendly: "What the radar found here",
  fKind: "Kind",
  fLevel: "Level",
  fWhat: "What it means",
  fSize: "Size and dates",
  fLevels: "Watched for, nothing found|Small or weak|1-5% of the area|Over 5% of the area",
  fStatus: "Calm|Worth watching|Alert",
  fNote: "Made automatically for every area from its radar results (contract C8).",
  sLive: "Live reports nearby",
  sWhy: "How the radar sees these changes",
  sMethods: "Methods and decisions",
  sInventory: "List of radar pictures",
  sGlossary: "Words used in this report",
  sCredits: "Credits and citations",
  kindsIntro: "Every part of this report is marked with one of four kinds of source, so it is always clear what comes from NISAR.",
  kNisar: "NISAR radar",
  kSatellite: "Other satellite",
  kFeed: "Live report",
  kRecord: "Published record",
  dNisar: "NASA-ISRO radar satellite. Sees through clouds, day and night. The main data of this report.",
  dSatellite: "Ordinary pictures from other satellites (NASA GIBS). Context only, never used to detect changes.",
  dFeed: "Alerts from public services (USGS, NASA EONET, GDACS, NOAA). Not NISAR.",
  dRecord: "Agency reports, scientific studies and news of past disasters, each with its link.",
  hKind: "Kind", hSource: "Source", hWhat: "What exactly", hDates: "Dates", hNotes: "Notes",
  gcovWhat: "GCOV backscatter (HH and HV)", gunwWhat: "GUNW ground motion", sme2What: "SME2 soil moisture", derivedWhat: "Maps derived by our pipeline",
  gibsWhat: "Photos for the before/after view",
  liveWhat: "Alerts near this place, last 24 hours",
  recordWhat: "Zone notes and remarkable events",
  checked: "Sources checked {date}",
  picPair: "NISAR radar, {group}: first pass ({before}) and latest pass ({after}). Bright = strong echo, dark = weak echo.",
  picChange: "Detected change between {from} and {to}, over the radar picture of {base}.",
  picSurface: "Surface type from the average of all radar dates ({from} to {to}).",
  picMotion: "Ground motion from {from} to {to}, over the radar picture of {base}. Red: moving away from the satellite. Blue: toward it.",
  picSat: "{name}: before ({before}) and now ({now}). Nearest clear days; they can differ from the radar dates.",
  picNone: "No pictures could be loaded.",
  before: "Before", after: "After", now: "Now",
  changesIntro: "The radar found {n} changes between {from} and {to}. Each one is a hypothesis from radar alone, with a confidence from 0 to 100%.",
  byKind: "Changes by kind",
  byMonth: "Changes by month they were seen",
  top: "The {n} most important (largest and surest)",
  all: "All detected changes",
  hDate: "Dates", hType: "Kind", hSaw: "What the radar saw", hArea: "Area (km²)", hConf: "Confidence",
  noChanges: "The radar found no changes here, or this area was not analyzed for changes.",
  trendsIntro: "Average values over the area on each radar date (NISAR).",
  noTrends: "No time series for this area.",
  nature: "Plants and animals",
  sources: "Sources",
  hYear: "Date", hEvent: "Event", hImpact: "What happened",
  noHistory: "No remarkable events recorded within 150 km.",
  liveIntro: "Reports from public alert services within 300 km, as of {date}. These are not NISAR data.",
  noLive: "No live reports within 300 km in the last 24 hours.",
  hWhen: "Reported (UTC)", hWhere: "Where",
  fires: "Fire hot spots seen by satellite (NASA FIRMS): {n}, the latest at {date} UTC.",
  whyIntro: "NISAR does not take photos. It sends microwaves to the ground and listens to the echo. What changes the echo is water and shape, not color.",
  methodsIntro: "Why we chose these data and methods, and what we gave up.",
  hDecision: "Decision", hChose: "We chose", hWhy: "Why", hGiveUp: "What we give up",
  hWord: "Word", hMeaning: "What it means",
  inventoryIntro: "Every NISAR picture of this area, in date order.",
  hPicture: "Picture", hProduct: "Product", hMaturity: "Maturity", hUnits: "Units", hRange: "Range",
  disclaimer: "Radar results are hypotheses from radar alone, not confirmed facts. Check with local authorities before making decisions.",
  legend: "Legend",
};
const ES: Words = {
  title: "Informe de zona",
  made: "Versión {v} · generada el {date} con G.I.G.A.S",
  asOf: "Datos al: resultados NISAR publicados {radar}; reportes en vivo {live}; fotos de satélite {sat}.",
  whatsNew: "Qué hay de nuevo desde la versión {n}",
  summaryFrom: "Descripción de la zona tomada de la lista de zonas de estudio del proyecto.",
  rulesText: "Cada descripción de abajo la escriben las reglas de detección de la app a partir de las mediciones del radar.",
  sRefs: "Referencias",
  refsIntro: "Cada explicación de este informe cita una de estas fuentes. Cada página se abrió y leyó el {date}. Los números que son reglas propias de la app citan el código del proyecto.",
  dataCredits: "Citas de los datos",
  subtitle: "Lo que vio el radar NISAR desde el espacio, con contexto de otros satélites, servicios de alerta y registros publicados.",
  glance: "De un vistazo",
  passes: "Fechas de radar",
  changes: "Cambios detectados",
  kinds: "Principales tipos de cambio",
  maturity: "Madurez de datos NISAR",
  none: "ninguno",
  noRadar: "Aún no hay datos del radar NISAR para este lugar. Todo en este informe viene de otras fuentes.",
  contents: "Contenido",
  page: "Página {n} de {total}",
  sSources: "De dónde vienen los datos",
  sPictures: "Imágenes: antes y después",
  sChanges: "Cambios detectados",
  sTrends: "Cambio en el tiempo",
  sZone: "Notas de contexto (escritas por el equipo para este lugar)",
  sHistory: "Eventos notables del pasado cerca (lista elegida a mano)",
  sFriendly: "Lo que encontró el radar aquí",
  fKind: "Tipo",
  fLevel: "Nivel",
  fWhat: "Qué significa",
  fSize: "Tamaño y fechas",
  fLevels: "Vigilado, sin hallazgos|Pequeño o débil|1-5 % del área|Más del 5 % del área",
  fStatus: "En calma|Para vigilar|Alerta",
  fNote: "Hecho automáticamente para cada área a partir de sus resultados de radar (contrato C8); las frases vienen en inglés.",
  sLive: "Reportes en vivo cercanos",
  sWhy: "Cómo ve el radar estos cambios",
  sMethods: "Métodos y decisiones",
  sInventory: "Lista de imágenes de radar",
  sGlossary: "Palabras usadas en este informe",
  sCredits: "Créditos y citas",
  kindsIntro: "Cada parte de este informe está marcada con uno de cuatro tipos de fuente, para que siempre quede claro qué viene de NISAR.",
  kNisar: "Radar NISAR",
  kSatellite: "Otro satélite",
  kFeed: "Reporte en vivo",
  kRecord: "Registro publicado",
  dNisar: "Satélite de radar de la NASA y la ISRO. Ve a través de nubes, de día y de noche. Los datos principales de este informe.",
  dSatellite: "Imágenes comunes de otros satélites (NASA GIBS). Solo contexto, nunca se usan para detectar cambios.",
  dFeed: "Alertas de servicios públicos (USGS, NASA EONET, GDACS, NOAA). No es NISAR.",
  dRecord: "Informes de agencias, estudios científicos y noticias de desastres pasados, cada uno con su enlace.",
  hKind: "Tipo", hSource: "Fuente", hWhat: "Qué exactamente", hDates: "Fechas", hNotes: "Notas",
  gcovWhat: "Retrodispersión GCOV (HH y HV)", gunwWhat: "Movimiento del suelo GUNW", sme2What: "Humedad del suelo SME2", derivedWhat: "Mapas derivados por nuestro procesamiento",
  gibsWhat: "Fotos para la vista antes/después",
  liveWhat: "Alertas cerca de este lugar, últimas 24 horas",
  recordWhat: "Notas de zona y eventos importantes",
  checked: "Fuentes revisadas el {date}",
  picPair: "Radar NISAR, {group}: primera pasada ({before}) y última pasada ({after}). Claro = eco fuerte, oscuro = eco débil.",
  picChange: "Cambio detectado entre {from} y {to}, sobre la imagen de radar del {base}.",
  picSurface: "Tipo de superficie según el promedio de todas las fechas de radar ({from} a {to}).",
  picMotion: "Movimiento del suelo de {from} a {to}, sobre la imagen de radar del {base}. Rojo: se aleja del satélite. Azul: se acerca.",
  picSat: "{name}: antes ({before}) y ahora ({now}). Días despejados más cercanos; pueden no coincidir con las fechas del radar.",
  picNone: "No se pudieron cargar imágenes.",
  before: "Antes", after: "Después", now: "Ahora",
  changesIntro: "El radar encontró {n} cambios entre {from} y {to}. Cada uno es una hipótesis solo con radar, con una confianza de 0 a 100%.",
  byKind: "Cambios por tipo",
  byMonth: "Cambios por mes en que se vieron",
  top: "Los {n} más importantes (más grandes y más seguros)",
  all: "Todos los cambios detectados",
  hDate: "Fechas", hType: "Tipo", hSaw: "Qué vio el radar", hArea: "Área (km²)", hConf: "Confianza",
  noChanges: "El radar no encontró cambios aquí, o esta zona no se analizó en busca de cambios.",
  trendsIntro: "Valores promedio sobre la zona en cada fecha de radar (NISAR).",
  noTrends: "No hay series de tiempo para esta zona.",
  nature: "Plantas y animales",
  sources: "Fuentes",
  hYear: "Fecha", hEvent: "Evento", hImpact: "Qué pasó",
  noHistory: "No hay eventos importantes registrados a menos de 150 km.",
  liveIntro: "Reportes de servicios públicos de alerta a menos de 300 km, al {date}. No son datos de NISAR.",
  noLive: "No hay reportes en vivo a menos de 300 km en las últimas 24 horas.",
  hWhen: "Reportado (UTC)", hWhere: "Dónde",
  fires: "Puntos de calor vistos por satélite (NASA FIRMS): {n}, el último a las {date} UTC.",
  whyIntro: "NISAR no toma fotos. Envía microondas al suelo y escucha el eco. Lo que cambia el eco es el agua y la forma, no el color.",
  methodsIntro: "Por qué elegimos estos datos y métodos, y a qué renunciamos.",
  hDecision: "Decisión", hChose: "Elegimos", hWhy: "Por qué", hGiveUp: "A qué renunciamos",
  hWord: "Palabra", hMeaning: "Qué significa",
  inventoryIntro: "Todas las imágenes NISAR de esta zona, por fecha.",
  hPicture: "Imagen", hProduct: "Producto", hMaturity: "Madurez", hUnits: "Unidades", hRange: "Rango",
  disclaimer: "Los resultados del radar son hipótesis solo con radar, no hechos confirmados. Consulta a las autoridades locales antes de tomar decisiones.",
  legend: "Leyenda",
};

// Each definition says only what its sources say (sources.ts).
const GLOSSARY: { term: string; en: string; es: string; refs: RefId[] }[] = [
  { term: "NISAR", en: "NASA-ISRO Synthetic Aperture Radar: a satellite launched on July 30, 2025 that observes Earth's land and ice every 12 days.", es: "Radar de Apertura Sintética NASA-ISRO: un satélite lanzado el 30 de julio de 2025 que observa la tierra y el hielo de la Tierra cada 12 días.", refs: ["nisarFacts"] },
  { term: "L-band", en: "NISAR's main radar: wavelength 24 cm. Longer waves go deeper into tree canopy than shorter ones.", es: "El radar principal de NISAR: longitud de onda de 24 cm. Las ondas largas entran más en el dosel que las cortas.", refs: ["nisarFacts", "sar"] },
  { term: "Backscatter", en: "The energy of a radar pulse that comes back to the instrument after it interacts with the Earth.", es: "La energía de un pulso de radar que regresa al instrumento después de interactuar con la Tierra.", refs: ["sar"] },
  { term: "HH / HV", en: "Polarizations: HH is sent and received horizontally; HV is sent horizontally and received vertically. Double bounce (buildings, tree trunks, flooded vegetation) shows most in HH; volume scattering by leaves and branches shows most in HV.", es: "Polarizaciones: HH se envía y recibe en horizontal; HV se envía en horizontal y se recibe en vertical. El doble rebote (edificios, troncos, vegetación inundada) se nota más en HH; la dispersión de volumen de hojas y ramas, en HV.", refs: ["sar"] },
  { term: "dB (decibel)", en: "A ratio scale: dB = 10 × log10(ratio). Half the echo is 10 × log10(0.5) ≈ -3 dB; double is about +3 dB.", es: "Una escala de razones: dB = 10 × log10(razón). La mitad del eco es 10 × log10(0.5) ≈ -3 dB; el doble, unos +3 dB.", refs: [] },
  { term: "GCOV", en: "NISAR Level 2 product: radiometrically terrain-corrected backscatter, for uses such as disturbance detection, inundation mapping and crop mapping.", es: "Producto NISAR de nivel 2: retrodispersión con corrección radiométrica del terreno, para usos como detección de disturbios, mapeo de inundaciones y de cultivos.", refs: ["asfProducts"] },
  { term: "GUNW", en: "NISAR Level 2 product: an unwrapped, multi-looked differential interferogram from two radar images, for measuring ground displacement.", es: "Producto NISAR de nivel 2: un interferograma diferencial desenvuelto y multilook de dos imágenes de radar, para medir desplazamientos del suelo.", refs: ["asfProducts"] },
  { term: "SME2", en: "NISAR Level 3 soil moisture product.", es: "Producto NISAR de nivel 3 de humedad del suelo.", refs: ["nisarFacts", "asfProducts"] },
  { term: "Maturity", en: "BETA products are not fully calibrated; PROVISIONAL products are fully calibrated and partially validated; VALIDATED products were first released on November 6, 2026.", es: "Los productos BETA no están totalmente calibrados; los PROVISIONAL están calibrados y parcialmente validados; los VALIDATED se publicaron por primera vez el 6 de noviembre de 2026.", refs: ["asfProducts"] },
  { term: "Confidence", en: "How strongly the app's detection rules support a change, from 0 to 100%.", es: "Qué tan fuerte es el apoyo de las reglas de detección de la app a un cambio, de 0 a 100%.", refs: ["rules"] },
  { term: "Hypothesis", en: "How the app labels every radar result: likely, but not confirmed on the ground.", es: "Cómo etiqueta la app cada resultado del radar: probable, pero no confirmado en el terreno.", refs: ["rules"] },
];

// ---- Look ----

type RGB = [number, number, number];
const NAVY: RGB = [3, 25, 39];
const INK: RGB = [28, 36, 44];
const MUTED: RGB = [96, 112, 124];
const LINE: RGB = [214, 222, 228];
const SOFT: RGB = [242, 246, 249];
const ACCENT: RGB = [239, 148, 108];
// Okabe-Ito, darkened where needed for white paper.
const KIND: Record<"nisar" | "satellite" | "feed" | "record", RGB> = {
  nisar: [0, 114, 178], satellite: [0, 158, 115], feed: [213, 140, 0], record: [204, 121, 167],
};
const LINES: RGB[] = [[0, 114, 178], [213, 94, 0], [0, 158, 115]];

const PAGE_W = 210, PAGE_H = 297, M = 16, CW = PAGE_W - 2 * M, TOP = 24, BOTTOM = PAGE_H - 18;

const parseRgb = (css: string): RGB => (css.match(/\d+/g) ?? ["0", "0", "0"]).slice(0, 3).map(Number) as RGB;

function loadImage(url: string): Promise<HTMLImageElement | undefined> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(undefined);
    img.src = url;
  });
}

// Pictures drawn on top of each other on a dark ground, as a JPEG for the PDF.
function flatten(imgs: (HTMLImageElement | undefined)[], width = 900): { url: string; ratio: number } | undefined {
  const base = imgs.find(Boolean);
  if (!base) return undefined;
  const ratio = base.naturalHeight / base.naturalWidth;
  const c = document.createElement("canvas");
  [c.width, c.height] = [width, Math.round(width * ratio)];
  const g = c.getContext("2d")!;
  g.fillStyle = "#02101c";
  g.fillRect(0, 0, c.width, c.height);
  for (const img of imgs) if (img) g.drawImage(img, 0, 0, c.width, c.height);
  try {
    return { url: c.toDataURL("image/jpeg", 0.86), ratio };
  } catch {
    return undefined; // a server that does not allow reading its pixels
  }
}

// ---- The document ----

/** The PDF of one snapshot, as a file. `meta` says which version it is and what is new in it. */
export async function renderReport(snap: ReportSnapshot, env: ReportEnv, meta: ReportMeta): Promise<Blob> {
  const a = snap.area;
  const L: Words = snap.lang === "es" ? ES : EN;
  const lang = snap.lang;
  const made = new Date(meta.made);
  const today = made.toISOString().slice(0, 10);
  const utc = (iso: string) => (iso && Number.isFinite(Date.parse(iso)) ? `${new Date(iso).toISOString().slice(0, 16).replace("T", " ")} UTC` : "-");
  // Numbered citations, in order of first use; listed in the References section.
  const cited: RefId[] = [];
  const num = (r: RefId) => (cited.includes(r) ? cited.indexOf(r) : cited.push(r) - 1) + 1;
  const cite = (refs: RefId[]) => (refs.length ? ` [${refs.map(num).join(", ")}]` : "");
  const doc = new jsPDF({ unit: "mm", format: "a4", compress: true });
  doc.setProperties({ title: `${L.title}: ${clean(a.title)}`, subject: "NISAR change report", creator: "G.I.G.A.S" });
  const toc: { title: string; page: number }[] = [];
  let y = TOP;

  // -- small drawing helpers --
  const color = (c: RGB) => doc.setTextColor(...c);
  const font = (size: number, style: "normal" | "bold" | "italic" = "normal") => {
    doc.setFont("helvetica", style);
    doc.setFontSize(size);
  };
  const newPage = () => {
    doc.addPage();
    y = TOP;
  };
  const ensure = (h: number) => {
    if (y + h > BOTTOM) newPage();
  };
  const para = (text: string, opts: { size?: number; style?: "normal" | "bold" | "italic"; c?: RGB; gap?: number; x?: number; w?: number } = {}) => {
    const size = opts.size ?? 10, lh = size * 0.42;
    font(size, opts.style);
    color(opts.c ?? INK);
    for (const line of doc.splitTextToSize(clean(text), opts.w ?? CW) as string[]) {
      ensure(lh);
      doc.text(line, opts.x ?? M, y + lh * 0.8);
      y += lh;
    }
    y += opts.gap ?? 2.5;
  };
  const heading = (text: string, size = 11.5) => {
    ensure(14);
    para(text, { size, style: "bold", c: NAVY, gap: 1.5 });
  };
  // Big sections start a page; short ones follow the previous one when there is room.
  const section = (title: string, fresh = false) => {
    if (fresh || y > BOTTOM - 80) newPage();
    else {
      y += 6;
      doc.setDrawColor(...LINE);
      doc.setLineWidth(0.3);
      doc.line(M, y, M + CW, y);
      y += 8;
    }
    toc.push({ title, page: doc.getNumberOfPages() });
    const n = toc.length;
    doc.setFillColor(...NAVY);
    doc.roundedRect(M, y, 9, 9, 1.5, 1.5, "F");
    font(11, "bold");
    doc.setTextColor(255, 255, 255);
    doc.text(String(n), M + 4.5, y + 6.2, { align: "center" });
    font(17, "bold");
    color(NAVY);
    doc.text(clean(title), M + 13, y + 7);
    y += 12;
    doc.setDrawColor(...ACCENT);
    doc.setLineWidth(0.8);
    doc.line(M, y, M + 30, y);
    y += 6;
  };
  // A source chip: colored shape (same shapes as on the page) + kind name + detail. `x0`/`width`
  // place it in a column.
  const chip = (kind: keyof typeof KIND, detail = "", x0 = M, width = CW, keep = false) => {
    const label = { nisar: L.kNisar, satellite: L.kSatellite, feed: L.kFeed, record: L.kRecord }[kind];
    font(8, "bold");
    const wLabel = doc.getTextWidth(clean(label));
    font(8);
    const room = width - wLabel - 12;
    const text = clean(detail) ? (doc.splitTextToSize(clean(detail), room)[0] as string) : "";
    const w = Math.min(width, 9 + wLabel + (text ? doc.getTextWidth(text) + 3 : 0) + 3);
    if (!keep) ensure(7);
    doc.setFillColor(...SOFT);
    doc.roundedRect(x0, y, w, 5.6, 1, 1, "F");
    doc.setFillColor(...KIND[kind]);
    doc.rect(x0, y, 1.2, 5.6, "F");
    shape(kind, x0 + 4.2, y + 2.8, 1.5);
    font(8, "bold");
    color(INK);
    doc.text(clean(label), x0 + 7, y + 3.9);
    if (text) {
      font(8);
      color(MUTED);
      doc.text(text, x0 + 7 + wLabel + 2.5, y + 3.9);
    }
    y += 7.5;
  };
  const shape = (kind: keyof typeof KIND, cx: number, cy: number, r: number) => {
    doc.setFillColor(...KIND[kind]);
    if (kind === "nisar") doc.lines([[r, r], [-r, r], [-r, -r], [r, -r]], cx, cy - r, [1, 1], "F", true);
    else if (kind === "satellite") doc.circle(cx, cy, r * 0.85, "F");
    else if (kind === "feed") doc.triangle(cx, cy - r, cx + r, cy + r * 0.8, cx - r, cy + r * 0.8, "F");
    else doc.rect(cx - r * 0.8, cy - r * 0.8, r * 1.6, r * 1.6, "F");
  };
  const table = (head: string[], body: (string | number)[][], opts: { widths?: number[]; size?: number; accent?: RGB; bold?: number } = {}) => {
    autoTable(doc, {
      head: [head.map(clean)],
      body: body.map((r) => r.map((v) => clean(String(v)))),
      startY: y,
      margin: { left: M, right: M, top: TOP, bottom: PAGE_H - BOTTOM + 2 },
      theme: "plain",
      styles: { font: "helvetica", fontSize: opts.size ?? 8.5, cellPadding: { top: 1.6, bottom: 1.6, left: 2, right: 2 }, textColor: INK, lineColor: LINE, lineWidth: { bottom: 0.2 }, valign: "top" },
      headStyles: { fillColor: opts.accent ?? NAVY, textColor: [255, 255, 255], fontStyle: "bold" },
      alternateRowStyles: { fillColor: SOFT },
      columnStyles: Object.fromEntries((opts.widths ?? []).map((w, i) => [i, { cellWidth: w, ...(i === opts.bold && { fontStyle: "bold" as const }) }])),
    });
    y = ((doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY ?? y) + 6;
  };
  const picture = (img: { url: string; ratio: number } | undefined, w: number, x = M) => {
    if (!img) return 0;
    const h = w * img.ratio;
    doc.addImage(img.url, "JPEG", x, y, w, h);
    doc.setDrawColor(...LINE);
    doc.setLineWidth(0.2);
    doc.rect(x, y, w, h);
    return h;
  };
  const caption = (text: string) => para(text, { size: 8.5, c: MUTED, gap: 4 });
  const swatches = (items: [RGB, string][], x0 = M, width = CW, keep = false) => {
    if (!keep) ensure(7);
    let x = x0;
    font(8);
    for (const [c, label] of items) {
      const w = doc.getTextWidth(clean(label)) + 8;
      if (x + w > x0 + width && x > x0) {
        x = x0;
        y += 5;
      }
      doc.setFillColor(...c);
      doc.rect(x, y, 3.2, 3.2, "F");
      color(INK);
      doc.text(clean(label), x + 4.6, y + 2.8);
      x += w + 2;
    }
    y += 6.5;
  };
  // Figures two per row: each with its source chip, picture, legend and caption.
  type Fig = { img: { url: string; ratio: number }; kind: keyof typeof KIND; label: string; legend?: [RGB, string][]; caption: string };
  const figureRows = (figs: Fig[]) => {
    const w = (CW - 6) / 2;
    for (let i = 0; i < figs.length; i += 2) {
      const row = figs.slice(i, i + 2);
      font(8);
      const textH = (f: Fig) => (doc.splitTextToSize(clean(f.caption), w).length as number) * 3.4 + (f.legend ? 11 : 0);
      const need = Math.max(...row.map((f) => 8 + w * f.img.ratio + 3 + textH(f))) + 4;
      ensure(need);
      const top = y;
      let bottom = y;
      row.forEach((f, k) => {
        const x = M + k * (w + 6);
        y = top;
        chip(f.kind, f.label, x, w, true);
        y += picture(f.img, w, x) + 2;
        if (f.legend) swatches(f.legend, x, w, true);
        para(f.caption, { size: 8, c: MUTED, x, w, gap: 0 });
        bottom = Math.max(bottom, y);
      });
      y = bottom + 6;
    }
  };

  // -- data --
  const layers = a.layers;
  const events = [...snap.events].sort((x, y2) => x.from.localeCompare(y2.from));
  const radarDates = [...new Set(layers.flatMap((l) => l.date_range ?? (l.date ? [l.date] : [])))].sort();
  const maturities = [...new Set(layers.map((l) => l.maturity))];
  const kindCounts = new Map<string, number>();
  for (const e of events) kindCounts.set(e.category, (kindCounts.get(e.category) ?? 0) + 1);
  const kinds = [...kindCounts].sort((p, q) => q[1] - p[1]);

  // ===== Cover =====
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, PAGE_W, 92, "F");
  doc.setFillColor(...ACCENT);
  doc.rect(0, 92, PAGE_W, 1.2, "F");
  font(10, "bold");
  doc.setTextColor(142, 177, 199);
  doc.text("G.I.G.A.S", M, 18);
  font(10);
  doc.text(clean(L.title.toUpperCase()), PAGE_W - M, 18, { align: "right" });
  font(26, "bold");
  doc.setTextColor(255, 255, 255);
  const titleLines = doc.splitTextToSize(clean(a.title), CW) as string[];
  doc.text(titleLines.slice(0, 2), M, 42);
  font(10.5);
  doc.setTextColor(214, 228, 236);
  doc.text(doc.splitTextToSize(clean(L.subtitle), CW) as string[], M, 42 + titleLines.slice(0, 2).length * 10 + 2);
  font(9);
  doc.setTextColor(142, 177, 199);
  doc.text(clean(fill(L.made, { v: meta.version, date: utc(meta.made) })), M, 86);
  if (a.types.length) doc.text(clean(a.types.map(env.typeName).join(" · ")), PAGE_W - M, 86, { align: "right", maxWidth: CW / 2 });
  y = 102;

  // At a glance: four tiles.
  const tiles: [string, string][] = [
    [L.passes, radarDates.length ? `${radarDates[0]} - ${radarDates.at(-1)}` : L.none],
    [L.changes, String(events.length)],
    [L.kinds, kinds.length ? kinds.slice(0, 2).map(([k]) => env.typeName(k)).join(", ") : L.none],
    [L.maturity, maturities.join(", ") || L.none],
  ];
  font(12, "bold");
  color(NAVY);
  doc.text(clean(L.glance), M, y);
  y += 4;
  const tileW = (CW - 9) / 4;
  tiles.forEach(([label, value], i) => {
    const x = M + i * (tileW + 3);
    doc.setFillColor(...SOFT);
    doc.roundedRect(x, y, tileW, 22, 2, 2, "F");
    font(7.5, "bold");
    color(MUTED);
    doc.text(clean(label.toUpperCase()), x + 3, y + 5.5, { maxWidth: tileW - 6 });
    font(value.length > 14 ? 9.5 : 14, "bold");
    color(INK);
    doc.text(doc.splitTextToSize(clean(value), tileW - 6).slice(0, 2) as string[], x + 3, y + (value.length > 14 ? 12.5 : 15));
  });
  y += 28;
  if (a.summary) {
    para(a.summary, { size: 10, gap: 0.5 });
    para(L.summaryFrom + cite(["sites"]), { size: 8, c: MUTED, gap: 3 });
  }
  if (!layers.length) para(L.noRadar, { size: 10, style: "bold", c: KIND.nisar });
  para(fill(L.asOf, { radar: utc(snap.asOf.radar), live: utc(snap.asOf.live), sat: snap.sat[1]?.date ?? "-" }), { size: 8.5, c: MUTED, gap: 3 });
  if (meta.replaces && meta.changes.length) {
    const lines = meta.changes.map((c) => `·  ${c}`);
    font(9);
    const h = 9 + lines.reduce((n, l) => n + (doc.splitTextToSize(clean(l), CW - 10).length as number) * 4, 0);
    doc.setFillColor(255, 244, 236);
    doc.setDrawColor(...ACCENT);
    doc.setLineWidth(0.4);
    doc.roundedRect(M, y, CW, h, 2, 2, "FD");
    const top = y;
    y += 2;
    para(fill(L.whatsNew, { n: meta.replaces }), { size: 9.5, style: "bold", x: M + 4, w: CW - 8, gap: 0.5 });
    for (const l of lines) para(l, { size: 9, x: M + 4, w: CW - 8, gap: 0 });
    y = top + h + 3;
  }
  const tocY = y + 4; // contents are written here once the page numbers are known

  // ===== 1. Where the data come from =====
  section(L.sSources, true);
  para(L.kindsIntro);
  for (const k of ["nisar", "satellite", "feed", "record"] as const) {
    ensure(12);
    const top = y;
    shape(k, M + 2, y + 2.3, 1.8);
    font(9.5, "bold");
    color(INK);
    doc.text(clean({ nisar: L.kNisar, satellite: L.kSatellite, feed: L.kFeed, record: L.kRecord }[k]), M + 6, y + 3.4);
    y += 4.5;
    const refs: Record<typeof k, RefId[]> = { nisar: ["nisarFacts", "cdmx"], satellite: ["gibs", "hls"], feed: ["usgs", "usgsVolcano", "eonet", "gdacs", "noaa"], record: [] };
    para({ nisar: L.dNisar, satellite: L.dSatellite, feed: L.dFeed, record: L.dRecord }[k] + cite(refs[k]), { size: 9, c: MUTED, x: M + 6, w: CW - 6, gap: 2 });
    y = Math.max(y, top + 10);
  }
  y += 2;
  const span = (ls: Layer[]) => {
    const d = [...new Set(ls.flatMap((l) => l.date_range ?? (l.date ? [l.date] : [])))].sort();
    return d.length ? (d.length === 1 ? d[0] : `${d[0]} - ${d.at(-1)} (${d.length})`) : "-";
  };
  const of = (pred: (l: Layer) => boolean) => layers.filter(pred);
  const rows: string[][] = [];
  const gcov = of((l) => l.product === "GCOV");
  const motion = of((l) => l.role === "motion");
  const soil = of((l) => l.role === "soil_moisture");
  const derived = of((l) => l.product === "derived" && l.role !== "motion" && l.role !== "soil_moisture");
  if (gcov.length) rows.push([L.kNisar, "NASA/JPL/ISRO · ASF DAAC" + cite(["asfProducts"]), L.gcovWhat, span(gcov), [...new Set(gcov.map((l) => l.maturity))].join(", ")]);
  if (motion.length) rows.push([L.kNisar, "NASA/JPL/ISRO · ASF DAAC" + cite(["asfProducts"]), L.gunwWhat, span(motion), motion[0].units]);
  if (soil.length) rows.push([L.kNisar, "NASA/JPL/ISRO · ASF DAAC" + cite(["asfProducts"]), L.sme2What, span(soil), soil[0].units]);
  if (derived.length) rows.push([L.kNisar, "G.I.G.A.S" + cite(["rules"]), L.derivedWhat, span(derived), [...new Set(derived.map((l) => l.group ?? ""))].join(", ")]);
  const [satBefore, satNow] = snap.sat;
  if (satBefore && satNow) rows.push([L.kSatellite, "NASA GIBS" + cite(["gibs", "hls"]), `${L.gibsWhat}: ${env.satName(satNow.layer)}`, `${satBefore.date}, ${satNow.date}`, ""]);
  rows.push([L.kFeed, "USGS · NASA EONET · GDACS · NOAA" + cite(["usgs", "eonet", "gdacs", "noaa"]), L.liveWhat, utc(snap.asOf.live), String(snap.live.length)]);
  rows.push([L.kRecord, L.sources, L.recordWhat, "-", fill(L.checked, { date: RECORDS_CHECKED })]);
  table([L.hKind, L.hSource, L.hWhat, L.hDates, L.hNotes], rows, { widths: [26, 38, 50, 34, 30] });

  // ===== 2. Pictures =====
  section(L.sPictures, true);
  const url = (l?: Layer) => (l ? new URL(l.url, env.base).href : "");
  const load = (l?: Layer) => (l ? loadImage(url(l)) : Promise.resolve(undefined));
  const isPicture = (l: Layer) => l.role === "backscatter" && l.colormap === "gray";
  const groups = [...new Set(layers.filter(isPicture).map((l) => l.group ?? l.polarization ?? ""))];
  const plants = a.types.some((x) => ["deforestation", "logging", "wildfires", "agriculture"].includes(x));
  const pairGroup = groups.includes("HV backscatter") && plants ? "HV backscatter" : groups.includes("HH backscatter") ? "HH backscatter" : groups[0];
  let drew = false;
  const sideBySide = async (left: HTMLImageElement | undefined, right: HTMLImageElement | undefined, labels: [string, string], kind: keyof typeof KIND) => {
    const l = flatten([left], 700), r = flatten([right], 700);
    if (!l || !r) return false;
    const w = (CW - 4) / 2;
    ensure(w * l.ratio + 22);
    chip(kind, `${labels[0]} · ${labels[1]}`);
    const top = y;
    picture(l, w);
    picture(r, w, M + w + 4);
    const tag = (text: string, x: number) => {
      font(8, "bold");
      const tw = doc.getTextWidth(clean(text)) + 4;
      doc.setFillColor(...NAVY);
      doc.rect(x + 1.5, top + 1.5, tw, 5, "F");
      doc.setTextColor(255, 255, 255);
      doc.text(clean(text), x + 3.5, top + 5);
    };
    tag(labels[0], M);
    tag(labels[1], M + w + 4);
    y = top + Math.max(w * l.ratio, w * r.ratio) + 2;
    return true;
  };
  if (pairGroup) {
    const dates = datesFor(layers.filter(isPicture), pairGroup);
    if (dates.length >= 2) {
      const [first, last] = [layerAt(layers, pairGroup, dates[0]), layerAt(layers, pairGroup, dates.at(-1)!)];
      if (await sideBySide(await load(first), await load(last), [`${L.before} ${dates[0]}`, `${L.after} ${dates.at(-1)}`], "nisar")) {
        caption(fill(L.picPair, { group: pairGroup, before: dates[0], after: dates.at(-1)! }) + cite(["sarImage"]));
        drew = true;
      }
    }
  }
  const hhDates = datesFor(layers.filter(isPicture), "HH backscatter");
  const baseFor = (date: string) => layerAt(layers, "HH backscatter", [...hhDates].reverse().find((d) => d <= date) ?? hhDates.at(-1) ?? "");
  const maps: Fig[] = [];
  const overlay = async (layer: Layer | undefined, captionText: (base: string) => string, legend?: [RGB, string][]) => {
    if (!layer) return;
    const end = layer.date_range?.[1] ?? layer.date ?? "";
    const base = baseFor(end);
    const img = flatten([await load(base), await load(layer)], 800);
    if (!img) return;
    maps.push({ img, kind: "nisar", label: `${layer.group ?? ""} · ${(layer.date_range ?? [layer.date]).filter(Boolean).join(" - ")}`, legend, caption: captionText(base?.date ?? end) });
  };
  const classLegend = (group: string): [RGB, string][] => (CLASSES[group] ?? []).map(([c, key]) => [parseRgb(c), t(key)]);
  const changeLayers = layers.filter((l) => l.group === "Detected change").sort((p, q) => (p.date_range?.[1] ?? "").localeCompare(q.date_range?.[1] ?? ""));
  const lastChange = changeLayers.at(-1);
  await overlay(lastChange, (base) => fill(L.picChange, { from: lastChange?.date_range?.[0] ?? "", to: lastChange?.date_range?.[1] ?? "", base }), classLegend("Detected change"));
  const surface = layers.find((l) => l.group === "Surface type");
  await overlay(surface, () => fill(L.picSurface, { from: surface?.date_range?.[0] ?? "", to: surface?.date_range?.[1] ?? "" }), classLegend("Surface type"));
  const ground = layers.find((l) => l.role === "motion");
  await overlay(ground, (base) => fill(L.picMotion, { from: ground?.date_range?.[0] ?? "", to: ground?.date_range?.[1] ?? "", base }), ground?.value_range ? [[[40, 110, 220], `${ground.value_range[0]} ${ground.units}`], [[215, 48, 39], `+${ground.value_range[1]} ${ground.units}`]] : undefined);
  if (maps.length) {
    figureRows(maps);
    drew = true;
  }
  if (satBefore && satNow) {
    if (await sideBySide(await loadImage(satBefore.url), await loadImage(satNow.url), [`${L.before} ${satBefore.date}`, `${L.now} ${satNow.date}`], "satellite")) {
      caption(fill(L.picSat, { name: `NASA GIBS · ${env.satName(satNow.layer)}`, before: satBefore.date, now: satNow.date }));
      drew = true;
    }
  }
  if (!drew) para(L.picNone, { c: MUTED });

  // ===== 3. Detected changes =====
  section(L.sChanges, true);
  chip("nisar", maturities.join(", "));
  if (!events.length) para(L.noChanges, { c: MUTED });
  else {
    para(fill(L.changesIntro, { n: events.length, from: events[0].from, to: events.reduce((m, e) => (e.to > m ? e.to : m), "") }) + " " + L.rulesText + cite(["rules"]));
    // Bars: changes by kind.
    heading(L.byKind);
    const most = kinds[0][1];
    for (const [k, n] of kinds) {
      ensure(7);
      font(9);
      color(INK);
      doc.text(clean(env.typeName(k)), M, y + 3.6, { maxWidth: 52 });
      const w = ((CW - 72) * n) / most;
      doc.setFillColor(...KIND.nisar);
      doc.roundedRect(M + 56, y, Math.max(w, 0.8), 4.6, 0.8, 0.8, "F");
      font(9, "bold");
      doc.text(String(n), M + 58 + w, y + 3.6);
      y += 6.5;
    }
    y += 3;
    // By month seen.
    const months = new Map<string, number>();
    for (const e of events) months.set(e.to.slice(0, 7), (months.get(e.to.slice(0, 7)) ?? 0) + 1);
    if (months.size > 1) {
      heading(L.byMonth);
      const ms = [...months].sort();
      const top = Math.max(...ms.map((p) => p[1]));
      const bw = Math.min(16, (CW - 10) / ms.length - 2), chartH = 30;
      ensure(chartH + 12);
      ms.forEach(([m, n], i) => {
        const x = M + i * (bw + 2), h = (chartH * n) / top;
        doc.setFillColor(...KIND.nisar);
        doc.rect(x, y + chartH - h, bw, h, "F");
        font(7.5, "bold");
        color(INK);
        doc.text(String(n), x + bw / 2, y + chartH - h - 1, { align: "center" });
        font(7);
        color(MUTED);
        doc.text(m, x + bw / 2, y + chartH + 4, { align: "center" });
      });
      y += chartH + 9;
    }
    // The most important, in full.
    const best = [...events].sort((p, q) => importance({ date: q.to, confidence: q.confidence, km2: q.area_km2 }) - importance({ date: p.to, confidence: p.confidence, km2: p.area_km2 })).slice(0, 5);
    heading(fill(L.top, { n: best.length }));
    best.forEach((e, i) => {
      ensure(18);
      font(10, "bold");
      color(INK);
      doc.text(clean(`${i + 1}. ${e.title}`), M, y + 3.5);
      font(8.5);
      color(MUTED);
      doc.text(clean(`${e.from} - ${e.to} · ${env.typeName(e.category)} · ${e.area_km2.toFixed(2)} km² · ${Math.round(e.confidence * 100)}%`), M, y + 8);
      y += 10;
      para(e.summary, { size: 9, gap: 3 });
    });
    ensure(45); // the full table never starts with its heading alone at the foot of a page
    heading(`${L.all} (${events.length})`);
    table(
      ["#", L.hDate, L.hType, L.hSaw, L.hArea, L.hConf],
      events.map((e, i) => [i + 1, `${e.from}\n${e.to}`, env.typeName(e.category), e.title, e.area_km2.toFixed(2), `${Math.round(e.confidence * 100)}%`]),
      { widths: [10, 24, 38, 66, 20, 20], size: 8 },
    );
  }

  // ===== 4. Change over time =====
  const series = snap.series;
  section(L.sTrends, true);
  if (!series.length) para(L.noTrends, { c: MUTED });
  else {
    chip("nisar", maturities.join(", "));
    para(L.trendsIntro, { c: MUTED, size: 9 });
    for (const [units, lines] of series) drawChart(lines.slice(0, 3), units);
  }

  function drawChart(lines: Series[], units: string) {
    const h = 58, left = M + 12, w = CW - 14;
    ensure(h + 22);
    heading(units, 10);
    const pts = lines.flatMap((s) => s.points);
    const xs = pts.map((p) => Date.parse(p.date)), vs = pts.map((p) => p.value);
    const [x0, x1] = [Math.min(...xs), Math.max(...xs)];
    const yt = ticks(Math.min(...vs), Math.max(...vs), 4);
    const [v0, v1] = [yt[0], yt.at(-1)!];
    const px = (d: number) => left + (x1 > x0 ? ((d - x0) / (x1 - x0)) * w : w / 2);
    const py = (v: number) => y + h - (v1 > v0 ? ((v - v0) / (v1 - v0)) * h : h / 2);
    doc.setLineWidth(0.15);
    doc.setDrawColor(...LINE);
    font(7);
    color(MUTED);
    for (const v of yt) {
      doc.line(left, py(v), left + w, py(v));
      doc.text(String(+v.toFixed(3)), left - 1.5, py(v) + 1, { align: "right" });
    }
    const dates = [...new Set(pts.map((p) => p.date))].sort();
    const every = Math.max(1, Math.ceil(dates.length / 6));
    dates.forEach((d, i) => i % every === 0 && doc.text(d, px(Date.parse(d)), y + h + 4, { align: "center" }));
    lines.forEach((s, i) => {
      const c = LINES[i % LINES.length];
      doc.setDrawColor(...c);
      doc.setFillColor(...c);
      doc.setLineWidth(0.6);
      const p = [...s.points].sort((q, r) => q.date.localeCompare(r.date));
      for (let k = 1; k < p.length; k++) doc.line(px(Date.parse(p[k - 1].date)), py(p[k - 1].value), px(Date.parse(p[k].date)), py(p[k].value));
      for (const q of p) doc.circle(px(Date.parse(q.date)), py(q.value), 0.7, "F");
    });
    y += h + 7;
    swatches(lines.map((s, i) => [LINES[i % LINES.length], s.label]));
  }

  // ===== What the radar found, in plain words (C8: made by the back end for every area) =====
  const f = snap.friendly;
  if (f) {
    section(L.sFriendly);
    chip("nisar");
    const status = L.fStatus.split("|")[["calm", "watch", "alert"].indexOf(f.status)];
    para(`${status}. ${f.headline}`, { style: "bold", gap: 3 });
    if (f.cards.length) {
      const levels = L.fLevels.split("|");
      table(
        [L.fKind, L.fLevel, L.fWhat, L.fSize],
        f.cards.map((c) => {
          const size = c.number ? `${c.number.value} ${c.number.unit}` : "";
          const span = c.from && c.to ? `${c.from} - ${c.to}` : "";
          return [env.typeName(c.category) || c.label, levels[Math.max(0, Math.min(3, c.level))], c.headline, [size, span].filter(Boolean).join(" · ")];
        }),
        { widths: [30, 32, 80, 36], size: 8 },
      );
    }
    for (const n of [...f.data_notes, L.fNote]) para(n, { size: 8.5, c: MUTED, gap: 1 });
  }

  // ===== Background notes, only for a place the team wrote them for =====
  const note = zoneNote(a.id);
  if (note) {
    section(L.sZone);
    chip("record", fill(L.checked, { date: RECORDS_CHECKED }));
    para(tx(note.changes, lang), { gap: 4 });
    heading(L.nature);
    para(tx(note.nature, lang), { gap: 4 });
    sourceList(note.sources);
  }

  function sourceList(sources: Source[]) {
    heading(L.sources, 10);
    for (const s of sources) {
      ensure(5);
      font(8.5);
      color(KIND.nisar);
      const label = clean(s.name);
      if (s.url) doc.textWithLink(label, M + 3, y + 3.2, { url: s.url });
      else doc.text(label, M + 3, y + 3.2);
      if (s.url) {
        font(7.5);
        color(MUTED);
        doc.text(doc.splitTextToSize(clean(s.url), CW - 6)[0] as string, M + 3, y + 7);
        y += 4;
      }
      y += 5.5;
    }
  }

  // ===== 6. Remarkable events =====
  section(L.sHistory, true);
  const history = zoneHistory(HISTORY, a.bbox);
  if (!history.length) para(L.noHistory, { c: MUTED });
  else {
    chip("record", fill(L.checked, { date: RECORDS_CHECKED }));
    table(
      [L.hYear, L.hEvent, L.hImpact, L.sources],
      history.map((e) => [e.date, `${tx(e.title, lang)}\n${env.typeName(e.type)}`, tx(e.impact, lang), e.sources.map((s) => s.name).join("; ")]),
      { widths: [20, 42, 76, 40], size: 8 },
    );
  }

  // ===== 7. Live reports nearby =====
  section(L.sLive);
  chip("feed", "USGS · NASA EONET · GDACS · NOAA");
  if (!snap.live.length) para(L.noLive, { c: MUTED });
  else {
    para(fill(L.liveIntro, { date: `${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC` }), { size: 9, c: MUTED });
    // Satellite fire hot spots come by the dozen: one line for all of them, the rest as a table.
    const fires = snap.live.filter((p) => p.source === "firms");
    const others = snap.live.filter((p) => p.source !== "firms").sort((p, q) => q.date.localeCompare(p.date));
    if (fires.length) {
      const latest = fires.map((p) => p.date).sort().at(-1)!.replace("T", " ").replace("Z", "");
      para(fill(L.fires, { n: fires.length, date: latest }) + cite(["firms"]), { size: 9.5, style: "bold", gap: 4 });
    }
    if (others.length) {
      table(
        [L.hWhen, L.hType, L.hEvent, L.hWhere, L.hSource],
        others.map((p) => [p.date.replace("T", " ").replace("Z", ""), env.typeName(p.category), p.title, liveWhere(p), SOURCE_SHORT[p.source] ?? p.source_name]),
        { widths: [28, 30, 56, 40, 24], size: 8, accent: [120, 80, 0] },
      );
    }
  }

  // ===== 8. How the radar sees =====
  section(L.sWhy);
  para(L.whyIntro + cite(["sar"]), { gap: 4 });
  for (const id of topicsFor(a.types)) {
    const topic = TOPICS.find((x) => x.id === id)!;
    heading(tx(topic.title, lang), 10.5);
    para(tx(topic.text, lang) + cite(topic.refs), { size: 9.5, gap: 1 });
    para(tx(topic.looks, lang), { size: 9, style: "italic", c: MUTED, gap: 4 });
  }

  // ===== 9. Methods and decisions =====
  section(L.sMethods);
  para(L.methodsIntro, { c: MUTED, size: 9 });
  table(
    [L.hDate, L.hDecision, L.hChose, L.hWhy, L.hGiveUp, "[ ]"],
    [...DECISIONS].sort((p, q) => q.date.localeCompare(p.date)).map((d) => [d.date, tx(d.title, lang), tx(d.chose, lang), tx(d.why, lang), tx(d.tradeoff, lang), cite(d.refs).trim()]),
    { widths: [17, 32, 42, 41, 32, 14], size: 7.4, bold: 1 },
  );

  // ===== 10. Radar pictures =====
  if (layers.length) {
    section(L.sInventory, true);
    chip("nisar", maturities.join(", "));
    para(L.inventoryIntro, { c: MUTED, size: 9 });
    const sorted = [...layers].sort((p, q) => (p.date ?? p.date_range?.[1] ?? "").localeCompare(q.date ?? q.date_range?.[1] ?? ""));
    table(
      [L.hDates, L.hPicture, L.hProduct, L.hMaturity, L.hUnits, L.hRange],
      sorted.map((l) => [(l.date_range ?? [l.date ?? ""]).join(" - "), l.group ?? l.polarization ?? "", l.product, l.maturity, l.units, l.value_range ? l.value_range.join(" … ") : "-"]),
      { widths: [36, 38, 22, 28, 30, 24], size: 7.8 },
    );
  }

  // ===== 11. Glossary =====
  section(L.sGlossary);
  table([L.hWord, L.hMeaning, "[ ]"], GLOSSARY.map((g) => [g.term, lang === "es" ? g.es : g.en, cite(g.refs).trim()]), { widths: [32, CW - 50, 18], size: 9, bold: 0 });

  // ===== 12. References and data citations =====
  section(L.sRefs, true);
  para(fill(L.refsIntro, { date: SOURCES_CHECKED }), { size: 9, c: MUTED, gap: 4 });
  cited.forEach((id, i) => {
    const r = REFS[id];
    ensure(11);
    font(9, "bold");
    color(INK);
    doc.text(`[${i + 1}]`, M, y + 3.4);
    para(`${r.who}. ${r.title}.`, { size: 9, x: M + 10, w: CW - 10, gap: 0 });
    font(8);
    color(KIND.nisar);
    doc.textWithLink(doc.splitTextToSize(clean(r.url), CW - 10)[0] as string, M + 10, y + 3, { url: r.url });
    y += 6;
  });
  heading(L.dataCredits);
  for (const c of a.credits) para(c, { size: 9, gap: 3 });
  for (const c of [...new Set(snap.live.map((p) => p.credit))]) para(c, { size: 9, gap: 3 });
  if (snap.sat[1]) para(`NASA Global Imagery Browse Services (GIBS), ${snap.sat[1].layer}. ${REFS.gibs.url}`, { size: 9, gap: 3 });
  y += 4;
  ensure(20);
  doc.setFillColor(...SOFT);
  const disclaimer = doc.splitTextToSize(clean(L.disclaimer), CW - 8) as string[];
  doc.roundedRect(M, y, CW, disclaimer.length * 4.6 + 6, 2, 2, "F");
  font(9.5, "bold");
  color(INK);
  doc.text(disclaimer, M + 4, y + 6.5);

  // ===== Contents on the cover, then headers and footers =====
  doc.setPage(1);
  y = tocY;
  font(12, "bold");
  color(NAVY);
  doc.text(clean(L.contents), M, y);
  y += 3;
  const step = meta.replaces ? 5.4 : 6.4; // a "what is new" box takes room on the cover
  toc.forEach((entry, i) => {
    y += step;
    font(10);
    color(INK);
    const label = clean(`${i + 1}.  ${entry.title}`);
    doc.textWithLink(label, M, y, { pageNumber: entry.page });
    const page = String(entry.page);
    const end = M + CW - doc.getTextWidth(page) - 2;
    doc.setDrawColor(...LINE);
    doc.setLineDashPattern([0.4, 1.2], 0);
    doc.line(M + doc.getTextWidth(label) + 2, y - 0.6, end, y - 0.6);
    doc.setLineDashPattern([], 0);
    doc.text(page, M + CW, y, { align: "right" });
  });
  const total = doc.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    doc.setDrawColor(...LINE);
    doc.setLineWidth(0.2);
    doc.line(M, PAGE_H - 13, PAGE_W - M, PAGE_H - 13);
    font(7.5);
    color(MUTED);
    doc.text(clean(`G.I.G.A.S · ${a.title} · v${meta.version} · ${today}`), M, PAGE_H - 8.5, { maxWidth: CW - 30 });
    doc.text(clean(fill(L.page, { n: p, total })), PAGE_W - M, PAGE_H - 8.5, { align: "right" });
    if (p > 1) {
      doc.text(clean(`${L.title} · ${a.title}`), M, 12);
      doc.line(M, 14.5, PAGE_W - M, 14.5);
    }
  }
  return doc.output("blob");
}
