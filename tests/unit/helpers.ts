import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateSync } from 'node:zlib';
import { PNG } from 'pngjs';

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), '..', 'fixtures');

export function fixture(name: string): Uint8Array {
  return new Uint8Array(readFileSync(join(FIXTURES, name)));
}

export function fixturePath(name: string): string {
  return join(FIXTURES, name);
}

export interface Chunk {
  type: string;
  data: Uint8Array;
}

/** Splits a PNG into its chunks, verifying the signature. CRCs are checked by pngjs elsewhere. */
export function pngChunks(png: Uint8Array): Chunk[] {
  const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (!sig.every((b, i) => png[i] === b)) throw new Error('not a PNG');
  const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
  const chunks: Chunk[] = [];
  for (let at = 8; at < png.length;) {
    const length = view.getUint32(at);
    const type = String.fromCharCode(...png.subarray(at + 4, at + 8));
    chunks.push({ type, data: png.subarray(at + 8, at + 8 + length) });
    at += 12 + length;
  }
  return chunks;
}

export function decodePng(png: Uint8Array): { width: number; height: number; data: Uint8Array } {
  const out = PNG.sync.read(Buffer.from(png));
  return { width: out.width, height: out.height, data: new Uint8Array(out.data) };
}

export async function bytesOf(blob: Blob): Promise<Uint8Array> {
  return new Uint8Array(await blob.arrayBuffer());
}

export function u32(view: Uint8Array, at: number): number {
  return new DataView(view.buffer, view.byteOffset, view.byteLength).getUint32(at);
}

export function u16(view: Uint8Array, at: number): number {
  return new DataView(view.buffer, view.byteOffset, view.byteLength).getUint16(at);
}

export { inflateSync };

// ---- ISO BMFF builders for synthetic container tests ----

export function box(type: string, ...payload: (Uint8Array | number[])[]): Uint8Array {
  const body = payload.map((p) => (p instanceof Uint8Array ? p : Uint8Array.from(p)));
  const size = 8 + body.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(size);
  new DataView(out.buffer).setUint32(0, size);
  out.set(
    [...type].map((c) => c.charCodeAt(0)),
    4,
  );
  let at = 8;
  for (const p of body) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

export function concat(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

export const ascii = (s: string): number[] => [...s].map((c) => c.charCodeAt(0));
