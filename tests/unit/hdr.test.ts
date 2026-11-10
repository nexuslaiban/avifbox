import { describe, expect, it } from 'vitest';
import {
  SDR_WHITE,
  hlgToNits,
  measurePeak,
  nitsToPq,
  pqToNits,
  srgbToDisplayP3,
  toneCurve,
  toneMap,
  type HdrImage,
} from '../../src/engine/hdr';

const BT709 = 1;
const BT2020 = 9;

/** Builds a PQ image from per-pixel [r, g, b] in nits (and optional 16-bit alpha). */
function pqImage(pixels: number[][], primaries = BT709): HdrImage {
  const data = new Uint16Array(pixels.length * 4);
  pixels.forEach(([r, g, b, a = 65535], i) => {
    data.set(
      [r, g, b].map((n) => Math.round(nitsToPq(n) * 65535)),
      i * 4,
    );
    data[i * 4 + 3] = a;
  });
  return { data, width: pixels.length, height: 1, transfer: 'pq', primaries };
}

const srgbToLinear = (v: number): number => {
  const s = v / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};
const linearToSrgb = (l: number): number =>
  Math.round(255 * (l <= 0.0031308 ? 12.92 * l : 1.055 * l ** (1 / 2.4) - 0.055));
const pixel = (out: Uint8ClampedArray, i: number): number[] => Array.from(out.subarray(i * 4, i * 4 + 4));
// A bright image area so the measured peak is 1000 nits regardless of the pixel under test.
const peak1000 = Array.from({ length: 50 }, () => [1000, 1000, 1000]);

describe('transfer functions (AC-18)', () => {
  it('PQ hits its reference points', () => {
    expect(pqToNits(0)).toBe(0);
    expect(pqToNits(0.5081)).toBeCloseTo(100, 0);
    expect(pqToNits(0.5807)).toBeCloseTo(203, 0);
    expect(Math.abs(pqToNits(0.7518) - 1000)).toBeLessThan(2);
    expect(pqToNits(1)).toBeCloseTo(10000, 3);
  });

  it('PQ encode and decode are inverses', () => {
    for (const nits of [0.01, 1, 48, 203, 1000, 4000, 10000]) {
      expect(pqToNits(nitsToPq(nits)) / nits).toBeCloseTo(1, 6);
    }
  });

  it('HLG hits its reference points on a 1000-nit display', () => {
    expect(hlgToNits(0.75, 0.75, 0.75)[0]).toBeCloseTo(203, 0);
    expect(hlgToNits(0.5, 0.5, 0.5)[1]).toBeCloseTo(50.7, 0);
    expect(hlgToNits(1, 1, 1)[2]).toBeCloseTo(1000, 3);
    expect(hlgToNits(0, 0, 0)).toEqual([0, 0, 0]);
  });
});

describe('toneCurve (AC-18)', () => {
  const curve = toneCurve(1000);

  it('is the identity below the knee', () => {
    for (const nits of [0, 1, 18, 50, 80]) expect(curve(nits)).toBeCloseTo(nits, 6);
  });

  it('maps the source peak to SDR white and never exceeds it', () => {
    expect(curve(1000)).toBeCloseTo(SDR_WHITE, 3);
    expect(curve(4000)).toBeCloseTo(SDR_WHITE, 3);
  });

  it('is monotonic and compresses highlights', () => {
    let last = -1;
    for (let nits = 0; nits <= 1000; nits += 5) {
      const mapped = curve(nits);
      expect(mapped).toBeGreaterThanOrEqual(last);
      expect(mapped).toBeLessThanOrEqual(nits + 1e-9);
      last = mapped;
    }
    expect(curve(600)).toBeLessThan(curve(1000));
  });

  it('leaves an image that already fits in SDR untouched', () => {
    const sdr = toneCurve(150);
    for (const nits of [0, 40, 150]) expect(sdr(nits)).toBeCloseTo(nits, 6);
  });
});

describe('measurePeak', () => {
  it('ignores a handful of outlier pixels', () => {
    const image = pqImage([...Array.from({ length: 3000 }, () => [1000, 400, 100]), [10000, 10000, 10000]]);
    expect(Math.abs(measurePeak(image) - 1000)).toBeLessThan(5);
  });

  it('never reports less than SDR white', () => {
    expect(measurePeak(pqImage([[50, 50, 50]]))).toBe(SDR_WHITE);
  });
});

describe('toneMap (AC-18)', () => {
  it('renders SDR-range greys colourimetrically', () => {
    const out = toneMap(pqImage([...peak1000, [100, 100, 100], [0, 0, 0]]), 'brightness', 'srgb');
    const expected = linearToSrgb(100 / SDR_WHITE);
    for (const c of pixel(out, 50).slice(0, 3)) expect(Math.abs(c - expected)).toBeLessThanOrEqual(1);
    expect(pixel(out, 51)).toEqual([0, 0, 0, 255]);
  });

  it('follows the tone curve for neutral highlights in both modes', () => {
    const curve = toneCurve(1000);
    for (const mode of ['brightness', 'colour'] as const) {
      const out = toneMap(pqImage([...peak1000, [480, 480, 480]]), mode, 'srgb');
      const expected = linearToSrgb(curve(480) / SDR_WHITE);
      for (const c of pixel(out, 50).slice(0, 3)) expect(Math.abs(c - expected)).toBeLessThanOrEqual(1);
      expect(pixel(out, 0)).toEqual([255, 255, 255, 255]); // the peak lands on white
    }
  });

  it('Keep colour preserves the ratio between channels', () => {
    const out = toneMap(pqImage([...peak1000, [1000, 500, 250]]), 'colour', 'srgb');
    const [r, g, b] = pixel(out, 50).map(srgbToLinear);
    expect(r).toBeCloseTo(1, 2);
    expect(g / r).toBeCloseTo(0.5, 1);
    expect(b / r).toBeCloseTo(0.25, 1);
  });

  it('Keep brightness preserves luminance and gives up saturation instead', () => {
    const source = [1000, 500, 250];
    const luminance = 0.2126 * source[0] + 0.7152 * source[1] + 0.0722 * source[2];
    const out = toneMap(pqImage([...peak1000, source]), 'brightness', 'srgb');
    const [r, g, b] = pixel(out, 50).map(srgbToLinear);
    expect(0.2126 * r + 0.7152 * g + 0.0722 * b).toBeCloseTo(toneCurve(1000)(luminance) / SDR_WHITE, 1);
    expect(g / r).toBeGreaterThan(0.55); // closer to white than the 0.5 ratio Keep colour holds
  });

  it('gives different results for the two modes on a saturated highlight', () => {
    const image = pqImage([...peak1000, [1000, 0, 0]], BT2020);
    expect(pixel(toneMap(image, 'brightness', 'srgb'), 50)).not.toEqual(pixel(toneMap(image, 'colour', 'srgb'), 50));
  });

  it('keeps out-of-gamut colours inside the output range without flipping their hue', () => {
    const out = toneMap(pqImage([...peak1000, [0, 60, 0]], BT2020), 'colour', 'srgb');
    const [r, g, b] = pixel(out, 50);
    expect(g).toBeGreaterThan(r);
    expect(g).toBeGreaterThan(b);
    expect(g).toBeGreaterThan(100);
  });

  it('keeps more saturation in Display P3 than in sRGB', () => {
    const image = pqImage([...peak1000, [0, 60, 0]], BT2020);
    const srgb = pixel(toneMap(image, 'colour', 'srgb'), 50);
    const p3 = pixel(toneMap(image, 'colour', 'display-p3'), 50);
    // Both pull the most negative channel (red) up to zero; the wider gamut needs less grey to do
    // it, which shows as less blue mixed into the green.
    expect([srgb[0], p3[0]]).toEqual([0, 0]);
    expect(p3[2]).toBeLessThan(srgb[2]);
  });

  it('decodes HLG with the 1000-nit system gamma', () => {
    const signal = Math.round(0.75 * 65535);
    const image: HdrImage = {
      data: Uint16Array.from([signal, signal, signal, 65535]),
      width: 1,
      height: 1,
      transfer: 'hlg',
      primaries: BT2020,
    };
    // 203 nits is exactly SDR white, and with no brighter pixel there is nothing to compress.
    expect(pixel(toneMap(image, 'brightness', 'srgb'), 0)).toEqual([255, 255, 255, 255]);
  });

  it('scales 16-bit alpha to 8-bit', () => {
    const out = toneMap(
      pqImage([
        [100, 100, 100, 0],
        [100, 100, 100, 32768],
        [100, 100, 100, 65535],
      ]),
      'colour',
      'srgb',
    );
    expect([out[3], out[7], out[11]]).toEqual([0, 128, 255]);
  });
});

describe('toneMap accuracy', () => {
  // Exact per-pixel reference for BT.709 sources (no gamut change), written without lookup tables.
  function reference(pixel: number[], peak: number, mode: 'brightness' | 'colour'): number[] {
    const [r, g, b] = pixel;
    const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    const level = mode === 'colour' ? Math.max(r, g, b) : luminance;
    const scale = level > 0 ? toneCurve(peak)(Math.min(level, peak)) / level / SDR_WHITE : 0;
    let out = [r * scale, g * scale, b * scale];
    const high = Math.max(...out);
    if (high > 1) {
      const y = Math.min(luminance * scale, 1);
      out =
        mode === 'brightness' ? out.map((c) => y + ((1 - y) / (high - y)) * (c - y)) : out.map((c) => Math.min(c, 1));
    }
    return out.map((c) => linearToSrgb(Math.min(Math.max(c, 0), 1)));
  }

  it('matches the exact formula within one level, including just below the peak', () => {
    const pixels: number[][] = [];
    let seed = 12345;
    const random = () => (seed = (Math.imul(seed, 1103515245) + 12345) >>> 0) / 2 ** 32;
    for (let i = 0; i < 400; i++) {
      const top = 1000 * (i < 200 ? 0.9 + 0.1 * random() : random()); // half of them crowd the peak
      pixels.push([top, top * random(), top * random() * random()].sort(() => random() - 0.5));
    }
    pixels.push(...peak1000);
    const image = pqImage(pixels);
    const peak = measurePeak(image);
    for (const mode of ['brightness', 'colour'] as const) {
      const out = toneMap(image, mode, 'srgb');
      let worst = 0;
      pixels.forEach((_, i) => {
        // The image stores PQ codes, so compare against what those codes actually say.
        const stored = Array.from(image.data.subarray(i * 4, i * 4 + 3), (code) => pqToNits(code / 65535));
        const expected = reference(stored, peak, mode);
        for (let c = 0; c < 3; c++) worst = Math.max(worst, Math.abs(out[i * 4 + c] - expected[c]));
      });
      expect(worst, `${mode}: worst channel error`).toBeLessThanOrEqual(1);
    }
  });

  it('keeps a grey ramp monotonic', () => {
    const ramp = Array.from({ length: 2000 }, (_, i) => [i / 2, i / 2, i / 2]);
    const out = toneMap(pqImage(ramp), 'brightness', 'srgb');
    for (let i = 1; i < ramp.length; i++) expect(out[i * 4]).toBeGreaterThanOrEqual(out[(i - 1) * 4]);
  });
});

describe('srgbToDisplayP3', () => {
  it('leaves neutral colours alone and re-expresses saturated ones', () => {
    expect(srgbToDisplayP3([255, 255, 255])).toEqual([255, 255, 255]);
    expect(srgbToDisplayP3([0, 0, 0])).toEqual([0, 0, 0]);
    expect(srgbToDisplayP3([128, 128, 128])).toEqual([128, 128, 128]);
    // sRGB red is color(display-p3 0.9175 0.2003 0.1386)
    expect(srgbToDisplayP3([255, 0, 0])).toEqual([234, 51, 35]);
  });
});
