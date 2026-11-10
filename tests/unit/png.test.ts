import { describe, expect, it } from 'vitest';
import { ApngWriter, encodePng } from '../../src/engine/png';
import { displayP3Profile } from '../../src/engine/icc';
import { bytesOf, decodePng, inflateSync, pngChunks, u16, u32 } from './helpers';

function image(width: number, height: number, at: (x: number, y: number) => number[]): Uint8Array {
  const out = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) out.set(at(x, y), (y * width + x) * 4);
  return out;
}

// Deterministic noise so every filter type gets exercised.
function noise(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s >>> 24;
  };
}

const colourType = (png: Uint8Array): number => pngChunks(png)[0].data[9];
const types = (png: Uint8Array): string[] => pngChunks(png).map((c) => c.type);

describe('encodePng (AC-16)', () => {
  it('round-trips translucent truecolour as RGBA', async () => {
    const rand = noise(1);
    const src = image(37, 29, (x, y) => [rand(), (x * 7) & 255, (y * 9) & 255, rand()]);
    const png = await bytesOf(await encodePng(src, 37, 29, { mode: 'truecolor' }));
    expect(colourType(png)).toBe(6);
    expect(decodePng(png)).toEqual({ width: 37, height: 29, data: src });
  });

  it('writes opaque truecolour without an alpha channel', async () => {
    const src = image(64, 40, (x, y) => [x * 4, y * 6, (x * y) & 255, 255]);
    const png = await bytesOf(await encodePng(src, 64, 40, { mode: 'truecolor' }));
    expect(colourType(png)).toBe(2);
    expect(decodePng(png).data).toEqual(src);
  });

  it('writes 256 colours or fewer as an exact palette, even in truecolor mode', async () => {
    const src = image(48, 48, (x, y) => [(x >> 3) * 40, (y >> 3) * 40, 128, x < 8 ? 0 : y < 8 ? 128 : 255]);
    const png = await bytesOf(await encodePng(src, 48, 48, { mode: 'truecolor' }));
    expect(colourType(png)).toBe(3);
    expect(types(png)).toEqual(['IHDR', 'PLTE', 'tRNS', 'IDAT', 'IEND']);
    expect(decodePng(png).data).toEqual(src);
  });

  it('omits tRNS for an opaque palette', async () => {
    const src = image(16, 16, (x, y) => [x * 16, y * 16, 0, 255]);
    const png = await bytesOf(await encodePng(src, 16, 16, { mode: 'truecolor' }));
    expect(types(png)).toEqual(['IHDR', 'PLTE', 'IDAT', 'IEND']);
    expect(decodePng(png).data).toEqual(src);
  });

  it('reduces a many-colour image to a palette in optimized mode', async () => {
    const src = image(256, 64, (x, y) => [x, 80 + (x >> 2) + y, 200 - (x >> 3), 255]);
    const truecolor = await bytesOf(await encodePng(src, 256, 64, { mode: 'truecolor' }));
    const optimized = await bytesOf(await encodePng(src, 256, 64, { mode: 'optimized' }));
    expect(colourType(truecolor)).toBe(2);
    expect(colourType(optimized)).toBe(3);
    const plte = pngChunks(optimized).find((c) => c.type === 'PLTE')!;
    expect(plte.data.length / 3).toBeLessThanOrEqual(256);
    const out = decodePng(optimized);
    expect([out.width, out.height]).toEqual([256, 64]);
  });

  it('embeds an ICC profile right after IHDR', async () => {
    const icc = displayP3Profile();
    const src = image(4, 4, (x, y) => [x * 60, y * 60, 0, 255]);
    const png = await bytesOf(await encodePng(src, 4, 4, { mode: 'truecolor', icc }));
    const chunks = pngChunks(png);
    expect(chunks[1].type).toBe('iCCP');
    const nameEnd = chunks[1].data.indexOf(0);
    expect(String.fromCharCode(...chunks[1].data.subarray(0, nameEnd))).toBe('Display P3');
    expect(chunks[1].data[nameEnd + 1]).toBe(0); // compression method: deflate
    expect(new Uint8Array(inflateSync(chunks[1].data.subarray(nameEnd + 2)))).toEqual(icc);
    expect(decodePng(png).data).toEqual(src);
  });

  it('writes no colour profile unless asked', async () => {
    const png = await bytesOf(
      await encodePng(
        image(2, 2, () => [1, 2, 3, 255]),
        2,
        2,
        { mode: 'truecolor' },
      ),
    );
    expect(types(png)).not.toContain('iCCP');
  });

  it('handles a 1x1 image', async () => {
    const src = Uint8Array.from([9, 8, 7, 6]);
    const png = await bytesOf(await encodePng(src, 1, 1, { mode: 'truecolor' }));
    expect(decodePng(png).data).toEqual(src);
  });
});

describe('ApngWriter (AC-16)', () => {
  const frames = [0, 1, 2].map((n) => image(20, 10, (x, y) => [x * 12, y * 25, n * 100, x === n ? 0 : 255]));

  async function build(): Promise<Uint8Array> {
    const writer = new ApngWriter(20, 10, { loops: 0 });
    for (const [i, rgba] of frames.entries()) await writer.add(rgba, 200 + i);
    return bytesOf(writer.finish());
  }

  it('lays out acTL, fcTL, IDAT and fdAT with consecutive sequence numbers', async () => {
    const chunks = pngChunks(await build());
    expect(chunks.map((c) => c.type)).toEqual(['IHDR', 'acTL', 'fcTL', 'IDAT', 'fcTL', 'fdAT', 'fcTL', 'fdAT', 'IEND']);
    const acTL = chunks[1].data;
    expect([u32(acTL, 0), u32(acTL, 4)]).toEqual([3, 0]);
    const sequence = chunks.filter((c) => c.type === 'fcTL' || c.type === 'fdAT').map((c) => u32(c.data, 0));
    expect(sequence).toEqual([0, 1, 2, 3, 4]);
  });

  it('records frame size and delay in every fcTL', async () => {
    const fcTLs = pngChunks(await build()).filter((c) => c.type === 'fcTL');
    fcTLs.forEach((c, i) => {
      expect([u32(c.data, 4), u32(c.data, 8), u32(c.data, 12), u32(c.data, 16)]).toEqual([20, 10, 0, 0]);
      expect(u16(c.data, 20) / u16(c.data, 22)).toBeCloseTo((200 + i) / 1000, 6);
    });
  });

  it('stores every frame losslessly', async () => {
    const png = await build();
    const chunks = pngChunks(png);
    // The default image (IDAT) is frame 0; a plain PNG decoder reads exactly that.
    expect(decodePng(png).data).toEqual(frames[0]);
    const ihdr = chunks[0].data;
    const view = new DataView(ihdr.buffer, ihdr.byteOffset, ihdr.byteLength);
    const stride = view.getUint32(0) * 4 + 1;
    chunks
      .filter((c) => c.type === 'fdAT')
      .forEach((c, i) => {
        const raw = new Uint8Array(inflateSync(c.data.subarray(4)));
        expect(raw.length).toBe(stride * view.getUint32(4));
        expect(unfilter(raw, 20, 10)).toEqual(frames[i + 1]);
      });
  });

  it('writes the loop count and refuses an empty animation', async () => {
    const writer = new ApngWriter(20, 10, { loops: 3 });
    expect(() => writer.finish()).toThrow();
    await writer.add(frames[0], 100);
    expect(u32(pngChunks(await bytesOf(writer.finish()))[1].data, 4)).toBe(3);
  });
});

/** Reverses PNG scanline filtering for 8-bit RGBA. */
function unfilter(raw: Uint8Array, width: number, height: number): Uint8Array {
  const bpp = 4;
  const stride = width * bpp;
  const out = new Uint8Array(stride * height);
  for (let y = 0; y < height; y++) {
    const type = raw[y * (stride + 1)];
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? out[y * stride + x - bpp] : 0;
      const b = y > 0 ? out[(y - 1) * stride + x] : 0;
      const c = x >= bpp && y > 0 ? out[(y - 1) * stride + x - bpp] : 0;
      const p = a + b - c;
      const pa = Math.abs(p - a);
      const pb = Math.abs(p - b);
      const pc = Math.abs(p - c);
      const paeth = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      const predictor = [0, a, b, (a + b) >> 1, paeth][type];
      out[y * stride + x] = (raw[y * (stride + 1) + 1 + x] + predictor) & 255;
    }
  }
  return out;
}
