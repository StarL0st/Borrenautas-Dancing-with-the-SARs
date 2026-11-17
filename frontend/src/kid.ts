// Words for Simple mode's side panel, written so a 10-year-old can follow them (jopa-testing).
// Short sentences, everyday words, one idea at a time. Every fact cites its source (sources.ts).
// Text is { en, es, fr, ja } (French and Japanese added 2026-11-17); German falls back to English, as in mexico.ts.
import type { Text } from "./mexico";
import type { RefId } from "./sources";

/** What each kind of change is, in one sentence. */
export const KID_TYPES: Record<string, Text> = {
  floods: { en: "Floods: water covers land that is usually dry.", es: "Inundaciones: el agua cubre tierra que normalmente está seca.", fr: "Inondations : l'eau recouvre une terre qui est d'habitude sèche.", ja: "洪水：ふだんはかわいている土地を水がおおうこと。" },
  deforestation: { en: "Cutting down forests: trees are cut and the land is used for something else.", es: "Tala de bosques: se cortan árboles y la tierra se usa para otra cosa.", fr: "Déforestation : on coupe les arbres et on utilise la terre pour autre chose.", ja: "森林破壊：木を切って、その土地を別のことに使うこと。" },
  logging: { en: "Logging: trees are cut for their wood.", es: "Tala: se cortan árboles por su madera.", fr: "Coupe de bois : on coupe des arbres pour leur bois.", ja: "伐採：木材をとるために木を切ること。" },
  wildfires: { en: "Wildfires: fires that burn forests and fields.", es: "Incendios: fuegos que queman bosques y campos.", fr: "Feux de forêt : des incendies qui brûlent les forêts et les champs.", ja: "山火事：森や野原を焼く火事。" },
  agriculture: { en: "Farming: fields where people grow food.", es: "Agricultura: campos donde la gente cultiva comida.", fr: "Agriculture : des champs où l'on cultive de quoi manger.", ja: "農業：人が食べ物を育てる畑。" },
  urban: { en: "Growing cities: new houses, roads and buildings.", es: "Ciudades que crecen: casas, calles y edificios nuevos.", fr: "Villes qui grandissent : nouvelles maisons, routes et bâtiments.", ja: "大きくなる町：新しい家や道路、ビル。" },
  subsidence: { en: "Sinking ground: the ground slowly goes down, like a cake sinking in the middle.", es: "Suelo que se hunde: el suelo baja poco a poco, como un pastel que se hunde en el centro.", fr: "Sol qui s'enfonce : le sol descend lentement, comme un gâteau qui s'affaisse au milieu.", ja: "しずむ地面：まん中がしぼむケーキのように、地面が少しずつ下がること。" },
  groundwater: { en: "Pumping water from underground: taking too much can make the ground sink.", es: "Sacar agua de debajo del suelo: si se saca mucha, el suelo se puede hundir.", fr: "Pomper l'eau sous la terre : en prendre trop peut faire s'enfoncer le sol.", ja: "地下の水をくみ上げること：とりすぎると地面がしずむことがあります。" },
  drought: { en: "Drought: a long time with very little rain, so the ground dries out.", es: "Sequía: mucho tiempo con muy poca lluvia, y el suelo se seca.", fr: "Sécheresse : longtemps sans presque pas de pluie, alors le sol se dessèche.", ja: "干ばつ：雨がとても少ない日が長くつづき、地面がかわくこと。" },
  volcanoes: { en: "Volcanoes: mountains that can throw out lava, ash and gas.", es: "Volcanes: montañas que pueden echar lava, ceniza y gas.", fr: "Volcans : des montagnes qui peuvent cracher de la lave, des cendres et du gaz.", ja: "火山：溶岩や灰、ガスをふき出すことがある山。" },
  earthquakes: { en: "Earthquakes: the ground suddenly shakes.", es: "Sismos: el suelo tiembla de repente.", fr: "Séismes : le sol tremble tout à coup.", ja: "地震：地面がとつぜんゆれること。" },
  landslides: { en: "Landslides: earth and rocks slide down a hill.", es: "Deslaves: tierra y rocas se resbalan por una ladera.", fr: "Glissements de terrain : la terre et les rochers glissent le long d'une pente.", ja: "地すべり：土や岩が坂をすべり落ちること。" },
  hurricanes: { en: "Hurricanes: giant storms with very strong wind and rain.", es: "Huracanes: tormentas gigantes con viento y lluvia muy fuertes.", fr: "Ouragans : des tempêtes géantes avec un vent et une pluie très forts.", ja: "ハリケーン：とても強い風と雨をともなう巨大な嵐。" },
  storms: { en: "Storms: strong wind, rain or hail.", es: "Tormentas: viento fuerte, lluvia o granizo.", fr: "Tempêtes : vent fort, pluie ou grêle.", ja: "嵐：強い風や雨、ひょう。" },
  sinkholes: { en: "Sinkholes: holes that suddenly open in the ground.", es: "Socavones: hoyos que se abren de repente en el suelo.", fr: "Effondrements : des trous qui s'ouvrent tout à coup dans le sol.", ja: "陥没穴：地面にとつぜんあく穴。" },
  "coastal-loss": { en: "Losing coast: the sea slowly eats away the beach.", es: "Pérdida de costa: el mar se come la playa poco a poco.", fr: "Recul de la côte : la mer grignote la plage petit à petit.", ja: "海岸がへること：海が少しずつ浜をけずっていくこと。" },
  reservoirs: { en: "Reservoirs: big lakes made by people to keep water.", es: "Presas: lagos grandes hechos por la gente para guardar agua.", fr: "Réservoirs : de grands lacs faits par les humains pour garder l'eau.", ja: "ダム湖：水をためるために人がつくった大きな湖。" },
  "oil-spills": { en: "Oil spills: oil that leaks into the sea or the land.", es: "Derrames de petróleo: petróleo que se sale al mar o a la tierra.", fr: "Marées noires : du pétrole qui fuit dans la mer ou sur la terre.", ja: "石油流出：石油が海や陸にもれ出すこと。" },
  glaciers: { en: "Glaciers: huge pieces of ice that move very slowly.", es: "Glaciares: enormes pedazos de hielo que se mueven muy despacio.", fr: "Glaciers : d'énormes masses de glace qui bougent très lentement.", ja: "氷河：とてもゆっくり動く、巨大な氷のかたまり。" },
  heat: { en: "Heat waves: many very hot days in a row.", es: "Olas de calor: muchos días muy calurosos seguidos.", fr: "Vagues de chaleur : beaucoup de jours très chauds à la suite.", ja: "熱波：とても暑い日が何日もつづくこと。" },
};

/** What the radar found, by kind of detected change: one place, or many. */
export const KID_FOUND: Record<string, { one: Text; many: Text }> = {
  floods: {
    one: { en: "1 spot where water may have covered the land", es: "1 lugar donde el agua pudo cubrir la tierra", fr: "1 endroit où l'eau a peut-être recouvert la terre", ja: "水が土地をおおったかもしれない場所：1か所" },
    many: { en: "{n} spots where water may have covered the land", es: "{n} lugares donde el agua pudo cubrir la tierra", fr: "{n} endroits où l'eau a peut-être recouvert la terre", ja: "水が土地をおおったかもしれない場所：{n}か所" },
  },
  deforestation: {
    one: { en: "1 spot where trees may have been cut", es: "1 lugar donde pudieron cortar árboles", fr: "1 endroit où des arbres ont peut-être été coupés", ja: "木が切られたかもしれない場所：1か所" },
    many: { en: "{n} spots where trees may have been cut", es: "{n} lugares donde pudieron cortar árboles", fr: "{n} endroits où des arbres ont peut-être été coupés", ja: "木が切られたかもしれない場所：{n}か所" },
  },
  logging: {
    one: { en: "1 spot where trees may have been cut", es: "1 lugar donde pudieron cortar árboles", fr: "1 endroit où des arbres ont peut-être été coupés", ja: "木が切られたかもしれない場所：1か所" },
    many: { en: "{n} spots where trees may have been cut", es: "{n} lugares donde pudieron cortar árboles", fr: "{n} endroits où des arbres ont peut-être été coupés", ja: "木が切られたかもしれない場所：{n}か所" },
  },
  wildfires: {
    one: { en: "1 spot where fire may have burned plants", es: "1 lugar donde el fuego pudo quemar plantas", fr: "1 endroit où le feu a peut-être brûlé des plantes", ja: "火が植物を焼いたかもしれない場所：1か所" },
    many: { en: "{n} spots where fire may have burned plants", es: "{n} lugares donde el fuego pudo quemar plantas", fr: "{n} endroits où le feu a peut-être brûlé des plantes", ja: "火が植物を焼いたかもしれない場所：{n}か所" },
  },
  agriculture: {
    one: { en: "1 farm field that changed (planted or harvested)", es: "1 campo de cultivo que cambió (sembrado o cosechado)", fr: "1 champ qui a changé (semé ou récolté)", ja: "変化した畑（種まきか収穫）：1か所" },
    many: { en: "{n} farm fields that changed (planted or harvested)", es: "{n} campos de cultivo que cambiaron (sembrados o cosechados)", fr: "{n} champs qui ont changé (semés ou récoltés)", ja: "変化した畑（種まきか収穫）：{n}か所" },
  },
  urban: {
    one: { en: "1 spot where new buildings may have appeared", es: "1 lugar donde pudieron aparecer edificios nuevos", fr: "1 endroit où de nouveaux bâtiments sont peut-être apparus", ja: "新しい建物ができたかもしれない場所：1か所" },
    many: { en: "{n} spots where new buildings may have appeared", es: "{n} lugares donde pudieron aparecer edificios nuevos", fr: "{n} endroits où de nouveaux bâtiments sont peut-être apparus", ja: "新しい建物ができたかもしれない場所：{n}か所" },
  },
  subsidence: {
    one: { en: "1 spot where the ground may be sinking", es: "1 lugar donde el suelo se puede estar hundiendo", fr: "1 endroit où le sol s'enfonce peut-être", ja: "地面がしずんでいるかもしれない場所：1か所" },
    many: { en: "{n} spots where the ground may be sinking", es: "{n} lugares donde el suelo se puede estar hundiendo", fr: "{n} endroits où le sol s'enfonce peut-être", ja: "地面がしずんでいるかもしれない場所：{n}か所" },
  },
  groundwater: {
    one: { en: "1 spot where the ground may be sinking", es: "1 lugar donde el suelo se puede estar hundiendo", fr: "1 endroit où le sol s'enfonce peut-être", ja: "地面がしずんでいるかもしれない場所：1か所" },
    many: { en: "{n} spots where the ground may be sinking", es: "{n} lugares donde el suelo se puede estar hundiendo", fr: "{n} endroits où le sol s'enfonce peut-être", ja: "地面がしずんでいるかもしれない場所：{n}か所" },
  },
  drought: {
    one: { en: "1 spot where the ground got drier", es: "1 lugar donde el suelo se secó", fr: "1 endroit où le sol est devenu plus sec", ja: "地面がかわいた場所：1か所" },
    many: { en: "{n} spots where the ground got drier", es: "{n} lugares donde el suelo se secó", fr: "{n} endroits où le sol est devenu plus sec", ja: "地面がかわいた場所：{n}か所" },
  },
  other: {
    one: { en: "1 other change the radar could not name", es: "1 cambio más que el radar no supo nombrar", fr: "1 autre changement que le radar n'a pas su nommer", ja: "レーダーが名前をつけられなかったほかの変化：1か所" },
    many: { en: "{n} other changes the radar could not name", es: "{n} cambios más que el radar no supo nombrar", fr: "{n} autres changements que le radar n'a pas su nommer", ja: "レーダーが名前をつけられなかったほかの変化：{n}か所" },
  },
};

/** One fun, true fact per kind of change, each with the source that says it (sources.ts). */
export type KidFact = Text & { refs: RefId[] };
export const KID_FACTS: Record<string, KidFact> = {
  subsidence: {
    en: "In the 1990s and 2000s, parts of Mexico City sank about 35 cm every year. That is longer than a 30 cm school ruler!",
    es: "En los años 1990 y 2000, partes de la Ciudad de México se hundían unos 35 cm cada año. ¡Más que una regla escolar de 30 cm!",
    fr: "Dans les années 1990 et 2000, certaines parties de Mexico s'enfonçaient d'environ 35 cm par an. C'est plus long qu'une règle d'écolier de 30 cm !",
    ja: "1990年代と2000年代、メキシコシティの一部は毎年およそ35 cmしずみました。学校の30 cmのものさしより長いんです！",
    refs: ["cdmx"],
  },
  groundwater: {
    en: "Mexico City is built on an old lakebed. Pumping lots of water out from under the ground has squeezed that ground down, so the city sinks.",
    es: "La Ciudad de México está construida sobre un antiguo lago. Sacar mucha agua de debajo del suelo lo ha apretado, y por eso la ciudad se hunde.",
    fr: "Mexico est construite sur le fond d'un ancien lac. Pomper beaucoup d'eau sous la terre a tassé ce sol, alors la ville s'enfonce.",
    ja: "メキシコシティは昔の湖の底の上につくられています。地下からたくさんの水をくみ上げたので地面がおしちぢめられ、町がしずんでいます。",
    refs: ["cdmx"],
  },
  floods: {
    en: "Calm water looks black to the radar, because the water reflects the waves away from the satellite, like a mirror.",
    es: "El agua tranquila se ve negra para el radar, porque refleja las ondas lejos del satélite, como un espejo.",
    fr: "L'eau calme paraît noire au radar, parce qu'elle renvoie les ondes loin du satellite, comme un miroir.",
    ja: "おだやかな水はレーダーには黒く見えます。水が鏡のように、波を衛星とは別の方向へはね返すからです。",
    refs: ["sarImage"],
  },
  deforestation: {
    en: "NISAR's radar waves are 24 cm long. Waves that long go deep into a forest and bounce off big branches and tree trunks.",
    es: "Las ondas del radar de NISAR miden 24 cm. Ondas tan largas entran hondo en un bosque y rebotan en ramas grandes y troncos.",
    fr: "Les ondes du radar de NISAR mesurent 24 cm. Des ondes aussi longues entrent loin dans la forêt et rebondissent sur les grosses branches et les troncs.",
    ja: "NISARのレーダーの波の長さは24 cmです。こんなに長い波は森のおくまで入り、太い枝や幹ではね返ります。",
    refs: ["nisarFacts", "sar"],
  },
  logging: {
    en: "NISAR's radar waves are 24 cm long. Waves that long go deep into a forest and bounce off big branches and tree trunks.",
    es: "Las ondas del radar de NISAR miden 24 cm. Ondas tan largas entran hondo en un bosque y rebotan en ramas grandes y troncos.",
    fr: "Les ondes du radar de NISAR mesurent 24 cm. Des ondes aussi longues entrent loin dans la forêt et rebondissent sur les grosses branches et les troncs.",
    ja: "NISARのレーダーの波の長さは24 cmです。こんなに長い波は森のおくまで入り、太い枝や幹ではね返ります。",
    refs: ["nisarFacts", "sar"],
  },
  wildfires: {
    en: "NASA's FIRMS system spots fires from space and shares them within about 3 hours.",
    es: "El sistema FIRMS de la NASA detecta incendios desde el espacio y los comparte en unas 3 horas.",
    fr: "Le système FIRMS de la NASA repère les feux depuis l'espace et les partage en 3 heures environ.",
    ja: "NASAのFIRMSというしくみは、宇宙から火事を見つけて、およそ3時間でみんなに知らせます。",
    refs: ["firms"],
  },
  agriculture: {
    en: "NISAR was made to follow changes like crops growing, even through clouds.",
    es: "NISAR fue hecho para seguir cambios como el crecimiento de los cultivos, incluso a través de las nubes.",
    fr: "NISAR a été conçu pour suivre des changements comme la pousse des cultures, même à travers les nuages.",
    ja: "NISARは、作物が育つような変化を、雲があっても追いかけられるようにつくられました。",
    refs: ["cdmx"],
  },
  drought: {
    en: "Wet ground sends back more radar energy than dry ground, so it looks brighter in radar pictures.",
    es: "El suelo mojado regresa más energía de radar que el seco, por eso se ve más claro en las imágenes de radar.",
    fr: "Un sol mouillé renvoie plus d'énergie radar qu'un sol sec : il paraît donc plus clair sur les images radar.",
    ja: "ぬれた地面は、かわいた地面よりたくさんのレーダーのエネルギーを返すので、レーダー画像では明るく見えます。",
    refs: ["sarImage"],
  },
  urban: {
    en: "Buildings and bridges work like corner mirrors for radar, so they show up as bright spots.",
    es: "Los edificios y puentes funcionan como espejos de esquina para el radar, por eso aparecen como puntos brillantes.",
    fr: "Les bâtiments et les ponts agissent comme des miroirs en coin pour le radar : ils apparaissent comme des points brillants.",
    ja: "建物や橋はレーダーにとって角の鏡のようにはたらくので、明るい点になって見えます。",
    refs: ["sarImage"],
  },
  volcanoes: {
    en: "Radar can measure how much the ground moved after a volcano erupts, down to about a centimeter.",
    es: "El radar puede medir cuánto se movió el suelo después de que un volcán hace erupción, con precisión de un centímetro.",
    fr: "Le radar peut mesurer de combien le sol a bougé après l'éruption d'un volcan, à environ un centimètre près.",
    ja: "レーダーは、火山がふん火したあとに地面がどれだけ動いたかを、1センチくらいまで測れます。",
    refs: ["sar"],
  },
  earthquakes: {
    en: "Radar can measure how much the ground moved in an earthquake, down to about a centimeter.",
    es: "El radar puede medir cuánto se movió el suelo en un sismo, con precisión de un centímetro.",
    fr: "Le radar peut mesurer de combien le sol a bougé lors d'un séisme, à environ un centimètre près.",
    ja: "レーダーは、地震で地面がどれだけ動いたかを、1センチくらいまで測れます。",
    refs: ["sar"],
  },
  hurricanes: {
    en: "NISAR's radar works day and night, rain or shine, so clouds do not stop it.",
    es: "El radar de NISAR funciona de día y de noche, con lluvia o con sol, así que las nubes no lo detienen.",
    fr: "Le radar de NISAR fonctionne de jour comme de nuit, qu'il pleuve ou qu'il fasse beau : les nuages ne l'arrêtent pas.",
    ja: "NISARのレーダーは昼も夜も、雨の日も晴れの日もはたらくので、雲にじゃまされません。",
    refs: ["cdmx"],
  },
  default: {
    en: "NISAR looks at almost all of Earth's land and ice every 12 days.",
    es: "NISAR observa casi toda la tierra y el hielo de la Tierra cada 12 días.",
    fr: "NISAR observe presque toutes les terres et les glaces de la Terre tous les 12 jours.",
    ja: "NISARは12日ごとに、地球のほとんどすべての陸と氷を観測します。",
    refs: ["nisarFacts"],
  },
};

/** The fact for the first kind of change the area is about. */
export const kidFact = (types: string[]): KidFact => KID_FACTS[types.find((x) => KID_FACTS[x]) ?? "default"];
