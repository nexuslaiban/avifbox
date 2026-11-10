import type { Pixels } from './types';

// Reduces an RGBA image to a palette of at most 256 colours.
//
// Pixels are split into three classes that never share a palette entry, so the two invariants users
// can see hold by construction rather than by tuning:
//   fully transparent (a = 0)  -> one dedicated entry
//   translucent (0 < a < 255)  -> translucent entries
//   opaque (a = 255)           -> opaque entries (alpha exactly 255)
// The palette is ordered transparent, translucent, opaque.

export interface Palette {
  /** RGBA quadruplets. */
  colors: Uint8Array;
  /** One palette index per pixel. */
  indices: Uint8Array;
}

/** Lossless palette for images with at most 256 distinct RGBA values, otherwise null. */
export function exactPalette(rgba: Pixels): Palette | null {
  const pixels = rgba.length >> 2;
  const seen = new Map<number, number>();
  const indices = new Uint8Array(pixels);
  let lastKey = -1;
  let lastIndex = 0;
  for (let i = 0, p = 0; i < pixels; i++, p += 4) {
    const key = (rgba[p] | (rgba[p + 1] << 8) | (rgba[p + 2] << 16) | (rgba[p + 3] << 24)) >>> 0;
    if (key !== lastKey) {
      let index = seen.get(key);
      if (index === undefined) {
        if (seen.size === 256) return null;
        index = seen.size;
        seen.set(key, index);
      }
      lastKey = key;
      lastIndex = index;
    }
    indices[i] = lastIndex;
  }
  const colors = new Uint8Array(seen.size * 4);
  for (const [key, index] of seen) {
    colors.set([key & 255, (key >>> 8) & 255, (key >>> 16) & 255, key >>> 24], index * 4);
  }
  return { colors, indices };
}

const OPAQUE_LEVEL = 31;
const BIN_COUNT = 1 << 20; // 5 bits each for r, g, b and the alpha level
const ALPHA_WEIGHT = 4; // an alpha step costs more than a colour step
const KMEANS_ROUNDS = 3;
const DITHER = 0.75; // share of the quantization error diffused to neighbours

/** Opaque pixels get a level of their own so they can never be averaged with translucent ones. */
function binKey(r: number, g: number, b: number, a: number): number {
  const level = a === 255 ? OPAQUE_LEVEL : Math.min(a >> 3, OPAQUE_LEVEL - 1);
  return ((r >> 3) << 15) | ((g >> 3) << 10) | ((b >> 3) << 5) | level;
}

/** Weighted colour statistics of the image, one entry per occupied histogram bin. */
interface Histogram {
  size: number;
  weight: Float64Array;
  /** Mean r, g, b, a per bin. */
  channels: Float64Array[];
  opaque: Uint8Array;
  /** Bin key -> bin index, -1 when empty. */
  binOf: Int32Array;
  hasTransparent: boolean;
}

function histogram(rgba: Pixels): Histogram {
  const binOf = new Int32Array(BIN_COUNT).fill(-1);
  let capacity = 4096;
  let weight = new Float64Array(capacity);
  let sums = [0, 1, 2, 3].map(() => new Float64Array(capacity));
  const keys: number[] = [];
  let hasTransparent = false;

  for (let p = 0; p < rgba.length; p += 4) {
    const a = rgba[p + 3];
    if (a === 0) {
      hasTransparent = true;
      continue;
    }
    const key = binKey(rgba[p], rgba[p + 1], rgba[p + 2], a);
    let bin = binOf[key];
    if (bin < 0) {
      bin = binOf[key] = keys.length;
      keys.push(key);
      if (bin === capacity) {
        capacity *= 2;
        weight = grow(weight, capacity);
        sums = sums.map((s) => grow(s, capacity));
      }
    }
    weight[bin]++;
    sums[0][bin] += rgba[p];
    sums[1][bin] += rgba[p + 1];
    sums[2][bin] += rgba[p + 2];
    sums[3][bin] += a;
  }

  const size = keys.length;
  const opaque = new Uint8Array(size);
  for (let bin = 0; bin < size; bin++) {
    opaque[bin] = (keys[bin] & 31) === OPAQUE_LEVEL ? 1 : 0;
    for (const s of sums) s[bin] /= weight[bin];
  }
  return { size, weight, channels: sums, opaque, binOf, hasTransparent };
}

function grow(source: Float64Array, capacity: number): Float64Array<ArrayBuffer> {
  const next = new Float64Array(capacity);
  next.set(source);
  return next;
}

interface Box {
  start: number;
  end: number;
  /** Weighted variance along `axis`; 0 when the box cannot be split. */
  score: number;
  axis: number;
  cut: number;
}

/** Median cut over histogram bins. Returns the bins of each box as ranges of `order`. */
function medianCut(h: Histogram, budget: number): { order: Int32Array; boxes: Box[] } {
  const order = new Int32Array(h.size);
  // Seed with one box per class so translucent and opaque bins never end up together.
  let translucent = 0;
  for (let bin = 0; bin < h.size; bin++) if (!h.opaque[bin]) order[translucent++] = bin;
  for (let bin = 0, at = translucent; bin < h.size; bin++) if (h.opaque[bin]) order[at++] = bin;

  const measure = (start: number, end: number): Box => {
    let total = 0;
    let score = 0;
    let axis = 0;
    let cut = 0;
    for (let c = 0; c < 4; c++) {
      const values = h.channels[c];
      let sum = 0;
      let squares = 0;
      let w = 0;
      for (let i = start; i < end; i++) {
        const bin = order[i];
        w += h.weight[bin];
        sum += h.weight[bin] * values[bin];
        squares += h.weight[bin] * values[bin] * values[bin];
      }
      total = w;
      const variance = squares - (sum * sum) / w;
      if (variance > score) {
        score = variance;
        axis = c;
        cut = sum / w;
      }
    }
    return { start, end, score: end - start > 1 && total > 0 && score > 1e-6 ? score : 0, axis, cut };
  };

  const boxes: Box[] = [];
  if (translucent > 0) boxes.push(measure(0, translucent));
  if (translucent < h.size) boxes.push(measure(translucent, h.size));

  while (boxes.length < budget) {
    let widest = 0;
    for (let i = 1; i < boxes.length; i++) if (boxes[i].score > boxes[widest].score) widest = i;
    const box = boxes[widest];
    if (box.score === 0) break;
    const values = h.channels[box.axis];
    let lo = box.start;
    let hi = box.end - 1;
    while (lo <= hi) {
      if (values[order[lo]] < box.cut) {
        lo++;
      } else {
        const swap = order[lo];
        order[lo] = order[hi];
        order[hi--] = swap;
      }
    }
    if (lo === box.start || lo === box.end) {
      box.score = 0;
      continue;
    }
    boxes[widest] = measure(box.start, lo);
    boxes.push(measure(lo, box.end));
  }
  return { order, boxes };
}

/** Float palette split into a translucent range [0, split) and an opaque range [split, size). */
interface Centres {
  size: number;
  split: number;
  channels: Float64Array[];
}

function centresOf(h: Histogram, order: Int32Array, boxes: Box[]): Centres {
  const sorted = [...boxes].sort((a, b) => h.opaque[order[a.start]] - h.opaque[order[b.start]] || a.start - b.start);
  const channels = [0, 1, 2, 3].map(() => new Float64Array(sorted.length));
  let split = sorted.length;
  sorted.forEach((box, index) => {
    if (h.opaque[order[box.start]] && index < split) split = index;
    let w = 0;
    for (let i = box.start; i < box.end; i++) {
      const bin = order[i];
      w += h.weight[bin];
      for (let c = 0; c < 4; c++) channels[c][index] += h.weight[bin] * h.channels[c][bin];
    }
    for (let c = 0; c < 4; c++) channels[c][index] /= w;
  });
  return { size: sorted.length, split, channels };
}

function nearest(k: Centres, r: number, g: number, b: number, a: number, opaque: boolean): number {
  const [cr, cg, cb, ca] = k.channels;
  const from = opaque ? k.split : 0;
  const to = opaque ? k.size : k.split;
  let best = from;
  let bestDistance = Infinity;
  for (let i = from; i < to; i++) {
    const dr = r - cr[i];
    const dg = g - cg[i];
    const db = b - cb[i];
    const da = a - ca[i];
    const distance = dr * dr + dg * dg + db * db + ALPHA_WEIGHT * da * da;
    if (distance < bestDistance) {
      bestDistance = distance;
      best = i;
    }
  }
  return best;
}

/** Lloyd iterations over the histogram; returns the final bin -> centre assignment. */
function refine(h: Histogram, k: Centres): Int16Array {
  const assignment = new Int16Array(h.size);
  const [hr, hg, hb, ha] = h.channels;
  for (let round = 0; round <= KMEANS_ROUNDS; round++) {
    const sums = [0, 1, 2, 3].map(() => new Float64Array(k.size));
    const weights = new Float64Array(k.size);
    for (let bin = 0; bin < h.size; bin++) {
      const centre = nearest(k, hr[bin], hg[bin], hb[bin], ha[bin], h.opaque[bin] === 1);
      assignment[bin] = centre;
      const w = h.weight[bin];
      weights[centre] += w;
      for (let c = 0; c < 4; c++) sums[c][centre] += w * h.channels[c][bin];
    }
    if (round === KMEANS_ROUNDS) break; // last pass only assigns, so `assignment` matches the final centres
    for (let i = 0; i < k.size; i++) {
      if (weights[i] === 0) continue;
      for (let c = 0; c < 4; c++) k.channels[c][i] = sums[c][i] / weights[i];
    }
  }
  return assignment;
}

/** Lossy reduction to at most `maxColors` colours (minimum 3) with Floyd–Steinberg dithering. */
export function quantize(rgba: Pixels, width: number, height: number, maxColors = 256): Palette {
  const h = histogram(rgba);
  const reserved = h.hasTransparent ? 1 : 0;
  const indices = new Uint8Array(width * height);
  if (h.size === 0) return { colors: new Uint8Array(4), indices };

  const { order, boxes } = medianCut(h, Math.max(2, maxColors - reserved));
  const k = centresOf(h, order, boxes);
  const assignment = refine(h, k);

  const colors = new Uint8Array((k.size + reserved) * 4);
  for (let i = 0; i < k.size; i++) {
    for (let c = 0; c < 4; c++) colors[(i + reserved) * 4 + c] = Math.round(k.channels[c][i]);
  }

  // Bin key -> centre. Seeded from the histogram; bins only reached through dithering fill in lazily.
  const centreOf = new Int16Array(BIN_COUNT).fill(-1);
  for (let key = 0; key < BIN_COUNT; key++) if (h.binOf[key] >= 0) centreOf[key] = assignment[h.binOf[key]];

  const row = (width + 2) * 3;
  let errors = new Float32Array(row);
  let nextErrors = new Float32Array(row);
  for (let y = 0, i = 0, p = 0; y < height; y++) {
    for (let x = 0; x < width; x++, i++, p += 4) {
      const a = rgba[p + 3];
      if (a === 0) continue; // index 0 is the transparent entry
      const e = (x + 1) * 3;
      const r = clamp(rgba[p] + errors[e]);
      const g = clamp(rgba[p + 1] + errors[e + 1]);
      const b = clamp(rgba[p + 2] + errors[e + 2]);
      const key = binKey(r, g, b, a);
      let centre = centreOf[key];
      if (centre < 0) centre = centreOf[key] = nearest(k, r, g, b, a, a === 255);
      indices[i] = centre + reserved;

      const scale = (DITHER * a) / 255 / 16;
      for (let c = 0; c < 3; c++) {
        const error = ((c === 0 ? r : c === 1 ? g : b) - k.channels[c][centre]) * scale;
        errors[e + 3 + c] += error * 7;
        nextErrors[e - 3 + c] += error * 3;
        nextErrors[e + c] += error * 5;
        nextErrors[e + 3 + c] += error;
      }
    }
    const swap = errors;
    errors = nextErrors;
    nextErrors = swap.fill(0);
  }
  return { colors, indices };
}

function clamp(value: number): number {
  return value < 0 ? 0 : value > 255 ? 255 : Math.round(value);
}
