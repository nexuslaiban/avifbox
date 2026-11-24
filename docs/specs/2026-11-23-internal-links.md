# AVIFBox — links to the pages Google has not indexed yet

Date: 2026-11-23 · Source: Search Console URL inspection of the same day.

## Change

Four pages had no place in Google's index on 2026-11-23: `/avif-to-jpg` and `/jfif-to-jpg`
("Discovered – currently not indexed"), `/webp-to-jpg` and `/avif-viewer` ("URL is unknown to Google").
All four are in the sitemap and in the header menu of every page, but few pages link to them from
their body. This change adds links in context, where a reader would want them, without new sections.

- Home FAQ, "What is an AVIF converter?": the sentence that repeated the privacy claim (stated in
  full two answers later) now links JFIF to JPG and WebP to JPG. The body stays under 900 words (AC-32).
- `/what-is-avif`, "Opening and converting AVIF": one paragraph on .webp and .jfif files, linking
  WebP to JPG and JFIF to JPG. Related cards: the viewer and WebP to JPG replace Open an AVIF file
  (linked in the body already) and WebP to PNG. `updated` moves to 2026-11-23 (AC-31).
- Related cards on tool pages: `/avif-to-png` and `/avif-to-apng` gain the viewer; `/jfif-to-png`
  points at WebP to JPG instead of WebP to PNG; `/webp-to-png` at JFIF to JPG instead of JFIF to PNG.
- Related cards on `/about` and `/privacy` point at AVIF to JPG, the viewer, and WebP to JPG or
  JFIF to JPG.

## Existing behaviour changed

No route, title, description or structured-data shape changes. The home and guide FAQ data still
match the visible FAQ (AC-32). Tool pages stay within 900–1,300 words (AC-23).

## Observed

- 2026-11-24: deployed with `pnpm run deploy` from commit `bc46375`, together with the converters
  that make AVIF; the record of that deploy is in `2026-11-23-to-avif.md`.
