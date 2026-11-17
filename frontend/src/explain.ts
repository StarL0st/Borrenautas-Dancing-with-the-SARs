// "Why the radar sees changes", explained simply, each idea with a small drawing (jopa-testing).
//
// Every sentence says only what its sources say (`refs`, see sources.ts): NASA Earthdata's SAR
// pages, NISAR's quick facts and NASA/JPL's Mexico City report. Numbers that are the app's own
// rules (3 dB, 4 dB, 5 cm a year, 0.04 km²) are called rules and cite the back-end code.
// Drawings are in explain-view.ts. Text is { en, es, fr, ja } (French and Japanese added 2026-11-17);
// German falls back to English, as in mexico.ts.
import type { Text } from "./mexico";
import type { RefId } from "./sources";

export type Topic = { id: string; title: Text; text: Text; looks: Text; refs: RefId[] };

export const TOPICS: Topic[] = [
  {
    id: "basics",
    title: { en: "An echo, not a photo", es: "Un eco, no una foto", fr: "Un écho, pas une photo", ja: "写真ではなく、こだま" },
    text: {
      en: "NISAR sends out pulses of microwaves 24 cm long (L-band) and records how much energy comes back after it hits the ground. It works by day and by night, and through clouds. It looks at the world's land and ice every 12 days. Rough surfaces send more energy back and look brighter.",
      es: "NISAR envía pulsos de microondas de 24 cm (banda L) y registra cuánta energía regresa después de chocar con el suelo. Funciona de día y de noche, y a través de las nubes. Observa la tierra y el hielo del mundo cada 12 días. Las superficies rugosas regresan más energía y se ven más claras.",
      fr: "NISAR envoie des impulsions de micro-ondes de 24 cm (bande L) et enregistre l'énergie qui revient après avoir touché le sol. Il fonctionne de jour comme de nuit, et à travers les nuages. Il observe les terres et les glaces du monde tous les 12 jours. Les surfaces rugueuses renvoient plus d'énergie et paraissent plus claires.",
      ja: "NISARは長さ24 cmのマイクロ波（Lバンド）のパルスを送り、地面に当たって戻ってくるエネルギーの量を記録します。昼も夜も、雲を通しても観測できます。世界の陸と氷を12日ごとに観測します。でこぼこした表面ほど多くのエネルギーを返し、明るく見えます。",
    },
    looks: { en: "Bright = strong echo. Dark = weak echo.", es: "Claro = eco fuerte. Oscuro = eco débil.", fr: "Clair = écho fort. Sombre = écho faible.", ja: "明るい＝こだまが強い。暗い＝こだまが弱い。" },
    refs: ["nisarFacts", "sar", "sarImage", "cdmx"],
  },
  {
    id: "water",
    title: { en: "Calm water looks black", es: "El agua tranquila se ve negra", fr: "L'eau calme paraît noire", ja: "おだやかな水は黒く見える" },
    text: {
      en: "Calm water and other smooth surfaces reflect the radar away from the satellite, so they look black. The app's flood rule: both channels (HH and HV) lose half their echo or more (3 dB) and HH ends very dark.",
      es: "El agua tranquila y otras superficies lisas reflejan el radar lejos del satélite, por eso se ven negras. La regla de inundación de la app: los dos canales (HH y HV) pierden la mitad del eco o más (3 dB) y HH queda muy oscuro.",
      fr: "L'eau calme et les autres surfaces lisses renvoient le radar loin du satellite : elles paraissent noires. La règle d'inondation de l'application : les deux canaux (HH et HV) perdent la moitié de leur écho ou plus (3 dB) et HH finit très sombre.",
      ja: "おだやかな水やなめらかな表面はレーダーを衛星とは別の方向へ反射するため、黒く見えます。アプリの洪水ルール：2つのチャンネル（HHとHV）がともにこだまの半分以上（3 dB）を失い、HHがとても暗くなること。",
    },
    looks: { en: "Flood: darker after.", es: "Inundación: más oscuro después.", fr: "Inondation : plus sombre après.", ja: "洪水：後のほうが暗い。" },
    refs: ["sarImage", "rules"],
  },
  {
    id: "structure",
    title: { en: "Corners shine", es: "Las esquinas brillan", fr: "Les coins brillent", ja: "角が光る" },
    text: {
      en: "Buildings, bridges and other human-made objects act as corner reflectors and show up as bright spots. This \"double bounce\" also happens with tree trunks and flooded vegetation, and shows most in the HH channel. The app's rule for new buildings: HH rises 4 dB or more.",
      es: "Edificios, puentes y otras construcciones funcionan como reflectores de esquina y aparecen como puntos brillantes. Este \"doble rebote\" también ocurre con troncos y vegetación inundada, y se nota más en el canal HH. La regla de la app para construcciones nuevas: HH sube 4 dB o más.",
      fr: "Les bâtiments, les ponts et les autres objets construits par l'homme agissent comme des réflecteurs en coin et apparaissent comme des points brillants. Ce « double rebond » se produit aussi avec les troncs d'arbres et la végétation inondée, et se voit surtout dans le canal HH. La règle de l'application pour les nouvelles constructions : HH augmente de 4 dB ou plus.",
      ja: "建物や橋など人がつくったものは角の反射器としてはたらき、明るい点として現れます。この「二重反射」は木の幹や水につかった植生でも起こり、HHチャンネルで最もよく見えます。アプリの新しい建物のルール：HHが4 dB以上上がること。",
    },
    looks: { en: "New buildings or flooded trees: brighter after.", es: "Construcciones nuevas o árboles inundados: más claro después.", fr: "Nouveaux bâtiments ou arbres inondés : plus clair après.", ja: "新しい建物や水につかった木：後のほうが明るい。" },
    refs: ["sarImage", "sar", "rules"],
  },
  {
    id: "plants",
    title: { en: "Leaves scatter the wave", es: "Las hojas dispersan la onda", fr: "Les feuilles dispersent l'onde", ja: "葉が波を散らす" },
    text: {
      en: "Leaves and branches scatter the wave in many directions (volume scattering), which shows most in the cross-polarized channel, HV. L-band's long wave goes deeper into the canopy and also meets large branches and trunks. The app's forest-loss rule: HV drops 3 dB or more, and 1.5 dB more than HH.",
      es: "Hojas y ramas dispersan la onda en muchas direcciones (dispersión de volumen), lo que se nota más en el canal de polarización cruzada, HV. La onda larga de la banda L entra más en el dosel y también toca ramas grandes y troncos. La regla de pérdida de bosque de la app: HV baja 3 dB o más, y 1.5 dB más que HH.",
      fr: "Les feuilles et les branches dispersent l'onde dans de nombreuses directions (diffusion de volume), ce qui se voit surtout dans le canal en polarisation croisée, HV. L'onde longue de la bande L pénètre plus profondément dans la canopée et rencontre aussi les grosses branches et les troncs. La règle de perte de forêt de l'application : HV baisse de 3 dB ou plus, et de 1,5 dB de plus que HH.",
      ja: "葉や枝は波をさまざまな方向に散らし（体積散乱）、それは交差偏波のHVチャンネルで最もよく見えます。Lバンドの長い波は樹冠のおくまで入り、太い枝や幹にも当たります。アプリの森林消失ルール：HVが3 dB以上下がり、しかもHHより1.5 dB以上大きく下がること。",
    },
    looks: { en: "Forest loss: HV darker after.", es: "Pérdida de bosque: HV más oscuro después.", fr: "Perte de forêt : HV plus sombre après.", ja: "森林消失：後のほうがHVが暗い。" },
    refs: ["sar", "rules"],
  },
  {
    id: "moisture",
    title: { en: "Wet ground is brighter", es: "El suelo mojado se ve más claro", fr: "Un sol mouillé est plus clair", ja: "ぬれた地面は明るい" },
    text: {
      en: "A rough surface backscatters even more brightly when it is wet, so the same field can look brighter after rain. NISAR also has a soil moisture product (SME2).",
      es: "Una superficie rugosa refleja con aún más brillo cuando está mojada, así que el mismo campo puede verse más claro después de llover. NISAR también tiene un producto de humedad del suelo (SME2).",
      fr: "Une surface rugueuse rétrodiffuse encore plus fortement quand elle est mouillée : un même champ peut donc paraître plus clair après la pluie. NISAR a aussi un produit d'humidité du sol (SME2).",
      ja: "でこぼこした表面はぬれるとさらに強く後方散乱するため、同じ畑でも雨のあとは明るく見えることがあります。NISARには土壌水分のプロダクト（SME2）もあります。",
    },
    looks: { en: "Wetter: brighter.", es: "Más húmedo: más claro.", fr: "Plus humide : plus clair.", ja: "湿っているほど明るい。" },
    refs: ["sarImage", "nisarFacts", "asfProducts"],
  },
  {
    id: "motion",
    title: { en: "Measuring centimeters", es: "Medir centímetros", fr: "Mesurer des centimètres", ja: "センチメートルを測る" },
    text: {
      en: "Interferometry (InSAR) uses the phase of the echo to measure the distance to the ground. Comparing two passes measures how the ground moved, up to the centimeter level. The app flags ground sinking 5 cm a year or more. NASA reports that parts of Mexico City sank about 35 cm a year in the 1990s and 2000s, and NISAR measured more than 2 cm a month in places between October 2025 and January 2026.",
      es: "La interferometría (InSAR) usa la fase del eco para medir la distancia al suelo. Comparar dos pasadas mide cómo se movió el suelo, con precisión de centímetros. La app marca hundimientos de 5 cm al año o más. La NASA informa que partes de la Ciudad de México se hundían unos 35 cm al año en los años 1990 y 2000, y NISAR midió más de 2 cm al mes en algunos lugares entre octubre de 2025 y enero de 2026.",
      fr: "L'interférométrie (InSAR) utilise la phase de l'écho pour mesurer la distance jusqu'au sol. Comparer deux passages mesure comment le sol a bougé, au centimètre près. L'application signale les sols qui s'enfoncent de 5 cm par an ou plus. La NASA indique que certaines parties de Mexico s'enfonçaient d'environ 35 cm par an dans les années 1990 et 2000, et NISAR a mesuré plus de 2 cm par mois par endroits entre octobre 2025 et janvier 2026.",
      ja: "干渉法（InSAR）は、こだまの位相を使って地面までの距離を測ります。2回の観測を比べると、地面がどう動いたかをセンチメートル単位で測れます。アプリは年5 cm以上しずむ地面に印をつけます。NASAによると、メキシコシティの一部は1990年代と2000年代に年およそ35 cmしずみ、NISARは2025年10月から2026年1月にかけて、ところによって月2 cmを超える沈下を測定しました。",
    },
    looks: { en: "Ground motion map: red away from the satellite, blue toward it.", es: "Mapa de movimiento: rojo se aleja del satélite, azul se acerca.", fr: "Carte du mouvement du sol : rouge s'éloigne du satellite, bleu s'en rapproche.", ja: "地面の動きの地図：赤は衛星から遠ざかり、青は近づく。" },
    refs: ["sar", "cdmx", "rules"],
  },
  {
    id: "fooled",
    title: { en: "What can fool it", es: "Qué lo puede engañar", fr: "Ce qui peut le tromper", ja: "レーダーをだますもの" },
    text: {
      en: "Wind-roughened water can look bright, wet ground looks brighter, the viewing angle changes the echo, and crops grow. So the app's rules need a change to still show on the next pass, drop patches under 0.04 km², and call every result a hypothesis, not a fact.",
      es: "El agua agitada por el viento puede verse brillante, el suelo mojado se ve más claro, el ángulo de vista cambia el eco y los cultivos crecen. Por eso las reglas de la app exigen que el cambio siga en la siguiente pasada, descartan manchas menores a 0.04 km² y presentan cada resultado como hipótesis, no como hecho.",
      fr: "L'eau agitée par le vent peut paraître brillante, un sol mouillé paraît plus clair, l'angle de vue change l'écho et les cultures poussent. C'est pourquoi les règles de l'application exigent qu'un changement soit encore visible au passage suivant, écartent les taches de moins de 0,04 km² et présentent chaque résultat comme une hypothèse, pas comme un fait.",
      ja: "風で波立つ水は明るく見えることがあり、ぬれた地面は明るく見え、見る角度でこだまは変わり、作物は育ちます。そのためアプリのルールでは、変化が次の観測でも見えることを求め、0.04 km²未満のまとまりは除き、すべての結果を事実ではなく仮説として示します。",
    },
    looks: { en: "One pass alone is never enough.", es: "Una sola pasada nunca basta.", fr: "Un seul passage ne suffit jamais.", ja: "1回の観測だけでは決して足りない。" },
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
