// Mexico context data (jopa-testing): remarkable past events and notes on what changed in each
// study zone. Pure data and helpers, no DOM, so `node --test` can load it.
//
// Text is in English and Spanish ({ en, es }); German falls back to English. Every entry names
// its sources. Figures are kept to well-documented ones, and stated as ranges where sources
// differ. VERIFY before submission: see frontend/JOPA_TESTING.md, "Facts to double-check".
//
// Space Apps rules: NASA data first (EONET, FIRMS, GIBS, Earth Observatory), then other open
// public sources with credit (USGS, NOAA, Smithsonian GVP, Mexico's SSN, CENAPRED, CONAGUA,
// CONABIO, CONANP, IUCN). No logos, no implied endorsement.

export type Text = { en: string; es: string };
export const tx = (s: Text, lang: string) => (lang === "es" ? s.es : s.en);

export type Source = { name: string; url?: string };

// A remarkable event. `places` are the epicenter or landfall first, then other places it hit
// hard (the 1985 quake struck offshore but killed thousands in Mexico City).
export type HistoryEvent = {
  id: string;
  date: string; // start, ISO
  type: string; // filter type id (filters.ts)
  severity: 1 | 2 | 3; // 3 = among the most destructive in modern Mexican history
  title: Text;
  impact: Text;
  places: [number, number][]; // [lon, lat]
  sources: Source[];
};

const USGS: Source = { name: "USGS Earthquake Hazards Program", url: "https://earthquake.usgs.gov/earthquakes/browse/significant.php" };
const SSN: Source = { name: "Servicio Sismológico Nacional (UNAM)", url: "http://www.ssn.unam.mx/" };
const NHC: Source = { name: "NOAA National Hurricane Center, Tropical Cyclone Reports", url: "https://www.nhc.noaa.gov/data/tcr/" };
const EO: Source = { name: "NASA Earth Observatory", url: "https://science.nasa.gov/earth/earth-observatory/" };
const GVP: Source = { name: "Smithsonian Global Volcanism Program", url: "https://volcano.si.edu/" };
const CENAPRED: Source = { name: "CENAPRED (Mexico's national disaster prevention center)", url: "https://www.gob.mx/cenapred" };
const CONAGUA: Source = { name: "CONAGUA / Servicio Meteorológico Nacional", url: "https://smn.conagua.gob.mx/" };

export const HISTORY: HistoryEvent[] = [
  {
    id: "ixtoc-1979", date: "1979-06-03", type: "oil-spills", severity: 3,
    title: { en: "Ixtoc I oil well blowout", es: "Derrame del pozo Ixtoc I" },
    impact: {
      en: "An offshore well in the Bay of Campeche blew out and leaked oil for about nine months, one of the largest accidental spills on record. Oil reached the coasts of Campeche, Tamaulipas and Texas.",
      es: "Un pozo marino en la Sonda de Campeche se descontroló y derramó petróleo durante unos nueve meses, uno de los mayores derrames accidentales registrados. El petróleo llegó a las costas de Campeche, Tamaulipas y Texas.",
    },
    places: [[-92.33, 19.41]],
    sources: [{ name: "NOAA Office of Response and Restoration", url: "https://response.restoration.noaa.gov/" }],
  },
  {
    id: "chichon-1982", date: "1982-03-28", type: "volcanoes", severity: 3,
    title: { en: "El Chichón eruption", es: "Erupción del Chichón" },
    impact: {
      en: "Explosive eruptions destroyed nearby villages in Chiapas and killed about 2,000 people. The sulfur cloud reached the stratosphere and was tracked by NASA satellites around the world.",
      es: "Erupciones explosivas destruyeron poblados cercanos en Chiapas y causaron unas 2,000 muertes. La nube de azufre llegó a la estratosfera y los satélites de la NASA la siguieron alrededor del mundo.",
    },
    places: [[-93.23, 17.36]],
    sources: [GVP, EO],
  },
  {
    id: "michoacan-1985", date: "1985-09-19", type: "earthquakes", severity: 3,
    title: { en: "Magnitude 8.0 Michoacán earthquake", es: "Sismo de magnitud 8.0 de Michoacán" },
    impact: {
      en: "Struck off the Michoacán coast, but the soft old lakebed under Mexico City amplified the shaking: hundreds of buildings collapsed and thousands died (the official count is about 10,000; other estimates are higher). It led to Mexico's civil protection system.",
      es: "Ocurrió frente a la costa de Michoacán, pero el suelo blando del antiguo lago bajo la Ciudad de México amplificó el movimiento: cientos de edificios colapsaron y murieron miles de personas (la cifra oficial es de unas 10,000; otras estimaciones son mayores). De ahí nació el sistema de protección civil.",
    },
    places: [[-102.53, 18.19], [-99.13, 19.43]],
    sources: [USGS, SSN],
  },
  {
    id: "gilbert-1988", date: "1988-09-14", type: "hurricanes", severity: 3,
    title: { en: "Hurricane Gilbert", es: "Huracán Gilberto" },
    impact: {
      en: "A Category 5 hurricane that hit the Yucatán Peninsula, then brought deadly floods to Monterrey days later. About 200 people died in Mexico, most of them in Monterrey.",
      es: "Huracán categoría 5 que golpeó la península de Yucatán y días después causó inundaciones mortales en Monterrey. Murieron unas 200 personas en México, la mayoría en Monterrey.",
    },
    places: [[-86.9, 20.8], [-100.31, 25.67]],
    sources: [NHC],
  },
  {
    id: "pauline-1997", date: "1997-10-08", type: "hurricanes", severity: 3,
    title: { en: "Hurricane Pauline", es: "Huracán Paulina" },
    impact: {
      en: "Torrential rain caused flash floods and mudslides in Acapulco and the coasts of Guerrero and Oaxaca; more than 200 people died.",
      es: "Lluvias torrenciales provocaron inundaciones repentinas y deslaves en Acapulco y las costas de Guerrero y Oaxaca; murieron más de 200 personas.",
    },
    places: [[-99.88, 16.85], [-96.5, 15.8]],
    sources: [NHC],
  },
  {
    id: "wilma-2005", date: "2005-10-21", type: "hurricanes", severity: 3,
    title: { en: "Hurricane Wilma", es: "Huracán Wilma" },
    impact: {
      en: "Stalled over Cozumel and Cancún as a major hurricane for two days or more, wrecking hotels, homes and beaches and stripping mangroves and coral reefs.",
      es: "Se estancó sobre Cozumel y Cancún como huracán mayor durante dos días o más, destruyendo hoteles, viviendas y playas, y dañando manglares y arrecifes.",
    },
    places: [[-86.95, 20.5], [-86.85, 21.16]],
    sources: [NHC, EO],
  },
  {
    id: "tabasco-2007", date: "2007-10-28", type: "floods", severity: 3,
    title: { en: "Tabasco floods", es: "Inundaciones de Tabasco" },
    impact: {
      en: "Days of heavy rain overflowed the Grijalva and Usumacinta rivers: up to about 80% of the state, including much of Villahermosa, was under water and about a million people were affected. A landslide days later blocked the Grijalva near Juan de Grijalva, Chiapas.",
      es: "Días de lluvia intensa desbordaron los ríos Grijalva y Usumacinta: hasta cerca del 80% del estado, incluida buena parte de Villahermosa, quedó bajo el agua y alrededor de un millón de personas resultaron afectadas. Días después un deslave tapó el Grijalva cerca de Juan de Grijalva, Chiapas.",
    },
    places: [[-92.93, 17.99], [-93.4, 17.4]],
    sources: [EO, CENAPRED],
  },
  {
    id: "piedrasnegras-2007", date: "2007-04-24", type: "storms", severity: 1,
    title: { en: "Piedras Negras tornado", es: "Tornado de Piedras Negras" },
    impact: {
      en: "A strong tornado crossed from Texas into Piedras Negras, Coahuila, destroying homes and killing three people there and seven more across the river in Eagle Pass, Texas. Tornadoes are rare but not unknown in northern Mexico.",
      es: "Un tornado fuerte cruzó de Texas a Piedras Negras, Coahuila, destruyó viviendas y mató a tres personas ahí y a siete más al otro lado del río, en Eagle Pass, Texas. Los tornados son raros pero no desconocidos en el norte de México.",
    },
    places: [[-100.52, 28.7]],
    sources: [CONAGUA],
  },
  {
    id: "alex-2010", date: "2010-06-30", type: "hurricanes", severity: 2,
    title: { en: "Hurricane Alex", es: "Huracán Alex" },
    impact: {
      en: "Record rain flooded Monterrey: the Santa Catarina river destroyed roads and bridges across the city.",
      es: "Lluvias récord inundaron Monterrey: el río Santa Catarina destruyó calles y puentes de la ciudad.",
    },
    places: [[-97.7, 24.3], [-100.31, 25.67]],
    sources: [NHC],
  },
  {
    id: "ingrid-manuel-2013", date: "2013-09-14", type: "hurricanes", severity: 3,
    title: { en: "Ingrid and Manuel, two storms at once", es: "Ingrid y Manuel, dos tormentas a la vez" },
    impact: {
      en: "Two storms hit both coasts at the same time. Floods and landslides killed well over a hundred people; a landslide buried much of La Pintada, Guerrero, and Acapulco was cut off.",
      es: "Dos tormentas golpearon ambas costas al mismo tiempo. Inundaciones y deslaves causaron bastante más de cien muertes; un deslave sepultó gran parte de La Pintada, Guerrero, y Acapulco quedó incomunicado.",
    },
    places: [[-100.33, 17.36], [-99.88, 16.85], [-97.9, 22.2]],
    sources: [NHC, CENAPRED],
  },
  {
    id: "sonora-2014", date: "2014-08-06", type: "industrial", severity: 2,
    title: { en: "Sonora River mine spill", es: "Derrame minero en el río Sonora" },
    impact: {
      en: "About 40,000 cubic meters of acidic copper sulfate solution leaked from the Buenavista del Cobre mine at Cananea into the Bacanuchi and Sonora rivers, cutting off drinking and farm water for towns downstream.",
      es: "Unos 40,000 metros cúbicos de solución ácida de sulfato de cobre se derramaron de la mina Buenavista del Cobre, en Cananea, a los ríos Bacanuchi y Sonora, y dejaron sin agua potable y de riego a los pueblos río abajo.",
    },
    places: [[-110.3, 30.98], [-110.2, 30.0]],
    sources: [{ name: "SEMARNAT / PROFEPA (Mexico's environment ministry)", url: "https://www.gob.mx/semarnat" }],
  },
  {
    id: "patricia-2015", date: "2015-10-23", type: "hurricanes", severity: 2,
    title: { en: "Hurricane Patricia", es: "Huracán Patricia" },
    impact: {
      en: "The strongest hurricane ever measured in the Western Hemisphere at its peak. It weakened to Category 4 before landfall on the Jalisco coast and hit a thinly populated area, so damage was smaller than feared, but forests were flattened.",
      es: "El huracán más intenso jamás medido en el hemisferio occidental en su punto máximo. Se debilitó a categoría 4 antes de tocar tierra en la costa de Jalisco, en una zona poco poblada, así que los daños fueron menores de lo temido, aunque derribó bosques enteros.",
    },
    places: [[-105.0, 19.4]],
    sources: [NHC, EO],
  },
  {
    id: "chiapas-2017", date: "2017-09-07", type: "earthquakes", severity: 3,
    title: { en: "Magnitude 8.2 Chiapas earthquake", es: "Sismo de magnitud 8.2 de Chiapas" },
    impact: {
      en: "The strongest quake in Mexico in a century, offshore in the Gulf of Tehuantepec. Juchitán, Oaxaca, was badly damaged and about a hundred people died.",
      es: "El sismo más fuerte en México en un siglo, mar adentro en el golfo de Tehuantepec. Juchitán, Oaxaca, sufrió graves daños y murieron alrededor de cien personas.",
    },
    places: [[-93.9, 15.02], [-95.02, 16.43]],
    sources: [USGS, SSN],
  },
  {
    id: "puebla-2017", date: "2017-09-19", type: "earthquakes", severity: 3,
    title: { en: "Magnitude 7.1 Puebla–Morelos earthquake", es: "Sismo de magnitud 7.1 de Puebla–Morelos" },
    impact: {
      en: "On the anniversary of 1985, buildings collapsed in Mexico City, Morelos and Puebla; about 370 people died. Radar satellites mapped the damage in the days after.",
      es: "En el aniversario de 1985 colapsaron edificios en la Ciudad de México, Morelos y Puebla; murieron unas 370 personas. Los satélites de radar mapearon los daños en los días siguientes.",
    },
    places: [[-98.49, 18.55], [-99.13, 19.43], [-98.2, 19.04]],
    sources: [USGS, SSN, EO],
  },
  {
    id: "tlahuelilpan-2019", date: "2019-01-18", type: "industrial", severity: 3,
    title: { en: "Tlahuelilpan pipeline explosion", es: "Explosión del ducto en Tlahuelilpan" },
    impact: {
      en: "An illegally tapped fuel pipeline in Hidalgo exploded while people collected gasoline; more than 130 people died.",
      es: "Un ducto de combustible con una toma clandestina explotó en Hidalgo mientras la gente recolectaba gasolina; murieron más de 130 personas.",
    },
    places: [[-99.23, 20.13]],
    sources: [CENAPRED],
  },
  {
    id: "oaxaca-2020", date: "2020-06-23", type: "earthquakes", severity: 2,
    title: { en: "Magnitude 7.4 Oaxaca earthquake", es: "Sismo de magnitud 7.4 de Oaxaca" },
    impact: {
      en: "Centered near Crucecita on the Oaxaca coast, during the COVID-19 lockdown. Ten people died; landslides blocked roads in the mountains.",
      es: "Con epicentro cerca de Crucecita, en la costa de Oaxaca, durante el confinamiento por COVID-19. Murieron diez personas; deslaves bloquearon caminos en la sierra.",
    },
    places: [[-96.01, 15.89]],
    sources: [USGS, SSN],
  },
  {
    id: "freeze-2021", date: "2021-02-15", type: "cold", severity: 2,
    title: { en: "Winter storm and blackouts in the north", es: "Tormenta invernal y apagones en el norte" },
    impact: {
      en: "A deep freeze cut natural gas from Texas; power plants in northern Mexico failed and millions of homes lost electricity.",
      es: "Una helada intensa cortó el gas natural desde Texas; fallaron centrales eléctricas del norte de México y millones de hogares se quedaron sin luz.",
    },
    places: [[-100.31, 25.67], [-106.08, 28.64]],
    sources: [EO],
  },
  {
    id: "metro12-2021", date: "2021-05-03", type: "urban", severity: 3,
    title: { en: "Metro Line 12 overpass collapse", es: "Colapso del tramo elevado de la Línea 12" },
    impact: {
      en: "An elevated section of Mexico City's Metro Line 12 fell onto a road as a train crossed; 26 people died. Investigations pointed to construction faults.",
      es: "Un tramo elevado de la Línea 12 del Metro de la Ciudad de México cayó sobre una avenida al pasar un tren; murieron 26 personas. Las investigaciones apuntaron a fallas de construcción.",
    },
    places: [[-99.05, 19.3]],
    sources: [{ name: "Gobierno de la Ciudad de México", url: "https://www.cdmx.gob.mx/" }],
  },
  {
    id: "zacatepec-2021", date: "2021-05-29", type: "sinkholes", severity: 1,
    title: { en: "Santa María Zacatepec sinkhole", es: "Socavón de Santa María Zacatepec" },
    impact: {
      en: "A sinkhole opened in farmland in Puebla and kept growing for weeks to more than a hundred meters across, swallowing part of a house.",
      es: "Un socavón se abrió en un campo de cultivo en Puebla y creció durante semanas hasta superar los cien metros de diámetro, tragándose parte de una casa.",
    },
    places: [[-98.37, 19.1]],
    sources: [CENAPRED],
  },
  {
    id: "michoacan-2022", date: "2022-09-19", type: "earthquakes", severity: 2,
    title: { en: "Magnitude 7.6 Michoacán earthquake", es: "Sismo de magnitud 7.6 de Michoacán" },
    impact: {
      en: "Struck near Coalcomán, again on September 19. It damaged hospitals and homes in Michoacán and Colima.",
      es: "Ocurrió cerca de Coalcomán, otra vez un 19 de septiembre. Dañó hospitales y viviendas en Michoacán y Colima.",
    },
    places: [[-103.25, 18.4]],
    sources: [USGS, SSN],
  },
  {
    id: "popo-2023", date: "2023-05-20", type: "volcanoes", severity: 2,
    title: { en: "Popocatépetl unrest", es: "Actividad del Popocatépetl" },
    impact: {
      en: "Intense ash emissions raised the alert to Yellow Phase 3 and closed the Mexico City and Puebla airports for hours. About 25 million people live within 100 km of the volcano.",
      es: "Fuertes emisiones de ceniza elevaron la alerta a Amarillo Fase 3 y cerraron por horas los aeropuertos de la Ciudad de México y Puebla. Unos 25 millones de personas viven a menos de 100 km del volcán.",
    },
    places: [[-98.62, 19.02], [-99.13, 19.43], [-98.2, 19.04]],
    sources: [CENAPRED, GVP],
  },
  {
    id: "otis-2023", date: "2023-10-25", type: "hurricanes", severity: 3,
    title: { en: "Hurricane Otis", es: "Huracán Otis" },
    impact: {
      en: "Grew from a tropical storm to Category 5 in about a day, far faster than forecast, and struck Acapulco at night as a Category 5, one of the strongest hurricanes ever to hit Mexico's Pacific coast. Dozens died and most of the city's buildings were damaged.",
      es: "Pasó de tormenta tropical a categoría 5 en alrededor de un día, mucho más rápido de lo pronosticado, y golpeó Acapulco de noche como categoría 5, uno de los huracanes más fuertes que han golpeado la costa del Pacífico mexicano. Murieron decenas de personas y la mayoría de los edificios resultaron dañados.",
    },
    places: [[-99.88, 16.85]],
    sources: [NHC, EO],
  },
  {
    id: "drought-2024", date: "2024-05-15", type: "drought", severity: 2,
    title: { en: "Drought and heat wave; Cutzamala at record lows", es: "Sequía y ola de calor; Cutzamala en mínimos" },
    impact: {
      en: "Most of Mexico was in drought. The Cutzamala reservoirs that supply Mexico City fell to about 26% of capacity in June, the lowest in some 25 years, and heat records were broken in many cities.",
      es: "La mayor parte de México estaba en sequía. Las presas del Sistema Cutzamala, que abastecen a la Ciudad de México, bajaron a cerca del 26% de su capacidad en junio, el nivel más bajo en unos 25 años, y se rompieron récords de calor en muchas ciudades.",
    },
    places: [[-100.13, 19.19], [-99.13, 19.43]],
    sources: [CONAGUA, EO],
  },
  {
    id: "john-2024", date: "2024-09-23", type: "hurricanes", severity: 2,
    title: { en: "Hurricane John", es: "Huracán John" },
    impact: {
      en: "Made landfall in Guerrero, drifted back to sea and returned; days of rain flooded Acapulco again, less than a year after Otis.",
      es: "Tocó tierra en Guerrero, regresó al mar y volvió; días de lluvia inundaron Acapulco otra vez, menos de un año después de Otis.",
    },
    places: [[-98.9, 16.6], [-99.88, 16.85]],
    sources: [NHC],
  },
];

const CHAUSSARD: Source = {
  name: "Chaussard et al. (2014), Land subsidence in central Mexico detected by ALOS InSAR time-series, Remote Sensing of Environment 140",
  url: "https://doi.org/10.1016/j.rse.2013.08.038",
};
// ---- What changed in each study zone, including plants and animals ----

export type ZoneNote = { center: [number, number]; changes: Text; nature: Text; sources: Source[] };

// Keyed by the back end's area ids (backend/sites.json); example areas match by distance.
export const ZONES: Record<string, ZoneNote> = {
  cdmx: {
    center: [-99.13, 19.43],
    changes: {
      en: "The city keeps sinking where groundwater is pumped from the old lakebed clay; streets crack, buildings tilt and the drainage system loses its slope. Built-up land keeps spreading over farmland and forest at the edges.",
      es: "La ciudad sigue hundiéndose donde se extrae agua del subsuelo arcilloso del antiguo lago; las calles se agrietan, los edificios se inclinan y el drenaje pierde pendiente. La mancha urbana sigue creciendo sobre campos y bosques en las orillas.",
    },
    nature: {
      en: "The canals and wetlands of Xochimilco, the last wild home of the axolotl (critically endangered), shrink and are polluted as the ground sinks and the city grows. Forests in the Sierra de las Cruces and Ajusco, which recharge the aquifer, are lost to housing.",
      es: "Los canales y humedales de Xochimilco, último hogar silvestre del ajolote (en peligro crítico), se reducen y contaminan mientras el suelo se hunde y la ciudad crece. Los bosques de la Sierra de las Cruces y del Ajusco, que recargan el acuífero, se pierden ante la vivienda.",
    },
    sources: [CHAUSSARD, { name: "IUCN Red List: Ambystoma mexicanum", url: "https://www.iucnredlist.org/" }, EO],
  },
  yucatan: {
    center: [-89.74, 19.75],
    changes: {
      en: "Tropical dry forest in Los Chenes is being cleared in large rectangles for mechanized farmland (soy, sorghum, corn). Radar sees the forest canopy disappear even through clouds.",
      es: "La selva baja de Los Chenes se desmonta en grandes rectángulos para agricultura mecanizada (soya, sorgo, maíz). El radar ve desaparecer el dosel incluso a través de las nubes.",
    },
    nature: {
      en: "Clearing cuts up the forest corridor toward the Calakmul reserve, used by jaguars and other wildlife. Maya beekeepers have taken genetically modified soy permits to court over harm to their bees and honey.",
      es: "El desmonte fragmenta el corredor de selva hacia la reserva de Calakmul, que usan jaguares y otra fauna. Apicultores mayas llevaron a los tribunales los permisos de soya transgénica por el daño a sus abejas y su miel.",
    },
    sources: [{ name: "University of Maryland GLAD, Global Forest Change (Hansen et al., Landsat)", url: "https://glad.earthengine.app/view/global-forest-change" }, { name: "CONABIO", url: "https://www.gob.mx/conabio" }],
  },
  chapala: {
    center: [-103.1, 20.22],
    changes: {
      en: "Mexico's largest lake rises and falls with rain and with how much water is taken for Guadalajara and farms; in droughts the shoreline retreats hundreds of meters.",
      es: "El lago más grande de México sube y baja con la lluvia y con el agua que se toma para Guadalajara y el campo; en las sequías la orilla retrocede cientos de metros.",
    },
    nature: {
      en: "Low water and pollution stress native fish such as charales; water hyacinth spreads over the surface. American white pelicans spend the winter on the lake.",
      es: "El nivel bajo y la contaminación afectan a peces nativos como los charales; el lirio acuático se extiende sobre el agua. Pelícanos blancos americanos pasan el invierno en el lago.",
    },
    sources: [CONAGUA, { name: "CONABIO", url: "https://www.gob.mx/conabio" }],
  },
  villahermosa: {
    center: [-92.93, 17.99],
    changes: {
      en: "Rivers, lagoons and wetlands surround the city, which floods when dams upstream release water during heavy rain (2007, 2020).",
      es: "Ríos, lagunas y humedales rodean la ciudad, que se inunda cuando las presas río arriba desfogan agua en lluvias intensas (2007, 2020).",
    },
    nature: {
      en: "The Pantanos de Centla biosphere reserve downstream is one of the largest wetlands in Mesoamerica, home to manatees, crocodiles and mangroves; drainage, oil works and cattle ranching shrink it.",
      es: "La reserva de la biosfera Pantanos de Centla, río abajo, es uno de los humedales más grandes de Mesoamérica, hogar de manatíes, cocodrilos y manglares; el drenaje, la actividad petrolera y la ganadería la reducen.",
    },
    sources: [{ name: "CONANP (Mexico's protected areas commission)", url: "https://www.gob.mx/conanp" }, CENAPRED],
  },
};

// ---- Geometry helpers ----

const RAD = Math.PI / 180;
/** Great-circle distance in km between two [lon, lat] points. */
export function distanceKm([lon1, lat1]: [number, number], [lon2, lat2]: [number, number]): number {
  const a = Math.sin(((lat2 - lat1) * RAD) / 2) ** 2 + Math.cos(lat1 * RAD) * Math.cos(lat2 * RAD) * Math.sin(((lon2 - lon1) * RAD) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(a)));
}

export const MEXICO_BBOX: [number, number, number, number] = [-118.5, 14.0, -86.0, 33.0];
// Mexico plus the seas its storms come from (same as the back end's LIVE_REGION default).
export const REGION_BBOX: [number, number, number, number] = [-125, 8, -78, 34];
export const inBbox = (lon: number, lat: number, [w, s, e, n]: [number, number, number, number]) => lon >= w && lon <= e && lat >= s && lat <= n;

/** Events that touched a zone: any of their places within `km` of the zone's center, or all of
 * them for a zone wider than 10° (the whole country). Oldest first, like a timeline. */
export function zoneHistory(events: HistoryEvent[], bbox: [number, number, number, number], km = 150): HistoryEvent[] {
  const wide = bbox[2] - bbox[0] > 10;
  const center: [number, number] = [(bbox[0] + bbox[2]) / 2, (bbox[1] + bbox[3]) / 2];
  return events
    .filter((e) => wide || e.places.some((p) => distanceKm(p, center) <= km))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** The `n` most important events of a zone (worst, then newest), oldest first for a timeline. */
export const topHistory = (events: HistoryEvent[], n = 5) =>
  [...events]
    .sort((a, b) => b.severity - a.severity || b.date.localeCompare(a.date))
    .slice(0, n)
    .sort((a, b) => a.date.localeCompare(b.date));

/** The most destructive events since `fromYear`, worst first, then newest first. */
export const mostDestructive = (events: HistoryEvent[], fromYear: number, n: number) =>
  events
    .filter((e) => +e.date.slice(0, 4) >= fromYear)
    .sort((a, b) => b.severity - a.severity || b.date.localeCompare(a.date))
    .slice(0, n);

/** The zone note for an area: by id, else the nearest zone within 100 km of its center. */
export function zoneNote(id: string, center: [number, number]): ZoneNote | undefined {
  if (ZONES[id]) return ZONES[id];
  let best: ZoneNote | undefined, bestKm = 100;
  for (const z of Object.values(ZONES)) {
    const d = distanceKm(z.center, center);
    if (d <= bestKm) [best, bestKm] = [z, d];
  }
  return best;
}
