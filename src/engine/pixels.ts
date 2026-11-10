import type { Pixels } from './types';

export type Rgb = [number, number, number];

export function parseHex(hex: string): Rgb {
  const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!match) throw new Error(`Not a #rrggbb colour: ${hex}`);
  return [parseInt(match[1], 16), parseInt(match[2], 16), parseInt(match[3], 16)];
}

/** Composites straight-alpha RGBA onto an opaque colour, in place. */
export function flatten(rgba: Pixels, background: Rgb): void {
  for (let p = 0; p < rgba.length; p += 4) {
    const alpha = rgba[p + 3];
    if (alpha === 255) continue;
    for (let c = 0; c < 3; c++) rgba[p + c] = ((rgba[p + c] * alpha + background[c] * (255 - alpha) + 127) / 255) | 0;
    rgba[p + 3] = 255;
  }
}
