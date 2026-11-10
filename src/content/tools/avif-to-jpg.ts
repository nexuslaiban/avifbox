import { BATCH_FAQ, LIMITS, LIMITS_AND_PRIVACY, PRIVACY_FAQ, RELATED } from '../site';
import type { ToolPage } from '../types';

export const avifToJpg: ToolPage = {
  slug: 'avif-to-jpg',
  from: '.AVIF',
  to: '.JPG',
  sourceLabel: 'AVIF',
  accept: '.avif,image/avif',
  target: 'jpg',
  sibling: { label: 'PNG', href: '/avif-to-png' },
  title: 'AVIF to JPG Converter — Free, Batch, No Upload | AVIFBox',
  description:
    'Convert AVIF to JPG (JPEG) in your browser. Set the quality, choose a background for transparent areas, batch 50 files. Free, private, no upload or sign-up.',
  h1: 'AVIF to <em>JPG</em> Converter',
  lede: 'Turn AVIF images into JPG files that every phone, program and upload form accepts. The conversion happens on your own device — nothing is uploaded.',
  howToTitle: 'How to convert AVIF to JPG',
  steps: [
    {
      title: 'Add your AVIF files',
      body: `Drop them on the box, press <strong>Choose files</strong>, or paste with Ctrl+V — up to ${LIMITS}. Conversion starts right away.`,
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
    caption: 'AVIF and JPG side by side',
    columns: ['AVIF', 'JPG'],
    rows: [
      ['Introduced', '2019', '1992'],
      ['Compression', 'Lossy or lossless (AV1)', 'Lossy (DCT)'],
      ['Size at similar quality', 'Roughly half', 'Reference'],
      ['Bit depth', '8, 10 or 12 bits per channel', '8 bits per channel'],
      ['Transparency', 'Yes', 'No'],
      ['HDR', 'Yes', 'No'],
      ['Animation', 'Yes', 'No'],
      ['Browser support', 'About 95% of browsers in use', 'All'],
      ['Apps, printers, upload forms', 'Recent software only', 'Everything'],
      ['Best for', 'Delivering images on the web', 'Sharing, printing, compatibility'],
    ],
  },
  sections: [
    {
      id: 'quality',
      title: 'Choosing a quality',
      body: [
        'JPG is lossy, so converting means compressing the picture a second time. At the default of 90 the result is hard to tell from the source. Between 75 and 85 files get noticeably smaller and still look right on web pages and in email. Below 60, blocky artefacts appear around edges and text.',
        'Sizes update as soon as you let go of the slider, so you can see the trade-off instead of guessing.',
      ],
    },
    {
      id: 'transparency',
      title: 'Transparent areas get a background',
      body: [
        'JPG has no alpha channel. Any transparent part of the AVIF is flattened onto a background colour — white unless you choose another. Pick the colour of the page the image will sit on and soft edges blend in cleanly.',
        'If you need the transparency itself, convert <a href="/avif-to-png">AVIF to PNG</a> instead.',
      ],
    },
    {
      id: 'animated',
      title: 'Animated AVIF becomes frames',
      body: [
        'A JPG cannot move, so an animated AVIF is exported as one JPG per frame, numbered in order, with thumbnails to pick from. To keep the motion in a single file, choose Animated PNG on the <a href="/avif-to-png">PNG converter</a>. Frame access works in Chrome, Edge and Firefox; Safari only exposes the first frame.',
      ],
    },
    {
      id: 'hdr',
      title: 'HDR and wide colour',
      body: [
        'JPG is 8-bit SDR. An HDR AVIF is tone-mapped rather than clipped, and you choose how: <strong>Keep brightness</strong> lets highlights fade toward white, <strong>Keep colour</strong> keeps their hue and makes them darker. Wide-gamut colour can be kept by choosing <strong>Display P3</strong>, which embeds the profile in the JPG.',
        'Brightness beyond SDR white and 10-bit precision cannot be stored in a JPG, so neither survives.',
      ],
    },
    {
      id: 'open',
      title: 'When the AVIF simply will not open',
      body: [
        'Converting is the quickest way around software that cannot read AVIF. If you would rather open the file as it is, the guide to <a href="/how-to-open-avif-file">opening AVIF files</a> covers Windows, Mac, iPhone, Android and Photoshop, and includes a viewer.',
      ],
    },
    LIMITS_AND_PRIVACY,
  ],
  faq: [
    {
      question: 'How do I convert AVIF to JPG?',
      answer:
        'Drop your AVIF files on the box at the top of this page or press Choose files. They convert in your browser at once; download each JPG or all of them as a ZIP.',
    },
    {
      question: 'Is AVIF to JPEG the same as AVIF to JPG?',
      answer: 'Yes. JPG and JPEG are two spellings of one format; .jpg is the three-letter extension that early versions of Windows required.',
    },
    {
      question: 'Will I lose quality converting AVIF to JPG?',
      answer: 'A little, because JPG is lossy. At quality 90 the difference is hard to see. For a lossless copy, convert to PNG instead.',
    },
    {
      question: 'What quality setting should I use?',
      answer: '90 for photos you care about, 75–85 for web pages and email. Going above 95 mostly makes the file bigger.',
    },
    {
      question: 'What happens to a transparent background?',
      answer: 'It is filled with the background colour you choose — white by default — because JPG cannot store transparency.',
    },
    {
      question: 'Why is my JPG bigger than the AVIF?',
      answer: 'AVIF compresses about twice as well as JPG, so some growth is normal. Lower the quality slider to trade size against detail.',
    },
    {
      question: 'Does the JPG keep the EXIF data?',
      answer:
        'No. Only the pixels are converted, so camera details and GPS location are not copied. Rotation is applied to the picture itself, so it stays upright.',
    },
    BATCH_FAQ,
    PRIVACY_FAQ,
  ],
  input: 'AVIF — 8, 10 and 12-bit, HDR, animated',
  output: 'JPG, quality 1–100',
  metadata: 'Not copied: the JPG holds pixels, plus a colour profile if you ask for one',
  related: [RELATED.avifToPng, RELATED.openAvif, RELATED.whatIsAvif, RELATED.jfifToJpg],
};
