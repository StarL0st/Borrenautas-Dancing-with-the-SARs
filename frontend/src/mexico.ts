// Mexico context data (jopa-testing): remarkable past events and notes on what changed in each
// study zone. Pure data and helpers, no DOM, so `node --test` can load it.
//
// Text is in English and Spanish ({ en, es }), plus French and Japanese (jopa-testing, 2026-11-17);
// German falls back to English. Every entry names
// its sources. Figures are kept to well-documented ones, and stated as ranges where sources
// differ. VERIFY before submission: see frontend/JOPA_TESTING.md, "Facts to double-check".
//
// Space Apps rules: NASA data first (EONET, FIRMS, GIBS, Earth Observatory), then other open
// public sources with credit (USGS, NOAA, Smithsonian GVP, Mexico's SSN, CENAPRED, CONAGUA,
// CONABIO, CONANP, IUCN). No logos, no implied endorsement.

// French and Japanese (jopa-testing, 2026-11-17) are optional: a text without them shows in English.
export type Text = { en: string; es: string; fr?: string; ja?: string };
export const tx = (s: Text, lang: string) => (lang === "es" ? s.es : lang === "fr" ? s.fr ?? s.en : lang === "ja" ? s.ja ?? s.en : s.en);

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
    title: { en: "Ixtoc I oil well blowout", es: "Derrame del pozo Ixtoc I", fr: "Éruption du puits de pétrole Ixtoc I", ja: "イストクI油井の暴噴" },
    impact: {
      en: "An offshore well in the Bay of Campeche blew out and leaked oil for about nine months, one of the largest accidental spills on record. Oil reached the coasts of Campeche, Tamaulipas and Texas.",
      es: "Un pozo marino en la Sonda de Campeche se descontroló y derramó petróleo durante unos nueve meses, uno de los mayores derrames accidentales registrados. El petróleo llegó a las costas de Campeche, Tamaulipas y Texas.",
      fr: "Un puits en mer dans la baie de Campeche a éclaté et laissé fuir du pétrole pendant environ neuf mois, l'une des plus grandes marées noires accidentelles jamais enregistrées. Le pétrole a atteint les côtes du Campeche, du Tamaulipas et du Texas.",
      ja: "カンペチェ湾の海底油井が暴噴し、約9か月にわたって石油が流れ出ました。記録に残る最大級の事故による流出です。石油はカンペチェ州、タマウリパス州、テキサス州の海岸に達しました。",
    },
    places: [[-92.33, 19.41]],
    sources: [{ name: "NOAA Office of Response and Restoration", url: "https://response.restoration.noaa.gov/" }],
  },
  {
    id: "chichon-1982", date: "1982-03-28", type: "volcanoes", severity: 3,
    title: { en: "El Chichón eruption", es: "Erupción del Chichón", fr: "Éruption d'El Chichón", ja: "エル・チチョン火山の噴火" },
    impact: {
      en: "Explosive eruptions destroyed nearby villages in Chiapas and killed about 2,000 people. The sulfur cloud reached the stratosphere and was tracked by NASA satellites around the world.",
      es: "Erupciones explosivas destruyeron poblados cercanos en Chiapas y causaron unas 2,000 muertes. La nube de azufre llegó a la estratosfera y los satélites de la NASA la siguieron alrededor del mundo.",
      fr: "Des éruptions explosives ont détruit des villages voisins au Chiapas et tué environ 2 000 personnes. Le nuage de soufre a atteint la stratosphère et a été suivi autour du monde par les satellites de la NASA.",
      ja: "爆発的な噴火でチアパス州の近くの村々が破壊され、約2,000人が亡くなりました。硫黄の雲は成層圏に達し、NASAの衛星が世界中でその動きを追いました。",
    },
    places: [[-93.23, 17.36]],
    sources: [GVP, EO],
  },
  {
    id: "michoacan-1985", date: "1985-09-19", type: "earthquakes", severity: 3,
    title: { en: "Magnitude 8.0 Michoacán earthquake", es: "Sismo de magnitud 8.0 de Michoacán", fr: "Séisme de magnitude 8,0 du Michoacán", ja: "マグニチュード8.0のミチョアカン地震" },
    impact: {
      en: "Struck off the Michoacán coast, but the soft old lakebed under Mexico City amplified the shaking: hundreds of buildings collapsed and thousands died (the official count is about 10,000; other estimates are higher). It led to Mexico's civil protection system.",
      es: "Ocurrió frente a la costa de Michoacán, pero el suelo blando del antiguo lago bajo la Ciudad de México amplificó el movimiento: cientos de edificios colapsaron y murieron miles de personas (la cifra oficial es de unas 10,000; otras estimaciones son mayores). De ahí nació el sistema de protección civil.",
      fr: "Il a frappé au large de la côte du Michoacán, mais le sol mou de l'ancien lac sous Mexico a amplifié les secousses : des centaines de bâtiments se sont effondrés et des milliers de personnes sont mortes (le bilan officiel est d'environ 10 000 ; d'autres estimations sont plus élevées). Il a donné naissance au système de protection civile du Mexique.",
      ja: "震源はミチョアカン州の沖でしたが、メキシコシティの下にある昔の湖のやわらかい地盤が揺れを強め、数百の建物が倒れて数千人が亡くなりました（公式の死者数は約1万人で、もっと多いとする推計もあります）。これをきっかけにメキシコの市民保護制度ができました。",
    },
    places: [[-102.53, 18.19], [-99.13, 19.43]],
    sources: [USGS, SSN],
  },
  {
    id: "gilbert-1988", date: "1988-09-14", type: "hurricanes", severity: 3,
    title: { en: "Hurricane Gilbert", es: "Huracán Gilberto", fr: "Ouragan Gilbert", ja: "ハリケーン・ギルバート" },
    impact: {
      en: "A Category 5 hurricane that hit the Yucatán Peninsula, then brought deadly floods to Monterrey days later. About 200 people died in Mexico, most of them in Monterrey.",
      es: "Huracán categoría 5 que golpeó la península de Yucatán y días después causó inundaciones mortales en Monterrey. Murieron unas 200 personas en México, la mayoría en Monterrey.",
      fr: "Un ouragan de catégorie 5 qui a frappé la péninsule du Yucatán, puis provoqué des inondations meurtrières à Monterrey quelques jours plus tard. Environ 200 personnes sont mortes au Mexique, la plupart à Monterrey.",
      ja: "カテゴリー5のハリケーンがユカタン半島を襲い、数日後にはモンテレイで死者を出す洪水を起こしました。メキシコで約200人が亡くなり、その多くがモンテレイでした。",
    },
    places: [[-86.9, 20.8], [-100.31, 25.67]],
    sources: [NHC],
  },
  {
    id: "pauline-1997", date: "1997-10-08", type: "hurricanes", severity: 3,
    title: { en: "Hurricane Pauline", es: "Huracán Paulina", fr: "Ouragan Pauline", ja: "ハリケーン・ポーリン" },
    impact: {
      en: "Torrential rain caused flash floods and mudslides in Acapulco and the coasts of Guerrero and Oaxaca; more than 200 people died.",
      es: "Lluvias torrenciales provocaron inundaciones repentinas y deslaves en Acapulco y las costas de Guerrero y Oaxaca; murieron más de 200 personas.",
      fr: "Des pluies torrentielles ont provoqué des crues soudaines et des coulées de boue à Acapulco et sur les côtes du Guerrero et de l'Oaxaca ; plus de 200 personnes sont mortes.",
      ja: "豪雨によりアカプルコとゲレロ州・オアハカ州の沿岸で鉄砲水と土石流が起き、200人以上が亡くなりました。",
    },
    places: [[-99.88, 16.85], [-96.5, 15.8]],
    sources: [NHC],
  },
  {
    id: "wilma-2005", date: "2005-10-21", type: "hurricanes", severity: 3,
    title: { en: "Hurricane Wilma", es: "Huracán Wilma", fr: "Ouragan Wilma", ja: "ハリケーン・ウィルマ" },
    impact: {
      en: "Stalled over Cozumel and Cancún as a major hurricane for two days or more, wrecking hotels, homes and beaches and stripping mangroves and coral reefs.",
      es: "Se estancó sobre Cozumel y Cancún como huracán mayor durante dos días o más, destruyendo hoteles, viviendas y playas, y dañando manglares y arrecifes.",
      fr: "Il est resté au-dessus de Cozumel et Cancún comme ouragan majeur pendant deux jours ou plus, ravageant hôtels, maisons et plages, et abîmant mangroves et récifs coralliens.",
      ja: "強い勢力のままコスメル島とカンクンの上に2日以上とどまり、ホテルや家、浜辺を壊し、マングローブやサンゴ礁を傷つけました。",
    },
    places: [[-86.95, 20.5], [-86.85, 21.16]],
    sources: [NHC, EO],
  },
  {
    id: "tabasco-2007", date: "2007-10-28", type: "floods", severity: 3,
    title: { en: "Tabasco floods", es: "Inundaciones de Tabasco", fr: "Inondations du Tabasco", ja: "タバスコ州の洪水" },
    impact: {
      en: "Days of heavy rain overflowed the Grijalva and Usumacinta rivers: up to about 80% of the state, including much of Villahermosa, was under water and about a million people were affected. A landslide days later blocked the Grijalva near Juan de Grijalva, Chiapas.",
      es: "Días de lluvia intensa desbordaron los ríos Grijalva y Usumacinta: hasta cerca del 80% del estado, incluida buena parte de Villahermosa, quedó bajo el agua y alrededor de un millón de personas resultaron afectadas. Días después un deslave tapó el Grijalva cerca de Juan de Grijalva, Chiapas.",
      fr: "Des jours de fortes pluies ont fait déborder les fleuves Grijalva et Usumacinta : jusqu'à environ 80 % de l'État, dont une grande partie de Villahermosa, a été sous l'eau et environ un million de personnes ont été touchées. Quelques jours plus tard, un glissement de terrain a bloqué le Grijalva près de Juan de Grijalva, au Chiapas.",
      ja: "何日も続いた大雨でグリハルバ川とウスマシンタ川があふれ、州の最大約80%（ビジャエルモサの大部分を含む）が水につかり、約100万人が被災しました。数日後には、チアパス州フアン・デ・グリハルバ付近で地すべりがグリハルバ川をせき止めました。",
    },
    places: [[-92.93, 17.99], [-93.4, 17.4]],
    sources: [EO, CENAPRED],
  },
  {
    id: "piedrasnegras-2007", date: "2007-04-24", type: "storms", severity: 1,
    title: { en: "Piedras Negras tornado", es: "Tornado de Piedras Negras", fr: "Tornade de Piedras Negras", ja: "ピエドラス・ネグラスの竜巻" },
    impact: {
      en: "A strong tornado crossed from Texas into Piedras Negras, Coahuila, destroying homes and killing three people there and seven more across the river in Eagle Pass, Texas. Tornadoes are rare but not unknown in northern Mexico.",
      es: "Un tornado fuerte cruzó de Texas a Piedras Negras, Coahuila, destruyó viviendas y mató a tres personas ahí y a siete más al otro lado del río, en Eagle Pass, Texas. Los tornados son raros pero no desconocidos en el norte de México.",
      fr: "Une forte tornade est passée du Texas à Piedras Negras, au Coahuila, détruisant des maisons et tuant trois personnes sur place et sept autres de l'autre côté du fleuve, à Eagle Pass (Texas). Les tornades sont rares mais pas inconnues dans le nord du Mexique.",
      ja: "強い竜巻がテキサス州からコアウイラ州ピエドラス・ネグラスへ渡り、家を壊して3人が死亡、川の向こうのテキサス州イーグルパスでも7人が亡くなりました。メキシコ北部では竜巻はまれですが、起こらないわけではありません。",
    },
    places: [[-100.52, 28.7]],
    sources: [CONAGUA],
  },
  {
    id: "alex-2010", date: "2010-06-30", type: "hurricanes", severity: 2,
    title: { en: "Hurricane Alex", es: "Huracán Alex", fr: "Ouragan Alex", ja: "ハリケーン・アレックス" },
    impact: {
      en: "Record rain flooded Monterrey: the Santa Catarina river destroyed roads and bridges across the city.",
      es: "Lluvias récord inundaron Monterrey: el río Santa Catarina destruyó calles y puentes de la ciudad.",
      fr: "Des pluies record ont inondé Monterrey : la rivière Santa Catarina a détruit routes et ponts dans toute la ville.",
      ja: "記録的な雨がモンテレイを水びたしにし、サンタ・カタリナ川が市内の道路や橋を壊しました。",
    },
    places: [[-97.7, 24.3], [-100.31, 25.67]],
    sources: [NHC],
  },
  {
    id: "ingrid-manuel-2013", date: "2013-09-14", type: "hurricanes", severity: 3,
    title: { en: "Ingrid and Manuel, two storms at once", es: "Ingrid y Manuel, dos tormentas a la vez", fr: "Ingrid et Manuel, deux tempêtes à la fois", ja: "イングリッドとマヌエル、2つの嵐が同時に" },
    impact: {
      en: "Two storms hit both coasts at the same time. Floods and landslides killed well over a hundred people; a landslide buried much of La Pintada, Guerrero, and Acapulco was cut off.",
      es: "Dos tormentas golpearon ambas costas al mismo tiempo. Inundaciones y deslaves causaron bastante más de cien muertes; un deslave sepultó gran parte de La Pintada, Guerrero, y Acapulco quedó incomunicado.",
      fr: "Deux tempêtes ont frappé les deux côtes en même temps. Inondations et glissements de terrain ont fait bien plus d'une centaine de morts ; un glissement a enseveli une grande partie de La Pintada, au Guerrero, et Acapulco a été coupée du monde.",
      ja: "2つの嵐が同時に両側の海岸を襲いました。洪水と地すべりで100人をはるかに超える人が亡くなり、ゲレロ州ラ・ピンタダの大部分が土砂に埋まり、アカプルコは孤立しました。",
    },
    places: [[-100.33, 17.36], [-99.88, 16.85], [-97.9, 22.2]],
    sources: [NHC, CENAPRED],
  },
  {
    id: "sonora-2014", date: "2014-08-06", type: "industrial", severity: 2,
    title: { en: "Sonora River mine spill", es: "Derrame minero en el río Sonora", fr: "Déversement minier dans la rivière Sonora", ja: "ソノラ川の鉱山流出事故" },
    impact: {
      en: "About 40,000 cubic meters of acidic copper sulfate solution leaked from the Buenavista del Cobre mine at Cananea into the Bacanuchi and Sonora rivers, cutting off drinking and farm water for towns downstream.",
      es: "Unos 40,000 metros cúbicos de solución ácida de sulfato de cobre se derramaron de la mina Buenavista del Cobre, en Cananea, a los ríos Bacanuchi y Sonora, y dejaron sin agua potable y de riego a los pueblos río abajo.",
      fr: "Environ 40 000 mètres cubes d'une solution acide de sulfate de cuivre ont fui de la mine Buenavista del Cobre, à Cananea, dans les rivières Bacanuchi et Sonora, privant d'eau potable et d'irrigation les villes en aval.",
      ja: "カナネアのブエナビスタ・デル・コブレ鉱山から、酸性の硫酸銅溶液約4万立方メートルがバカヌチ川とソノラ川に流れ出し、下流の町では飲み水と農業用水が使えなくなりました。",
    },
    places: [[-110.3, 30.98], [-110.2, 30.0]],
    sources: [{ name: "SEMARNAT / PROFEPA (Mexico's environment ministry)", url: "https://www.gob.mx/semarnat" }],
  },
  {
    id: "patricia-2015", date: "2015-10-23", type: "hurricanes", severity: 2,
    title: { en: "Hurricane Patricia", es: "Huracán Patricia", fr: "Ouragan Patricia", ja: "ハリケーン・パトリシア" },
    impact: {
      en: "The strongest hurricane ever measured in the Western Hemisphere at its peak. It weakened to Category 4 before landfall on the Jalisco coast and hit a thinly populated area, so damage was smaller than feared, but forests were flattened.",
      es: "El huracán más intenso jamás medido en el hemisferio occidental en su punto máximo. Se debilitó a categoría 4 antes de tocar tierra en la costa de Jalisco, en una zona poco poblada, así que los daños fueron menores de lo temido, aunque derribó bosques enteros.",
      fr: "L'ouragan le plus puissant jamais mesuré dans l'hémisphère occidental à son pic. Il s'est affaibli en catégorie 4 avant de toucher terre sur la côte du Jalisco, dans une zone peu peuplée : les dégâts ont été moindres que redouté, mais des forêts ont été rasées.",
      ja: "最盛期には西半球で観測史上最も強いハリケーンでした。カテゴリー4に弱まってからハリスコ州の海岸の人の少ない地域に上陸したため、被害は心配されたほど大きくありませんでしたが、森がなぎ倒されました。",
    },
    places: [[-105.0, 19.4]],
    sources: [NHC, EO],
  },
  {
    id: "chiapas-2017", date: "2017-09-07", type: "earthquakes", severity: 3,
    title: { en: "Magnitude 8.2 Chiapas earthquake", es: "Sismo de magnitud 8.2 de Chiapas", fr: "Séisme de magnitude 8,2 du Chiapas", ja: "マグニチュード8.2のチアパス地震" },
    impact: {
      en: "The strongest quake in Mexico in a century, offshore in the Gulf of Tehuantepec. Juchitán, Oaxaca, was badly damaged and about a hundred people died.",
      es: "El sismo más fuerte en México en un siglo, mar adentro en el golfo de Tehuantepec. Juchitán, Oaxaca, sufrió graves daños y murieron alrededor de cien personas.",
      fr: "Le plus fort séisme au Mexique depuis un siècle, au large dans le golfe de Tehuantepec. Juchitán, en Oaxaca, a été gravement endommagée et une centaine de personnes sont mortes.",
      ja: "テワンテペク湾の沖で起きた、メキシコでこの100年で最も強い地震です。オアハカ州フチタンが大きな被害を受け、約100人が亡くなりました。",
    },
    places: [[-93.9, 15.02], [-95.02, 16.43]],
    sources: [USGS, SSN],
  },
  {
    id: "puebla-2017", date: "2017-09-19", type: "earthquakes", severity: 3,
    title: { en: "Magnitude 7.1 Puebla–Morelos earthquake", es: "Sismo de magnitud 7.1 de Puebla–Morelos", fr: "Séisme de magnitude 7,1 de Puebla–Morelos", ja: "マグニチュード7.1のプエブラ・モレロス地震" },
    impact: {
      en: "On the anniversary of 1985, buildings collapsed in Mexico City, Morelos and Puebla; about 370 people died. Radar satellites mapped the damage in the days after.",
      es: "En el aniversario de 1985 colapsaron edificios en la Ciudad de México, Morelos y Puebla; murieron unas 370 personas. Los satélites de radar mapearon los daños en los días siguientes.",
      fr: "Le jour anniversaire de 1985, des bâtiments se sont effondrés à Mexico, au Morelos et à Puebla ; environ 370 personnes sont mortes. Des satellites radar ont cartographié les dégâts dans les jours qui ont suivi.",
      ja: "1985年の地震と同じ日に、メキシコシティ、モレロス州、プエブラ州で建物が倒れ、約370人が亡くなりました。その後数日のうちに、レーダー衛星が被害を地図にしました。",
    },
    places: [[-98.49, 18.55], [-99.13, 19.43], [-98.2, 19.04]],
    sources: [USGS, SSN, EO],
  },
  {
    id: "tlahuelilpan-2019", date: "2019-01-18", type: "industrial", severity: 3,
    title: { en: "Tlahuelilpan pipeline explosion", es: "Explosión del ducto en Tlahuelilpan", fr: "Explosion de l'oléoduc de Tlahuelilpan", ja: "トラウエリルパンのパイプライン爆発" },
    impact: {
      en: "An illegally tapped fuel pipeline in Hidalgo exploded while people collected gasoline; more than 130 people died.",
      es: "Un ducto de combustible con una toma clandestina explotó en Hidalgo mientras la gente recolectaba gasolina; murieron más de 130 personas.",
      fr: "Un oléoduc piqué illégalement a explosé dans l'État d'Hidalgo pendant que des gens récupéraient de l'essence ; plus de 130 personnes sont mortes.",
      ja: "イダルゴ州で、違法に穴をあけられた燃料パイプラインが、人々がガソリンを集めている最中に爆発し、130人以上が亡くなりました。",
    },
    places: [[-99.23, 20.13]],
    sources: [CENAPRED],
  },
  {
    id: "oaxaca-2020", date: "2020-06-23", type: "earthquakes", severity: 2,
    title: { en: "Magnitude 7.4 Oaxaca earthquake", es: "Sismo de magnitud 7.4 de Oaxaca", fr: "Séisme de magnitude 7,4 de l'Oaxaca", ja: "マグニチュード7.4のオアハカ地震" },
    impact: {
      en: "Centered near Crucecita on the Oaxaca coast, during the COVID-19 lockdown. Ten people died; landslides blocked roads in the mountains.",
      es: "Con epicentro cerca de Crucecita, en la costa de Oaxaca, durante el confinamiento por COVID-19. Murieron diez personas; deslaves bloquearon caminos en la sierra.",
      fr: "Épicentre près de Crucecita, sur la côte de l'Oaxaca, pendant le confinement dû au COVID-19. Dix personnes sont mortes ; des glissements de terrain ont bloqué des routes de montagne.",
      ja: "震源はオアハカ州の海岸のクルセシータ付近で、新型コロナの外出制限中に起きました。10人が亡くなり、山では地すべりが道路をふさぎました。",
    },
    places: [[-96.01, 15.89]],
    sources: [USGS, SSN],
  },
  {
    id: "freeze-2021", date: "2021-02-15", type: "cold", severity: 2,
    title: { en: "Winter storm and blackouts in the north", es: "Tormenta invernal y apagones en el norte", fr: "Tempête hivernale et coupures de courant dans le nord", ja: "北部の冬の嵐と大停電" },
    impact: {
      en: "A deep freeze cut natural gas from Texas; power plants in northern Mexico failed and millions of homes lost electricity.",
      es: "Una helada intensa cortó el gas natural desde Texas; fallaron centrales eléctricas del norte de México y millones de hogares se quedaron sin luz.",
      fr: "Un froid intense a coupé le gaz naturel venant du Texas ; des centrales du nord du Mexique sont tombées en panne et des millions de foyers ont perdu l'électricité.",
      ja: "強い寒波でテキサス州からの天然ガスが止まり、メキシコ北部の発電所が止まって、数百万世帯が停電しました。",
    },
    places: [[-100.31, 25.67], [-106.08, 28.64]],
    sources: [EO],
  },
  {
    id: "metro12-2021", date: "2021-05-03", type: "urban", severity: 3,
    title: { en: "Metro Line 12 overpass collapse", es: "Colapso del tramo elevado de la Línea 12", fr: "Effondrement du viaduc de la ligne 12 du métro", ja: "地下鉄12号線の高架崩落" },
    impact: {
      en: "An elevated section of Mexico City's Metro Line 12 fell onto a road as a train crossed; 26 people died. Investigations pointed to construction faults.",
      es: "Un tramo elevado de la Línea 12 del Metro de la Ciudad de México cayó sobre una avenida al pasar un tren; murieron 26 personas. Las investigaciones apuntaron a fallas de construcción.",
      fr: "Une section aérienne de la ligne 12 du métro de Mexico est tombée sur une route au passage d'un train ; 26 personnes sont mortes. Les enquêtes ont pointé des défauts de construction.",
      ja: "メキシコシティ地下鉄12号線の高架部分が、電車の通過中に道路へ崩れ落ち、26人が亡くなりました。調査では施工の欠陥が指摘されました。",
    },
    places: [[-99.05, 19.3]],
    sources: [{ name: "Gobierno de la Ciudad de México", url: "https://www.cdmx.gob.mx/" }],
  },
  {
    id: "zacatepec-2021", date: "2021-05-29", type: "sinkholes", severity: 1,
    title: { en: "Santa María Zacatepec sinkhole", es: "Socavón de Santa María Zacatepec", fr: "Effondrement de Santa María Zacatepec", ja: "サンタ・マリア・サカテペックの陥没穴" },
    impact: {
      en: "A sinkhole opened in farmland in Puebla and kept growing for weeks to more than a hundred meters across, swallowing part of a house.",
      es: "Un socavón se abrió en un campo de cultivo en Puebla y creció durante semanas hasta superar los cien metros de diámetro, tragándose parte de una casa.",
      fr: "Un effondrement s'est ouvert dans un champ à Puebla et s'est agrandi pendant des semaines jusqu'à dépasser cent mètres de diamètre, engloutissant une partie d'une maison.",
      ja: "プエブラ州の畑に陥没穴があき、何週間も広がり続けて直径100 mを超え、家の一部をのみこみました。",
    },
    places: [[-98.37, 19.1]],
    sources: [CENAPRED],
  },
  {
    id: "michoacan-2022", date: "2022-09-19", type: "earthquakes", severity: 2,
    title: { en: "Magnitude 7.6 Michoacán earthquake", es: "Sismo de magnitud 7.6 de Michoacán", fr: "Séisme de magnitude 7,6 du Michoacán", ja: "マグニチュード7.6のミチョアカン地震" },
    impact: {
      en: "Struck near Coalcomán, again on September 19. It damaged hospitals and homes in Michoacán and Colima.",
      es: "Ocurrió cerca de Coalcomán, otra vez un 19 de septiembre. Dañó hospitales y viviendas en Michoacán y Colima.",
      fr: "Il a frappé près de Coalcomán, encore un 19 septembre. Il a endommagé des hôpitaux et des maisons au Michoacán et au Colima.",
      ja: "コアルコマン付近で、またも9月19日に起きました。ミチョアカン州とコリマ州で病院や家に被害が出ました。",
    },
    places: [[-103.25, 18.4]],
    sources: [USGS, SSN],
  },
  {
    id: "popo-2023", date: "2023-05-20", type: "volcanoes", severity: 2,
    title: { en: "Popocatépetl unrest", es: "Actividad del Popocatépetl", fr: "Agitation du Popocatépetl", ja: "ポポカテペトル山の活動" },
    impact: {
      en: "Intense ash emissions raised the alert to Yellow Phase 3 and closed the Mexico City and Puebla airports for hours. About 25 million people live within 100 km of the volcano.",
      es: "Fuertes emisiones de ceniza elevaron la alerta a Amarillo Fase 3 y cerraron por horas los aeropuertos de la Ciudad de México y Puebla. Unos 25 millones de personas viven a menos de 100 km del volcán.",
      fr: "D'intenses émissions de cendres ont fait passer l'alerte en Jaune Phase 3 et fermé pendant des heures les aéroports de Mexico et de Puebla. Environ 25 millions de personnes vivent à moins de 100 km du volcan.",
      ja: "激しい火山灰の噴出で警戒レベルが「黄色フェーズ3」に上がり、メキシコシティとプエブラの空港が数時間閉鎖されました。火山から100 km以内に約2,500万人が住んでいます。",
    },
    places: [[-98.62, 19.02], [-99.13, 19.43], [-98.2, 19.04]],
    sources: [CENAPRED, GVP],
  },
  {
    id: "otis-2023", date: "2023-10-25", type: "hurricanes", severity: 3,
    title: { en: "Hurricane Otis", es: "Huracán Otis", fr: "Ouragan Otis", ja: "ハリケーン・オーティス" },
    impact: {
      en: "Grew from a tropical storm to Category 5 in about a day, far faster than forecast, and struck Acapulco at night as a Category 5, one of the strongest hurricanes ever to hit Mexico's Pacific coast. Dozens died and most of the city's buildings were damaged.",
      es: "Pasó de tormenta tropical a categoría 5 en alrededor de un día, mucho más rápido de lo pronosticado, y golpeó Acapulco de noche como categoría 5, uno de los huracanes más fuertes que han golpeado la costa del Pacífico mexicano. Murieron decenas de personas y la mayoría de los edificios resultaron dañados.",
      fr: "Passé de tempête tropicale à la catégorie 5 en une journée environ, bien plus vite que prévu, il a frappé Acapulco de nuit en catégorie 5, l'un des ouragans les plus forts à avoir touché la côte pacifique du Mexique. Des dizaines de personnes sont mortes et la plupart des bâtiments de la ville ont été endommagés.",
      ja: "約1日で熱帯暴風雨からカテゴリー5へと予報よりはるかに速く強まり、夜のアカプルコをカテゴリー5で襲いました。メキシコの太平洋岸を襲った最強クラスのハリケーンのひとつです。数十人が亡くなり、市内のほとんどの建物が被害を受けました。",
    },
    places: [[-99.88, 16.85]],
    sources: [NHC, EO],
  },
  {
    id: "drought-2024", date: "2024-05-15", type: "drought", severity: 2,
    title: { en: "Drought and heat wave; Cutzamala at record lows", es: "Sequía y ola de calor; Cutzamala en mínimos", fr: "Sécheresse et canicule ; Cutzamala au plus bas", ja: "干ばつと熱波、クツァマラ貯水池が記録的な低水準に" },
    impact: {
      en: "Most of Mexico was in drought. The Cutzamala reservoirs that supply Mexico City fell to about 26% of capacity in June, the lowest in some 25 years, and heat records were broken in many cities.",
      es: "La mayor parte de México estaba en sequía. Las presas del Sistema Cutzamala, que abastecen a la Ciudad de México, bajaron a cerca del 26% de su capacidad en junio, el nivel más bajo en unos 25 años, y se rompieron récords de calor en muchas ciudades.",
      fr: "La majeure partie du Mexique était en sécheresse. Les réservoirs du système Cutzamala, qui alimentent Mexico, sont tombés à environ 26 % de leur capacité en juin, le niveau le plus bas depuis quelque 25 ans, et des records de chaleur ont été battus dans de nombreuses villes.",
      ja: "メキシコの大部分が干ばつでした。メキシコシティに水を送るクツァマラ水系の貯水池は6月に容量の約26%まで下がり、およそ25年で最も低くなりました。多くの都市で暑さの記録が破られました。",
    },
    places: [[-100.13, 19.19], [-99.13, 19.43]],
    sources: [CONAGUA, EO],
  },
  {
    id: "john-2024", date: "2024-09-23", type: "hurricanes", severity: 2,
    title: { en: "Hurricane John", es: "Huracán John", fr: "Ouragan John", ja: "ハリケーン・ジョン" },
    impact: {
      en: "Made landfall in Guerrero, drifted back to sea and returned; days of rain flooded Acapulco again, less than a year after Otis.",
      es: "Tocó tierra en Guerrero, regresó al mar y volvió; días de lluvia inundaron Acapulco otra vez, menos de un año después de Otis.",
      fr: "Il a touché terre au Guerrero, est reparti en mer puis revenu ; des jours de pluie ont de nouveau inondé Acapulco, moins d'un an après Otis.",
      ja: "ゲレロ州に上陸したあと海へ戻り、再び上陸しました。何日も続いた雨で、オーティスから1年もたたないうちにアカプルコがまた水につかりました。",
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
      fr: "La ville continue de s'enfoncer là où l'on pompe l'eau souterraine dans l'argile de l'ancien lac ; les rues se fissurent, les bâtiments penchent et le réseau d'égouts perd sa pente. Les zones bâties continuent de s'étendre sur les terres agricoles et les forêts en périphérie.",
      ja: "昔の湖の粘土層から地下水をくみ上げている場所では、町が沈み続けています。道路にひびが入り、建物は傾き、下水道は勾配を失っています。市街地は周辺の農地や森へ広がり続けています。",
    },
    nature: {
      en: "The canals and wetlands of Xochimilco, the last wild home of the axolotl (critically endangered), shrink and are polluted as the ground sinks and the city grows. Forests in the Sierra de las Cruces and Ajusco, which recharge the aquifer, are lost to housing.",
      es: "Los canales y humedales de Xochimilco, último hogar silvestre del ajolote (en peligro crítico), se reducen y contaminan mientras el suelo se hunde y la ciudad crece. Los bosques de la Sierra de las Cruces y del Ajusco, que recargan el acuífero, se pierden ante la vivienda.",
      fr: "Les canaux et zones humides de Xochimilco, dernier habitat sauvage de l'axolotl (en danger critique), rétrécissent et sont pollués à mesure que le sol s'enfonce et que la ville grandit. Les forêts de la Sierra de las Cruces et de l'Ajusco, qui rechargent l'aquifère, disparaissent au profit des logements.",
      ja: "絶滅寸前のアホロートル（ウーパールーパー）が野生で暮らす最後の場所、ソチミルコの運河と湿地は、地面が沈み町が大きくなるにつれて狭まり、汚れています。帯水層に水を補給するシエラ・デ・ラス・クルセスとアフスコの森は、住宅に置き換わっています。",
    },
    sources: [CHAUSSARD, { name: "IUCN Red List: Ambystoma mexicanum", url: "https://www.iucnredlist.org/" }, EO],
  },
  yucatan: {
    center: [-89.74, 19.75],
    changes: {
      en: "Tropical dry forest in Los Chenes is being cleared in large rectangles for mechanized farmland (soy, sorghum, corn). Radar sees the forest canopy disappear even through clouds.",
      es: "La selva baja de Los Chenes se desmonta en grandes rectángulos para agricultura mecanizada (soya, sorgo, maíz). El radar ve desaparecer el dosel incluso a través de las nubes.",
      fr: "La forêt tropicale sèche de Los Chenes est défrichée en grands rectangles pour l'agriculture mécanisée (soja, sorgho, maïs). Le radar voit disparaître le couvert forestier même à travers les nuages.",
      ja: "ロス・チェネスの熱帯乾燥林は、機械化農業（大豆、ソルガム、トウモロコシ）のために大きな長方形に切り開かれています。レーダーは雲を通しても森の樹冠が消えていくのを捉えます。",
    },
    nature: {
      en: "Clearing cuts up the forest corridor toward the Calakmul reserve, used by jaguars and other wildlife. Maya beekeepers have taken genetically modified soy permits to court over harm to their bees and honey.",
      es: "El desmonte fragmenta el corredor de selva hacia la reserva de Calakmul, que usan jaguares y otra fauna. Apicultores mayas llevaron a los tribunales los permisos de soya transgénica por el daño a sus abejas y su miel.",
      fr: "Le défrichement coupe le corridor forestier vers la réserve de Calakmul, utilisé par les jaguars et d'autres animaux. Des apiculteurs mayas ont porté devant la justice les permis de soja transgénique, pour le tort causé à leurs abeilles et à leur miel.",
      ja: "森の伐採は、ジャガーなどの動物が使うカラクムル保護区への森の回廊を分断しています。マヤの養蜂家たちは、ミツバチとはちみつへの被害を理由に、遺伝子組み換え大豆の許可を裁判で争いました。",
    },
    sources: [{ name: "University of Maryland GLAD, Global Forest Change (Hansen et al., Landsat)", url: "https://glad.earthengine.app/view/global-forest-change" }, { name: "CONABIO", url: "https://www.gob.mx/conabio" }],
  },
  chapala: {
    center: [-103.1, 20.22],
    changes: {
      en: "Mexico's largest lake rises and falls with rain and with how much water is taken for Guadalajara and farms; in droughts the shoreline retreats hundreds of meters.",
      es: "El lago más grande de México sube y baja con la lluvia y con el agua que se toma para Guadalajara y el campo; en las sequías la orilla retrocede cientos de metros.",
      fr: "Le plus grand lac du Mexique monte et descend avec la pluie et avec l'eau prélevée pour Guadalajara et l'agriculture ; en période de sécheresse, la rive recule de centaines de mètres.",
      ja: "メキシコ最大の湖は、雨の量と、グアダラハラや農業のために取られる水の量で水位が上下します。干ばつのときには湖岸が数百メートル後退します。",
    },
    nature: {
      en: "Low water and pollution stress native fish such as charales; water hyacinth spreads over the surface. American white pelicans spend the winter on the lake.",
      es: "El nivel bajo y la contaminación afectan a peces nativos como los charales; el lirio acuático se extiende sobre el agua. Pelícanos blancos americanos pasan el invierno en el lago.",
      fr: "Le niveau bas et la pollution affaiblissent des poissons indigènes comme les charales ; la jacinthe d'eau s'étend à la surface. Des pélicans blancs d'Amérique passent l'hiver sur le lac.",
      ja: "水位の低下と汚染は、チャラレスなどの在来の魚を弱らせ、ホテイアオイが水面に広がっています。アメリカシロペリカンが湖で冬を越します。",
    },
    sources: [CONAGUA, { name: "CONABIO", url: "https://www.gob.mx/conabio" }],
  },
  villahermosa: {
    center: [-92.93, 17.99],
    changes: {
      en: "Rivers, lagoons and wetlands surround the city, which floods when dams upstream release water during heavy rain (2007, 2020).",
      es: "Ríos, lagunas y humedales rodean la ciudad, que se inunda cuando las presas río arriba desfogan agua en lluvias intensas (2007, 2020).",
      fr: "Rivières, lagunes et zones humides entourent la ville, qui est inondée quand les barrages en amont lâchent de l'eau lors de fortes pluies (2007, 2020).",
      ja: "川、潟湖、湿地に囲まれたこの町は、大雨のときに上流のダムが放流すると水につかります（2007年、2020年）。",
    },
    nature: {
      en: "The Pantanos de Centla biosphere reserve downstream is one of the largest wetlands in Mesoamerica, home to manatees, crocodiles and mangroves; drainage, oil works and cattle ranching shrink it.",
      es: "La reserva de la biosfera Pantanos de Centla, río abajo, es uno de los humedales más grandes de Mesoamérica, hogar de manatíes, cocodrilos y manglares; el drenaje, la actividad petrolera y la ganadería la reducen.",
      fr: "La réserve de biosphère des Pantanos de Centla, en aval, est l'une des plus grandes zones humides de Mésoamérique, refuge des lamantins, des crocodiles et des mangroves ; le drainage, l'activité pétrolière et l'élevage la réduisent.",
      ja: "下流のパンタノス・デ・センラ生物圏保護区は、メソアメリカ最大級の湿地で、マナティー、ワニ、マングローブのすみかです。排水、石油開発、牧畜によって狭まっています。",
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

/** The hand-written note for an area, only when it was written for that very area (same id): a new
 *  place nearby must not show another place's text. Every place gets its own words from the back
 *  end's friendly cards (C8). */
export function zoneNote(id: string): ZoneNote | undefined {
  return Object.hasOwn(ZONES, id) ? ZONES[id] : undefined;
}
