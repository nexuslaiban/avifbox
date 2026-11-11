/**
 * When each guide was published and last revised, as ISO days. This is the only place the dates
 * are written: the line printed on the page, the Article data and the sitemap all read it.
 * Change `updated` whenever a guide's content changes. Imported by astro.config.mjs, so keep this
 * file free of imports.
 */
export const GUIDE_DATES: Record<string, { published: string; updated: string }> = {
  '/what-is-avif': { published: '2026-11-11', updated: '2026-11-11' },
  '/how-to-open-avif-file': { published: '2026-11-11', updated: '2026-11-11' },
};

/** "11 November 2026" */
export function longDate(day: string): string {
  return new Intl.DateTimeFormat('en-GB', { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(day));
}
