// Words for Simple mode's side panel, written so a 10-year-old can follow them (jopa-testing).
// Short sentences, everyday words, one idea at a time. Every fact cites its source (sources.ts). Text is { en, es }; German falls back to English, as in mexico.ts.
import type { Text } from "./mexico";
import type { RefId } from "./sources";

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

/** One fun, true fact per kind of change, each with the source that says it (sources.ts). */
export type KidFact = Text & { refs: RefId[] };
export const KID_FACTS: Record<string, KidFact> = {
  subsidence: { en: "In the 1990s and 2000s, parts of Mexico City sank about 35 cm every year. That is longer than a 30 cm school ruler!", es: "En los años 1990 y 2000, partes de la Ciudad de México se hundían unos 35 cm cada año. ¡Más que una regla escolar de 30 cm!", refs: ["cdmx"] },
  groundwater: { en: "Mexico City is built on an old lakebed. Pumping lots of water out from under the ground has squeezed that ground down, so the city sinks.", es: "La Ciudad de México está construida sobre un antiguo lago. Sacar mucha agua de debajo del suelo lo ha apretado, y por eso la ciudad se hunde.", refs: ["cdmx"] },
  floods: { en: "Calm water looks black to the radar, because the water reflects the waves away from the satellite, like a mirror.", es: "El agua tranquila se ve negra para el radar, porque refleja las ondas lejos del satélite, como un espejo.", refs: ["sarImage"] },
  deforestation: { en: "NISAR's radar waves are 24 cm long. Waves that long go deep into a forest and bounce off big branches and tree trunks.", es: "Las ondas del radar de NISAR miden 24 cm. Ondas tan largas entran hondo en un bosque y rebotan en ramas grandes y troncos.", refs: ["nisarFacts", "sar"] },
  logging: { en: "NISAR's radar waves are 24 cm long. Waves that long go deep into a forest and bounce off big branches and tree trunks.", es: "Las ondas del radar de NISAR miden 24 cm. Ondas tan largas entran hondo en un bosque y rebotan en ramas grandes y troncos.", refs: ["nisarFacts", "sar"] },
  wildfires: { en: "NASA's FIRMS system spots fires from space and shares them within about 3 hours.", es: "El sistema FIRMS de la NASA detecta incendios desde el espacio y los comparte en unas 3 horas.", refs: ["firms"] },
  agriculture: { en: "NISAR was made to follow changes like crops growing, even through clouds.", es: "NISAR fue hecho para seguir cambios como el crecimiento de los cultivos, incluso a través de las nubes.", refs: ["cdmx"] },
  drought: { en: "Wet ground sends back more radar energy than dry ground, so it looks brighter in radar pictures.", es: "El suelo mojado regresa más energía de radar que el seco, por eso se ve más claro en las imágenes de radar.", refs: ["sarImage"] },
  urban: { en: "Buildings and bridges work like corner mirrors for radar, so they show up as bright spots.", es: "Los edificios y puentes funcionan como espejos de esquina para el radar, por eso aparecen como puntos brillantes.", refs: ["sarImage"] },
  volcanoes: { en: "Radar can measure how much the ground moved after a volcano erupts, down to about a centimeter.", es: "El radar puede medir cuánto se movió el suelo después de que un volcán hace erupción, con precisión de un centímetro.", refs: ["sar"] },
  earthquakes: { en: "Radar can measure how much the ground moved in an earthquake, down to about a centimeter.", es: "El radar puede medir cuánto se movió el suelo en un sismo, con precisión de un centímetro.", refs: ["sar"] },
  hurricanes: { en: "NISAR's radar works day and night, rain or shine, so clouds do not stop it.", es: "El radar de NISAR funciona de día y de noche, con lluvia o con sol, así que las nubes no lo detienen.", refs: ["cdmx"] },
  default: { en: "NISAR looks at almost all of Earth's land and ice every 12 days.", es: "NISAR observa casi toda la tierra y el hielo de la Tierra cada 12 días.", refs: ["nisarFacts"] },
};

/** The fact for the first kind of change the area is about. */
export const kidFact = (types: string[]): KidFact => KID_FACTS[types.find((x) => KID_FACTS[x]) ?? "default"];
