import { describe, expect, it } from 'vitest';
import { probe } from '../../src/engine/probe';
import { ascii, box, concat, fixture } from './helpers';

describe('probe (AC-15)', () => {
  it('reads an 8-bit sRGB still AVIF', () => {
    expect(probe(fixture('still.avif'))).toEqual({
      format: 'avif',
      bitDepth: 8,
      animated: false,
      cicp: { primaries: 1, transfer: 13, matrix: 0, fullRange: true },
      hdr: null,
    });
  });

  it('reads the primary item, not the alpha auxiliary item', () => {
    const info = probe(fixture('alpha.avif'));
    expect(info?.bitDepth).toBe(8);
    expect(info?.cicp).toEqual({ primaries: 1, transfer: 13, matrix: 0, fullRange: true });
  });

  it('flags a 10-bit BT.2020 PQ AVIF as HDR', () => {
    expect(probe(fixture('hdr-pq.avif'))).toEqual({
      format: 'avif',
      bitDepth: 10,
      animated: false,
      cicp: { primaries: 9, transfer: 16, matrix: 0, fullRange: true },
      hdr: 'pq',
    });
  });

  it('flags HLG transfer as HDR', () => {
    const bytes = fixture('hdr-pq.avif').slice();
    const at = indexOf(bytes, 'colrnclx') + 8;
    bytes[at + 3] = 18; // transfer_characteristics low byte: PQ (16) -> HLG (18)
    expect(probe(bytes)?.hdr).toBe('hlg');
  });

  it('reads Display P3 primaries', () => {
    expect(probe(fixture('p3.avif'))?.cicp?.primaries).toBe(12);
  });

  it('detects an animated AVIF sequence', () => {
    const info = probe(fixture('anim.avif'));
    expect(info?.format).toBe('avif');
    expect(info?.animated).toBe(true);
  });

  it('detects still and animated WebP', () => {
    expect(probe(fixture('lossless.webp'))).toEqual({ format: 'webp', bitDepth: 8, animated: false, cicp: null, hdr: null });
    expect(probe(fixture('anim.webp'))?.animated).toBe(true);
  });

  it('detects JPEG (a .jfif file is a JPEG) and PNG', () => {
    expect(probe(fixture('photo.jfif'))?.format).toBe('jpeg');
    expect(probe(fixture('still.png'))?.format).toBe('png');
  });

  it('still identifies a truncated AVIF by its header', () => {
    expect(probe(fixture('corrupt.avif'))?.format).toBe('avif');
  });

  it('rejects data that is not a supported image', () => {
    expect(probe(new TextEncoder().encode('%PDF-1.7 not an image at all'))).toBeNull();
    expect(probe(new Uint8Array(0))).toBeNull();
    expect(probe(Uint8Array.from([0xff, 0xd8]))).toBeNull();
  });

  it('rejects an ISO BMFF file that is not AVIF (HEIC brand)', () => {
    const heic = box('ftyp', ascii('heic'), [0, 0, 0, 0], ascii('mif1'), ascii('heic'));
    expect(probe(heic)).toBeNull();
  });

  it('uses 12-bit depth and wide ipma indices when present', () => {
    // Primary item 1 owns property 2 (12-bit av1C); property 1 belongs to another item.
    const ipco = box('ipco', box('av1C', [0x81, 0x00, 0x00, 0x00]), box('av1C', [0x81, 0x00, 0x60, 0x00]));
    // version 0, flags 1 => 16-bit property indices
    const ipma = box('ipma', [0, 0, 0, 1], [0, 0, 0, 2], [0, 2, 1, 0x00, 0x01], [0, 1, 1, 0x80, 0x02]);
    const meta = box('meta', [0, 0, 0, 0], box('pitm', [0, 0, 0, 0], [0, 1]), box('iprp', ipco, ipma));
    const file = concat(box('ftyp', ascii('avif'), [0, 0, 0, 0], ascii('avif'), ascii('mif1')), meta);
    expect(probe(file)).toEqual({ format: 'avif', bitDepth: 12, animated: false, cicp: null, hdr: null });
  });

  it('survives malformed box sizes without throwing', () => {
    const bad = concat(box('ftyp', ascii('avif'), [0, 0, 0, 0], ascii('avif')), Uint8Array.from([0xff, 0xff, 0xff, 0xff, 0x6d, 0x65, 0x74, 0x61, 1, 2, 3]));
    expect(probe(bad)).toEqual({ format: 'avif', bitDepth: 8, animated: false, cicp: null, hdr: null });
  });
});

function indexOf(bytes: Uint8Array, text: string): number {
  const needle = ascii(text);
  for (let i = 0; i <= bytes.length - needle.length; i++) {
    if (needle.every((b, j) => bytes[i + j] === b)) return i;
  }
  throw new Error(`${text} not found`);
}
