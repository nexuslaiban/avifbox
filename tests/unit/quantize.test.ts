import { describe, expect, it } from 'vitest';
import { exactPalette, quantize } from '../../src/engine/quantize';

function image(width: number, height: number, at: (x: number, y: number) => number[]): Uint8Array {
  const out = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) out.set(at(x, y), (y * width + x) * 4);
  return out;
}

function rebuild(palette: { colors: Uint8Array; indices: Uint8Array }): Uint8Array {
  const out = new Uint8Array(palette.indices.length * 4);
  palette.indices.forEach((index, i) => out.set(palette.colors.subarray(index * 4, index * 4 + 4), i * 4));
  return out;
}

function psnr(a: Uint8Array, b: Uint8Array): number {
  let sum = 0;
  let n = 0;
  for (let i = 0; i < a.length; i += 4) {
    for (let c = 0; c < 3; c++) {
      sum += (a[i + c] - b[i + c]) ** 2;
      n++;
    }
  }
  return 10 * Math.log10((255 * 255) / (sum / n));
}

// A sky-like gradient: thousands of colours, all three channels moving.
const sky = image(512, 64, (x, y) => [x >> 1, 80 + (x >> 2) + (y >> 3), 200 - (x >> 3), 255]);

describe('exactPalette', () => {
  it('maps an image with at most 256 colours without loss', () => {
    const src = image(40, 40, (x, y) => [(x % 8) * 32, (y % 8) * 32, 7, (x + y) % 3 === 0 ? 0 : 255]);
    const palette = exactPalette(src);
    expect(palette).not.toBeNull();
    expect(palette!.colors.length / 4).toBeLessThanOrEqual(256);
    expect(rebuild(palette!)).toEqual(src);
  });

  it('gives up on more than 256 colours', () => {
    expect(exactPalette(sky)).toBeNull();
  });

  it('keeps colours that differ only in alpha apart', () => {
    const src = image(2, 1, (x) => [10, 20, 30, x === 0 ? 255 : 254]);
    expect(rebuild(exactPalette(src)!)).toEqual(src);
  });
});

describe('quantize (AC-17)', () => {
  it('returns at most 256 colours and one valid index per pixel', () => {
    const q = quantize(sky, 512, 64);
    const count = q.colors.length / 4;
    expect(count).toBeGreaterThan(64);
    expect(count).toBeLessThanOrEqual(256);
    expect(q.indices.length).toBe(512 * 64);
    expect(Math.max(...q.indices)).toBeLessThan(count);
  });

  it('keeps a smooth gradient above 35 dB', () => {
    expect(psnr(rebuild(quantize(sky, 512, 64)), sky)).toBeGreaterThanOrEqual(35);
  });

  it('honours a smaller colour budget', () => {
    const q = quantize(sky, 512, 64, 16);
    expect(q.colors.length / 4).toBeLessThanOrEqual(16);
    expect(psnr(rebuild(q), sky)).toBeGreaterThan(20);
  });

  it('keeps opaque images opaque', () => {
    const q = quantize(sky, 512, 64);
    for (let i = 3; i < q.colors.length; i += 4) expect(q.colors[i]).toBe(255);
  });

  it('keeps fully transparent pixels fully transparent and opaque pixels opaque', () => {
    // Left third transparent, middle third a soft alpha ramp, right third opaque noise-free gradient.
    const src = image(300, 60, (x, y) => {
      if (x < 100) return [x, y, 99, 0];
      if (x < 200) return [x, 255 - y, y * 4, 1 + ((x - 100) * 253) / 100];
      return [x & 255, y * 4, (x * y) & 255, 255];
    });
    const out = rebuild(quantize(src, 300, 60));
    for (let i = 0; i < src.length; i += 4) {
      if (src[i + 3] === 0) expect(out[i + 3]).toBe(0);
      if (src[i + 3] === 255) expect(out[i + 3]).toBe(255);
    }
  });

  it('is deterministic', () => {
    const a = quantize(sky, 512, 64);
    const b = quantize(sky, 512, 64);
    expect(a.colors).toEqual(b.colors);
    expect(a.indices).toEqual(b.indices);
  });

  it('handles a single-colour image', () => {
    const flat = image(8, 8, () => [1, 2, 3, 255]);
    const q = quantize(flat, 8, 8);
    expect(rebuild(q)).toEqual(flat);
  });
});
