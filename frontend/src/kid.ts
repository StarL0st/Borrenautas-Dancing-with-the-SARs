// Words for Simple mode's side panel, written so a 10-year-old can follow them (jopa-testing).
// Short sentences, everyday words, one idea at a time. Facts match the rest of the app (explain.ts,
// mexico.ts). Text is { en, es }; German falls back to English, as in mexico.ts.
import type { Text } from "./mexico";

/** What each kind of change is, in one sentence. */
export const KID_TYPES: Record<string, Text> = {
  floods: { en: "Floods: water covers land that is usually dry.", es: "Inundaciones: el agua cubre tierra que normalmente está seca." },
  deforestation: { en: "Cutting down forests: trees are cut and the land is used for something else.", es: "Tala de bosques: se cortan árboles y la tierra se usa para otra cosa." },
  logging: { en: "Logging: trees are cut for their wood.", es: "Tala: se cortan árboles por su madera." },
  wildfires: { en: "Wildfires: fires that burn forests and fields.", es: "Incendios: fuegos que queman bosques y campos." },
  agriculture: { en: "Farming: fields where people grow food.", es: "Agricultura: campos donde la gente cultiva comida." },
  urban: { en: "Growing cities: new houses, roads and buildings.", es: "Ciudades que crecen: casas, calles y edificios nuevos." },
  subsidence: { en: "Sinking ground: the ground slowly goes down, like a cake sinking in the middle.", es: "Suelo que se hunde: el suelo baja poco a poco, como un pastel que se hunde en el centro." },
  groundwater: { en: "Pumping water from underground: taking too much can make the ground sink.", es: "Sacar agua de debajo del suelo: si se saca mucha, el suelo se puede hundir." },
  drought: { en: "Drought: a long time with very little rain, so the ground dries out.", es: "Sequía: mucho tiempo con muy poca lluvia, y el suelo se seca." },
  volcanoes: { en: "Volcanoes: mountains that can throw out lava, ash and gas.", es: "Volcanes: montañas que pueden echar lava, ceniza y gas." },
  earthquakes: { en: "Earthquakes: the ground suddenly shakes.", es: "Sismos: el suelo tiembla de repente." },
  landslides: { en: "Landslides: earth and rocks slide down a hill.", es: "Deslaves: tierra y rocas se resbalan por una ladera." },
  hurricanes: { en: "Hurricanes: giant storms with very strong wind and rain.", es: "Huracanes: tormentas gigantes con viento y lluvia muy fuertes." },
  storms: { en: "Storms: strong wind, rain or hail.", es: "Tormentas: viento fuerte, lluvia o granizo." },
  sinkholes: { en: "Sinkholes: holes that suddenly open in the ground.", es: "Socavones: hoyos que se abren de repente en el suelo." },
  "coastal-loss": { en: "Losing coast: the sea slowly eats away the beach.", es: "Pérdida de costa: el mar se come la playa poco a poco." },
  reservoirs: { en: "Reservoirs: big lakes made by people to keep water.", es: "Presas: lagos grandes hechos por la gente para guardar agua." },
  "oil-spills": { en: "Oil spills: oil that leaks into the sea or the land.", es: "Derrames de petróleo: petróleo que se sale al mar o a la tierra." },
  glaciers: { en: "Glaciers: huge pieces of ice that move very slowly.", es: "Glaciares: enormes pedazos de hielo que se mueven muy despacio." },
  heat: { en: "Heat waves: many very hot days in a row.", es: "Olas de calor: muchos días muy calurosos seguidos." },
};

/** What the radar found, by kind of detected change: one place, or many. */
export const KID_FOUND: Record<string, { one: Text; many: Text }> = {
  floods: { one: { en: "1 spot where water may have covered the land", es: "1 lugar donde el agua pudo cubrir la tierra" }, many: { en: "{n} spots where water may have covered the land", es: "{n} lugares donde el agua pudo cubrir la tierra" } },
  deforestation: { one: { en: "1 spot where trees may have been cut", es: "1 lugar donde pudieron cortar árboles" }, many: { en: "{n} spots where trees may have been cut", es: "{n} lugares donde pudieron cortar árboles" } },
  logging: { one: { en: "1 spot where trees may have been cut", es: "1 lugar donde pudieron cortar árboles" }, many: { en: "{n} spots where trees may have been cut", es: "{n} lugares donde pudieron cortar árboles" } },
  wildfires: { one: { en: "1 spot where fire may have burned plants", es: "1 lugar donde el fuego pudo quemar plantas" }, many: { en: "{n} spots where fire may have burned plants", es: "{n} lugares donde el fuego pudo quemar plantas" } },
  agriculture: { one: { en: "1 farm field that changed (planted or harvested)", es: "1 campo de cultivo que cambió (sembrado o cosechado)" }, many: { en: "{n} farm fields that changed (planted or harvested)", es: "{n} campos de cultivo que cambiaron (sembrados o cosechados)" } },
  urban: { one: { en: "1 spot where new buildings may have appeared", es: "1 lugar donde pudieron aparecer edificios nuevos" }, many: { en: "{n} spots where new buildings may have appeared", es: "{n} lugares donde pudieron aparecer edificios nuevos" } },
  subsidence: { one: { en: "1 spot where the ground may be sinking", es: "1 lugar donde el suelo se puede estar hundiendo" }, many: { en: "{n} spots where the ground may be sinking", es: "{n} lugares donde el suelo se puede estar hundiendo" } },
  groundwater: { one: { en: "1 spot where the ground may be sinking", es: "1 lugar donde el suelo se puede estar hundiendo" }, many: { en: "{n} spots where the ground may be sinking", es: "{n} lugares donde el suelo se puede estar hundiendo" } },
  drought: { one: { en: "1 spot where the ground got drier", es: "1 lugar donde el suelo se secó" }, many: { en: "{n} spots where the ground got drier", es: "{n} lugares donde el suelo se secó" } },
  other: { one: { en: "1 other change the radar could not name", es: "1 cambio más que el radar no supo nombrar" }, many: { en: "{n} other changes the radar could not name", es: "{n} cambios más que el radar no supo nombrar" } },
};

/** One fun, true fact per kind of change. */
export const KID_FACTS: Record<string, Text> = {
  subsidence: { en: "Some parts of Mexico City sink 30 to 50 cm every year. That is as much as a school ruler, or more!", es: "Algunas partes de la Ciudad de México se hunden de 30 a 50 cm cada año. ¡Eso es lo que mide una regla escolar, o más!" },
  groundwater: { en: "Under many cities there is water stored in the ground. Pump out too much and the ground sinks, like a sponge that dries and shrinks.", es: "Debajo de muchas ciudades hay agua guardada en el suelo. Si se saca demasiada, el suelo se hunde, como una esponja que se seca y se encoge." },
  floods: { en: "Calm water looks black to the radar, because it bounces the waves away like a mirror.", es: "El agua tranquila se ve negra para el radar, porque desvía las ondas como un espejo." },
  deforestation: { en: "The radar can tell trees from bare ground, because leaves bounce its waves around many times.", es: "El radar distingue árboles de suelo pelón, porque las hojas rebotan sus ondas muchas veces." },
  logging: { en: "The radar can tell trees from bare ground, because leaves bounce its waves around many times.", es: "El radar distingue árboles de suelo pelón, porque las hojas rebotan sus ondas muchas veces." },
  wildfires: { en: "After a fire, plants can grow back. The radar can watch them return, month after month.", es: "Después de un incendio, las plantas pueden volver a crecer. El radar puede verlas regresar, mes tras mes." },
  agriculture: { en: "Fields look different to the radar when they are planted, growing or harvested.", es: "Los campos se ven distintos para el radar cuando están sembrados, creciendo o cosechados." },
  drought: { en: "Wet soil sends back a stronger echo than dry soil, so the radar can tell when the ground is drying.", es: "El suelo mojado regresa un eco más fuerte que el seco, así el radar sabe cuando el suelo se está secando." },
  urban: { en: "Buildings are the brightest things in radar pictures: walls and streets bounce the waves straight back.", es: "Los edificios son lo más brillante en las imágenes de radar: paredes y calles regresan las ondas directo." },
  volcanoes: { en: "Before some eruptions, the ground of a volcano swells a few centimeters, and radar can measure it.", es: "Antes de algunas erupciones, el suelo de un volcán se infla unos centímetros, y el radar lo puede medir." },
  earthquakes: { en: "Radar can measure how much the ground moved in an earthquake, even just a few centimeters.", es: "El radar puede medir cuánto se movió el suelo en un sismo, aunque sean pocos centímetros." },
  hurricanes: { en: "Radar sees through the clouds of a hurricane, down to the flooded land below.", es: "El radar ve a través de las nubes de un huracán, hasta la tierra inundada de abajo." },
  default: { en: "NISAR goes around the whole Earth and looks at almost all of its land and ice every 12 days.", es: "NISAR le da la vuelta a toda la Tierra y mira casi toda su tierra y su hielo cada 12 días." },
};

/** The fact for the first kind of change the area is about. */
export const kidFact = (types: string[]): Text => KID_FACTS[types.find((x) => KID_FACTS[x]) ?? "default"];
