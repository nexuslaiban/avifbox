import type { Cicp, ImageInfo } from './types';

// Identifies a file from its bytes and, for AVIF, reads the container metadata that decides how it
// has to be decoded: bit depth, colour signalling (HDR or not) and whether it is an image sequence.

interface Box {
  type: string;
  /** Payload range, header excluded. */
  start: number;
  end: number;
}

const TRANSFER_PQ = 16;
const TRANSFER_HLG = 18;

/** Returns null when the bytes are not an image this tool handles. */
export function probe(bytes: Uint8Array): ImageInfo | null {
  const sdr = { bitDepth: 8, animated: false, cicp: null, hdr: null } as const;
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return { format: 'jpeg', ...sdr };
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return { format: 'png', ...sdr };
  if (ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 12) === 'WEBP') {
    const animated = ascii(bytes, 12, 16) === 'VP8X' && (bytes[20] & 0x02) !== 0;
    return { format: 'webp', ...sdr, animated };
  }
  return probeAvif(bytes);
}

function probeAvif(bytes: Uint8Array): ImageInfo | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const top = [...boxes(view, 0, bytes.length)];
  const ftyp = top[0];
  if (ftyp?.type !== 'ftyp') return null;
  const brands = new Set<string>();
  for (let at = ftyp.start; at + 4 <= ftyp.end; at += 4) {
    if (at !== ftyp.start + 4) brands.add(ascii(bytes, at, at + 4)); // skip minor_version
  }
  if (!brands.has('avif') && !brands.has('avis')) return null;

  const info: ImageInfo = {
    format: 'avif',
    bitDepth: 8,
    animated: brands.has('avis') && top.some((b) => b.type === 'moov'),
    cicp: null,
    hdr: null,
  };
  const meta = top.find((b) => b.type === 'meta');
  if (!meta) return info;
  try {
    for (const prop of primaryItemProperties(view, meta)) {
      if (prop.type === 'av1C') info.bitDepth = av1BitDepth(view.getUint8(prop.start + 2));
      // A grid image has no av1C of its own (its tiles do); pixi gives the depth for every kind of item.
      if (prop.type === 'pixi') info.bitDepth = view.getUint8(prop.start + 5);
      if (prop.type === 'colr' && ascii(bytes, prop.start, prop.start + 4) === 'nclx')
        info.cicp = nclx(view, prop.start + 4);
    }
  } catch (error) {
    // A damaged container still decodes or fails downstream; the defaults above are the safe reading.
    if (!(error instanceof RangeError)) throw error;
  }
  if (info.cicp?.transfer === TRANSFER_PQ) info.hdr = 'pq';
  if (info.cicp?.transfer === TRANSFER_HLG) info.hdr = 'hlg';
  return info;
}

function* boxes(view: DataView, start: number, end: number): Generator<Box> {
  while (start + 8 <= end) {
    let size = view.getUint32(start);
    let header = 8;
    if (size === 1) {
      if (start + 16 > end) return;
      size = Number(view.getBigUint64(start + 8));
      header = 16;
    } else if (size === 0) {
      size = end - start;
    }
    if (size < header) return;
    const type = String.fromCharCode(
      view.getUint8(start + 4),
      view.getUint8(start + 5),
      view.getUint8(start + 6),
      view.getUint8(start + 7),
    );
    yield { type, start: start + header, end: Math.min(start + size, end) };
    start += size;
  }
}

function child(view: DataView, parent: Box, type: string, skip = 0): Box | undefined {
  for (const b of boxes(view, parent.start + skip, parent.end)) if (b.type === type) return b;
  return undefined;
}

/** The property boxes (`ipco` children) that `ipma` associates with the primary item (`pitm`). */
function primaryItemProperties(view: DataView, meta: Box): Box[] {
  const FULL_BOX = 4; // version + flags
  const pitm = child(view, meta, 'pitm', FULL_BOX);
  const iprp = child(view, meta, 'iprp', FULL_BOX);
  const ipco = iprp && child(view, iprp, 'ipco');
  const ipma = iprp && child(view, iprp, 'ipma');
  if (!pitm || !ipco || !ipma) return [];

  const primary = view.getUint8(pitm.start) === 0 ? view.getUint16(pitm.start + 4) : view.getUint32(pitm.start + 4);
  const properties = [...boxes(view, ipco.start, ipco.end)];
  const version = view.getUint8(ipma.start);
  const wideIndex = (view.getUint8(ipma.start + 3) & 1) !== 0;
  const entries = view.getUint32(ipma.start + 4);
  const found: Box[] = [];
  let at = ipma.start + 8;
  for (let e = 0; e < entries; e++) {
    const item = version < 1 ? view.getUint16(at) : view.getUint32(at);
    at += version < 1 ? 2 : 4;
    const count = view.getUint8(at++);
    for (let i = 0; i < count; i++) {
      const index = wideIndex ? view.getUint16(at) & 0x7fff : view.getUint8(at) & 0x7f;
      at += wideIndex ? 2 : 1;
      const prop = properties[index - 1];
      if (item === primary && prop) found.push(prop);
    }
  }
  return found;
}

/** Third byte of AV1CodecConfigurationRecord: tier(1) high_bitdepth(1) twelve_bit(1) … */
function av1BitDepth(flags: number): number {
  if ((flags & 0x40) === 0) return 8;
  return (flags & 0x20) !== 0 ? 12 : 10;
}

function nclx(view: DataView, at: number): Cicp {
  return {
    primaries: view.getUint16(at),
    transfer: view.getUint16(at + 2),
    matrix: view.getUint16(at + 4),
    fullRange: (view.getUint8(at + 6) & 0x80) !== 0,
  };
}

function startsWith(bytes: Uint8Array, magic: number[]): boolean {
  return bytes.length >= magic.length && magic.every((b, i) => bytes[i] === b);
}

function ascii(bytes: Uint8Array, start: number, end: number): string {
  return end <= bytes.length ? String.fromCharCode(...bytes.subarray(start, end)) : '';
}
