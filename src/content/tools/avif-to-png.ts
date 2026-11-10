import { BATCH_FAQ, LIMITS, LIMITS_AND_PRIVACY, PRIVACY_FAQ, RELATED } from '../site';
import type { ToolPage } from '../types';

export const avifToPng: ToolPage = {
  slug: 'avif-to-png',
  from: '.AVIF',
  to: '.PNG',
  sourceLabel: 'AVIF',
  accept: '.avif,image/avif',
  target: 'png',
  sibling: { label: 'JPG', href: '/avif-to-jpg' },
  title: 'AVIF to PNG Converter — Free, Batch, No Upload | AVIFBox',
  description:
    'Convert AVIF to PNG in your browser: batch 50 files, keep transparency, export animated AVIF frame by frame and tone-map HDR. Free, no upload, no sign-up.',
  h1: 'AVIF to <em>PNG</em> Converter',
  lede: 'Turn AVIF images into PNG files that open everywhere. The conversion runs on your own device, so nothing is uploaded and nothing waits in a queue.',
  howToTitle: 'How to convert AVIF to PNG',
  steps: [
    {
      title: 'Add your AVIF files',
      body: `Drop them on the box, press <strong>Choose files</strong>, or paste with Ctrl+V — up to ${LIMITS}. Conversion starts immediately.`,
    },
    {
      title: 'Adjust if you need to',
      body: 'Pick Truecolor for a lossless copy or Optimized for a smaller file. Results update as you change settings.',
    },
    {
      title: 'Download',
      body: 'Save each PNG, or take the whole batch as one ZIP.',
    },
  ],
  comparison: {
    caption: 'AVIF and PNG side by side',
    columns: ['AVIF', 'PNG'],
    rows: [
      ['Introduced', '2019, Alliance for Open Media', '1996, W3C'],
      ['Compression', 'Lossy or lossless (AV1)', 'Lossless only (DEFLATE)'],
      ['Photo file size', 'Reference', 'Typically 5–20× larger'],
      ['Bit depth', '8, 10 or 12 bits per channel', '8 or 16 bits per channel'],
      ['Transparency', 'Full alpha channel', 'Full alpha channel'],
      ['HDR', 'Yes — PQ and HLG', 'Only since the 2025 revision; rarely read'],
      ['Wide colour gamut', 'Yes', 'Yes, with an embedded profile'],
      ['Animation', 'Yes, image sequences', 'Yes, as APNG'],
      ['Browser support', 'About 95% of browsers in use', 'Effectively all'],
      ['Repeated editing', 'Loses quality on each lossy save', 'No generation loss'],
      ['Best for', 'Delivering images on the web', 'Editing, screenshots, graphics'],
    ],
  },
  sections: [
    {
      id: 'transparency',
      title: 'Transparency survives the trip',
      body: [
        'AVIF and PNG both carry a full alpha channel, so see-through areas, soft shadows and anti-aliased edges come out as they went in — no checkerboard, no white box.',
        'If the PNG is headed somewhere that ignores transparency, tick <strong>Fill transparent areas</strong> and pick a colour. Going to JPG instead? The <a href="/avif-to-jpg">AVIF to JPG converter</a> does the same with a background colour.',
      ],
    },
    {
      id: 'size',
      title: 'Why the PNG is bigger, and how to shrink it',
      body: [
        'AVIF is usually lossy; PNG stores every pixel, so a photo typically grows 5 to 20 times. That is the format, not a fault in the conversion. Two presets control it:',
        '<ul><li><strong>Truecolor</strong> — a lossless copy in the leanest lossless layout: an exact palette for images with 256 colours or fewer, no alpha channel when nothing is transparent.</li><li><strong>Optimized</strong> — at most 256 colours, with dithering. Roughly halves a photo; flat graphics usually look identical.</li></ul>',
        'The sizes beside each file are measured, not estimated — switch presets and watch them change.',
      ],
    },
    {
      id: 'animated',
      title: 'Animated AVIF: pick frames, or keep it moving',
      body: [
        'Many converters keep the first frame of an animated AVIF and quietly drop the rest. Here every frame becomes its own numbered PNG, with thumbnails so you can untick the ones you do not want.',
        'Prefer one file? <strong>Animated PNG</strong> gives a single .png (APNG) that keeps the motion and timing and plays in every current browser. Frame access works in Chrome, Edge and Firefox; in Safari only the first frame is converted.',
      ],
    },
    {
      id: 'hdr',
      title: 'HDR and 10-bit AVIF, handled honestly',
      body: [
        'PNGs from this tool are 8-bit SDR, the kind every program reads. An HDR AVIF (PQ or HLG) has to be squeezed to fit, and the converter does that deliberately:',
        '<ul><li><strong>Keep brightness</strong> — highlights stay as bright as SDR allows and fade toward white, like a camera JPG.</li><li><strong>Keep colour</strong> — highlights keep their hue and come out darker.</li></ul>',
        '<strong>Display P3</strong> keeps wide-gamut colour by embedding the profile. Lost either way: brightness above SDR white, and 10- and 12-bit precision, which is rounded to 8 bits. If you need those, decode to 16-bit TIFF or PNG with a desktop tool such as <code>avifdec</code>.',
      ],
    },
    {
      ...LIMITS_AND_PRIVACY,
      body: [
        `A batch holds ${LIMITS}. Those are guard rails, not a paywall: no quota, no account, as many batches as you like. PNG output has no pixel cap; the real limit is your device’s memory.`,
        LIMITS_AND_PRIVACY.body[1],
      ],
    },
  ],
  samples: true,
  faq: [
    {
      question: 'How do I convert AVIF to PNG?',
      answer:
        'Drop your AVIF files on the box at the top of this page, or press Choose files. They convert at once; download each PNG, or a ZIP of them all.',
    },
    {
      question: 'Why is the PNG so much bigger than the AVIF?',
      answer:
        'AVIF is lossy and PNG is not, so a photo commonly grows 5–20 times. Choose Optimized, or convert to JPG if you do not need transparency.',
    },
    {
      question: 'Does AVIF to PNG keep transparency?',
      answer:
        'Yes. The alpha channel is copied as it is, partly transparent pixels included, unless you tick Fill transparent areas.',
    },
    {
      question: 'Is the PNG I get actually lossless?',
      answer:
        'PNG adds no loss: Truecolor stores the pixels your browser decodes. Detail the AVIF discarded cannot return, and 10- and 12-bit sources are rounded to 8-bit. Nearly transparent pixels keep their alpha, but their colour is stored less precisely — invisible once drawn.',
    },
    {
      question: 'Why will my AVIF file not open in Windows Photos or Photoshop?',
      answer:
        'AVIF dates from 2019 and older software never learned it. See <a href="/how-to-open-avif-file">how to open an AVIF file</a> — or convert it to PNG and open it anywhere.',
    },
    {
      question: 'Can I convert animated AVIF to PNG?',
      answer:
        'Yes. Every frame becomes a numbered PNG and you choose which to keep, or pick Animated PNG for one file that still moves.',
    },
    {
      question: 'What about HDR and wide-colour AVIF?',
      answer:
        'HDR is tone-mapped to SDR — Keep brightness or Keep colour — and wide gamut can be kept as Display P3. Output is always 8-bit.',
    },
    BATCH_FAQ,
    PRIVACY_FAQ,
    {
      question: 'Should I convert to JPG or WebP rather than PNG?',
      answer:
        'PNG for transparency, screenshots, graphics and anything you will edit. For photos you only view or share, <a href="/avif-to-jpg">JPG</a> is far smaller; WebP is smaller still but less widely accepted.',
    },
  ],
  input: 'AVIF — 8, 10 and 12-bit, HDR, animated',
  output: 'PNG (Truecolor or Optimized), animated PNG',
  metadata: 'Not copied: the PNG holds pixels, plus a colour profile if you ask for one',
  related: [RELATED.avifToJpg, RELATED.whatIsAvif, RELATED.openAvif, RELATED.webpToPng],
};
