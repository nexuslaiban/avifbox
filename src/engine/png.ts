import { exactPalette, quantize, type Palette } from './quantize';
import type { Pixels } from './types';

// PNG and APNG writer for 8-bit RGBA input. zlib comes from the platform's CompressionStream.

export interface PngOptions {
  /** `truecolor` never changes a pixel; `optimized` reduces many-colour images to a 256-colour palette. */
  mode: 'truecolor' | 'optimized';
  /** ICC profile to embed (iCCP). Pixels are written as given, the profile says how to read them. */
  icc?: Uint8Array;
}

const SIGNATURE = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const COLOUR_RGB = 2;
const COLOUR_PALETTE = 3;
const COLOUR_RGBA = 6;
const ICC_NAME = 'Display P3';

/**
 * Picks the smallest representation that fits the mode: an exact palette when the image has at most
 * 256 colours, otherwise RGB (opaque) or RGBA — or a quantized palette in `optimized` mode.
 */
export async function encodePng(rgba: Pixels, width: number, height: number, options: PngOptions): Promise<Blob> {
  const palette = exactPalette(rgba) ?? (options.mode === 'optimized' ? quantize(rgba, width, height) : null);
  const parts: Uint8Array[] = [SIGNATURE];
  if (palette) {
    const { colors, indices, translucent } = transparentFirst(palette);
    const count = colors.length / 4;
    const plte = new Uint8Array(count * 3);
    const trns = new Uint8Array(translucent);
    for (let i = 0; i < count; i++) {
      plte.set(colors.subarray(i * 4, i * 4 + 3), i * 3);
      if (i < translucent) trns[i] = colors[i * 4 + 3];
    }
    parts.push(...chunk('IHDR', header(width, height, COLOUR_PALETTE)), ...(await iccChunk(options.icc)));
    parts.push(...chunk('PLTE', plte));
    if (translucent > 0) parts.push(...chunk('tRNS', trns));
    parts.push(...chunk('IDAT', await deflate(unfilteredRows(indices, width, height))));
  } else {
    const channels = isOpaque(rgba) ? 3 : 4;
    parts.push(...chunk('IHDR', header(width, height, channels === 3 ? COLOUR_RGB : COLOUR_RGBA)));
    parts.push(...(await iccChunk(options.icc)));
    parts.push(...chunk('IDAT', await deflate(filteredRows(rgba, width, height, channels))));
  }
  parts.push(...chunk('IEND'));
  return new Blob(parts as BlobPart[], { type: 'image/png' });
}

/**
 * Animated PNG, written one frame at a time so a long animation never has to sit in memory decoded.
 * Every frame is a full RGBA image; a viewer without APNG support shows the first frame.
 */
export class ApngWriter {
  private readonly parts: Uint8Array[] = [];
  private icc: Uint8Array[] = [];
  private frames = 0;
  private sequence = 0;

  constructor(
    private readonly width: number,
    private readonly height: number,
    private readonly options: { loops: number; icc?: Uint8Array },
  ) {}

  async add(rgba: Pixels, delayMs: number): Promise<void> {
    if (this.frames === 0) this.icc = await iccChunk(this.options.icc);
    const data = await deflate(filteredRows(rgba, this.width, this.height, 4));
    const control = new Uint8Array(26); // offsets, dispose_op and blend_op stay 0: full-frame replace
    const view = new DataView(control.buffer);
    view.setUint32(0, this.sequence++);
    view.setUint32(4, this.width);
    view.setUint32(8, this.height);
    view.setUint16(20, Math.min(65535, Math.max(0, Math.round(delayMs))));
    view.setUint16(22, 1000);
    this.parts.push(...chunk('fcTL', control));
    this.parts.push(...(this.frames === 0 ? chunk('IDAT', data) : chunk('fdAT', uint32(this.sequence++), data)));
    this.frames++;
  }

  finish(): Blob {
    if (this.frames === 0) throw new Error('An animation needs at least one frame');
    const parts = [
      SIGNATURE,
      ...chunk('IHDR', header(this.width, this.height, COLOUR_RGBA)),
      ...this.icc,
      ...chunk('acTL', uint32(this.frames), uint32(this.options.loops)),
      ...this.parts,
      ...chunk('IEND'),
    ];
    return new Blob(parts as BlobPart[], { type: 'image/png' });
  }
}

function header(width: number, height: number, colourType: number): Uint8Array {
  const ihdr = new Uint8Array(13);
  const view = new DataView(ihdr.buffer);
  view.setUint32(0, width);
  view.setUint32(4, height);
  ihdr[8] = 8; // bit depth
  ihdr[9] = colourType;
  return ihdr;
}

async function iccChunk(icc: Uint8Array | undefined): Promise<Uint8Array[]> {
  if (!icc) return [];
  const name = Uint8Array.from([...ICC_NAME].map((c) => c.charCodeAt(0)));
  return chunk('iCCP', name, Uint8Array.of(0, 0), await deflate(icc));
}

/** Moves non-opaque palette entries to the front so tRNS only has to cover them. */
function transparentFirst(palette: Palette): Palette & { translucent: number } {
  const count = palette.colors.length / 4;
  const order = Array.from({ length: count }, (_, i) => i);
  const opaque = (i: number): number => (palette.colors[i * 4 + 3] === 255 ? 1 : 0);
  order.sort((a, b) => opaque(a) - opaque(b) || a - b);
  const colors = new Uint8Array(palette.colors.length);
  const remap = new Uint8Array(count);
  order.forEach((from, to) => {
    colors.set(palette.colors.subarray(from * 4, from * 4 + 4), to * 4);
    remap[from] = to;
  });
  const indices = palette.indices.map((index) => remap[index]);
  return { colors, indices, translucent: order.filter((i) => !opaque(i)).length };
}

function isOpaque(rgba: Pixels): boolean {
  for (let p = 3; p < rgba.length; p += 4) if (rgba[p] !== 255) return false;
  return true;
}

/** Palette rows compress best unfiltered: filter type 0 on every scanline. */
function unfilteredRows(indices: Uint8Array, width: number, height: number): Uint8Array {
  const out = new Uint8Array((width + 1) * height);
  for (let y = 0; y < height; y++) out.set(indices.subarray(y * width, (y + 1) * width), y * (width + 1) + 1);
  return out;
}

/**
 * Applies, per scanline, whichever of the five PNG filters gives the smallest sum of absolute
 * residuals — the standard heuristic for truecolour images.
 */
function filteredRows(rgba: Pixels, width: number, height: number, channels: 3 | 4): Uint8Array {
  const stride = width * channels;
  const out = new Uint8Array((stride + 1) * height);
  const candidates = [0, 1, 2, 3, 4].map(() => new Uint8Array(stride));
  const [none, sub, up, average, paeth] = candidates;
  const sums = new Float64Array(5);
  let current = new Uint8Array(stride);
  let previous = new Uint8Array(stride);

  for (let y = 0; y < height; y++) {
    if (channels === 4) {
      current.set(rgba.subarray(y * stride, (y + 1) * stride));
    } else {
      for (let x = 0, p = y * width * 4; x < stride; x += 3, p += 4) {
        current[x] = rgba[p];
        current[x + 1] = rgba[p + 1];
        current[x + 2] = rgba[p + 2];
      }
    }
    sums.fill(0);
    for (let x = 0; x < stride; x++) {
      const value = current[x];
      const a = x >= channels ? current[x - channels] : 0;
      const b = previous[x];
      const c = x >= channels ? previous[x - channels] : 0;
      const p = a + b - c;
      const pa = Math.abs(p - a);
      const pb = Math.abs(p - b);
      const pc = Math.abs(p - c);
      none[x] = value;
      sub[x] = value - a;
      up[x] = value - b;
      average[x] = value - ((a + b) >> 1);
      paeth[x] = value - (pa <= pb && pa <= pc ? a : pb <= pc ? b : c);
      sums[0] += residual(none[x]);
      sums[1] += residual(sub[x]);
      sums[2] += residual(up[x]);
      sums[3] += residual(average[x]);
      sums[4] += residual(paeth[x]);
    }
    let best = 0;
    for (let f = 1; f < 5; f++) if (sums[f] < sums[best]) best = f;
    out[y * (stride + 1)] = best;
    out.set(candidates[best], y * (stride + 1) + 1);
    const swap = previous;
    previous = current;
    current = swap;
  }
  return out;
}

/** Magnitude of a filtered byte read as a signed value. */
function residual(byte: number): number {
  return byte < 128 ? byte : 256 - byte;
}

async function deflate(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([data as BlobPart]).stream().pipeThrough(new CompressionStream('deflate'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function uint32(value: number): Uint8Array {
  const out = new Uint8Array(4);
  new DataView(out.buffer).setUint32(0, value);
  return out;
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(crc: number, data: Uint8Array): number {
  for (let i = 0; i < data.length; i++) crc = CRC_TABLE[(crc ^ data[i]) & 255] ^ (crc >>> 8);
  return crc;
}

/** A chunk as separate parts (length+type, payload pieces, CRC) so large payloads are never copied. */
function chunk(type: string, ...payload: Uint8Array[]): Uint8Array[] {
  const head = new Uint8Array(8);
  new DataView(head.buffer).setUint32(
    0,
    payload.reduce((n, p) => n + p.length, 0),
  );
  head.set(
    [...type].map((c) => c.charCodeAt(0)),
    4,
  );
  let crc = crc32(0xffffffff, head.subarray(4));
  for (const p of payload) crc = crc32(crc, p);
  return [head, ...payload, uint32((crc ^ 0xffffffff) >>> 0)];
}
