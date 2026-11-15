# AVIFBox — SEO / GEO round 1

Date: 2026-11-11 · Source: the on-page audit of the live site made the same day.
Builds on `2026-11-11-avifbox-first-batch.md`; AC numbers continue from it (AC-01…28 are unchanged
unless listed under "Existing behaviour changed").

## Change

Five parts, in the order they are built.

1. **Late web fonts no longer move the page** (bug fix, AC-29). Measured on the live site: layout shift
   0.245 on `/what-is-avif` (phone) and 0.157 on `/` (desktop) when the fonts arrive after the first
   paint; the "good" bound is 0.1. Three causes, three fixes:
   - headings fell back to a sans about 45% wider than the display font → fallback faces scaled with
     `size-adjust` (Arial Bold 69%, Roboto Bold 75%, measured on the site's own headings);
   - the hero heading was capped at `12ch`, and `ch` follows whichever font is showing → `6.1em`;
   - body text fell back to `system-ui`, whose width is unknown → Arial / Liberation Sans / Roboto,
     all within 2% of the body font.
2. **Claims cite their primary source** (AC-30). External links to the specification, vendor release
   notes and support data, kept in one registry (`src/content/sources.ts`). Checking the sources
   turned up two claims to correct:
   - Photoshop does not read AVIF "from version 23.2 (February 2022)" — that release added WebP.
     Adobe lists AVIF in the June 2025 release, version 26.8.
   - "About 95% of browsers" → "over 95%" (caniuse: 96.7% on 2026-11-11).
3. **Guides show when they were last updated** (AC-31). One date per guide feeds the visible line,
   `Article.dateModified` and the sitemap `lastmod`. Today `dateModified` is a copy of
   `datePublished` and can never change.
4. **The home page carries real content** (AC-32). It targets the broadest query ("avif converter")
   with 232 words and no FAQ. It gains a how-to, a table of what converts to what, an FAQ, and
   `SoftwareApplication` + `FAQPage` data; the title leads with the keyword instead of the brand.
5. **`/about`, `/privacy` and an `Organization`** (AC-33). The site claims "nothing is uploaded" and
   says nowhere who runs it or what the host can see.

Out of scope: `/webp-to-jpg` and other new tool pages, heading rewrites, `favicon.ico` /
`apple-touch-icon`, `llms.txt`, preloading fonts, fallback faces for the mono font (its swap moves
nothing measurable), anything off-site (Bing Webmaster Tools, IndexNow, backlinks).

## Existing behaviour changed

- CSS: the fallback part of `--font-display` and `--font-body`; `.band h1` `max-width: 12ch` → `6.1em`.
  The page with fonts loaded is unchanged: heading height, line count and document height are
  identical on all 9 pages at 9 widths (320–1920 px).
- Home: `<title>` changes; new sections and JSON-LD blocks. The `<h1>` and the converter do not change.
- Guides: Photoshop version and the browser-share figure (also in the comparison tables of
  `/avif-to-png` and `/avif-to-jpg`); external links; a visible date.
- Sitemap: 8 → 10 URLs, and `lastmod` on the two guides. This supersedes "the 8 routes" in AC-21;
  AC-21, AC-22, AC-24 and AC-28 now run over all 10 pages.
- Footer: a third link group (About, Privacy) on every page.
- Home: "no privacy policy to worry about" is gone from the first feature, now that there is one.
- `Article` JSON-LD: `dateModified` comes from the guide's own date; `author` and `publisher` gain an
  `@id`.

## Acceptance criteria

All `E` (Playwright against the built site).

- **AC-29** Given any page at 412×915 and at 1280×800 with reduced motion, when the web fonts arrive
  only after the first paint, then the layout shift score is at most 0.1. A run in which a web font
  arrived before the first paint fails rather than passes.
- **AC-30** Given any page, then every external link in `<main>` is `https:` and is listed in the
  source registry. `/what-is-avif` and `/how-to-open-avif-file` each link to at least 4 different
  sources, the latter including the Microsoft Store page of the AV1 Video Extension; every tool page
  links to at least 1. Both guides name Photoshop 26.8 and neither mentions 23.2; no page says
  "about 95%".
- **AC-31** Given a guide, then it shows "Updated" followed by a `<time>` whose `datetime` equals
  `Article.dateModified`, the printed date is that same day, `datePublished` is not later than
  `dateModified`, and the sitemap `lastmod` of that URL is the same day. No other URL has a `lastmod`.
- **AC-32** Given the home page, then its title starts with "AVIF Converter"; it carries `WebSite`,
  `SoftwareApplication` (URL `https://avifbox.com/`, price 0) and `FAQPage` data; the FAQ has at
  least 6 entries, identical to the visible ones; `#how-to` has 3 steps; the `#formats` table links
  to all five tool pages; and the body copy is 500–900 words (tool UI excluded).
- **AC-33** Given `/about` and `/privacy`, then both are built, listed in the sitemap, and pass AC-22
  and AC-28; the footer of every page links to both. The home page and `/about` carry an
  `Organization` with `@id` `https://avifbox.com/#organization`, a name, a URL and a logo, and the
  guides' `Article.author` and `Article.publisher` have the same `@id`; the logo is an image on this
  site, at least 112 px on each side. `/privacy` states that files are converted on the device and never uploaded,
  that there are no cookies, analytics or ads, and that the site is served by Cloudflare, with a
  link to Cloudflare's privacy policy. `/about` gives the contact address as a `mailto:` link to
  `hello@avifbox.com`, and the two pages link to each other.

## Decisions worth recording

- **AC-29 runs with reduced motion.** The entrance animation starts at opacity 0, and Chrome scores
  a shift inside it only some of the time (not at all on a zero-latency local server, always on a
  real connection). Without the animation every shift counts, so the test is strict and repeatable.
- **Two fallback faces, not one.** Android has no Arial, and Roboto Bold is 8% narrower. The Roboto
  factor comes from measuring the font file; it has not been checked on a device.
- **The display factor is the home heading's own ratio.** That heading fills 98.7% of its width cap
  in the final design, so an average over all headings (70%) still wrapped it.
- **Dates are written by hand, on guides only.** A `lastmod` nobody maintains is worse than none, so
  tool pages get no date until something keeps it true.
- **Sources verified on 2026-11-11** (each URL fetched, and the claim read on the page): AVIF
  v1.0.0 (19 February 2019), caniuse `avif`, Microsoft Store AV1 Video Extension, WebKit "Safari
  16.0", Android 12 features, GIMP 2.10.22 release notes, ITU-T T.871, W3C PNG Third Edition,
  libavif, Google WebP, MDN `ImageDecoder`. Adobe's June 2025 feature summary refuses automated
  requests (403); its content was confirmed through the search index and the Adobe community
  manager's post that links it.
- **Who runs the site, and how to reach them, is the owner's call.** Answers given at approval:
  `/about` describes AVIFBox as an independent project and names nobody; the contact address is
  `hello@avifbox.com`. `avifbox.com` had no MX record when the page was written, so the address
  received nothing. The owner turned on Cloudflare Email Routing later on 2026-11-11: the MX and SPF
  records were checked that day, delivery to a mailbox was not. On 2026-11-15 the owner confirmed
  that mail sent to the address arrives.

## Approval

TOUCHPOINT 1 — approved by the owner on 2026-11-11, all five parts.
