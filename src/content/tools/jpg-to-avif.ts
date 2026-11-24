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

export const jpgToAvif: ToolPage = {
  slug: 'jpg-to-avif',
  from: '.JPG',
  to: '.AVIF',
  sourceLabel: 'JPG',
  accept: '.jpg,.jpeg,.jfif,.jfi,.jif,image/jpeg',
  target: 'avif',
  title: 'JPG to AVIF Converter — Smaller Photos, Free, No Upload | AVIFBox',
  description:
    'Convert JPG to AVIF in your browser for photos about half the size. Set the quality, batch 50 files, download a ZIP. Free, private, no upload or sign-up.',
  h1: 'JPG to <em>AVIF</em> Converter',
  lede: 'Shrink JPG photos by converting them to AVIF, the format modern websites use to load faster. Free, in batches, on your own device — the files are never uploaded.',
  howToTitle: 'How to convert JPG to AVIF',
  steps: [
    {
      title: 'Add your JPG photos',
      body: `Drop JPG, JPEG or JFIF files on the box, press <strong>Choose files</strong>, or paste with Ctrl+V — up to ${LIMITS}. Encoding starts immediately.`,
    },
    {
      title: 'Set the quality',
      body: 'The preset of 60 suits most photos. Compare the sizes shown, and move the slider if you want a smaller file or more detail.',
    },
    {
      title: 'Download',
      body: 'Save each AVIF, or take the whole batch as a single ZIP.',
    },
  ],
  comparison: {
    caption: 'JPG and AVIF side by side',
    columns: ['JPG', 'AVIF'],
    rows: [
      ['Introduced', '1992', '2019, Alliance for Open Media'],
      ['Compression', 'Lossy', 'Lossy or lossless, based on the AV1 video codec'],
      ['File size at the same look', 'Reference', 'Roughly half'],
      ['Transparency', 'No', 'Yes'],
      ['HDR and wide colour', 'No', 'Yes'],
      ['Browser support', 'Everything', 'All current browsers'],
      ['Editors and upload forms', 'Universal', 'Patchy'],
      ['Best for', 'Sharing with anyone', 'Images on your own website'],
    ],
  },
  sections: [
    {
      id: 'why',
      title: 'Why convert JPG to AVIF',
      body: [
        `${cite('avifSpec', 'AVIF')} stores a picture with the compression of the AV1 video codec. For photos that means a file roughly half the size of a JPG that looks the same, so pages load faster and use less data. That is why image-heavy sites, shops and portfolios serve AVIF to every browser that reads it.`,
        'The saving depends on the photo. Soft backgrounds, skies and skin shrink the most; busy, sharp detail such as foliage or gravel the least. A JPG that was already compressed hard has less to give.',
      ],
    },
    AVIF_QUALITY,
    {
      id: 'generation',
      title: 'A JPG is already compressed',
      body: [
        'Converting a JPG to AVIF compresses it a second time. Detail the JPG had already discarded cannot come back, and its blocky artefacts are part of the picture the encoder sees. Start from the largest, least compressed JPG you have, and do not convert the same photo back and forth.',
        'If you have the original as PNG or straight from the camera, use that instead: <a href="/png-to-avif">PNG to AVIF</a> starts from every pixel.',
      ],
    },
    AVIF_ENCODER,
    AVIF_SUPPORT,
    {
      id: 'web',
      title: 'Using AVIF on a website',
      body: [
        'Serve the AVIF to browsers that read it and keep the JPG as a fallback for the rest. In HTML that is a <code>&lt;picture&gt;</code> element with an AVIF <code>&lt;source&gt;</code> and the JPG in its <code>&lt;img&gt;</code>; every browser picks the first format it understands.',
      ],
    },
    LIMITS_AND_PRIVACY,
  ],
  faq: [
    {
      question: 'How do I convert JPG to AVIF?',
      answer:
        'Drop your JPG files on the box at the top of this page or press Choose files. They are encoded in your browser; download each AVIF or all of them as a ZIP.',
    },
    {
      question: 'How much smaller is AVIF than JPG?',
      answer:
        'Often around half the size at the same visual quality, sometimes much less. It depends on the photo and on how hard the JPG was compressed; the page shows the real size of every result.',
    },
    {
      question: 'Is it free to convert JPG to AVIF?',
      answer: 'Yes — free, with no sign-up, no watermark and no daily limit.',
    },
    AVIF_LOSSY_FAQ,
    BATCH_FAQ,
    AVIF_SLOW_FAQ,
    AVIF_METADATA_FAQ,
    PRIVACY_FAQ,
  ],
  input: 'JPG, JPEG, JFIF',
  output: 'AVIF, 8-bit, quality 1–100',
  metadata: 'Not copied: the AVIF holds the picture only, no EXIF or location',
  related: [RELATED.pngToAvif, RELATED.webpToAvif, RELATED.avifToJpg, RELATED.whatIsAvif],
};
