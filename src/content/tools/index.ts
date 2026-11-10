import type { ToolPage } from '../types';
import { avifToJpg } from './avif-to-jpg';
import { avifToPng } from './avif-to-png';
import { jfifToJpg } from './jfif-to-jpg';
import { jfifToPng } from './jfif-to-png';
import { webpToPng } from './webp-to-png';

/** First-batch tool pages, in the order they appear in navigation. */
export const tools: ToolPage[] = [avifToPng, avifToJpg, jfifToJpg, jfifToPng, webpToPng];
