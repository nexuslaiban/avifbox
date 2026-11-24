import { ConvertError } from './errors';

/** The AV1 encoder is a 3.5 MB WebAssembly module: loaded on the first AVIF a visitor makes, then kept. */
async function wasmEncoder(): Promise<typeof import('@jsquash/avif/encode.js').default> {
  return (await import('@jsquash/avif/encode.js')).default;
}

/**
 * Encodes straight-alpha sRGB RGBA as an 8-bit AVIF with libavif (aom), compiled to WebAssembly by jSquash.
 * `quality` is 1–100 on AVIF's own scale. Transparency is kept. No browser exposes an AVIF encoder to
 * canvas everywhere, so the same encoder runs in every browser and the output does not depend on it.
 */
export async function encodeAvif(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
  quality: number,
): Promise<Blob> {
  const encode = await wasmEncoder().catch(() => {
    throw new ConvertError('The AVIF encoder could not load. Check your connection, reload the page and try again.');
  });
  let bytes: ArrayBuffer;
  try {
    bytes = await encode(new ImageData(rgba as Uint8ClampedArray<ArrayBuffer>, width, height), { quality });
  } catch (error) {
    if (error instanceof RangeError) throw error; // reported as out of memory by the worker
    throw new ConvertError(`Could not encode this ${width}×${height} image as AVIF.`);
  }
  return new Blob([bytes], { type: 'image/avif' });
}
