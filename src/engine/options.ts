import type { ConvertOptions, Target } from './types';

/** The settings a page starts with. */
export function defaultOptions(target: Target, animation: ConvertOptions['animation'] = 'frames'): ConvertOptions {
  return {
    target,
    pngMode: 'truecolor',
    // AVIF's scale is not JPG's: 60 is where photos look like the original at a fraction of the size.
    quality: target === 'avif' ? 60 : 90,
    background: null,
    animation,
    tone: 'brightness',
    gamut: 'srgb',
    keepJpeg: true,
  };
}
