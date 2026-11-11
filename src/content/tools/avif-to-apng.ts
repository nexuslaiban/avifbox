import { BATCH_FAQ, LIMITS, LIMITS_AND_PRIVACY, PRIVACY_FAQ, RELATED } from '../site';
import { cite } from '../sources';
import type { ToolPage } from '../types';

export const avifToApng: ToolPage = {
  slug: 'avif-to-apng',
  from: '.AVIF',
  to: 'APNG',
  sourceLabel: 'AVIF',
  accept: '.avif,image/avif',
  target: 'png',
  animation: 'apng',
  title: 'AVIF to APNG Converter — Animated AVIF to Animated PNG | AVIFBox',
  description:
    'Convert animated AVIF to APNG (animated PNG) in your browser. Every frame, its timing and its transparency are kept. Free, batch 50 files, no upload.',
  h1: 'AVIF to <em>APNG</em> Converter',
  lede: 'Turn an animated AVIF into an animated PNG that keeps every frame, its timing and its transparency. The conversion runs on your own device — nothing is uploaded.',
  howToTitle: 'How to convert AVIF to APNG',
  steps: [
    {
      title: 'Add your animated AVIF files',
      body: `Drop them on the box, press <strong>Choose files</strong>, or paste with Ctrl+V — up to ${LIMITS}. Conversion starts right away.`,
    },
    {
      title: 'Leave the settings as they are',
      body: 'On this page <strong>Animated PNG</strong> is already selected, so each animation comes out as one file that still moves. Fill transparent areas only if you want a solid background.',
    },
    {
      title: 'Download',
      body: 'Save each animated PNG, or take the whole batch as a single ZIP. The files end in .png.',
    },
  ],
  comparison: {
    caption: 'Animated AVIF and APNG side by side',
    columns: ['Animated AVIF', 'APNG'],
    rows: [
      ['Compression', 'Lossy or lossless (AV1)', 'Lossless'],
      ['File size', 'Reference', 'Many times larger'],
      ['Bit depth', '8, 10 or 12 bits per channel', '8 bits per channel from this converter'],
      ['Transparency', 'Yes', 'Yes, a full alpha channel'],
      ['Frame timing and repeat count', 'Stored in the file', 'Copied from the AVIF'],
      ['Browser support', 'Over 95% of browsers in use', 'Over 97% of browsers in use'],
      ['Software that cannot play it', 'Cannot open the file at all', 'Shows the first frame as a still PNG'],
      ['File extension', '.avif', '.png'],
      ['Best for', 'Delivering animations on the web', 'A lossless animation that opens wherever PNG does'],
    ],
  },
  sections: [
    {
      id: 'what',
      title: 'What an APNG is',
      body: [
        `An APNG is a PNG file with extra chunks that hold further frames and their timing. ${cite('pngSpec', 'The PNG specification')} defines it as an extension of the ordinary, static format: software that understands the animation plays it, and software that does not shows a single still image. In the files written here that still image is the first frame.`,
        'That is also why the result is named .png. An APNG is a valid PNG, and the .png extension is what browsers, operating systems and upload forms expect.',
      ],
    },
    {
      id: 'support',
      title: 'Where an APNG plays',
      body: [
        `${cite('caniuseApng', 'Every current browser')} plays APNG: Chrome since version 59, Firefox since 3, Safari since 8 and Edge since 79. Outside the browser it varies. Many image viewers and editors open the file and show only the first frame.`,
        'If a program shows a still picture, the file is not broken: that program ignores the animation. Open the file in a browser to check that it moves.',
      ],
    },
    {
      id: 'size',
      title: 'Why the APNG is much bigger',
      body: [
        'An animated AVIF is compressed like video: most frames are stored as changes from the frame before, and usually with some loss. An APNG stores every frame losslessly. Expect a file many times the size of the AVIF, growing with the number of frames and with their dimensions.',
        'Animated PNG is always written in truecolour. The <strong>Optimized</strong> preset, which reduces an image to 256 colours, applies to still images and to separate frames, not to an APNG.',
      ],
    },
    {
      id: 'frames',
      title: 'Timing, repeats and transparency',
      body: [
        'Each frame keeps the delay it had in the AVIF, and the animation repeats as many times as the AVIF says — forever, in most files. Transparency is copied as it is, soft edges included, unless you tick <strong>Fill transparent areas</strong>.',
        'Want the frames as separate images instead? Choose <strong>Every frame</strong> under “Animation, HDR and colour profile”, or use <a href="/avif-to-png">AVIF to PNG</a>, which starts that way. For JPG frames there is <a href="/avif-to-jpg">AVIF to JPG</a>.',
      ],
    },
    {
      id: 'stills',
      title: 'Still images, and Safari',
      body: [
        'A still AVIF added to this page becomes an ordinary PNG, since there is nothing to animate. The <a href="/avif-viewer">AVIF viewer</a> shows whether a file is animated, and how many frames it has.',
        `Safari does not let a web page step through the frames of an animation — it has no ${cite('imageDecoder', 'ImageDecoder')} — so there only the first frame is converted and the result is a still PNG. Use Chrome, Edge or Firefox to convert animations.`,
      ],
    },
    LIMITS_AND_PRIVACY,
  ],
  faq: [
    {
      question: 'How do I convert AVIF to APNG?',
      answer:
        'Drop your animated AVIF files on the box at the top of this page or press Choose files. Each one is converted in your browser to an animated PNG; download them one by one or as a ZIP.',
    },
    {
      question: 'Is an APNG the same as a PNG?',
      answer:
        'It is a PNG with an animation added. Any program that reads PNG can open it; programs that also understand APNG play it, and the others show the first frame.',
    },
    {
      question: 'Why does my APNG not move?',
      answer:
        'Most often because the program showing it does not support APNG and displays the first frame. Open the file in a browser. The other causes are a source AVIF that was a still image, and converting in Safari, which only reads the first frame.',
    },
    {
      question: 'Why does the file end in .png and not .apng?',
      answer:
        'Because an APNG is a valid PNG, and .png is the extension that browsers, operating systems and upload forms recognise. You can rename it to .apng if a tool asks for that.',
    },
    {
      question: 'Does AVIF to APNG keep transparency?',
      answer: 'Yes. The alpha channel of every frame is copied as it is, partly transparent pixels included.',
    },
    {
      question: 'Is quality lost converting AVIF to APNG?',
      answer:
        'APNG adds no loss: every frame is stored exactly as it was decoded. Detail the AVIF already discarded cannot be restored.',
    },
    {
      question: 'Why is the APNG so much bigger than the AVIF?',
      answer:
        'AVIF compresses an animation like video; APNG stores each frame losslessly. A much larger file is normal, and it grows with the number of frames.',
    },
    BATCH_FAQ,
    PRIVACY_FAQ,
  ],
  input: 'AVIF — animated; a still AVIF becomes an ordinary PNG',
  output: 'Animated PNG (.png), truecolour with transparency',
  metadata: 'Not copied: the PNG holds pixels, plus a colour profile if you ask for one',
  related: [RELATED.avifToPng, RELATED.avifToJpg, RELATED.whatIsAvif, RELATED.webpToPng],
};
