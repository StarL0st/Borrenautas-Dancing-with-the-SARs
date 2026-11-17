// Live news in the reader's language (jopa-testing, 2026-11-17).
//
// The live sources (USGS, NASA EONET, GDACS, NOAA, and the back end's copy of them) write in
// English, and their titles come in a handful of shapes: "Magnitude 4.6 earthquake", "Flood in
// Spain", "Wildfire Red Hill, Perry, Mississippi", "Tropical Cyclone AKVAN-26", "Kanlaon Volcano,
// Philippines", "Winter Storm Warning". Each shape is recognized here and rebuilt from translated
// words. Names (of storms, fires, volcanoes, towns) stay as the source wrote them; country names
// come from Natural Earth (countries.json, set with `setCountryNames`). A title in no known shape
// keeps its English words after the event type in the reader's language ("Inundaciones: ...").
//
// The same goes for "where" (USGS "12 km NNE of Ridgecrest, CA", GDACS country lists) and for
// the parts of the details the app writes itself ("Magnitude 5.1, depth 10 km", "Orange alert").
// Free text written by a source (a NOAA headline, a USGS volcano notice) stays in English.
//
// No DOM and only type imports, so `node --test` runs it.
import type { Lang } from "./i18n";

type Words = {
  quake: string; // {mag}
  usgs: Record<string, string>; // the app's own names for the other USGS kinds
  usgsKind: Record<string, string>; // the USGS `type` in brackets
  usgsTitle: string; // {what} {kind} {mag}
  volcanoLevel: string; // {name} {level}
  levels: Record<string, string>; // USGS volcano alert levels and NOAA alert kinds share words
  fireSpot: string;
  hazards: Record<string, string>; // EONET and GDACS hazards, NOAA alert hazards; English key in lower case
  storms: Record<string, string>; // storm kinds, English key in lower case
  named: string; // {what} {name}: "Wildfire Red Hill" and the fallback
  inPlace: string; // {what} {place}: "Flood in Spain"
  volcano: string; // {name} {place}
  storm: string; // {what} {name}
  iceberg: string; // {name}
  alert: string; // {alert} {h}: NOAA "Flood Warning"
  more: string; // {list} {n}: "Mexico, Guatemala and 4 more"
  comma: string;
  dirs: Record<string, string>; // N, S, E, W
  where: string; // {km} {dir} {place}
  depth: string; // {km}
  tsunami: string;
  alertLevel: string; // {level}: GDACS "Orange alert"
  gdacsLevels: Record<string, string>;
  since: string; // {date}
  reported: string; // {who}
  firms: string; // {sat} {conf}
  confidence: Record<string, string>;
  winds: string; // {what} {kt}
  magnitude: string; // {mag}: detail "Magnitude 5.1"
};

const EN_HAZARDS = [
  "wildfire", "prescribed fire", "flood", "forest fires", "drought", "volcano", "earthquake", "landslide", "dust storm",
  "flash flood", "coastal flood", "lakeshore flood", "tsunami", "high surf", "storm surge", "hurricane", "hurricane force wind",
  "typhoon", "tropical storm", "blowing dust", "heat", "excessive heat", "extreme heat", "winter storm", "winter weather",
  "blizzard", "ice storm", "freeze", "hard freeze", "frost", "cold weather", "extreme cold", "wind chill", "lake effect snow",
  "snow squall", "heavy snow", "red flag", "fire weather", "extreme fire danger", "fire", "tornado", "severe thunderstorm",
  "high wind", "extreme wind", "eruption",
] as const;
type Hazard = (typeof EN_HAZARDS)[number];

const W: Record<Lang, Words> = {
  en: {
    quake: "Magnitude {mag} earthquake",
    usgs: {}, usgsKind: {}, usgsTitle: "{what} ({kind}), magnitude {mag}",
    volcanoLevel: "{name} volcano: alert level {level}",
    levels: {}, fireSpot: "Fire or hot spot detected", hazards: {}, storms: {},
    named: "{what} {name}", inPlace: "{what} in {place}", volcano: "{name} Volcano, {place}", storm: "{what} {name}",
    iceberg: "Iceberg {name}", alert: "{h} {alert}", more: "{list} and {n} more", comma: ", ",
    dirs: { N: "N", S: "S", E: "E", W: "W" }, where: "{km} km {dir} of {place}",
    depth: ", depth {km} km", tsunami: "Tsunami possible: see NOAA tsunami.gov", alertLevel: "{level} alert",
    gdacsLevels: {}, since: "since {date}", reported: "Reported by {who}", firms: "VIIRS {sat}, confidence {conf}. Can also be a crop burn or a gas flare.",
    confidence: {}, winds: "{what}, winds {kt} kt", magnitude: "Magnitude {mag}",
  },
  es: {
    quake: "Sismo de magnitud {mag}",
    usgs: {
      Landslide: "Deslizamiento de tierra", "Volcanic eruption": "Erupción volcánica", "Ice quake": "Sismo glaciar",
      "Ground collapse": "Hundimiento del terreno", "Shaking caused by people": "Sacudida causada por personas",
    },
    usgsKind: {
      "quarry blast": "voladura en cantera", explosion: "explosión", "mining explosion": "explosión minera", "chemical explosion": "explosión química",
      "nuclear explosion": "explosión nuclear", "experimental explosion": "explosión experimental", "accidental explosion": "explosión accidental",
      "rock burst": "estallido de roca", "induced or triggered event": "evento inducido o provocado", landslide: "deslizamiento de tierra",
      "rock slide": "deslizamiento de rocas", avalanche: "avalancha", "volcanic eruption": "erupción volcánica", "ice quake": "sismo glaciar",
      collapse: "colapso", "mine collapse": "derrumbe de mina", sinkhole: "socavón",
    },
    usgsTitle: "{what} ({kind}), magnitud {mag}",
    volcanoLevel: "Volcán {name}: nivel de alerta {level}",
    levels: { NORMAL: "normal", ADVISORY: "advertencia", WATCH: "vigilancia", WARNING: "aviso", Warning: "Aviso", Watch: "Vigilancia", Advisory: "Advertencia", Statement: "Comunicado", Emergency: "Emergencia" },
    fireSpot: "Fuego o punto de calor detectado",
    hazards: {
      wildfire: "Incendio forestal", "prescribed fire": "Quema prescrita", flood: "Inundación", "forest fires": "Incendios forestales", drought: "Sequía",
      volcano: "Volcán", earthquake: "Sismo", landslide: "Deslizamiento de tierra", "dust storm": "tormenta de polvo",
      "flash flood": "inundación repentina", "coastal flood": "inundación costera", "lakeshore flood": "inundación en la ribera del lago", tsunami: "tsunami",
      "high surf": "oleaje alto", "storm surge": "marejada ciclónica", hurricane: "huracán", "hurricane force wind": "vientos con fuerza de huracán",
      typhoon: "tifón", "tropical storm": "tormenta tropical", "blowing dust": "polvo en suspensión", heat: "calor", "excessive heat": "calor excesivo",
      "extreme heat": "calor extremo", "winter storm": "tormenta invernal", "winter weather": "tiempo invernal", blizzard: "ventisca",
      "ice storm": "tormenta de hielo", freeze: "helada", "hard freeze": "helada fuerte", frost: "escarcha", "cold weather": "frío",
      "extreme cold": "frío extremo", "wind chill": "sensación térmica muy baja", "lake effect snow": "nieve por efecto lago",
      "snow squall": "chubasco de nieve", "heavy snow": "nevada intensa", "red flag": "bandera roja (peligro de incendio)",
      "fire weather": "condiciones de incendio", "extreme fire danger": "peligro extremo de incendio", fire: "incendio", tornado: "tornado",
      "severe thunderstorm": "tormenta eléctrica severa", "high wind": "vientos fuertes", "extreme wind": "vientos extremos", eruption: "Erupción volcánica",
    } satisfies Record<Hazard, string>,
    storms: {
      "tropical cyclone": "Ciclón tropical", "tropical storm": "Tormenta tropical", "tropical depression": "Depresión tropical", typhoon: "Tifón",
      "super typhoon": "Supertifón", hurricane: "Huracán", "major hurricane": "Huracán mayor", cyclone: "Ciclón",
    },
    named: "{what}: {name}", inPlace: "{what} en {place}", volcano: "Volcán {name}, {place}", storm: "{what} {name}",
    iceberg: "Iceberg {name}", alert: "{alert} de {h}", more: "{list} y {n} más", comma: ", ",
    dirs: { N: "N", S: "S", E: "E", W: "O" }, where: "A {km} km al {dir} de {place}",
    depth: ", profundidad {km} km", tsunami: "Posible tsunami: consulte tsunami.gov de la NOAA", alertLevel: "Alerta {level}",
    gdacsLevels: { Green: "verde", Orange: "naranja", Red: "roja" }, since: "desde el {date}", reported: "Reportado por {who}",
    firms: "VIIRS {sat}, confianza {conf}. También puede ser una quema agrícola o una antorcha de gas.",
    confidence: { high: "alta", nominal: "nominal", low: "baja" }, winds: "{what}, vientos de {kt} nudos", magnitude: "Magnitud {mag}",
  },
  de: {
    quake: "Erdbeben der Stärke {mag}",
    usgs: {
      Landslide: "Erdrutsch", "Volcanic eruption": "Vulkanausbruch", "Ice quake": "Eisbeben",
      "Ground collapse": "Bodeneinbruch", "Shaking caused by people": "Vom Menschen verursachte Erschütterung",
    },
    usgsKind: {
      "quarry blast": "Steinbruchsprengung", explosion: "Explosion", "mining explosion": "Bergbausprengung", "chemical explosion": "chemische Explosion",
      "nuclear explosion": "Kernexplosion", "experimental explosion": "Versuchsexplosion", "accidental explosion": "Unfallexplosion",
      "rock burst": "Gebirgsschlag", "induced or triggered event": "induziertes oder ausgelöstes Ereignis", landslide: "Erdrutsch",
      "rock slide": "Felsrutsch", avalanche: "Lawine", "volcanic eruption": "Vulkanausbruch", "ice quake": "Eisbeben",
      collapse: "Einsturz", "mine collapse": "Grubeneinsturz", sinkhole: "Erdfall",
    },
    usgsTitle: "{what} ({kind}), Stärke {mag}",
    volcanoLevel: "Vulkan {name}: Warnstufe {level}",
    levels: { NORMAL: "normal", ADVISORY: "Hinweis", WATCH: "Vorwarnung", WARNING: "Warnung", Warning: "Warnung", Watch: "Vorwarnung", Advisory: "Hinweis", Statement: "Mitteilung", Emergency: "Notfall" },
    fireSpot: "Feuer oder Hitzepunkt erkannt",
    hazards: {
      wildfire: "Waldbrand", "prescribed fire": "Kontrolliertes Abbrennen", flood: "Überschwemmung", "forest fires": "Waldbrände", drought: "Dürre",
      volcano: "Vulkan", earthquake: "Erdbeben", landslide: "Erdrutsch", "dust storm": "Staubsturm",
      "flash flood": "Sturzflut", "coastal flood": "Küstenhochwasser", "lakeshore flood": "Seeuferhochwasser", tsunami: "Tsunami",
      "high surf": "hohe Brandung", "storm surge": "Sturmflut", hurricane: "Hurrikan", "hurricane force wind": "Wind in Orkanstärke",
      typhoon: "Taifun", "tropical storm": "Tropensturm", "blowing dust": "Staubverwehungen", heat: "Hitze", "excessive heat": "übermäßige Hitze",
      "extreme heat": "extreme Hitze", "winter storm": "Wintersturm", "winter weather": "Winterwetter", blizzard: "Blizzard",
      "ice storm": "Eissturm", freeze: "Frost", "hard freeze": "strenger Frost", frost: "Bodenfrost", "cold weather": "Kälte",
      "extreme cold": "extreme Kälte", "wind chill": "gefühlte Kälte (Windchill)", "lake effect snow": "Lake-Effect-Schnee",
      "snow squall": "Schneeböen", "heavy snow": "starker Schneefall", "red flag": "Rote Flagge (Brandgefahr)",
      "fire weather": "Waldbrandwetter", "extreme fire danger": "extreme Waldbrandgefahr", fire: "Feuer", tornado: "Tornado",
      "severe thunderstorm": "schweres Gewitter", "high wind": "Sturm", "extreme wind": "extremer Wind", eruption: "Vulkanausbruch",
    } satisfies Record<Hazard, string>,
    storms: {
      "tropical cyclone": "Tropischer Wirbelsturm", "tropical storm": "Tropensturm", "tropical depression": "Tropisches Tief", typhoon: "Taifun",
      "super typhoon": "Supertaifun", hurricane: "Hurrikan", "major hurricane": "Schwerer Hurrikan", cyclone: "Zyklon",
    },
    named: "{what}: {name}", inPlace: "{what}: {place}", volcano: "Vulkan {name}, {place}", storm: "{what} {name}",
    iceberg: "Eisberg {name}", alert: "{alert}: {h}", more: "{list} und {n} weitere", comma: ", ",
    dirs: { N: "N", S: "S", E: "O", W: "W" }, where: "{km} km {dir} von {place}",
    depth: ", Tiefe {km} km", tsunami: "Tsunami möglich: siehe tsunami.gov der NOAA", alertLevel: "Alarmstufe {level}",
    gdacsLevels: { Green: "Grün", Orange: "Orange", Red: "Rot" }, since: "seit {date}", reported: "Gemeldet von {who}",
    firms: "VIIRS {sat}, Konfidenz {conf}. Kann auch ein Feldfeuer oder eine Gasfackel sein.",
    confidence: { high: "hoch", nominal: "nominal", low: "niedrig" }, winds: "{what}, Wind {kt} kn", magnitude: "Stärke {mag}",
  },
  fr: {
    quake: "Séisme de magnitude {mag}",
    usgs: {
      Landslide: "Glissement de terrain", "Volcanic eruption": "Éruption volcanique", "Ice quake": "Séisme glaciaire",
      "Ground collapse": "Effondrement du sol", "Shaking caused by people": "Secousse d'origine humaine",
    },
    usgsKind: {
      "quarry blast": "tir de carrière", explosion: "explosion", "mining explosion": "explosion minière", "chemical explosion": "explosion chimique",
      "nuclear explosion": "explosion nucléaire", "experimental explosion": "explosion expérimentale", "accidental explosion": "explosion accidentelle",
      "rock burst": "coup de terrain", "induced or triggered event": "événement induit ou déclenché", landslide: "glissement de terrain",
      "rock slide": "éboulement", avalanche: "avalanche", "volcanic eruption": "éruption volcanique", "ice quake": "séisme glaciaire",
      collapse: "effondrement", "mine collapse": "effondrement de mine", sinkhole: "affaissement karstique",
    },
    usgsTitle: "{what} ({kind}), magnitude {mag}",
    volcanoLevel: "Volcan {name} : niveau d'alerte {level}",
    levels: { NORMAL: "normal", ADVISORY: "avis", WATCH: "veille", WARNING: "avertissement", Warning: "Avertissement", Watch: "Veille", Advisory: "Avis", Statement: "Bulletin", Emergency: "Urgence" },
    fireSpot: "Feu ou point chaud détecté",
    hazards: {
      wildfire: "Feu de forêt", "prescribed fire": "Brûlage dirigé", flood: "Inondation", "forest fires": "Feux de forêt", drought: "Sécheresse",
      volcano: "Volcan", earthquake: "Séisme", landslide: "Glissement de terrain", "dust storm": "tempête de poussière",
      "flash flood": "crue soudaine", "coastal flood": "inondation côtière", "lakeshore flood": "inondation riveraine de lac", tsunami: "tsunami",
      "high surf": "fortes vagues", "storm surge": "onde de tempête", hurricane: "ouragan", "hurricane force wind": "vents de force ouragan",
      typhoon: "typhon", "tropical storm": "tempête tropicale", "blowing dust": "poussière soulevée par le vent", heat: "chaleur",
      "excessive heat": "chaleur excessive", "extreme heat": "chaleur extrême", "winter storm": "tempête hivernale", "winter weather": "temps hivernal",
      blizzard: "blizzard", "ice storm": "tempête de verglas", freeze: "gel", "hard freeze": "gel intense", frost: "gelée", "cold weather": "froid",
      "extreme cold": "froid extrême", "wind chill": "refroidissement éolien", "lake effect snow": "neige par effet de lac",
      "snow squall": "bourrasques de neige", "heavy snow": "fortes chutes de neige", "red flag": "drapeau rouge (risque d'incendie)",
      "fire weather": "conditions propices aux incendies", "extreme fire danger": "danger d'incendie extrême", fire: "incendie", tornado: "tornade",
      "severe thunderstorm": "orage violent", "high wind": "vents violents", "extreme wind": "vents extrêmes", eruption: "Éruption volcanique",
    } satisfies Record<Hazard, string>,
    storms: {
      "tropical cyclone": "Cyclone tropical", "tropical storm": "Tempête tropicale", "tropical depression": "Dépression tropicale", typhoon: "Typhon",
      "super typhoon": "Super typhon", hurricane: "Ouragan", "major hurricane": "Ouragan majeur", cyclone: "Cyclone",
    },
    named: "{what} : {name}", inPlace: "{what} : {place}", volcano: "Volcan {name}, {place}", storm: "{what} {name}",
    iceberg: "Iceberg {name}", alert: "{alert} {de}{h}", more: "{list} et {n} autres", comma: ", ",
    dirs: { N: "N", S: "S", E: "E", W: "O" }, where: "{km} km {dir} de {place}",
    depth: ", profondeur {km} km", tsunami: "Tsunami possible : voir tsunami.gov de la NOAA", alertLevel: "Alerte {level}",
    gdacsLevels: { Green: "verte", Orange: "orange", Red: "rouge" }, since: "depuis le {date}", reported: "Signalé par {who}",
    firms: "VIIRS {sat}, confiance {conf}. Il peut aussi s'agir d'un brûlage agricole ou d'une torchère.",
    confidence: { high: "élevée", nominal: "nominale", low: "faible" }, winds: "{what}, vents de {kt} nœuds", magnitude: "Magnitude {mag}",
  },
  ja: {
    quake: "マグニチュード{mag}の地震",
    usgs: {
      Landslide: "地すべり", "Volcanic eruption": "火山噴火", "Ice quake": "氷震", "Ground collapse": "地盤の崩落", "Shaking caused by people": "人為的な揺れ",
    },
    usgsKind: {
      "quarry blast": "採石場の発破", explosion: "爆発", "mining explosion": "鉱山の発破", "chemical explosion": "化学爆発",
      "nuclear explosion": "核爆発", "experimental explosion": "実験爆発", "accidental explosion": "事故による爆発",
      "rock burst": "山はね", "induced or triggered event": "誘発地震", landslide: "地すべり", "rock slide": "岩盤すべり", avalanche: "雪崩",
      "volcanic eruption": "火山噴火", "ice quake": "氷震", collapse: "崩落", "mine collapse": "鉱山の崩落", sinkhole: "陥没穴",
    },
    usgsTitle: "{what}（{kind}）、マグニチュード{mag}",
    volcanoLevel: "{name}火山：警戒レベル「{level}」",
    levels: { NORMAL: "平常", ADVISORY: "注意報", WATCH: "警戒情報", WARNING: "警報", Warning: "警報", Watch: "警戒情報", Advisory: "注意報", Statement: "情報", Emergency: "緊急警報" },
    fireSpot: "火災または高温地点を検知",
    hazards: {
      wildfire: "山火事", "prescribed fire": "計画的な野焼き", flood: "洪水", "forest fires": "森林火災", drought: "干ばつ", volcano: "火山",
      earthquake: "地震", landslide: "地すべり", "dust storm": "砂じん嵐", "flash flood": "鉄砲水", "coastal flood": "沿岸浸水",
      "lakeshore flood": "湖岸浸水", tsunami: "津波", "high surf": "高波", "storm surge": "高潮", hurricane: "ハリケーン",
      "hurricane force wind": "ハリケーン級の暴風", typhoon: "台風", "tropical storm": "熱帯暴風雨", "blowing dust": "砂じん", heat: "高温",
      "excessive heat": "酷暑", "extreme heat": "猛暑", "winter storm": "冬の嵐", "winter weather": "冬の荒天", blizzard: "暴風雪",
      "ice storm": "着氷性の嵐", freeze: "凍結", "hard freeze": "強い凍結", frost: "霜", "cold weather": "低温", "extreme cold": "極寒",
      "wind chill": "体感温度の低下", "lake effect snow": "湖水効果雪", "snow squall": "突風を伴う吹雪", "heavy snow": "大雪",
      "red flag": "レッドフラッグ（火災危険）", "fire weather": "火災気象", "extreme fire danger": "極めて高い火災危険度", fire: "火災",
      tornado: "竜巻", "severe thunderstorm": "激しい雷雨", "high wind": "強風", "extreme wind": "猛烈な風", eruption: "火山噴火",
    } satisfies Record<Hazard, string>,
    storms: {
      "tropical cyclone": "熱帯サイクロン", "tropical storm": "熱帯暴風雨", "tropical depression": "熱帯低気圧", typhoon: "台風",
      "super typhoon": "スーパー台風", hurricane: "ハリケーン", "major hurricane": "大型ハリケーン", cyclone: "サイクロン",
    },
    named: "{what}：{name}", inPlace: "{place}で{what}", volcano: "{name}火山（{place}）", storm: "{what} {name}",
    iceberg: "氷山 {name}", alert: "{h}{alert}", more: "{list}ほか{n}か国", comma: "、",
    dirs: { N: "北", S: "南", E: "東", W: "西" }, where: "{place}の{dir}{km} km",
    depth: "、深さ{km} km", tsunami: "津波の可能性：NOAAのtsunami.govを参照", alertLevel: "{level}警報",
    gdacsLevels: { Green: "緑", Orange: "オレンジ", Red: "赤" }, since: "{date}から", reported: "報告元：{who}",
    firms: "VIIRS {sat}、信頼度{conf}。農地の野焼きやガスフレアの場合もあります。",
    confidence: { high: "高", nominal: "標準", low: "低" }, winds: "{what}、風速{kt}ノット", magnitude: "マグニチュード{mag}",
  },
};

const fill = (s: string, vars: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ""));

// ---- Country names (Natural Earth) ----

type Names = { en: string } & Partial<Record<Lang, string>>;
const NAMES = new Map<string, Names>();
// How the feeds spell some countries, and Natural Earth's English name for them.
const ALIAS: Record<string, string> = {
  "United States": "United States of America", USA: "United States of America", "Democratic Republic of Congo": "Democratic Republic of the Congo",
  "DR Congo": "Democratic Republic of the Congo", "Republic of Congo": "Republic of the Congo", Türkiye: "Turkey", Czechia: "Czech Republic",
  "Bosnia & Herzegovina": "Bosnia and Herzegovina", "Timor-Leste": "East Timor", Bahamas: "The Bahamas", Gambia: "The Gambia",
  "Côte d'Ivoire": "Ivory Coast", "Cote d'Ivoire": "Ivory Coast", China: "People's Republic of China", "Viet Nam": "Vietnam",
  "Lao PDR": "Laos", "Russian Federation": "Russia", "Syrian Arab Republic": "Syria", "Iran (Islamic Republic of)": "Iran",
};

/** The countries the page knows (countries.json): their names in every language. */
export function setCountryNames(rows: Names[]) {
  NAMES.clear();
  for (const r of rows) NAMES.set(r.en, r);
}

const tidy = (s: string) => s.replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();

/** A country's name in `lang`, or the name as given when it is not a known country. */
export function countryName(name: string, lang: Lang): string {
  const clean = tidy(name);
  const row = NAMES.get(ALIAS[clean] ?? clean);
  return (row && row[lang]) || clean;
}
const isCountry = (name: string) => NAMES.has(ALIAS[tidy(name)] ?? tidy(name));

// "Mexico, Guatemala and 4 more", one country or a list of them; anything else as given.
// `lenient`: the text is known to name countries (GDACS lists, "Flood in ..."), so each known one
// is translated even if another is not in the list. Otherwise every part must be a country: in
// "Perry, Georgia" Georgia is a US state.
function places(text: string, lang: Lang, lenient = false): string {
  const w = W[lang];
  const more = /^(.*) and (\d+) more$/.exec(text);
  const list = (more ? more[1] : text).split(",").map((s) => s.trim()).filter(Boolean);
  if (!list.length || !(lenient || more ? list.some(isCountry) : list.every(isCountry))) return text;
  const named = list.map((c) => countryName(c, lang)).join(w.comma);
  return more ? fill(w.more, { list: named, n: more[2] }) : named;
}

// ---- Titles ----

// French drops the "e" of "de" before a vowel: "Veille d'inondation".
const de = (lang: Lang, next: string) => (lang === "fr" ? (/^[aeiouyéèêh]/i.test(next) ? "d'" : "de ") : "");

// Spanish numbers as in Mexico, the app's region: 4.6, not 4,6.
const LOCALE: Record<Lang, string> = { en: "en", es: "es-MX", de: "de", fr: "fr", ja: "ja" };
function number(value: string, lang: Lang): string {
  const n = Number(value);
  return Number.isFinite(n) && value.trim() !== "" ? new Intl.NumberFormat(LOCALE[lang], { maximumFractionDigits: 2 }).format(n) : value;
}

const STORM = /^(super typhoon|major hurricane|tropical cyclone|tropical storm|tropical depression|typhoon|hurricane|cyclone)\b\s*(.*)$/i;
const NOAA = /^(.*?)\s+(Warning|Watch|Advisory|Statement|Emergency)$/;

/**
 * What happened, in `lang`. `kind` names an event type in that language (filters.ts
 * shortLabel); it heads titles in no known shape.
 */
export function liveTitle(p: { title: string; category: string }, lang: Lang, kind: (category: string) => string = (c) => c): string {
  const title = tidy(p.title).replace(/^(.+ in .+?) \d{5,}$/, "$1"); // EONET adds its own number: "Flood in Spain 1104287"
  if (lang === "en") return title;
  const w = W[lang];
  const h = (en: string) => w.hazards[en.toLowerCase()];
  let m: RegExpExecArray | null;

  if ((m = /^Magnitude (\S+) earthquake$/.exec(title))) return fill(w.quake, { mag: number(m[1], lang) });
  if ((m = /^(.+?) \((.+)\), magnitude (\S+)$/.exec(title)) && w.usgs[m[1]])
    return fill(w.usgsTitle, { what: w.usgs[m[1]], kind: w.usgsKind[m[2].toLowerCase()] ?? m[2], mag: number(m[3], lang) });
  if ((m = /^(.+) volcano: alert level (\w+)$/.exec(title))) return fill(w.volcanoLevel, { name: m[1], level: w.levels[m[2]] ?? m[2] });
  if (title === "Fire or hot spot detected") return w.fireSpot;
  if ((m = /^(Flood|Forest fires|Wildfires?|Drought|Landslide|Earthquake) in (.+)$/i.exec(title))) {
    const what = h(/^wildfires$/i.test(m[1]) ? "forest fires" : m[1]);
    return fill(w.inPlace, { what, place: places(m[2], lang, true) });
  }
  if ((m = /^(Wildfire|Prescribed Fire|Eruption) (.+)$/i.exec(title))) return fill(w.named, { what: h(m[1]), name: m[2] });
  if ((m = /^(.+) Volcano, (.+)$/.exec(title))) return fill(w.volcano, { name: m[1], place: places(m[2], lang, true) });
  // NOAA alerts first: "Tropical Storm Warning" is an alert, "Tropical Storm Pena" a storm.
  if ((m = NOAA.exec(title)) && h(m[1])) {
    // Inside a sentence, Spanish and French hazards start in lower case ("Aviso de inundación").
    const hazard = lang === "es" || lang === "fr" ? h(m[1])[0].toLowerCase() + h(m[1]).slice(1) : h(m[1]);
    return fill(w.alert, { alert: w.levels[m[2]], h: hazard, de: de(lang, hazard) });
  }
  if ((m = STORM.exec(title))) return fill(w.storm, { what: w.storms[m[1].toLowerCase()], name: m[2] }).trim();
  if ((m = /^Iceberg (.+)$/i.exec(title))) return fill(w.iceberg, { name: m[1] });
  return fill(w.named, { what: kind(p.category), name: title });
}

/** Where, in `lang`: USGS distances ("12 km NNE of Ridgecrest, CA") and country names. */
export function livePlace(place: string, lang: Lang): string {
  const text = tidy(place).replace(/^(.+?) \d{5,}$/, "$1");
  if (lang === "en") return text;
  const w = W[lang];
  const m = /^(\d+(?:\.\d+)?) km ([NSEW]{1,3}) of (.+)$/.exec(text);
  if (m) return fill(w.where, { km: number(m[1], lang), dir: [...m[2]].map((c) => w.dirs[c]).join(""), place: places(m[3], lang) });
  return places(text, lang);
}

/** The details, in `lang`: the parts the app writes itself are translated, the rest kept. */
export function liveDetail(detail: string, lang: Lang): string {
  if (lang === "en" || !detail) return detail;
  const w = W[lang];
  return detail
    .split(" · ")
    .map((part) => {
      let m: RegExpExecArray | null;
      if ((m = /^Magnitude (\S+?)(?:, depth (\d+) km)?$/.exec(part))) return fill(w.magnitude, { mag: number(m[1], lang) }) + (m[2] ? fill(w.depth, { km: m[2] }) : "");
      if (part === "Tsunami possible: see NOAA tsunami.gov") return w.tsunami;
      if ((m = /^(Green|Orange|Red) alert$/.exec(part))) return fill(w.alertLevel, { level: w.gdacsLevels[m[1]] });
      if ((m = /^since (\d{4}-\d\d-\d\d)$/.exec(part))) return fill(w.since, { date: m[1] });
      if ((m = /^Reported by (.+)$/.exec(part))) return fill(w.reported, { who: m[1] });
      if ((m = /^VIIRS (\S+), confidence (\w+)\. Can also be a crop burn or a gas flare\.$/.exec(part)))
        return fill(w.firms, { sat: m[1], conf: w.confidence[m[2]] ?? m[2] });
      if ((m = /^(Hurricane|Tropical storm|Tropical depression|Tropical cyclone)(?:, winds (\d+) kt)?$/.exec(part)))
        return m[2] ? fill(w.winds, { what: w.storms[m[1].toLowerCase()], kt: m[2] }) : w.storms[m[1].toLowerCase()];
      return part;
    })
    .join(" · ");
}
