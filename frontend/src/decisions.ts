// Decision log: why the project uses these data and methods, and what it gave up (jopa-testing).
//
// Dates are when the choice shows up in the repository (git log, docs/03, docs/10). Numbers are
// the back end's own (backend/src/sars_pipeline/classify.py, site.py) so the log matches the app.
// Facts about the world cite outside sources (sources.ts); the project's own choices cite its files.
// Text is { en, es }; German falls back to English, as in mexico.ts.
import type { Text } from "./mexico";
import type { RefId } from "./sources";

export type Decision = {
  id: string;
  date: string;
  kind: "data" | "method" | "design";
  title: Text;
  chose: Text;
  why: Text;
  instead: Text;
  tradeoff: Text;
  refs: RefId[]; // where each statement comes from (sources.ts)
};

export const DECISIONS: Decision[] = [
  {
    id: "gcov",
    date: "2026-11-13",
    kind: "data",
    title: { en: "NISAR GCOV as the main radar product", es: "NISAR GCOV como producto de radar principal" },
    chose: {
      en: "Geocoded, calibrated L-band backscatter (GCOV), two channels: HH and HV.",
      es: "Retrodispersión en banda L, calibrada y georreferenciada (GCOV), con dos canales: HH y HV.",
    },
    why: {
      en: "GCOV is radiometrically terrain-corrected backscatter made for uses such as disturbance detection, inundation mapping and crop mapping. NISAR's L-band (24 cm) goes deeper into tree canopy than shorter waves, and works day and night, through clouds.",
      es: "GCOV es retrodispersión con corrección radiométrica del terreno, hecha para usos como detección de disturbios, mapeo de inundaciones y de cultivos. La banda L de NISAR (24 cm) entra más en el dosel que las ondas cortas y funciona de día y de noche, a través de las nubes.",
    },
    instead: {
      en: "Raw radar files (RSLC), which need heavy processing; or a shorter C-band radar, which penetrates only the top layers of a forest canopy.",
      es: "Archivos de radar crudos (RSLC), que requieren mucho procesamiento; o un radar de banda C más corta, que solo penetra las capas superiores del dosel.",
    },
    tradeoff: {
      en: "Objects smaller than a pixel (about 40 m after averaging) are not seen.",
      es: "No se ven objetos más pequeños que un píxel (unos 40 m después de promediar).",
    },
    refs: ["asfProducts", "nisarFacts", "sar", "cdmx", "rules"],
  },
  {
    id: "maturity",
    date: "2026-11-13",
    kind: "method",
    title: { en: "Never mix data maturities in one comparison", es: "Nunca mezclar madurez de datos en una comparación" },
    chose: {
      en: "Each comparison uses one maturity only (BETA, PROVISIONAL or VALIDATED), and every layer says which.",
      es: "Cada comparación usa una sola madurez (BETA, PROVISIONAL o VALIDATED) y cada capa dice cuál.",
    },
    why: {
      en: "BETA products are not fully calibrated and PROVISIONAL ones are. Mixing them could create a change that is only in the processing, not on the ground.",
      es: "Los productos BETA no están totalmente calibrados y los PROVISIONAL sí. Mezclarlos podría crear un cambio que solo está en el procesamiento, no en el terreno.",
    },
    instead: { en: "Using every date available, whatever its maturity.", es: "Usar todas las fechas disponibles, sin importar su madurez." },
    tradeoff: { en: "Fewer dates to compare in some places.", es: "Menos fechas para comparar en algunos lugares." },
    refs: ["asfProducts", "docs"],
  },
  {
    id: "mexico",
    date: "2026-11-13",
    kind: "data",
    title: { en: "Mexico as the study region", es: "México como región de estudio" },
    chose: {
      en: "Case studies with well documented changes: Mexico City (sinking), Villahermosa (floods), Yucatán (forest loss), Chapala (fires), plus a whole-country soil moisture view.",
      es: "Casos con cambios bien documentados: Ciudad de México (hundimiento), Villahermosa (inundaciones), Yucatán (pérdida de bosque), Chapala (incendios), y una vista de humedad de todo el país.",
    },
    why: {
      en: "Known events let us check the radar's answers against published studies, and the team knows these places.",
      es: "Los eventos conocidos permiten comprobar las respuestas del radar contra estudios publicados, y el equipo conoce estos lugares.",
    },
    instead: { en: "Random places around the world.", es: "Lugares al azar en el mundo." },
    tradeoff: { en: "Other regions get live reports, but no radar analysis yet.", es: "Otras regiones tienen reportes en vivo, pero aún no análisis de radar." },
    refs: ["docs", "cdmx"],
  },
  {
    id: "db-difference",
    date: "2026-11-14",
    kind: "method",
    title: { en: "Compare in decibels, after removing the scene-wide change", es: "Comparar en decibeles, quitando el cambio de toda la escena" },
    chose: {
      en: "Average 4 × 4 pixels in linear power, convert to dB, subtract the two dates, and remove the change shared by the whole scene.",
      es: "Promediar 4 × 4 píxeles en potencia lineal, pasar a dB, restar las dos fechas y quitar el cambio que comparte toda la escena.",
    },
    why: {
      en: "Averaging neighboring pixels (multi-looking) removes radar speckle. A change over the whole scene, such as rain everywhere, is not a local event.",
      es: "Promediar píxeles vecinos (multilook) quita el moteado del radar. Un cambio en toda la escena, como lluvia general, no es un evento local.",
    },
    instead: { en: "Subtracting raw pixel values.", es: "Restar los valores crudos de los píxeles." },
    tradeoff: { en: "Detail below about 40 m is averaged away.", es: "Se pierde el detalle menor a unos 40 m." },
    refs: ["sar", "rules"],
  },
  {
    id: "rules",
    date: "2026-11-14",
    kind: "method",
    title: { en: "Written rules instead of machine learning", es: "Reglas escritas en lugar de aprendizaje automático" },
    chose: {
      en: "A decision table: flood if HH and HV both drop 3 dB and HH ends below −18 dB; forest loss if HV drops 3 dB and 1.5 dB more than HH; new buildings if HH rises 4 dB. Patches under 25 pixels (0.04 km²) are dropped and a change must still show half its size on the next pass.",
      es: "Una tabla de decisiones: inundación si HH y HV bajan 3 dB y HH queda bajo −18 dB; pérdida de bosque si HV baja 3 dB y 1.5 dB más que HH; construcción si HH sube 4 dB. Se descartan manchas menores a 25 píxeles (0.04 km²) y el cambio debe seguir con la mitad de su tamaño en la siguiente pasada.",
    },
    why: {
      en: "Every result can be explained in one sentence and checked by hand against the numbers behind it.",
      es: "Cada resultado se puede explicar en una frase y revisar a mano contra los números que lo respaldan.",
    },
    instead: { en: "A trained classifier.", es: "Un clasificador entrenado." },
    tradeoff: {
      en: "Subtle changes are missed, so results are labeled hypotheses with a confidence.",
      es: "Se pierden cambios sutiles, por eso los resultados se presentan como hipótesis con un nivel de confianza.",
    },
    refs: ["rules"],
  },
  {
    id: "gunw-sme2",
    date: "2026-11-14",
    kind: "data",
    title: { en: "GUNW for ground motion, SME2 for soil moisture", es: "GUNW para movimiento del suelo, SME2 para humedad" },
    chose: {
      en: "Interferograms (GUNW) flag ground sinking 5 cm a year or more; soil moisture (SME2) flags drying of 0.05 m³/m³ or more over at least 4 dates.",
      es: "Los interferogramas (GUNW) marcan hundimientos de 5 cm al año o más; la humedad del suelo (SME2) marca secado de 0.05 m³/m³ o más en al menos 4 fechas.",
    },
    why: {
      en: "These NISAR products are made for exactly that: GUNW for measuring ground displacement, SME2 for soil moisture.",
      es: "Estos productos de NISAR están hechos justo para eso: GUNW para medir desplazamientos del suelo, SME2 para la humedad del suelo.",
    },
    instead: { en: "Guessing drought or sinking from backscatter alone.", es: "Adivinar sequía o hundimiento solo con la retrodispersión." },
    tradeoff: {
      en: "Motion is along the radar's line of sight, not straight down, and soil moisture is coarse (about 2 km nationally).",
      es: "El movimiento es en la línea de vista del radar, no vertical, y la humedad es gruesa (unos 2 km a escala nacional).",
    },
    refs: ["asfProducts", "rules", "docs"],
  },
  {
    id: "firms",
    date: "2026-11-14",
    kind: "data",
    title: { en: "Fire detections as context", es: "Detecciones de fuego como contexto" },
    chose: {
      en: "NASA FIRMS fire points (VIIRS) decide whether lost forest burned or was cleared.",
      es: "Los puntos de fuego de NASA FIRMS (VIIRS) deciden si un bosque perdido se quemó o se taló.",
    },
    why: {
      en: "Radar sees that the trees are gone, not why. A fire at the same place and time is strong evidence.",
      es: "El radar ve que los árboles ya no están, no por qué. Un incendio en el mismo lugar y momento es una prueba fuerte.",
    },
    instead: { en: "Calling every forest loss deforestation.", es: "Llamar deforestación a toda pérdida de bosque." },
    tradeoff: { en: "A clearing with no fire detection is called forest loss, never fire.", es: "Un desmonte sin detección de fuego se llama pérdida de bosque, nunca incendio." },
    refs: ["firms", "rules"],
  },
  {
    id: "gibs",
    date: "2026-11-14",
    kind: "data",
    title: { en: "Satellite photos only as context", es: "Fotos de satélite solo como contexto" },
    chose: {
      en: "NASA GIBS pictures (HLS 30 m, VIIRS daily, MODIS) next to the radar, always labeled \"other satellite\" with their date. They never feed the detection.",
      es: "Imágenes de NASA GIBS (HLS 30 m, VIIRS diario, MODIS) junto al radar, siempre marcadas como \"otro satélite\" con su fecha. Nunca alimentan la detección.",
    },
    why: {
      en: "People understand photos at once. GIBS gives full-resolution satellite imagery, most of it updated daily, and this page can load it directly. HLS harmonizes Landsat 8/9 and Sentinel-2 at 30 m. SPHEREx makes an all-sky survey, not pictures of the Earth, so it cannot be used.",
      es: "Las fotos se entienden de inmediato. GIBS ofrece imágenes de satélite a resolución completa, casi todas actualizadas a diario, y esta página puede cargarlas directamente. HLS armoniza Landsat 8/9 y Sentinel-2 a 30 m. SPHEREx hace un mapeo de todo el cielo, no imágenes de la Tierra, así que no sirve aquí.",
    },
    instead: { en: "Radar only.", es: "Solo radar." },
    tradeoff: {
      en: "Clouds hide many days, so the picture is the nearest clear day, which can differ from the radar dates.",
      es: "Las nubes tapan muchos días, así que la imagen es el día despejado más cercano, que puede no coincidir con las fechas del radar.",
    },
    refs: ["gibs", "hls", "spherex", "app"],
  },
  {
    id: "live",
    date: "2026-11-14",
    kind: "data",
    title: { en: "Live reports from official alert services", es: "Reportes en vivo de servicios oficiales de alerta" },
    chose: {
      en: "USGS (earthquakes, volcanoes), NASA EONET, GDACS and NOAA (weather alerts), worldwide, last 24 hours, checked every 15 minutes.",
      es: "USGS (sismos, volcanes), NASA EONET, GDACS y NOAA (alertas del clima), en todo el mundo, últimas 24 horas, revisados cada 15 minutos.",
    },
    why: {
      en: "They are public services run by official agencies. NISAR repeats its orbit every 12 days, so it cannot say what is happening today.",
      es: "Son servicios públicos de agencias oficiales. NISAR repite su órbita cada 12 días, así que no puede decir qué pasa hoy.",
    },
    instead: { en: "News sites or social media.", es: "Sitios de noticias o redes sociales." },
    tradeoff: {
      en: "GDACS states no data license; it is shown with credit, a link and its disclaimer.",
      es: "GDACS no declara licencia de datos; se muestra con crédito, enlace y su aviso.",
    },
    refs: ["usgs", "usgsVolcano", "eonet", "gdacs", "noaa", "nisarFacts", "docs", "app"],
  },
  {
    id: "records",
    date: "2026-11-14",
    kind: "data",
    title: { en: "Only claims we could check", es: "Solo afirmaciones que pudimos comprobar" },
    chose: {
      en: "Past disasters and zone notes come from agencies and peer-reviewed studies, each linked. Claims we could not confirm were removed.",
      es: "Los desastres pasados y las notas de zona vienen de agencias y estudios revisados por pares, cada uno con enlace. Se quitaron las afirmaciones que no pudimos confirmar.",
    },
    why: {
      en: "A wrong number on a disaster map damages trust in everything else on it.",
      es: "Un número equivocado en un mapa de desastres daña la confianza en todo lo demás.",
    },
    instead: { en: "Popular figures repeated without a source.", es: "Cifras populares repetidas sin fuente." },
    tradeoff: { en: "Some well-known stories are shorter or missing.", es: "Algunas historias conocidas quedan más cortas o fuera." },
    refs: ["app"],
  },
  {
    id: "no-risk-score",
    date: "2026-11-14",
    kind: "design",
    title: { en: "No danger score, no \"infrastructure near me\"", es: "Sin puntaje de peligro ni \"infraestructura cerca de mí\"" },
    chose: {
      en: "The \"how dangerous\" slider and the nearby-infrastructure check were removed.",
      es: "Se quitaron el control de \"qué tan peligroso\" y la revisión de infraestructura cercana.",
    },
    why: {
      en: "We cannot check risk thresholds responsibly; a wrong \"safe\" could mislead someone in danger.",
      es: "No podemos verificar umbrales de riesgo de forma responsable; un \"seguro\" equivocado podría engañar a alguien en peligro.",
    },
    instead: { en: "Our own risk scale.", es: "Una escala de riesgo propia." },
    tradeoff: { en: "Users read the official alert levels instead.", es: "Los usuarios leen los niveles de alerta oficiales." },
    refs: ["app"],
  },
  {
    id: "compare-pct",
    date: "2026-11-14",
    kind: "method",
    title: { en: "How the comparator measures change", es: "Cómo mide el cambio el comparador" },
    chose: {
      en: "Change = |after − before| ÷ the brighter of the two, after a 3 × 3 average. Radar starts at 50% (3 dB, the rules' own step); photos at 30%.",
      es: "Cambio = |después − antes| ÷ el más brillante de los dos, tras un promedio de 3 × 3. El radar empieza en 50% (3 dB, el paso de las reglas); las fotos en 30%.",
    },
    why: {
      en: "It reads the same both ways (half and double are both 50%), stays between 0 and 100%, and for radar maps straight onto dB.",
      es: "Se lee igual en ambos sentidos (la mitad y el doble son 50%), queda entre 0 y 100% y en el radar equivale directamente a dB.",
    },
    instead: { en: "A plain difference of pixel values.", es: "Una resta simple de valores de píxel." },
    tradeoff: {
      en: "On photos it is a visual guide: clouds, shadows and seasons change colors too.",
      es: "En fotos es una guía visual: nubes, sombras y estaciones también cambian los colores.",
    },
    refs: ["app", "rules"],
  },
  {
    id: "colors",
    date: "2026-11-14",
    kind: "design",
    title: { en: "Colorblind-safe colors, always with words", es: "Colores seguros para daltonismo, siempre con palabras" },
    chose: {
      en: "The Okabe-Ito palette, and every color also named in text or shown with a shape.",
      es: "La paleta Okabe-Ito, y cada color también nombrado en texto o con una forma.",
    },
    why: { en: "About 1 in 12 men have color vision deficiency.", es: "Cerca de 1 de cada 12 hombres tiene deficiencia en la visión del color." },
    instead: { en: "Red and green for bad and good.", es: "Rojo y verde para malo y bueno." },
    tradeoff: { en: "Fewer distinct colors to use.", es: "Menos colores distintos disponibles." },
    refs: ["nei", "okabe"],
  },
];
