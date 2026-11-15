// The arithmetic behind the before/after comparator (jopa-testing). No DOM, so `node --test`
// runs it directly.
//
// "Change" is the relative difference of the two brightnesses: |after - before| / max(both).
// It runs from 0% (same) to 100% (one of them is black), the same both ways: halving and
// doubling are both 50%. For radar the brightness is the echo power (linear, from dB), so 50% is
// 3 dB, the size of change the back end's detection rules look for (classify.py).

/** Turns one 0..255 pixel value into a brightness. */
export type Decode = (v: number) => number;

/** Radar gray PNGs are dB stretched between `lo` and `hi` (export.py): back to linear power. */
export const radarDecode = (lo: number, hi: number): Decode => (v) => 10 ** ((lo + (v / 255) * (hi - lo)) / 10);

/** Photos: the value is already a brightness (luminance). */
export const opticalDecode: Decode = (v) => v;

/** The dB step that a relative change of `p` (0..1) means. 0.5 -> 3.01 dB. */
export const pctToDb = (p: number) => -10 * Math.log10(1 - Math.min(p, 0.999));

/** Signed relative change, -1..1: positive when `after` is brighter. */
export const relChange = (before: number, after: number) => {
  const top = Math.max(before, after);
  return top > 0 ? (after - before) / top : 0;
};

export type ChangeStats = { valid: number; brighter: number; darker: number };

// Luminance of RGBA pixels, NaN where either picture has no data (transparent or empty black).
function brightness(px: Uint8ClampedArray, decode: Decode, emptyIsBlack: boolean): Float32Array {
  const out = new Float32Array(px.length / 4);
  for (let i = 0, j = 0; i < px.length; i += 4, j++) {
    const r = px[i], g = px[i + 1], b = px[i + 2], a = px[i + 3];
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    out[j] = a < 128 || (emptyIsBlack && r + g + b < 6) ? NaN : decode(lum);
  }
  return out;
}

// 3x3 mean, skipping missing pixels: radar speckle and photo noise would otherwise light up
// single pixels everywhere.
function smooth(v: Float32Array, w: number, h: number): Float32Array {
  const out = new Float32Array(v.length);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (Number.isNaN(v[y * w + x])) {
        out[y * w + x] = NaN;
        continue;
      }
      let sum = 0, n = 0;
      for (let dy = -1; dy <= 1; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= h) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx;
          if (xx < 0 || xx >= w) continue;
          const s = v[yy * w + xx];
          if (!Number.isNaN(s)) (sum += s), n++;
        }
      }
      out[y * w + x] = sum / n;
    }
  }
  return out;
}

/**
 * Which pixels changed by more than `threshold` (0..1). Returns one code per pixel
 * (0 same, 1 brighter, 2 darker, 255 no data) and the counts.
 */
export function changeMap(
  before: Uint8ClampedArray, after: Uint8ClampedArray, w: number, h: number,
  decodeBefore: Decode, decodeAfter: Decode, threshold: number, emptyIsBlack = false,
): { codes: Uint8Array; stats: ChangeStats } {
  const b = smooth(brightness(before, decodeBefore, emptyIsBlack), w, h);
  const a = smooth(brightness(after, decodeAfter, emptyIsBlack), w, h);
  const codes = new Uint8Array(w * h);
  const stats: ChangeStats = { valid: 0, brighter: 0, darker: 0 };
  for (let i = 0; i < codes.length; i++) {
    if (Number.isNaN(a[i]) || Number.isNaN(b[i])) {
      codes[i] = 255;
      continue;
    }
    stats.valid++;
    const c = relChange(b[i], a[i]);
    if (c > threshold) (codes[i] = 1), stats.brighter++;
    else if (c < -threshold) (codes[i] = 2), stats.darker++;
  }
  return { codes, stats };
}

/** The visible part of a picture, in 0..1 picture coordinates, at zoom `z` around (cx, cy). */
export function viewRect(z: number, cx: number, cy: number): [number, number, number, number] {
  const half = 0.5 / z;
  const x = Math.min(Math.max(cx, half), 1 - half), y = Math.min(Math.max(cy, half), 1 - half);
  return [x - half, y - half, x + half, y + half];
}

/** The part of a lon/lat box that a picture rect shows (y runs from north down). */
export function subBox([w, s, e, n]: [number, number, number, number], [x0, y0, x1, y1]: [number, number, number, number]): [number, number, number, number] {
  return [w + x0 * (e - w), n - y1 * (n - s), w + x1 * (e - w), n - y0 * (n - s)];
}
