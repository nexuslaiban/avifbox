import type { ConvertOptions, Target } from './types';

/** The settings a page starts with. */
export function defaultOptions(target: Target, animation: ConvertOptions['animation'] = 'frames'): ConvertOptions {
  return {
    target,
    pngMode: 'truecolor',
    quality: 90,
    background: null,
    animation,
    tone: 'brightness',
    gamut: 'srgb',
    keepJpeg: true,
  };
}
