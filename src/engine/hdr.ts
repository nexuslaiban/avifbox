import type { Gamut, ToneMode } from './types';

// HDR (PQ / HLG) to 8-bit SDR.
//
// 1. Transfer function -> absolute display light in nits.
// 2. Source primaries -> output gamut (sRGB or Display P3), colours outside it pulled toward grey.
// 3. Highlights compressed with the BT.2390 knee so the image's own peak lands on SDR white
//    (203 nits, BT.2408). Everything below the knee is left exactly as mastered.
// 4. sRGB transfer curve, 8 bits.

export const SDR_WHITE = 203;
const HLG_PEAK = 1000;
const HLG_GAMMA = 1.2;

export interface HdrImage {
  /** RGBA, 16 bits per channel, still encoded with the source transfer function. */
  data: Uint16Array;
  width: number;
  height: number;
  transfer: 'pq' | 'hlg';
  /** CICP colour primaries of the source. */
  primaries: number;
}

// ---- transfer functions ----

const PQ_M1 = 2610 / 16384;
const PQ_M2 = (2523 / 4096) * 128;
const PQ_C1 = 3424 / 4096;
const PQ_C2 = (2413 / 4096) * 32;
const PQ_C3 = (2392 / 4096) * 32;

/** SMPTE ST 2084 EOTF: signal in [0, 1] to nits. */
export function pqToNits(signal: number): number {
  const p = Math.max(signal, 0) ** (1 / PQ_M2);
  return 10000 * (Math.max(p - PQ_C1, 0) / (PQ_C2 - PQ_C3 * p)) ** (1 / PQ_M1);
}

export function nitsToPq(nits: number): number {
  const y = (Math.max(nits, 0) / 10000) ** PQ_M1;
  return ((PQ_C1 + PQ_C2 * y) / (1 + PQ_C3 * y)) ** PQ_M2;
}

const HLG_A = 0.17883277;
const HLG_B = 0.28466892;
const HLG_C = 0.55991073;

/** BT.2100 HLG inverse OETF: signal to scene light in [0, 1]. */
function hlgToScene(signal: number): number {
  return signal <= 0.5 ? (signal * signal) / 3 : (Math.exp((signal - HLG_C) / HLG_A) + HLG_B) / 12;
}

/** HLG signal to display light on a 1000-nit display (BT.2100 OOTF, system gamma 1.2). */
export function hlgToNits(r: number, g: number, b: number): [number, number, number] {
  const scene = [hlgToScene(r), hlgToScene(g), hlgToScene(b)];
  const [wr, wg, wb] = luminanceWeights(PRIMARIES.bt2020);
  const gain = HLG_PEAK * (wr * scene[0] + wg * scene[1] + wb * scene[2]) ** (HLG_GAMMA - 1);
  return [scene[0] * gain, scene[1] * gain, scene[2] * gain];
}

// ---- colour spaces ----

type Matrix = number[]; // 3x3, row-major
type Chromaticities = readonly [number, number, number, number, number, number];

const D65 = [0.3127, 0.329] as const;
const PRIMARIES = {
  bt709: [0.64, 0.33, 0.3, 0.6, 0.15, 0.06],
  p3: [0.68, 0.32, 0.265, 0.69, 0.15, 0.06],
  bt2020: [0.708, 0.292, 0.17, 0.797, 0.131, 0.046],
} as const satisfies Record<string, Chromaticities>;

function multiply(a: Matrix, b: Matrix): Matrix {
  const out = new Array<number>(9).fill(0);
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) for (let k = 0; k < 3; k++) out[r * 3 + c] += a[r * 3 + k] * b[k * 3 + c];
  return out;
}

function invert(m: Matrix): Matrix {
  const [a, b, c, d, e, f, g, h, i] = m;
  const det = a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g);
  return [e * i - f * h, c * h - b * i, b * f - c * e, f * g - d * i, a * i - c * g, c * d - a * f, d * h - e * g, b * g - a * h, a * e - b * d].map(
    (v) => v / det,
  );
}

/** Linear RGB -> CIE XYZ for a D65 colour space given by its primaries. */
function rgbToXyz([xr, yr, xg, yg, xb, yb]: Chromaticities): Matrix {
  const xyz = (x: number, y: number): number[] => [x / y, 1, (1 - x - y) / y];
  const [r, g, b] = [xyz(xr, yr), xyz(xg, yg), xyz(xb, yb)];
  const primaries = [r[0], g[0], b[0], r[1], g[1], b[1], r[2], g[2], b[2]];
  const white = xyz(D65[0], D65[1]);
  const inverse = invert(primaries);
  const scale = [0, 1, 2].map((row) => inverse[row * 3] * white[0] + inverse[row * 3 + 1] * white[1] + inverse[row * 3 + 2] * white[2]);
  return primaries.map((v, index) => v * scale[index % 3]);
}

function luminanceWeights(primaries: Chromaticities): number[] {
  return rgbToXyz(primaries).slice(3, 6);
}

/** HDR files that do not say otherwise are BT.2020; DCI-P3 (11) is read as Display P3 (12). */
function sourcePrimaries(cicp: number): Chromaticities {
  if (cicp === 1) return PRIMARIES.bt709;
  if (cicp === 11 || cicp === 12) return PRIMARIES.p3;
  return PRIMARIES.bt2020;
}

// ---- tone mapping ----

/**
 * BT.2390 EETF from a source peak down to SDR white, applied in PQ space: the identity up to a
 * knee, then a Hermite roll-off that reaches SDR white exactly at the peak.
 */
export function toneCurve(peak: number): (nits: number) => number {
  if (peak <= SDR_WHITE) return (nits) => Math.min(nits, SDR_WHITE);
  const source = nitsToPq(peak);
  const target = nitsToPq(SDR_WHITE) / source;
  const knee = 1.5 * target - 0.5;
  return (nits) => {
    const e = Math.min(nitsToPq(nits) / source, 1);
    if (e < knee) return nits;
    const t = (e - knee) / (1 - knee);
    const t2 = t * t;
    const t3 = t2 * t;
    const rolled = (2 * t3 - 3 * t2 + 1) * knee + (t3 - 2 * t2 + t) * (1 - knee) + (-2 * t3 + 3 * t2) * target;
    return pqToNits(rolled * source);
  };
}

/** Brightest content level in nits: the 99.9th percentile, so a few stray pixels cannot set it. */
export function measurePeak(image: HdrImage): number {
  const histogram = new Uint32Array(65536);
  const { data } = image;
  for (let p = 0; p < data.length; p += 4) histogram[Math.max(data[p], data[p + 1], data[p + 2])]++;
  let allowed = (data.length / 4) * 0.001;
  let code = 65535;
  while (code > 0 && allowed >= histogram[code]) allowed -= histogram[code--];
  const signal = code / 65535;
  const nits = image.transfer === 'pq' ? pqToNits(signal) : hlgToNits(signal, signal, signal)[0];
  return Math.max(nits, SDR_WHITE);
}

const CURVE_STEPS = 4096;
const OETF_STEPS = 16384;

const SRGB_OETF = (() => {
  const lut = new Uint8Array(OETF_STEPS + 1);
  for (let i = 0; i <= OETF_STEPS; i++) {
    const l = i / OETF_STEPS;
    lut[i] = Math.round(255 * (l <= 0.0031308 ? 12.92 * l : 1.055 * l ** (1 / 2.4) - 0.055));
  }
  return lut;
})();

/**
 * Tone-maps to 8-bit RGBA in the requested gamut.
 *
 * `colour` scales all three channels by one factor chosen from the brightest channel, so hue and
 * saturation survive and saturated highlights get darker. `brightness` chooses the factor from
 * luminance, keeps luminance, and lets highlights that no longer fit fade toward white.
 */
export function toneMap(image: HdrImage, mode: ToneMode, gamut: Gamut): Uint8ClampedArray {
  const { data } = image;
  const out = new Uint8ClampedArray(data.length);
  const isPq = image.transfer === 'pq';
  const source = sourcePrimaries(image.primaries);
  const target = gamut === 'display-p3' ? PRIMARIES.p3 : PRIMARIES.bt709;
  const m = multiply(invert(rgbToXyz(target)), rgbToXyz(source));
  const [wr, wg, wb] = luminanceWeights(target);
  const [sr, sg, sb] = luminanceWeights(source);

  // Signal -> nits (PQ) or scene light (HLG, which still needs the per-pixel OOTF gain).
  const eotf = new Float32Array(65536);
  for (let i = 0; i < 65536; i++) eotf[i] = isPq ? pqToNits(i / 65535) : hlgToScene(i / 65535);

  // Scale factor (including the division by SDR white) indexed by the 4th root of level / peak.
  const peak = measurePeak(image);
  const curve = toneCurve(peak);
  const scales = new Float32Array(CURVE_STEPS + 1);
  for (let i = 0; i <= CURVE_STEPS; i++) {
    const level = peak * (i / CURVE_STEPS) ** 4;
    scales[i] = level > 0 ? curve(level) / level / SDR_WHITE : 1 / SDR_WHITE;
  }

  for (let p = 0; p < data.length; p += 4) {
    let r0 = eotf[data[p]];
    let g0 = eotf[data[p + 1]];
    let b0 = eotf[data[p + 2]];
    if (!isPq) {
      const gain = HLG_PEAK * (sr * r0 + sg * g0 + sb * b0) ** (HLG_GAMMA - 1);
      r0 *= gain;
      g0 *= gain;
      b0 *= gain;
    }
    let r = m[0] * r0 + m[1] * g0 + m[2] * b0;
    let g = m[3] * r0 + m[4] * g0 + m[5] * b0;
    let b = m[6] * r0 + m[7] * g0 + m[8] * b0;
    const luminance = wr * r + wg * g + wb * b;

    // Outside the output gamut: move toward grey of the same luminance until no channel is negative.
    const low = Math.min(r, g, b);
    if (low < 0) {
      const t = luminance > 0 ? luminance / (luminance - low) : 0;
      r = luminance + t * (r - luminance);
      g = luminance + t * (g - luminance);
      b = luminance + t * (b - luminance);
    }

    const level = mode === 'colour' ? Math.max(r, g, b) : luminance;
    const scale = level >= peak ? 1 / level : scales[Math.round(Math.sqrt(Math.sqrt(level / peak)) * CURVE_STEPS)];
    r *= scale;
    g *= scale;
    b *= scale;

    // Keep brightness: a channel still above white is desaturated toward the (in-range) luminance.
    const high = Math.max(r, g, b);
    if (high > 1) {
      const y = Math.min(luminance * scale, 1);
      const t = (1 - y) / (high - y);
      r = y + t * (r - y);
      g = y + t * (g - y);
      b = y + t * (b - y);
    }

    out[p] = SRGB_OETF[Math.round(Math.max(r, 0) * OETF_STEPS)];
    out[p + 1] = SRGB_OETF[Math.round(Math.max(g, 0) * OETF_STEPS)];
    out[p + 2] = SRGB_OETF[Math.round(Math.max(b, 0) * OETF_STEPS)];
    out[p + 3] = Math.round(data[p + 3] / 257);
  }
  return out;
}
