import type { Target } from '../engine/types';

/** Strings marked "HTML" may contain inline markup (<a>, <strong>, <em>, <code>) and are rendered as is. */

export interface Step {
  title: string;
  /** HTML */
  body: string;
}

export interface Comparison {
  caption: string;
  columns: [string, string];
  /** [aspect, left format, right format] */
  rows: [string, string, string][];
}

export interface Section {
  id: string;
  title: string;
  /** HTML blocks: paragraphs, or a whole <ul>. */
  body: string[];
}

export interface Faq {
  question: string;
  /** HTML */
  answer: string;
}

export interface Related {
  href: string;
  label: string;
  note: string;
  kind: 'Converter' | 'Guide';
}

export interface ToolPage {
  slug: string;
  /** Shipping-label fields, e.g. ".AVIF" -> ".PNG". */
  from: string;
  to: string;
  /** How the source reads in the drop zone ("AVIF"), and the picker filter. */
  sourceLabel: string;
  accept: string;
  target: Target;
  /** The same source converted to the other output format, shown as a tab. */
  sibling?: { label: string; href: string };
  offerKeepJpeg?: boolean;
  title: string;
  description: string;
  /** HTML; wrap the word to highlight in <em>. */
  h1: string;
  lede: string;
  howToTitle: string;
  steps: Step[];
  comparison: Comparison;
  sections: Section[];
  /** Show the downloadable sample files (AVIF pages). */
  samples?: boolean;
  faq: Faq[];
  /** Fact sheet rows that differ per tool; the rest is shared. */
  input: string;
  output: string;
  metadata: string;
  related: Related[];
}
