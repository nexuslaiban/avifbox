import { describe, expect, it } from 'vitest';
import jpeg from 'jpeg-js';
import { flatten, parseHex } from '../../src/engine/pixels';
import { embedIcc, isJpeg } from '../../src/engine/jpeg';
import { displayP3Profile } from '../../src/engine/icc';
import { outputName, stem, uniqueNames, uniqueStem } from '../../src/engine/names';
import { MAX_FILES, MAX_FILE_BYTES, admit } from '../../src/engine/limits';
import { openImage, type Decoders } from '../../src/engine/open';
import type { ConvertOptions, FrameSource, ImageInfo } from '../../src/engine/types';
import { fixture } from './helpers';

describe('pixels', () => {
  it('parses #rrggbb', () => {
    expect(parseHex('#ff8000')).toEqual([255, 128, 0]);
    expect(parseHex('#FFFFFF')).toEqual([255, 255, 255]);
    expect(() => parseHex('red')).toThrow();
  });

  it('flattens straight alpha onto an opaque colour', () => {
    const px = Uint8ClampedArray.from([255, 0, 0, 128, 9, 9, 9, 0, 10, 20, 30, 255]);
    flatten(px, [255, 255, 255]);
    expect(Array.from(px)).toEqual([255, 127, 127, 255, 255, 255, 255, 255, 10, 20, 30, 255]);
  });
});

describe('jpeg', () => {
  const photo = fixture('photo.jfif');

  it('recognises JPEG data', () => {
    expect(isJpeg(photo)).toBe(true);
    expect(isJpeg(fixture('still.png'))).toBe(false);
    expect(isJpeg(new Uint8Array(2))).toBe(false);
  });

  it('inserts the ICC profile as an APP2 segment after the JFIF header, leaving the rest intact', () => {
    const icc = displayP3Profile();
    const tagged = embedIcc(photo, icc);
    const app0Length = 2 + ((photo[4] << 8) | photo[5]);
    const at = 2 + app0Length;
    expect(Array.from(tagged.subarray(0, at))).toEqual(Array.from(photo.subarray(0, at)));
    expect(Array.from(tagged.subarray(at, at + 2))).toEqual([0xff, 0xe2]);
    const length = (tagged[at + 2] << 8) | tagged[at + 3];
    expect(length).toBe(2 + 14 + icc.length);
    expect(String.fromCharCode(...tagged.subarray(at + 4, at + 15))).toBe('ICC_PROFILE');
    expect(Array.from(tagged.subarray(at + 15, at + 18))).toEqual([0, 1, 1]);
    expect(tagged.subarray(at + 18, at + 18 + icc.length)).toEqual(icc);
    expect(Array.from(tagged.subarray(at + 2 + length))).toEqual(Array.from(photo.subarray(at)));
  });

  it('keeps the tagged file decodable with identical pixels', () => {
    const before = jpeg.decode(photo, { useTArray: true });
    const after = jpeg.decode(embedIcc(photo, displayP3Profile()), { useTArray: true });
    expect([after.width, after.height]).toEqual([320, 240]);
    expect(after.data).toEqual(before.data);
  });

  it('puts the profile right after SOI when there is no APPn header', () => {
    const bare = Uint8Array.from([0xff, 0xd8, 0xff, 0xdb, 0x00, 0x02, 0xff, 0xd9]);
    const tagged = embedIcc(bare, Uint8Array.from([1, 2, 3]));
    expect(Array.from(tagged.subarray(0, 4))).toEqual([0xff, 0xd8, 0xff, 0xe2]);
    expect(Array.from(tagged.subarray(-6))).toEqual([0xff, 0xdb, 0x00, 0x02, 0xff, 0xd9]);
  });
});

describe('names (AC-20)', () => {
  it('strips only the last extension', () => {
    expect(stem('photo.avif')).toBe('photo');
    expect(stem('archive.tar.avif')).toBe('archive.tar');
    expect(stem('noext')).toBe('noext');
    expect(stem('.hidden')).toBe('.hidden');
    expect(stem('')).toBe('image');
  });

  it('replaces characters that are unsafe in file and ZIP entry names', () => {
    expect(stem('a/b\\c:d.avif')).toBe('a_b_c_d');
  });

  it('de-duplicates stems', () => {
    const taken = new Set<string>();
    expect(uniqueStem('photo', taken)).toBe('photo');
    expect(uniqueStem('photo', taken)).toBe('photo (2)');
    expect(uniqueStem('photo', taken)).toBe('photo (3)');
    expect(uniqueStem('other', taken)).toBe('other');
  });

  it('swaps the extension and numbers frames from 1', () => {
    expect(outputName('photo', 'png')).toBe('photo.png');
    expect(outputName('photo', 'jpg')).toBe('photo.jpg');
    expect(outputName('anim', 'png', { frame: 0, of: 5 })).toBe('anim-001.png');
    expect(outputName('anim', 'png', { frame: 4, of: 5 })).toBe('anim-005.png');
    expect(outputName('anim', 'png', { frame: 1199, of: 1200 })).toBe('anim-1200.png');
  });
});

describe('uniqueNames', () => {
  it('keeps distinct names and renames later duplicates before the extension', () => {
    // A frame of anim.avif and a still called anim-001.avif would otherwise overwrite each other in a ZIP.
    expect(uniqueNames(['anim-001.png', 'anim-002.png', 'anim-001.png', 'ANIM-001.png', 'photo.jpg'])).toEqual([
      'anim-001.png',
      'anim-002.png',
      'anim-001 (2).png',
      'ANIM-001 (3).png',
      'photo.jpg',
    ]);
  });
});

describe('limits (AC-11)', () => {
  const file = (size: number, name = 'a.avif') => ({ name, size });

  it('documents the limits', () => {
    expect(MAX_FILES).toBe(50);
    expect(MAX_FILE_BYTES).toBe(50 * 1024 * 1024);
  });

  it('accepts up to 50 files and reports the overflow', () => {
    const result = admit(
      Array.from({ length: 51 }, () => file(1000)),
      0,
    );
    expect(result.accepted).toHaveLength(50);
    expect(result.overflow).toBe(1);
    expect(result.tooLarge).toEqual([]);
  });

  it('counts files already queued', () => {
    const result = admit(
      Array.from({ length: 5 }, () => file(1000)),
      48,
    );
    expect(result.accepted).toHaveLength(2);
    expect(result.overflow).toBe(3);
  });

  it('rejects a file over 50 MB without letting it use up a slot', () => {
    const big = file(MAX_FILE_BYTES + 1, 'big.avif');
    const edge = file(MAX_FILE_BYTES, 'edge.avif');
    const result = admit([big, edge, ...Array.from({ length: 49 }, () => file(10))], 0);
    expect(result.tooLarge).toEqual([big]);
    expect(result.accepted).toHaveLength(50);
    expect(result.accepted[0]).toBe(edge);
    expect(result.overflow).toBe(0);
  });
});

describe('openImage routing (AC-19)', () => {
  const source = (label: string): FrameSource & { label: string } => ({
    label,
    width: 1,
    height: 1,
    frameCount: 1,
    loops: 0,
    gamut: 'srgb',
    toneMapped: false,
    async *frames() {},
  });
  const options = { tone: 'colour', gamut: 'srgb' } as ConvertOptions;
  const info = (over: Partial<ImageInfo>): ImageInfo => ({
    format: 'avif',
    bitDepth: 8,
    animated: false,
    cicp: null,
    hdr: null,
    ...over,
  });
  const bytes = new Uint8Array(1);

  function decoders(over: Partial<Decoders> = {}): Decoders & { calls: string[] } {
    const calls: string[] = [];
    const record = (name: string) => async () => {
      calls.push(name);
      return source(name);
    };
    return { calls, native: record('native'), hdr: record('hdr'), wasm: record('wasm'), ...over };
  }

  it('decodes SDR images natively', async () => {
    const d = decoders();
    expect(await openImage(bytes, info({}), options, d)).toMatchObject({ label: 'native' });
    expect(d.calls).toEqual(['native']);
  });

  it('sends HDR images to the tone-mapping decoder', async () => {
    const d = decoders();
    expect(await openImage(bytes, info({ hdr: 'pq', bitDepth: 10 }), options, d)).toMatchObject({ label: 'hdr' });
    expect(d.calls).toEqual(['hdr']);
  });

  it('lets the browser render an animated HDR sequence, which the WASM decoder cannot step through', async () => {
    const d = decoders();
    await openImage(bytes, info({ hdr: 'pq', animated: true }), options, d);
    expect(d.calls).toEqual(['native']);
  });

  it('falls back to WASM when the browser cannot decode an AVIF', async () => {
    const d = decoders({ native: async () => Promise.reject(new Error('unsupported')) });
    expect(await openImage(bytes, info({}), options, d)).toMatchObject({ label: 'wasm' });
  });

  it('falls back to the browser when the HDR decoder fails', async () => {
    const d = decoders({ hdr: async () => Promise.reject(new Error('wasm blocked')) });
    expect(await openImage(bytes, info({ hdr: 'hlg' }), options, d)).toMatchObject({ label: 'native' });
  });

  it('reports a failure for other formats instead of trying WASM', async () => {
    const d = decoders({ native: async () => Promise.reject(new Error('broken webp')) });
    await expect(openImage(bytes, info({ format: 'webp' }), options, d)).rejects.toThrow('broken webp');
    expect(d.calls).toEqual([]);
  });

  it('reports the original error when both AVIF decoders fail', async () => {
    const d = decoders({
      native: async () => Promise.reject(new Error('native failed')),
      wasm: async () => Promise.reject(new Error('wasm failed')),
    });
    await expect(openImage(bytes, info({}), options, d)).rejects.toThrow('native failed');
  });
});
