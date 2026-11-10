import { BATCH_FAQ, LIMITS, LIMITS_AND_PRIVACY, PRIVACY_FAQ, RELATED } from '../site';
import type { ToolPage } from '../types';

export const jfifToPng: ToolPage = {
  slug: 'jfif-to-png',
  from: '.JFIF',
  to: '.PNG',
  sourceLabel: 'JFIF',
  accept: '.jfif,.jfi,.jif,.jpe,image/jpeg',
  target: 'png',
  sibling: { label: 'JPG', href: '/jfif-to-jpg' },
  title: 'JFIF to PNG Converter — Free, Batch, No Upload | AVIFBox',
  description:
    'Convert JFIF to PNG in your browser. Batch up to 50 files and choose a lossless Truecolor PNG or a smaller Optimized one. Free, private, no upload or sign-up.',
  h1: 'JFIF to <em>PNG</em> Converter',
  lede: 'Convert .jfif images to PNG for editing, design tools and anything that insists on PNG. It all happens on your own device — nothing is uploaded.',
  howToTitle: 'How to convert JFIF to PNG',
  steps: [
    {
      title: 'Add your JFIF files',
      body: `Drop them on the box, press <strong>Choose files</strong>, or paste with Ctrl+V — up to ${LIMITS}. Conversion starts immediately.`,
    },
    {
      title: 'Choose a PNG type',
      body: 'Truecolor keeps every decoded pixel. Optimized reduces the image to 256 colours for a much smaller file.',
    },
    {
      title: 'Download',
      body: 'Save each PNG, or take the whole batch as a single ZIP.',
    },
  ],
  comparison: {
    caption: 'JFIF (JPEG) and PNG side by side',
    columns: ['JFIF / JPEG', 'PNG'],
    rows: [
      ['Compression', 'Lossy (JPEG)', 'Lossless (DEFLATE)'],
      ['Photo file size', 'Reference', 'Several times larger'],
      ['Transparency', 'No', 'Yes'],
      ['Colours', '16.7 million', '16.7 million, or 256 in palette mode'],
      ['Repeated saving', 'Loses a little each time', 'No loss'],
      ['Sharp edges and text', 'Soft, with ringing', 'Crisp'],
      ['Opens in', 'Most software; the .jfif extension is sometimes refused', 'Everything'],
      ['Best for', 'Photographs', 'Screenshots, graphics, editing'],
    ],
  },
  sections: [
    {
      id: 'what',
      title: 'JFIF is JPEG',
      body: [
        'A .jfif file is a JPEG image under a less common extension; JFIF is simply the name of the JPEG file layout. Windows sometimes uses it when you save a picture from a web page.',
        'If all you need is a file ending in .jpg, do not convert to PNG at all: <a href="/jfif-to-jpg">JFIF to JPG</a> changes the name without touching the picture, so nothing is lost and the file stays small.',
      ],
    },
    {
      id: 'when',
      title: 'When PNG is the right target',
      body: [
        'Choose PNG when you are going to edit the image and save it repeatedly, when a design tool, game engine or document template asks for PNG, or when the picture is a screenshot or diagram you will crop and annotate. PNG never degrades on re-saving; JPEG does, a little, every time.',
      ],
    },
    {
      id: 'size',
      title: 'Expect a bigger file',
      body: [
        'Converting cannot add detail: the PNG is a lossless copy of what the JPEG decodes to, compression artefacts included. And because PNG stores every pixel, a photo comes out several times larger than the JFIF it came from.',
        'If that matters, switch to <strong>Optimized</strong>. The image is reduced to at most 256 colours with dithering, which shrinks photos substantially; pictures that already use few colours are stored as an exact palette either way. The sizes on screen are measured, so you can compare before you download.',
      ],
    },
    {
      id: 'details',
      title: 'Rotation, colour and transparency',
      body: [
        'Photos record which way up they were taken in their metadata. The converter applies that rotation, so portrait shots stay upright in the PNG. Images tagged with a Display P3 profile, as iPhone photos are, can keep their wide colour: choose Display P3 in the advanced options and the profile is embedded.',
        'JPEG has no transparency, so there is none to carry over, and converting does not remove backgrounds: PNGs made here are fully opaque. Other metadata, such as camera model and location, is not copied.',
      ],
    },
    { ...LIMITS_AND_PRIVACY, body: [`${LIMITS_AND_PRIVACY.body[0]} PNG output has no pixel cap.`, LIMITS_AND_PRIVACY.body[1]] },
  ],
  faq: [
    {
      question: 'How do I convert JFIF to PNG?',
      answer:
        'Drop your .jfif files on the box at the top of this page or press Choose files. They convert in your browser at once; download each PNG or all of them as a ZIP.',
    },
    {
      question: 'Is JFIF to PNG lossless?',
      answer: 'The PNG is an exact copy of the decoded picture, so nothing more is lost. Detail that JPEG compression already removed cannot come back.',
    },
    {
      question: 'Why is the PNG so much larger than the JFIF?',
      answer: 'JPEG discards detail to stay small; PNG stores every pixel. Choose Optimized to bring the size down, or keep the image as JPG.',
    },
    {
      question: 'Should I convert JFIF to PNG or to JPG?',
      answer:
        'JPG if you only need a familiar extension — <a href="/jfif-to-jpg">that conversion</a> is lossless and instant. PNG if you will edit the image or the destination requires PNG.',
    },
    {
      question: 'Will the PNG have a transparent background?',
      answer: 'No. JPEG images have no transparency, and converting does not remove backgrounds.',
    },
    {
      question: 'Why do I have JFIF files at all?',
      answer: 'Windows sometimes saves web images with the .jfif extension because of a system setting. They are ordinary JPEGs.',
    },
    BATCH_FAQ,
    PRIVACY_FAQ,
  ],
  input: 'JFIF and any other JPEG file',
  output: 'PNG (Truecolor or Optimized)',
  metadata: 'Not copied: the PNG holds pixels, plus a colour profile if you ask for one',
  related: [RELATED.jfifToJpg, RELATED.webpToPng, RELATED.avifToPng, RELATED.avifToJpg],
};
