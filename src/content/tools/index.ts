import type { ToolPage } from '../types';
import { avifToApng } from './avif-to-apng';
import { avifToJpg } from './avif-to-jpg';
import { avifToPng } from './avif-to-png';
import { jfifToJpg } from './jfif-to-jpg';
import { jfifToPng } from './jfif-to-png';
import { webpToJpg } from './webp-to-jpg';
import { webpToPng } from './webp-to-png';

/** Tool pages, in the order they appear in navigation. */
export const tools: ToolPage[] = [avifToPng, avifToJpg, avifToApng, jfifToJpg, jfifToPng, webpToPng, webpToJpg];
