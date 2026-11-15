// "Why the radar sees changes", explained simply, each idea with a small drawing (jopa-testing).
//
// Every sentence says only what its sources say (`refs`, see sources.ts): NASA Earthdata's SAR
// pages, NISAR's quick facts and NASA/JPL's Mexico City report. Numbers that are the app's own
// rules (3 dB, 4 dB, 5 cm a year, 0.04 km²) are called rules and cite the back-end code.
// Drawings are in explain-view.ts. Text is { en, es }; German falls back to English, as in mexico.ts.
import type { Text } from "./mexico";
import type { RefId } from "./sources";

export type Topic = { id: string; title: Text; text: Text; looks: Text; refs: RefId[] };

export const TOPICS: Topic[] = [
  {
    id: "basics",
    title: { en: "An echo, not a photo", es: "Un eco, no una foto" },
    text: {
      en: "NISAR sends out pulses of microwaves 24 cm long (L-band) and records how much energy comes back after it hits the ground. It works by day and by night, and through clouds. It looks at the world's land and ice every 12 days. Rough surfaces send more energy back and look brighter.",
      es: "NISAR envía pulsos de microondas de 24 cm (banda L) y registra cuánta energía regresa después de chocar con el suelo. Funciona de día y de noche, y a través de las nubes. Observa la tierra y el hielo del mundo cada 12 días. Las superficies rugosas regresan más energía y se ven más claras.",
    },
    looks: { en: "Bright = strong echo. Dark = weak echo.", es: "Claro = eco fuerte. Oscuro = eco débil." },
    refs: ["nisarFacts", "sar", "sarImage", "cdmx"],
  },
  {
    id: "water",
    title: { en: "Calm water looks black", es: "El agua tranquila se ve negra" },
    text: {
      en: "Calm water and other smooth surfaces reflect the radar away from the satellite, so they look black. The app's flood rule: both channels (HH and HV) lose half their echo or more (3 dB) and HH ends very dark.",
      es: "El agua tranquila y otras superficies lisas reflejan el radar lejos del satélite, por eso se ven negras. La regla de inundación de la app: los dos canales (HH y HV) pierden la mitad del eco o más (3 dB) y HH queda muy oscuro.",
    },
    looks: { en: "Flood: darker after.", es: "Inundación: más oscuro después." },
    refs: ["sarImage", "rules"],
  },
  {
    id: "structure",
    title: { en: "Corners shine", es: "Las esquinas brillan" },
    text: {
      en: "Buildings, bridges and other human-made objects act as corner reflectors and show up as bright spots. This \"double bounce\" also happens with tree trunks and flooded vegetation, and shows most in the HH channel. The app's rule for new buildings: HH rises 4 dB or more.",
      es: "Edificios, puentes y otras construcciones funcionan como reflectores de esquina y aparecen como puntos brillantes. Este \"doble rebote\" también ocurre con troncos y vegetación inundada, y se nota más en el canal HH. La regla de la app para construcciones nuevas: HH sube 4 dB o más.",
    },
    looks: { en: "New buildings or flooded trees: brighter after.", es: "Construcciones nuevas o árboles inundados: más claro después." },
    refs: ["sarImage", "sar", "rules"],
  },
  {
    id: "plants",
    title: { en: "Leaves scatter the wave", es: "Las hojas dispersan la onda" },
    text: {
      en: "Leaves and branches scatter the wave in many directions (volume scattering), which shows most in the cross-polarized channel, HV. L-band's long wave goes deeper into the canopy and also meets large branches and trunks. The app's forest-loss rule: HV drops 3 dB or more, and 1.5 dB more than HH.",
      es: "Hojas y ramas dispersan la onda en muchas direcciones (dispersión de volumen), lo que se nota más en el canal de polarización cruzada, HV. La onda larga de la banda L entra más en el dosel y también toca ramas grandes y troncos. La regla de pérdida de bosque de la app: HV baja 3 dB o más, y 1.5 dB más que HH.",
    },
    looks: { en: "Forest loss: HV darker after.", es: "Pérdida de bosque: HV más oscuro después." },
    refs: ["sar", "rules"],
  },
  {
    id: "moisture",
    title: { en: "Wet ground is brighter", es: "El suelo mojado se ve más claro" },
    text: {
      en: "A rough surface backscatters even more brightly when it is wet, so the same field can look brighter after rain. NISAR also has a soil moisture product (SME2).",
      es: "Una superficie rugosa refleja con aún más brillo cuando está mojada, así que el mismo campo puede verse más claro después de llover. NISAR también tiene un producto de humedad del suelo (SME2).",
    },
    looks: { en: "Wetter: brighter.", es: "Más húmedo: más claro." },
    refs: ["sarImage", "nisarFacts", "asfProducts"],
  },
  {
    id: "motion",
    title: { en: "Measuring centimeters", es: "Medir centímetros" },
    text: {
      en: "Interferometry (InSAR) uses the phase of the echo to measure the distance to the ground. Comparing two passes measures how the ground moved, up to the centimeter level. The app flags ground sinking 5 cm a year or more. NASA reports that parts of Mexico City sank about 35 cm a year in the 1990s and 2000s, and NISAR measured more than 2 cm a month in places between October 2025 and January 2026.",
      es: "La interferometría (InSAR) usa la fase del eco para medir la distancia al suelo. Comparar dos pasadas mide cómo se movió el suelo, con precisión de centímetros. La app marca hundimientos de 5 cm al año o más. La NASA informa que partes de la Ciudad de México se hundían unos 35 cm al año en los años 1990 y 2000, y NISAR midió más de 2 cm al mes en algunos lugares entre octubre de 2025 y enero de 2026.",
    },
    looks: { en: "Ground motion map: red away from the satellite, blue toward it.", es: "Mapa de movimiento: rojo se aleja del satélite, azul se acerca." },
    refs: ["sar", "cdmx", "rules"],
  },
  {
    id: "fooled",
    title: { en: "What can fool it", es: "Qué lo puede engañar" },
    text: {
      en: "Wind-roughened water can look bright, wet ground looks brighter, the viewing angle changes the echo, and crops grow. So the app's rules need a change to still show on the next pass, drop patches under 0.04 km², and call every result a hypothesis, not a fact.",
      es: "El agua agitada por el viento puede verse brillante, el suelo mojado se ve más claro, el ángulo de vista cambia el eco y los cultivos crecen. Por eso las reglas de la app exigen que el cambio siga en la siguiente pasada, descartan manchas menores a 0.04 km² y presentan cada resultado como hipótesis, no como hecho.",
    },
    looks: { en: "One pass alone is never enough.", es: "Una sola pasada nunca basta." },
    refs: ["sarImage", "sar", "cdmx", "rules"],
  },
];

// Which ideas explain which filter types.
const FOR: Record<string, string[]> = {
  floods: ["water", "structure"],
  urban: ["structure"],
  deforestation: ["plants"],
  logging: ["plants"],
  wildfires: ["plants"],
  agriculture: ["plants", "moisture"],
  drought: ["moisture"],
  subsidence: ["motion"],
  groundwater: ["motion"],
  volcanoes: ["motion"],
  earthquakes: ["motion"],
  landslides: ["motion"],
  sinkholes: ["motion"],
};

/** The ideas for an area: the basics, at most two about its types, and what can fool the radar. */
export function topicsFor(types: string[]): string[] {
  const picked = [...new Set(types.flatMap((x) => FOR[x] ?? []))].slice(0, 2);
  return ["basics", ...(picked.length ? picked : ["water", "plants"]), "fooled"];
}
