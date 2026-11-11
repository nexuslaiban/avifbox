import { BATCH_FAQ, LIMITS, LIMITS_AND_PRIVACY, PRIVACY_FAQ, RELATED } from '../site';
import { cite } from '../sources';
import type { ToolPage } from '../types';

export const webpToJpg: ToolPage = {
  slug: 'webp-to-jpg',
  from: '.WEBP',
  to: '.JPG',
  sourceLabel: 'WebP',
  accept: '.webp,image/webp',
  target: 'jpg',
  sibling: { label: 'PNG', href: '/webp-to-png' },
  title: 'Convert WebP to JPG — Free, Batch, No Upload | AVIFBox',
  description:
    'Convert WebP to JPG (JPEG) free in your browser. Set the quality, pick a background for transparent areas, batch 50 files. No upload, no sign-up.',
  h1: 'Convert WebP to <em>JPG</em>',
  lede: 'Convert WebP images to JPG files that every phone, program and upload form accepts. Free, in batches, on your own device — the files are never uploaded.',
  howToTitle: 'How to convert WebP to JPG',
  steps: [
    {
      title: 'Add your WebP files',
      body: `Drop them on the box, press <strong>Choose files</strong>, or paste with Ctrl+V — up to ${LIMITS}. Conversion starts immediately.`,
    },
    {
      title: 'Set quality and background',
      body: 'The default quality of 90 suits most photos; lower it for smaller files. Pick the colour that should replace any transparent areas.',
    },
    {
      title: 'Download',
      body: 'Save each JPG, or take the whole batch as a single ZIP.',
    },
  ],
  comparison: {
    caption: 'WebP and JPG side by side',
    columns: ['WebP', 'JPG'],
    rows: [
      ['Introduced', '2010, Google', '1992'],
      ['Compression', 'Lossy or lossless', 'Lossy'],
      ['Size at similar quality', '25–34% smaller when lossy', 'Reference'],
      ['Transparency', 'Yes', 'No'],
      ['Animation', 'Yes', 'No'],
      ['Bit depth', '8 bits per channel', '8 bits per channel'],
      ['Browser support', 'All current browsers', 'All'],
      ['Apps, printers, upload forms', 'Patchy in older software', 'Everything'],
      ['Best for', 'Web pages', 'Sharing, printing, compatibility'],
    ],
  },
  sections: [
    {
      id: 'why',
      title: 'Why you have a WebP and need a JPG',
      body: [
        `Websites serve ${cite('webp', 'WebP')} because it loads faster than JPG or PNG, so that is what “Save image as” hands you. Browsers have read WebP for years, but older editors, office suites, chat apps and upload forms still reject it. JPG is the format none of them refuses, and for photographs it is also a small one.`,
      ],
    },
    {
      id: 'quality',
      title: 'Choosing a quality',
      body: [
        'JPG is lossy. A <strong>lossy</strong> WebP has already been compressed once, so converting compresses the picture a second time; a <strong>lossless</strong> WebP is compressed for the first time. Either way the default of 90 gives a result that is hard to tell from the source. Between 75 and 85 files get noticeably smaller and still look right on web pages and in email. Below 60, blocky artefacts appear around edges and text.',
        'Sizes update as soon as you let go of the slider, so you can see the trade-off instead of guessing.',
      ],
    },
    {
      id: 'transparency',
      title: 'Transparent areas get a background',
      body: [
        'JPG has no alpha channel. Any transparent part of the WebP — the cut-out around a logo, a sticker or a product photo — is flattened onto a background colour, white unless you choose another. Pick the colour of the page the image will sit on and soft edges blend in cleanly.',
        'If you need the transparency itself, convert <a href="/webp-to-png">WebP to PNG</a> instead.',
      ],
    },
    {
      id: 'size',
      title: 'Why the JPG can be bigger than the WebP',
      body: [
        `A JPG made from a lossy WebP usually comes out larger: ${cite('webp', 'Google’s own figures')} put lossy WebP 25–34% below a JPG of equivalent quality. Lower the quality slider if size matters more than detail.`,
        'A lossless WebP is the opposite case. Its JPG is normally much smaller, because JPG throws detail away and lossless WebP keeps all of it. The sizes shown are measured, so compare before you download.',
      ],
    },
    {
      id: 'animated',
      title: 'Animated WebP becomes frames',
      body: [
        `A JPG cannot move, so an animated WebP is exported as one JPG per frame, numbered in order, with thumbnails to pick from. To keep the motion in a single file, choose Animated PNG on the <a href="/webp-to-png">WebP to PNG converter</a>. ${cite('imageDecoder', 'Frame access')} works in Chrome, Edge and Firefox; Safari only exposes the first frame.`,
      ],
    },
    {
      ...LIMITS_AND_PRIVACY,
      title: 'Batch conversion, free and private',
      body: [
        ...LIMITS_AND_PRIVACY.body,
        'Have AVIF files too? The <a href="/avif-to-jpg">AVIF to JPG converter</a> works the same way and also handles HDR.',
      ],
    },
  ],
  faq: [
    {
      question: 'How do I convert WebP to JPG?',
      answer:
        'Drop your WebP files on the box at the top of this page or press Choose files. They convert in your browser at once; download each JPG or all of them as a ZIP.',
    },
    {
      question: 'Is WebP to JPEG the same as WebP to JPG?',
      answer:
        'Yes. JPG and JPEG are two spellings of one format; .jpg is the three-letter extension that early versions of Windows required.',
    },
    {
      question: 'Will I lose quality converting WebP to JPG?',
      answer:
        'A little, because JPG is lossy. At quality 90 the difference is hard to see. For an exact copy, convert <a href="/webp-to-png">WebP to PNG</a> instead.',
    },
    {
      question: 'What quality setting should I use?',
      answer:
        '90 for photos you care about, 75–85 for web pages and email. Going above 95 mostly makes the file bigger.',
    },
    {
      question: 'What happens to a transparent background?',
      answer:
        'It is filled with the background colour you choose — white by default — because JPG cannot store transparency.',
    },
    {
      question: 'Why is my JPG bigger than the WebP?',
      answer:
        'Lossy WebP compresses harder than JPG, so some growth is normal. Lower the quality slider to trade size against detail.',
    },
    {
      question: 'Can I convert an animated WebP to JPG?',
      answer:
        'Yes, as still images: every frame becomes a numbered JPG and you choose which to keep. A JPG itself cannot move.',
    },
    {
      question: 'Why do images download as WebP?',
      answer:
        'The website serves WebP because it is smaller, and your browser saves what it was given. Converting to JPG makes the file usable anywhere.',
    },
    BATCH_FAQ,
    PRIVACY_FAQ,
  ],
  input: 'WebP — lossy, lossless, animated',
  output: 'JPG, quality 1–100',
  metadata: 'Not copied: the JPG holds pixels, plus a colour profile if you ask for one',
  related: [RELATED.webpToPng, RELATED.avifToJpg, RELATED.jfifToJpg, RELATED.whatIsAvif],
};
