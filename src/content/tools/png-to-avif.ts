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

export const pngToAvif: ToolPage = {
  slug: 'png-to-avif',
  from: '.PNG',
  to: '.AVIF',
  sourceLabel: 'PNG',
  accept: '.png,image/png',
  target: 'avif',
  title: 'PNG to AVIF Converter — Free, Transparent, No Upload | AVIFBox',
  description:
    'Convert PNG to AVIF in your browser: far smaller files that keep transparency. Set the quality, batch 50 files. Free, private, no upload or sign-up.',
  h1: 'PNG to <em>AVIF</em> Converter',
  lede: 'Turn large PNG images into small AVIF files that keep their transparency. Free, in batches, on your own device — the files are never uploaded.',
  howToTitle: 'How to convert PNG to AVIF',
  steps: [
    {
      title: 'Add your PNG files',
      body: `Drop them on the box, press <strong>Choose files</strong>, or paste a screenshot with Ctrl+V — up to ${LIMITS}. Encoding starts immediately.`,
    },
    {
      title: 'Check the settings',
      body: 'Quality 60 suits photos; raise it for screenshots and text. Transparency is kept unless you choose a fill colour.',
    },
    {
      title: 'Download',
      body: 'Save each AVIF, or take the whole batch as a single ZIP.',
    },
  ],
  comparison: {
    caption: 'PNG and AVIF side by side',
    columns: ['PNG', 'AVIF'],
    rows: [
      ['Introduced', '1996, W3C', '2019, Alliance for Open Media'],
      ['Compression', 'Lossless only', 'Lossy or lossless, based on the AV1 video codec'],
      ['File size for a photo', 'Reference', 'A small fraction'],
      ['Transparency', 'Yes', 'Yes'],
      ['Animation', 'Yes, as APNG', 'Yes'],
      ['Browser support', 'Everything', 'All current browsers'],
      ['Editors and upload forms', 'Universal', 'Patchy'],
      ['Best for', 'Editing, exact pixels', 'Images on your own website'],
    ],
  },
  sections: [
    {
      id: 'why',
      title: 'Why convert PNG to AVIF',
      body: [
        `PNG keeps every pixel, which is right for editing and wrong for a web page: a photo saved as PNG is often several times the size of a JPG. ${cite('avifSpec', 'AVIF')} compresses with the AV1 video codec and keeps an alpha channel, so a product cut-out, a logo on a photo or an illustration loses most of its weight and none of its transparency.`,
      ],
    },
    {
      id: 'transparency',
      title: 'Transparency is kept',
      body: [
        'Soft edges, shadows and partly transparent pixels are encoded as they are. Tick <strong>Fill transparent areas</strong> only if you want a solid background instead — for a site with one background colour, that can make the file a little smaller still.',
      ],
    },
    AVIF_QUALITY,
    {
      id: 'graphics',
      title: 'Screenshots, text and flat graphics',
      body: [
        'Photos compress best. Screenshots, diagrams and images with small text are harder for a lossy encoder: thin lines can soften and coloured edges can blur at low settings. Use 75 or more for those, and look at the result at full size. A tiny icon or a graphic with a handful of colours may already be smaller as an optimized PNG; the sizes shown tell you which way it goes.',
      ],
    },
    AVIF_ENCODER,
    AVIF_SUPPORT,
    LIMITS_AND_PRIVACY,
  ],
  faq: [
    {
      question: 'How do I convert PNG to AVIF?',
      answer:
        'Drop your PNG files on the box at the top of this page or press Choose files. They are encoded in your browser; download each AVIF or all of them as a ZIP.',
    },
    {
      question: 'Does PNG to AVIF keep transparency?',
      answer: 'Yes. The alpha channel is encoded with the picture, partly transparent pixels included.',
    },
    {
      question: 'How much smaller is AVIF than PNG?',
      answer:
        'For photos, usually a small fraction of the PNG. For screenshots and flat graphics the gap is narrower, and a few tiny images may not shrink at all; the page shows the real size of every result.',
    },
    {
      question: 'Is it free to convert PNG to AVIF?',
      answer: 'Yes — free, with no sign-up, no watermark and no daily limit.',
    },
    AVIF_LOSSY_FAQ,
    {
      question: 'What about animated PNG?',
      answer:
        'Each frame of an animated PNG becomes its own still AVIF, and you choose which to keep. This page does not write animated AVIF.',
    },
    BATCH_FAQ,
    AVIF_SLOW_FAQ,
    AVIF_METADATA_FAQ,
    PRIVACY_FAQ,
  ],
  input: 'PNG — truecolor, palette, transparent',
  output: 'AVIF, 8-bit, quality 1–100, transparency kept',
  metadata: 'Not copied: the AVIF holds the picture only',
  related: [RELATED.jpgToAvif, RELATED.webpToAvif, RELATED.avifToPng, RELATED.whatIsAvif],
};
