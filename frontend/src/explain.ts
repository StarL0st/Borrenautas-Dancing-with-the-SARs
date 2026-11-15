// "Why the radar sees changes", explained simply, each idea with a small drawing (jopa-testing).
//
// Drawings are in explain-view.ts. The numbers are the back end's own rules (backend/src/sars_pipeline/classify.py, site.py), so the
// explanation matches what the app does. Text is { en, es }; German falls back to English, as in
// mexico.ts.
import type { Text } from "./mexico";

export type Topic = { id: string; title: Text; text: Text; looks: Text };

export const TOPICS: Topic[] = [
  {
    id: "basics",
    title: { en: "An echo, not a photo", es: "Un eco, no una foto" },
    text: {
      en: "NISAR sends microwaves 24 cm long (L-band) to the ground and listens to the echo. A strong echo is drawn bright, a weak one dark. Microwaves pass through clouds and need no sunlight, so the same place is seen every 12 days, by night or day.",
      es: "NISAR envía microondas de 24 cm (banda L) al suelo y escucha el eco. Un eco fuerte se dibuja claro y uno débil, oscuro. Las microondas atraviesan las nubes y no necesitan luz del sol, así que ve el mismo lugar cada 12 días, de noche o de día.",
    },
    looks: { en: "Bright = strong echo. Dark = weak echo.", es: "Claro = eco fuerte. Oscuro = eco débil." },
  },
  {
    id: "water",
    title: { en: "Water is a mirror", es: "El agua es un espejo" },
    text: {
      en: "Calm water bounces the wave away, like a mirror, so almost nothing comes back and water looks black. When land floods, both channels (HH and HV) lose half their echo or more (3 dB): that is how a flood shows up.",
      es: "El agua tranquila desvía la onda como un espejo, casi nada regresa y el agua se ve negra. Cuando un terreno se inunda, los dos canales (HH y HV) pierden la mitad del eco o más (3 dB): así aparece una inundación.",
    },
    looks: { en: "Flood: darker after.", es: "Inundación: más oscuro después." },
  },
  {
    id: "structure",
    title: { en: "Corners shine", es: "Las esquinas brillan" },
    text: {
      en: "A wall and the ground make a corner that throws the wave straight back. That is why cities are the brightest thing in a radar picture. New buildings make a place brighter (HH up 4 dB or more). Water under trees does the same: a flooded forest gets brighter, not darker.",
      es: "Una pared y el suelo forman una esquina que devuelve la onda directo al satélite. Por eso las ciudades son lo más brillante en una imagen de radar. Las construcciones nuevas hacen un lugar más brillante (HH sube 4 dB o más). El agua bajo los árboles hace lo mismo: un bosque inundado se ve más claro, no más oscuro.",
    },
    looks: { en: "New buildings: brighter after.", es: "Construcciones nuevas: más claro después." },
  },
  {
    id: "plants",
    title: { en: "Leaves scramble the wave", es: "Las hojas revuelven la onda" },
    text: {
      en: "Leaves and branches bounce the wave many times and turn part of it sideways. That sideways part is the HV channel. When a forest is cut or burned, HV drops by half or more (3 dB) and more than HH does.",
      es: "Hojas y ramas rebotan la onda muchas veces y giran parte de ella de lado. Esa parte girada es el canal HV. Cuando se tala o quema un bosque, HV cae a la mitad o menos (3 dB) y más que HH.",
    },
    looks: { en: "Forest loss: HV darker after.", es: "Pérdida de bosque: HV más oscuro después." },
  },
  {
    id: "moisture",
    title: { en: "Wet ground echoes more", es: "El suelo húmedo hace más eco" },
    text: {
      en: "Water in the soil makes it reflect more, so the same field is brighter after rain and darker in a drought. NISAR's soil moisture product turns this into cubic meters of water per cubic meter of soil.",
      es: "El agua en el suelo hace que refleje más, así que el mismo campo se ve más claro después de llover y más oscuro en una sequía. El producto de humedad de NISAR lo convierte en metros cúbicos de agua por metro cúbico de suelo.",
    },
    looks: { en: "Wetter: brighter. Drier: darker.", es: "Más húmedo: más claro. Más seco: más oscuro." },
  },
  {
    id: "motion",
    title: { en: "Measuring centimeters", es: "Medir centímetros" },
    text: {
      en: "The radar also records at which point of its wave the echo returns (the phase). If the ground sinks between two passes, the echo travels a little further and the phase shifts. Comparing passes measures movements of millimeters to centimeters. The app flags ground sinking 5 cm a year or more; parts of Mexico City sink 30 to 50 cm a year.",
      es: "El radar también registra en qué punto de su onda regresa el eco (la fase). Si el suelo se hunde entre dos pasadas, el eco recorre un poco más y la fase cambia. Comparar pasadas mide movimientos de milímetros a centímetros. La app marca hundimientos de 5 cm al año o más; partes de la Ciudad de México se hunden de 30 a 50 cm al año.",
    },
    looks: { en: "Ground motion map: red away from the satellite, blue toward it.", es: "Mapa de movimiento: rojo se aleja del satélite, azul se acerca." },
  },
  {
    id: "fooled",
    title: { en: "What can fool it", es: "Qué lo puede engañar" },
    text: {
      en: "Wind roughens lakes and makes them brighter, rain wets the soil for a day, crops grow and get harvested, and a different viewing angle changes the echo. So a change must still show on the next pass, patches under 0.04 km² are dropped, and every result is called a hypothesis, not a fact.",
      es: "El viento agita los lagos y los aclara, la lluvia moja el suelo por un día, los cultivos crecen y se cosechan, y otro ángulo de vista cambia el eco. Por eso un cambio debe seguir en la siguiente pasada, se descartan manchas menores a 0.04 km² y cada resultado se presenta como hipótesis, no como hecho.",
    },
    looks: { en: "One pass alone is never enough.", es: "Una sola pasada nunca basta." },
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
