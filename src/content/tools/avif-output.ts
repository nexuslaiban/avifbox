import { cite } from '../sources';
import type { Faq, Section } from '../types';

// Copy shared by the three pages that make AVIF: what the encoder is, what the slider means, and why it
// takes a moment. Each page adds what is particular to its source format.

export const AVIF_QUALITY: Section = {
  id: 'quality',
  title: 'Choosing a quality',
  body: [
    'The slider runs from 1 to 100, but AVIF’s scale is not JPG’s. At the preset of <strong>60</strong> most photos look like the original; a JPG needs a number near 90 for the same result. Go up to 70–80 for images with fine text, sharp lines or smooth gradients, and down to 40–50 when size matters more than detail.',
    'The size of every result is shown next to the original, so move the slider and compare before you download. The converter waits until you let go, then encodes the batch again.',
  ],
};

export const AVIF_ENCODER: Section = {
  id: 'encoder',
  title: 'The encoder, and why it takes a moment',
  body: [
    `Chrome and Firefox can read AVIF but will not write it from a web page, so this page brings its own encoder: ${cite('libavif', 'libavif')}, the reference library of the Alliance for Open Media, compiled to WebAssembly by the ${cite('jsquash', 'jSquash')} project. Every browser runs the same encoder, so the same file and setting give the same AVIF everywhere.`,
    'The first file you add loads the encoder, about 3.5 MB, from avifbox.com; your browser keeps it afterwards. AVIF is slow to create by design — the encoder tries many ways to describe each block of the picture — so a large photo takes a few seconds on a computer and longer on a phone. Several files are encoded side by side.',
  ],
};

export const AVIF_SUPPORT: Section = {
  id: 'support',
  title: 'Where the AVIF will open',
  body: [
    `${cite('caniuseAvif', 'Chrome 85, Firefox 93, Edge 121 and Safari 16')} or later display AVIF, which covers well over nine in ten browsers in use, and so do current Windows, macOS, iOS and Android. Older editors, office suites and many upload forms still refuse it, so keep the original if you will need it there. When an AVIF has to go back, <a href="/avif-to-jpg">AVIF to JPG</a> and <a href="/avif-to-png">AVIF to PNG</a> are one click away.`,
  ],
};

export const AVIF_LOSSY_FAQ: Faq = {
  question: 'Is converting to AVIF lossless?',
  answer:
    'No. The encoder works in its lossy mode, trading detail you are unlikely to notice for a much smaller file. Raise the quality if you see a difference, and keep the original if you may edit the image later.',
};

export const AVIF_METADATA_FAQ: Faq = {
  question: 'Is the EXIF data kept?',
  answer:
    'No. The AVIF holds only the picture: camera details and location are left out. A photo is turned upright first, so it does not end up sideways.',
};

export const AVIF_SLOW_FAQ: Faq = {
  question: 'Why does it take longer than making a JPG?',
  answer:
    'AVIF spends far more effort per image to save those bytes. The first file also loads the encoder once. Large photos take a few seconds each, longer on a phone.',
};
