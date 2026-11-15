// Text helpers for the PDF report (no imports, so `node --test` can run them).

// The PDF's built-in fonts are only safe for Latin-1 letters (é, ñ, ü, ², ·, ×...). Anything else
// is swapped for a near match, or loses its accent, or becomes "?".
const SWAP: Record<string, string> = {
  "−": "-", "–": "-", "—": "-", "…": "...", "‘": "'", "’": "'", "“": '"', "”": '"',
  "•": "·", "≥": ">=", "≤": "<=", "→": "->", "≈": "~", "€": "EUR",
  "◆": "", "●": "", "▲": "", "■": "", " ": " ", " ": " ",
};

export function clean(text: string): string {
  let out = "";
  for (const ch of text ?? "") {
    if (ch.charCodeAt(0) <= 0xff) out += ch;
    else if (ch in SWAP) out += SWAP[ch];
    else {
      const plain = ch.normalize("NFKD").replace(/[̀-ͯ]/g, "");
      out += plain && plain.charCodeAt(0) <= 0xff ? plain : "?";
    }
  }
  return out;
}

/** "{n} changes" with n = 3 -> "3 changes". */
export const fill = (s: string, vars: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ""));
