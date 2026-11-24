import { BATCH_FAQ, LIMITS, LIMITS_AND_PRIVACY, PRIVACY_FAQ, RELATED } from '../site';
import { cite } from '../sources';
import type { ToolPage } from '../types';
import {
  AVIF_ENCODER,
  AVIF_LOSSY_FAQ,
  AVIF_METADATA_FAQ,
  AVIF_QUALITY,
  AVIF_SLOW_FAQ,
  AVIF_SUPPORT,
} from './avif-output';

export const webpToAvif: ToolPage = {
  slug: 'webp-to-avif',
  from: '.WEBP',
  to: '.AVIF',
  sourceLabel: 'WebP',
  accept: '.webp,image/webp',
  target: 'avif',
  title: 'WebP to AVIF Converter — Free, Batch, No Upload | AVIFBox',
  description:
    'Convert WebP to AVIF in your browser for smaller images with transparency kept. Set the quality, batch 50 files. Free, private, no upload or sign-up.',
  h1: 'WebP to <em>AVIF</em> Converter',
  lede: 'Move WebP images to AVIF, the newer format that usually makes the same picture smaller still. Free, in batches, on your own device — nothing is uploaded.',
  howToTitle: 'How to convert WebP to AVIF',
  steps: [
    {
      title: 'Add your WebP files',
      body: `Drop them on the box, press <strong>Choose files</strong>, or paste with Ctrl+V — up to ${LIMITS}. Encoding starts immediately.`,
    },
    {
      title: 'Set the quality',
      body: 'The preset of 60 suits most images. Compare each result with its WebP and move the slider until the size and the look are right.',
    },
    {
      title: 'Download',
      body: 'Save each AVIF, or take the whole batch as a single ZIP.',
    },
  ],
  comparison: {
    caption: 'WebP and AVIF side by side',
    columns: ['WebP', 'AVIF'],
    rows: [
      ['Introduced', '2010, Google', '2019, Alliance for Open Media'],
      ['Based on', 'The VP8 video codec', 'The AV1 video codec'],
      ['File size at the same look', 'Reference', 'Usually smaller'],
      ['Transparency', 'Yes', 'Yes'],
      ['Animation', 'Yes', 'Yes'],
      ['HDR and wide colour', 'No', 'Yes'],
      ['Encoding speed', 'Fast', 'Slow'],
      ['Browser support', 'All current browsers', 'All current browsers'],
    ],
  },
  sections: [
    {
      id: 'why',
      title: 'Why move from WebP to AVIF',
      body: [
        `${cite('webp', 'WebP')} was the first widely supported step beyond JPG and PNG. ${cite('avifSpec', 'AVIF')} is the next one: built on the newer AV1 codec, it usually makes the same picture smaller again, and it handles HDR and wide colour, which WebP cannot. Every current browser reads both, so for a website the switch is mostly a matter of file size.`,
      ],
    },
    {
      id: 'lossy-twice',
      title: 'Lossy WebP, compressed twice',
      body: [
        'Most WebP images on the web are lossy. Converting one to AVIF compresses it again, and the detail WebP already dropped stays dropped. The saving is real but smaller than from an original, so if you still have the source PNG or camera JPG, convert that instead with <a href="/png-to-avif">PNG to AVIF</a> or <a href="/jpg-to-avif">JPG to AVIF</a>. A lossless WebP converts from exact pixels.',
      ],
    },
    {
      id: 'transparency',
      title: 'Transparency and animation',
      body: [
        `The alpha channel is kept, soft edges included. An animated WebP is decoded ${cite('imageDecoder', 'frame by frame')} where the browser allows it, and each frame becomes its own still AVIF that you can keep or drop; this page does not write animated AVIF. In Safari only the first frame is read.`,
      ],
    },
    AVIF_QUALITY,
    AVIF_ENCODER,
    AVIF_SUPPORT,
    LIMITS_AND_PRIVACY,
  ],
  faq: [
    {
      question: 'How do I convert WebP to AVIF?',
      answer:
        'Drop your WebP files on the box at the top of this page or press Choose files. They are encoded in your browser; download each AVIF or all of them as a ZIP.',
    },
    {
      question: 'Is AVIF better than WebP?',
      answer:
        'For file size, usually yes: AVIF tends to be smaller at the same look, and it adds HDR and wide colour. WebP is much faster to encode. Both open in every current browser.',
    },
    {
      question: 'Does WebP to AVIF keep transparency?',
      answer: 'Yes. The alpha channel is encoded with the picture, partly transparent pixels included.',
    },
    {
      question: 'Is it free to convert WebP to AVIF?',
      answer: 'Yes — free, with no sign-up, no watermark and no daily limit.',
    },
    AVIF_LOSSY_FAQ,
    BATCH_FAQ,
    AVIF_SLOW_FAQ,
    AVIF_METADATA_FAQ,
    PRIVACY_FAQ,
  ],
  input: 'WebP — lossy, lossless, animated (each frame as a still)',
  output: 'AVIF, 8-bit, quality 1–100, transparency kept',
  metadata: 'Not copied: the AVIF holds the picture only',
  related: [RELATED.jpgToAvif, RELATED.pngToAvif, RELATED.webpToPng, RELATED.whatIsAvif],
};
