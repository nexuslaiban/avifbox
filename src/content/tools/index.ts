import type { ToolPage } from '../types';
import { avifToApng } from './avif-to-apng';
import { avifToJpg } from './avif-to-jpg';
import { avifToPng } from './avif-to-png';
import { jfifToJpg } from './jfif-to-jpg';
import { jfifToPng } from './jfif-to-png';
import { jpgToAvif } from './jpg-to-avif';
import { pngToAvif } from './png-to-avif';
import { webpToJpg } from './webp-to-jpg';
import { webpToAvif } from './webp-to-avif';
import { webpToPng } from './webp-to-png';

/** Tool pages, in the order they appear in navigation. */
export const tools: ToolPage[] = [
  avifToPng,
  avifToJpg,
  avifToApng,
  jfifToJpg,
  jfifToPng,
  webpToPng,
  webpToJpg,
  jpgToAvif,
  pngToAvif,
  webpToAvif,
];
