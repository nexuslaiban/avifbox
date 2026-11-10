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

/** Optional browser features. Works on the main thread and in a worker. */
export function detectCapabilities(): Capabilities {
  return {
    p3: typeof OffscreenCanvas !== 'undefined' && canvasGamut('display-p3') === 'display-p3',
    frames: typeof ImageDecoder !== 'undefined',
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
