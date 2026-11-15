// Legends of the back end's pictures, shared by the area card and the PDF report.
import type { Key } from "./i18n";

// The colors the back end paints into its images (backend/src/sars_pipeline/site.py and
// categorize.py). Keep in step with the back end.
// Color bars run from the low end of `value_range` to the high end.
export const RAMPS: Record<string, string> = {
  gray: "#000, #fff",
  rdbu: "rgb(215 48 39), transparent, rgb(40 110 220)",
  brbg: "rgb(166 97 26), rgb(1 133 113)",
};
// shortcut: "classes" layers are matched by their group label because the contract does not
// list their classes; replace with the contract's class list if it gains one.
export const CLASSES: Record<string, [string, Key][]> = {
  "Surface type": [
    ["rgb(33 113 181)", "class.water"], ["rgb(200 60 60)", "class.built"],
    ["rgb(49 163 84)", "class.vegetation"], ["rgb(217 180 120)", "class.bare"],
  ],
  "Detected change": [
    ["rgb(33 113 181)", "class.darkening"], ["rgb(230 85 13)", "class.hvdrop"],
    ["rgb(200 60 160)", "class.brightening"], ["rgb(150 150 150)", "class.strong"],
  ],
};

