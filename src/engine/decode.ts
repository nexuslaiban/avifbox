import { canvasGamut } from './capabilities';
import { toneMap } from './hdr';
import type { Decoders } from './open';
import type { Format, FrameSource, Gamut } from './types';

// The three ways pixels get out of a file. All of them produce straight-alpha 8-bit RGBA.

const MIME: Record<Format, string> = {
  avif: 'image/avif',
  webp: 'image/webp',
  jpeg: 'image/jpeg',
  png: 'image/png',
};

/** Pixels read back per canvas. Keeps peak memory flat and stays under every browser's canvas limit. */
const STRIP_PIXELS = 4 * 1024 * 1024;

/** Copies an image out of the browser in horizontal strips, so its size is not bound by canvas limits. */
function readPixels(image: CanvasImageSource, width: number, height: number, gamut: Gamut): Uint8ClampedArray {
  const rows = Math.max(1, Math.min(height, Math.floor(STRIP_PIXELS / width)));
  const context = new OffscreenCanvas(width, rows).getContext('2d', { willReadFrequently: true, colorSpace: gamut });
  if (!context) throw new Error('Canvas is not available');
  context.imageSmoothingEnabled = false;
  const out = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += rows) {
    const h = Math.min(rows, height - y);
    context.clearRect(0, 0, width, rows);
    context.drawImage(image, 0, y, width, h, 0, 0, width, h);
    out.set(context.getImageData(0, 0, width, h, { colorSpace: gamut }).data, y * width * 4);
  }
  return out;
}

function still(rgba: Uint8ClampedArray, width: number, height: number, gamut: Gamut, toneMapped: boolean): FrameSource {
  return {
    width,
    height,
    frameCount: 1,
    loops: 0,
    gamut,
    toneMapped,
    async *frames() {
      yield { rgba, delayMs: 0 };
    },
  };
}

async function animation(bytes: Uint8Array, type: string, gamut: Gamut): Promise<FrameSource> {
  const decoder = new ImageDecoder({ data: bytes as Uint8Array<ArrayBuffer>, type, preferAnimation: true });
  await decoder.tracks.ready;
  await decoder.completed; // all data is in, so the frame count is final
  const track = decoder.tracks.selectedTrack;
  if (!track) throw new Error('No image track');
  // The first frame is decoded once and kept: it gives the size, and Firefox hands back an unusable
  // frame when the same index is decoded a second time in a worker.
  let held: VideoFrame | null = (await decoder.decode({ frameIndex: 0 })).image;
  const width = held.displayWidth;
  const height = held.displayHeight;
  return {
    width,
    height,
    frameCount: track.frameCount,
    loops: Number.isFinite(track.repetitionCount) ? track.repetitionCount + 1 : 0,
    gamut,
    toneMapped: false,
    async *frames() {
      try {
        for (let frameIndex = 0; frameIndex < track.frameCount; frameIndex++) {
          const image: VideoFrame = held ?? (await decoder.decode({ frameIndex })).image;
          held = null;
          try {
            yield { rgba: readPixels(image, width, height, gamut), delayMs: (image.duration ?? 0) / 1000 };
          } finally {
            image.close();
          }
        }
      } finally {
        decoder.close();
      }
    },
  };
}

async function wasmDecoder(): Promise<typeof import('@jsquash/avif/decode.js').default> {
  return (await import('@jsquash/avif/decode.js')).default;
}

export const decoders: Decoders = {
  async native(bytes, info, options) {
    const type = MIME[info.format];
    const gamut = canvasGamut(options.gamut);
    if (info.animated && typeof ImageDecoder !== 'undefined' && (await ImageDecoder.isTypeSupported(type))) {
      return animation(bytes, type, gamut);
    }
    const bitmap = await createImageBitmap(new Blob([bytes as BlobPart], { type }));
    try {
      return still(readPixels(bitmap, bitmap.width, bitmap.height, gamut), bitmap.width, bitmap.height, gamut, false);
    } finally {
      bitmap.close();
    }
  },

  async hdr(bytes, info, options) {
    const decode = await wasmDecoder();
    const image = await decode(bytes.buffer as ArrayBuffer, { bitDepth: 16 });
    if (!image || !info.hdr) throw new Error('HDR decode failed');
    const source = { ...image, transfer: info.hdr, primaries: info.cicp?.primaries ?? 9 };
    return still(toneMap(source, options.tone, options.gamut), image.width, image.height, options.gamut, true);
  },

  async wasm(bytes) {
    const decode = await wasmDecoder();
    const image = await decode(bytes.buffer as ArrayBuffer);
    if (!image) throw new Error('Decode failed');
    return still(image.data, image.width, image.height, 'srgb', false);
  },
};
