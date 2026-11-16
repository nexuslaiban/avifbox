/**
 * Every external page the copy links to. One registry, so a link that moves is fixed in one place
 * and a test can tell a cited source from a stray link. Each page was read on 2026-11-11 and says
 * what the sentence linking to it says.
 */
export const SOURCES = {
  /** AV1 Image File Format v1.0.0, dated 19 February 2019. */
  avifSpec: 'https://aomediacodec.github.io/av1-avif/v1.0.0.html',
  aom: 'https://aomedia.org/',
  /** First browser versions with AVIF, and the share of browsers in use that read it. */
  caniuseAvif: 'https://caniuse.com/avif',
  av1Extension: 'https://apps.microsoft.com/detail/9mvzqvxjbq9v',
  /** AVIF in Safari on iOS 16, with macOS Ventura to follow. */
  safari16: 'https://webkit.org/blog/13152/webkit-features-in-safari-16-0/',
  android12: 'https://developer.android.com/about/versions/12/features',
  /** Feature summary of the June 2025 release (26.8), the first to list AVIF. */
  photoshop: 'https://helpx.adobe.com/photoshop/using/whats-new/2025-6.html#file-format-support',
  gimp: 'https://www.gimp.org/news/2020/10/07/gimp-2-10-22-released/',
  /** Home of the avifdec command-line decoder. */
  libavif: 'https://github.com/AOMediaCodec/libavif',
  /** ITU-T T.871, the JPEG File Interchange Format as a standard. */
  jfif: 'https://www.itu.int/rec/T-REC-T.871',
  webp: 'https://developers.google.com/speed/webp',
  /** The API that gives a page the frames of an animation; its table shows Safari without it. */
  imageDecoder: 'https://developer.mozilla.org/en-US/docs/Web/API/ImageDecoder',
  /** The PNG specification (editor's draft): APNG extends the static format; software without it shows the static image. */
  pngSpec: 'https://w3c.github.io/png/',
  /** APNG support: 97.4% of browsers in use; Chrome 59, Firefox 3, Safari 8, Edge 79. */
  caniuseApng: 'https://caniuse.com/apng',
  /** The project that compiles libavif to WebAssembly. */
  jsquash: 'https://github.com/jamsinclair/jSquash',
  cloudflarePrivacy: 'https://www.cloudflare.com/privacypolicy/',
  /** What a browser reports when it cannot reach the site; its "Privacy" section says no IP is stored. */
  cloudflareNel: 'https://developers.cloudflare.com/network-error-logging/',
  /** The repository this site is built from: public since 2026-11-16, AGPL-3.0-only. */
  sourceCode: 'https://github.com/nexuslaiban/avifbox',
} as const;

export type Source = keyof typeof SOURCES;

/** A citation for the HTML strings in the content files: `text` linked to its source. */
export const cite = (source: Source, text: string): string => `<a href="${SOURCES[source]}">${text}</a>`;
