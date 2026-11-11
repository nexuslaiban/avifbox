import { MAX_FILES, MAX_FILE_BYTES } from '../engine/limits';
import type { Faq, Related, Section } from './types';

export const SITE = {
  name: 'AVIFBox',
  url: 'https://avifbox.com',
  tagline: 'Image converters that run in your browser',
  email: 'hello@avifbox.com',
} as const;

export const LIMITS = `${MAX_FILES} files per batch, ${MAX_FILE_BYTES / (1024 * 1024)} MB each`;

export const NAV = {
  /** `group` is the source format; the header menu lists the converters under it. */
  converters: [
    { href: '/avif-to-png', label: 'AVIF to PNG', group: 'AVIF' },
    { href: '/avif-to-jpg', label: 'AVIF to JPG', group: 'AVIF' },
    { href: '/jfif-to-jpg', label: 'JFIF to JPG', group: 'JFIF' },
    { href: '/jfif-to-png', label: 'JFIF to PNG', group: 'JFIF' },
    { href: '/webp-to-png', label: 'WebP to PNG', group: 'WebP' },
  ],
  guides: [
    { href: '/what-is-avif', label: 'What is AVIF?' },
    { href: '/how-to-open-avif-file', label: 'Open an AVIF file' },
  ],
  about: [
    { href: '/about', label: 'About AVIFBox' },
    { href: '/privacy', label: 'Privacy' },
  ],
} as const;

/** Trust badges shown under every converter. */
export const STAMPS = [
  { title: 'No upload', note: 'Converted on your device' },
  { title: 'No account', note: 'Nothing to sign up for' },
  { title: 'No watermark', note: 'Your image, untouched' },
  { title: 'Free', note: 'No quota, no paid tier' },
] as const;

export const RELATED = {
  avifToPng: {
    href: '/avif-to-png',
    label: 'AVIF to PNG',
    note: 'Lossless, with transparency, animation and HDR handled.',
    kind: 'Converter',
  },
  avifToJpg: {
    href: '/avif-to-jpg',
    label: 'AVIF to JPG',
    note: 'Small files that every app and upload form accepts.',
    kind: 'Converter',
  },
  jfifToJpg: {
    href: '/jfif-to-jpg',
    label: 'JFIF to JPG',
    note: 'A lossless rename: the image data is not touched.',
    kind: 'Converter',
  },
  jfifToPng: {
    href: '/jfif-to-png',
    label: 'JFIF to PNG',
    note: 'For editing and for tools that insist on PNG.',
    kind: 'Converter',
  },
  webpToPng: {
    href: '/webp-to-png',
    label: 'WebP to PNG',
    note: 'Keeps transparency; splits animated WebP into frames.',
    kind: 'Converter',
  },
  whatIsAvif: {
    href: '/what-is-avif',
    label: 'What is AVIF?',
    note: 'The format, its strengths and where it still falls short.',
    kind: 'Guide',
  },
  openAvif: {
    href: '/how-to-open-avif-file',
    label: 'Open an AVIF file',
    note: 'Windows, Mac, iPhone, Android, Photoshop — and a viewer.',
    kind: 'Guide',
  },
} as const satisfies Record<string, Related>;

export const PRIVACY_FAQ: Faq = {
  question: 'Are my files uploaded to a server?',
  answer: 'No. Your browser decodes and re-encodes the images on your own device, and the files never leave it.',
};

export const BATCH_FAQ: Faq = {
  question: 'How many files can I convert at once?',
  answer: `Up to ${LIMITS}, and as many batches as you like. There is no daily limit; a very large image is bounded only by your device’s memory.`,
};

export const LIMITS_AND_PRIVACY: Section = {
  id: 'privacy',
  title: 'Limits and privacy, stated plainly',
  body: [
    `One batch holds ${LIMITS}. Those are guard rails, not a paywall: no daily quota, no account, no paid tier, and as many batches as you like. The real limit is your device’s memory, because that is where the work happens.`,
    'Your browser does the decoding and encoding, so the files are never sent anywhere. You need not take that on trust: this page’s security policy only lets it talk to avifbox.com, and your browser’s network panel will show that converting sends nothing.',
  ],
};
