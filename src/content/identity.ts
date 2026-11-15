/**
 * Who the site is. In a file of its own so that the scripts sent to the browser can name the site
 * without carrying the page copy of `site.ts` along.
 */
export const SITE = {
  name: 'AVIFBox',
  url: 'https://avifbox.com',
  tagline: 'Image converters that run in your browser',
  email: 'hello@avifbox.com',
} as const;
