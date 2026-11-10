import type { Capabilities, Gamut } from './types';

/** The colour space a 2D canvas actually gets when `requested` is asked for. */
export function canvasGamut(requested: Gamut): Gamut {
  if (requested === 'srgb') return 'srgb';
  try {
    const context = new OffscreenCanvas(1, 1).getContext('2d', { colorSpace: requested });
    return context?.getImageData(0, 0, 1, 1, { colorSpace: requested }).colorSpace === requested ? requested : 'srgb';
  } catch {
    return 'srgb';
  }
}

/**
 * Whether a canvas hands back exactly what was drawn on it. Some browsers (Brave, private windows in
 * Firefox and Safari) randomise a few values to resist fingerprinting, which also lands in converted images.
 */
function canvasIsExact(): boolean {
  try {
    const size = 16;
    const drawn = new ImageData(size, size);
    for (let i = 0; i < drawn.data.length; i++) drawn.data[i] = i % 4 === 3 ? 255 : (i * 37 + 11) & 255;
    const context = new OffscreenCanvas(size, size).getContext('2d', { willReadFrequently: true });
    if (!context) return true;
    context.putImageData(drawn, 0, 0);
    const read = context.getImageData(0, 0, size, size).data;
    return drawn.data.every((value, i) => value === read[i]);
  } catch {
    return true;
  }
}

/** Optional browser features. Works on the main thread and in a worker. */
export function detectCapabilities(): Capabilities {
  return {
    p3: typeof OffscreenCanvas !== 'undefined' && canvasGamut('display-p3') === 'display-p3',
    frames: typeof ImageDecoder !== 'undefined',
    exact: typeof OffscreenCanvas === 'undefined' || canvasIsExact(),
  };
}

/** Everything the converter cannot work without. */
export function isSupportedBrowser(): boolean {
  return (
    typeof Worker !== 'undefined' &&
    typeof OffscreenCanvas !== 'undefined' &&
    typeof createImageBitmap !== 'undefined' &&
    typeof CompressionStream !== 'undefined'
  );
}
