import type { Sample } from '../ui/Converter';

/** Sample files offered in the drop zone of the AVIF converters. */
export const SAMPLE_BUTTONS: Sample[] = [
  { label: 'Photo', url: '/samples/photo.avif' },
  { label: 'Transparent', url: '/samples/transparent.avif' },
  { label: 'Animated', url: '/samples/animated.avif' },
  { label: 'HDR', url: '/samples/hdr.avif' },
];

export interface SampleSet {
  title: string;
  /** What the pair demonstrates. */
  note: string;
  alt: string;
  /** File names in public/samples/. Results are produced by `pnpm samples`. */
  source: string;
  results: { file: string; label: string }[];
  credit?: string;
}

export const SAMPLE_SETS: SampleSet[] = [
  {
    title: 'Photo',
    note: 'An ordinary lossy AVIF. Truecolor keeps every decoded pixel; Optimized trades colours for size.',
    alt: 'Earth rising over the lunar horizon',
    source: 'photo.avif',
    results: [
      { file: 'photo.png', label: 'PNG · Truecolor' },
      { file: 'photo-optimized.png', label: 'PNG · Optimized' },
    ],
    credit: '“Earthrise”, NASA / Bill Anders, 1968. Public domain.',
  },
  {
    title: 'Transparent graphic',
    note: 'Soft shadow and see-through tape: partial transparency survives.',
    alt: 'A red “Fragile” sticker with translucent tape and a soft shadow on a transparent background',
    source: 'transparent.avif',
    results: [{ file: 'transparent.png', label: 'PNG · Truecolor' }],
  },
  {
    title: 'Animated AVIF',
    note: '24 frames, exported here as one animated PNG.',
    alt: 'Animation of a parcel on a conveyor belt being re-labelled from AVIF to PNG',
    source: 'animated.avif',
    results: [{ file: 'animated.png', label: 'Animated PNG' }],
  },
];
