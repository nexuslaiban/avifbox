import { LIMITS, LIMITS_AND_PRIVACY, PRIVACY_FAQ, RELATED } from '../site';
import type { ToolPage } from '../types';

export const webpToPng: ToolPage = {
  slug: 'webp-to-png',
  from: '.WEBP',
  to: '.PNG',
  sourceLabel: 'WebP',
  accept: '.webp,image/webp',
  target: 'png',
  title: 'Convert WebP to PNG — Free, Batch, No Upload | AVIFBox',
  description:
    'Convert WebP to PNG free in your browser. Batch 50 files, keep transparency, split animated WebP into frames or an animated PNG. No upload, no sign-up.',
  h1: 'Convert WebP to <em>PNG</em>',
  lede: 'Convert WebP images to PNG that any editor, viewer or upload form accepts. Free, in batches, on your own device — the files are never uploaded.',
  howToTitle: 'How to convert WebP to PNG',
  steps: [
    {
      title: 'Add your WebP files',
      body: `Drop them on the box, press <strong>Choose files</strong>, or paste with Ctrl+V — up to ${LIMITS}. Conversion starts immediately.`,
    },
    {
      title: 'Check the settings',
      body: 'Truecolor, the default, is lossless. Optimized makes a much smaller PNG. Fill transparent areas only if you want a solid background.',
    },
    {
      title: 'Download',
      body: 'Save each PNG, or take the whole batch as a single ZIP.',
    },
  ],
  comparison: {
    caption: 'WebP and PNG side by side',
    columns: ['WebP', 'PNG'],
    rows: [
      ['Introduced', '2010, Google', '1996, W3C'],
      ['Compression', 'Lossy or lossless', 'Lossless only'],
      ['File size', 'Reference', 'About a third larger than lossless WebP; several times larger than lossy'],
      ['Transparency', 'Yes', 'Yes'],
      ['Animation', 'Yes', 'Yes, as APNG'],
      ['Bit depth', '8 bits per channel', '8 or 16 bits per channel'],
      ['Browser support', 'All current browsers', 'Everything, including very old ones'],
      ['Editors and office software', 'Patchy in older versions', 'Universal'],
      ['Best for', 'Web pages', 'Editing, screenshots, compatibility'],
    ],
  },
  sections: [
    {
      id: 'why',
      title: 'Why you keep ending up with WebP',
      body: [
        'Websites serve WebP because it loads faster than PNG or JPG, so that is what “Save image as” hands you. Browsers have read WebP for years, but older editors, office suites, chat apps and upload forms still reject it. PNG is the safe way out: lossless, transparent and understood by everything.',
      ],
    },
    {
      id: 'quality',
      title: 'What happens to quality',
      body: [
        'WebP comes in two kinds. A <strong>lossless</strong> WebP converts to a PNG with exactly the same pixels; nothing changes but the container. A <strong>lossy</strong> WebP has already discarded detail, and the PNG preserves precisely what is left without adding any loss of its own. Either way, the Truecolor preset never alters a pixel.',
      ],
    },
    {
      id: 'transparency',
      title: 'Transparency is kept',
      body: [
        'Logos, stickers and product cut-outs keep their alpha channel, soft edges included. Tick <strong>Fill transparent areas</strong> only if you want a solid background colour instead.',
      ],
    },
    {
      id: 'size',
      title: 'Keeping the PNG small',
      body: [
        'A PNG made from a lossy WebP is usually several times larger, because PNG stores every pixel. The <strong>Optimized</strong> preset reduces the image to at most 256 colours with dithering and shrinks photos substantially. Images that already use few colours, such as icons and screenshots, are stored as an exact palette automatically, with no loss. The sizes shown are measured, so compare the presets before you download.',
      ],
    },
    {
      id: 'animated',
      title: 'Animated WebP',
      body: [
        'Animated WebP files are decoded frame by frame. Keep each frame as its own numbered PNG and untick the ones you do not need, or choose <strong>Animated PNG</strong> for a single file that still plays. Frame access works in Chrome, Edge and Firefox; in Safari, which does not expose frames to web pages, the first frame is converted.',
      ],
    },
    {
      ...LIMITS_AND_PRIVACY,
      title: 'Batch conversion, free and private',
      body: [
        ...LIMITS_AND_PRIVACY.body,
        'Have AVIF files too? The <a href="/avif-to-png">AVIF to PNG converter</a> works the same way and also handles HDR.',
      ],
    },
  ],
  faq: [
    {
      question: 'How do I convert WebP to PNG?',
      answer:
        'Drop your WebP files on the box at the top of this page or press Choose files. They convert in your browser at once; download each PNG or all of them as a ZIP.',
    },
    {
      question: 'Is it free to convert WebP to PNG?',
      answer: 'Yes — free, with no sign-up, no watermark and no daily limit.',
    },
    {
      question: 'Does WebP to PNG keep transparency?',
      answer: 'Yes. The alpha channel is copied as it is, partly transparent pixels included.',
    },
    {
      question: 'Is converting WebP to PNG lossless?',
      answer:
        'PNG adds no loss. A lossless WebP converts exactly; a lossy WebP keeps the quality it already has, and the detail it discarded cannot be restored.',
    },
    {
      question: 'Why is the PNG bigger than the WebP?',
      answer:
        'WebP compresses harder, especially when it is lossy. Choose Optimized to cut the PNG to 256 colours and a fraction of the size.',
    },
    {
      question: 'Can I convert WebP to PNG in bulk?',
      answer: `Yes: add up to ${LIMITS} and download the results as one ZIP. You can run as many batches as you like.`,
    },
    {
      question: 'Can I convert an animated WebP?',
      answer:
        'Yes. Every frame becomes a numbered PNG and you choose which to keep, or pick Animated PNG for one file that still moves.',
    },
    {
      question: 'Why do images download as WebP?',
      answer:
        'The website serves WebP because it is smaller, and your browser saves what it was given. Converting to PNG makes the file usable anywhere.',
    },
    PRIVACY_FAQ,
  ],
  input: 'WebP — lossy, lossless, animated',
  output: 'PNG (Truecolor or Optimized), animated PNG',
  metadata: 'Not copied: the PNG holds pixels, plus a colour profile if you ask for one',
  related: [RELATED.avifToPng, RELATED.jfifToPng, RELATED.jfifToJpg, RELATED.whatIsAvif],
};
