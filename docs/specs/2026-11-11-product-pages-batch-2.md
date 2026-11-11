# AVIFBox — product pages, batch 2

Date: 2026-11-11 · Source: the owner's page plan ("step 0: product pages first") checked against the
code the same day. Builds on `2026-11-11-avifbox-first-batch.md` and `2026-11-11-seo-geo-round-1.md`;
AC numbers continue from them (AC-01…33 are unchanged unless listed under "Existing behaviour changed").

## Change

Four parts, in the order they are built.

1. **The header gets a second level** (AC-34). Seven links already fill one row; three more pages do
   not fit. The header becomes `Converters ▾ · AVIF viewer · Guides ▾`, the converters grouped by
   source format (AVIF, JFIF, WebP). Every link stays a plain `<a>` in the page's HTML.
2. **The header logo becomes a file** (AC-35). The mark is inline SVG today, so there is no URL to
   fetch. It moves to `/logo.svg`, shown with an `<img>`. `/logo.png` (the `Organization` logo) stays.
3. **Two tool pages over what the engine already does** (AC-36, AC-37): `/webp-to-jpg`, and
   `/avif-to-apng` — the PNG converter with "Animated PNG" chosen by default.
4. **`/avif-viewer`** (AC-38, AC-39): the viewer that sits inside `/how-to-open-avif-file`, given its
   own page and three additions: a strip of frames for animations, the frame count among the facts,
   and saving what is shown as PNG or JPG in one click.

Out of scope, each a later spec: `/avif-to-webp`, `/avif-to-pdf`, `/avif-to-gif` (each needs an
encoder the engine does not have), `/jpg-to-avif` and `/png-to-avif`, `/heic-to-jpg`, the
"can't open AVIF" pages per system, `favicon.ico` / `apple-touch-icon`.

## Existing behaviour changed

- Header: the flat row of seven links is replaced by two menus and one link. On a phone the
  swipeable row is gone; an open menu spans the width of the header.
- Header logo: inline SVG → `<img src="/logo.svg">`. Same shape, same colours in light and dark.
- `/webp-to-png` gains the PNG / JPG tabs the AVIF and JFIF pairs already have.
- Home: the converter cards and the "what each conversion keeps" table grow from 5 rows to 7.
- Footer: the Converters list grows to 7; the viewer is listed with the guides.
- The viewer inside `/how-to-open-avif-file` is the same component, so it changes too: the
  "Convert to PNG / JPG" links become "Save as PNG / JPG" buttons that work in place, followed by
  links to the converters for more options. This amends AC-27.
- Sitemap: 10 → 13 URLs. AC-21, 22, 24, 28, 29 and 30 run over 13 pages; AC-23 over 7 tool pages.

## Acceptance criteria

All `E` (Playwright against the built site).

- **AC-34** Given any page, then the header has a "Converters" menu and a "Guides" menu, closed, and
  the links of both are in the page's HTML. When a menu's button is activated by click or by Enter,
  then its links are visible — the converters under the headings AVIF, JFIF and WebP — and the other
  menu is closed. Escape closes the open menu and puts the focus back on its button; a click
  elsewhere on the page closes it. The link to the current page has `aria-current="page"` and the
  button of the menu that holds it is marked as current. At 412 px wide an open menu causes no
  horizontal scrolling. With a menu open the page has no serious axe violation, light or dark. With
  JavaScript turned off a menu still opens and closes by click.
- **AC-35** Given any page, then the header mark is an `<img>` with `src` `/logo.svg`, `alt`
  "AVIFBox" and `width` / `height` attributes, and `/logo.svg` is served as `image/svg+xml`. Drawn in
  the light and in the dark colour scheme, the mark is filled with that scheme's accent colour
  (`#c8330f`, `#ff7a4d`). `Organization.logo` is still `/logo.png`.
- **AC-36** Given `/webp-to-jpg`, then it is a tool page that passes AC-21…24 and AC-28…30, and it
  and `/webp-to-png` reach each other through the output-format tabs. When a WebP is added, then the
  result is named `<name>.jpg` and is a JPEG; an animated WebP gives one JPG per frame.
- **AC-37** Given `/avif-to-apng`, then it is a tool page that passes AC-21…24 and AC-28…30. When an
  animated AVIF is added and no setting is touched, then the result is one `<name>.png` that is an
  animated PNG with as many frames as the source; when a still AVIF is added, the result is an
  ordinary PNG.
- **AC-38** Given `/avif-viewer`, then it is built, listed in the sitemap and passes AC-22, 28, 29 and
  30; its title starts with "AVIF Viewer"; it carries `SoftwareApplication` (URL
  `https://avifbox.com/avif-viewer`, price 0) and `FAQPage` data, the FAQ having at least 5 entries
  identical to the visible ones; its body copy is 500–900 words (viewer UI excluded); it links to
  `/avif-to-png`, `/avif-to-jpg` and `/how-to-open-avif-file`; and the header and footer of every
  page link to it.
- **AC-39** Given a still AVIF opened in the viewer, then it is shown with its file name, size,
  format, dimensions, bit depth, colour (HDR transfer and primaries) and "Animated: No"; "Save as
  PNG" downloads `<name>.png`, a PNG, and "Save as JPG" downloads `<name>.jpg`, a JPEG. Given an
  animated AVIF, then the facts give the number of frames and a strip shows one thumbnail per frame;
  choosing a thumbnail shows that frame and marks it as chosen, and "Play" returns to the moving
  image; with frame 2 chosen "Save as PNG" downloads `<name>-002.png`. Given a file that cannot be
  decoded, then the viewer says so and offers nothing to save. Where the browser cannot step
  through frames, the viewer says that only the first frame is available. On
  `/how-to-open-avif-file` the viewer behaves the same (AC-27).

## Decisions worth recording

- **`<details>`, not a scripted menu.** A `<details name>` group opens, closes and excludes its
  sibling without JavaScript, is a native disclosure for keyboards and screen readers, and keeps
  its links in the HTML. A few lines of script add Escape and click-outside; nothing depends on them.
- **`NAV.converters` stays one flat list** and each entry gains its group. The footer, the 404 page
  and the home page keep reading the list; only the header groups it.
- **The logo keeps a fixed URL** (`public/logo.svg`, cached for a day) instead of a hashed asset: a
  directory listing or a crawler needs an address that does not change. Cost: one cached request
  where there was none. The file carries its own light and dark colours, since an `<img>` cannot
  read the page's CSS variables.
- **`/avif-to-apng` writes `.png`.** That is what the engine already does and what software expects;
  the page says so.
- **The viewer runs the engine once per file** (PNG, every frame). That one job feeds the frame
  strip and the PNG download. The cost is decoding and encoding every frame of an animation, under
  the same 50 MB limit as the converters. "Save as JPG" runs a second job and, for an animation,
  stops it once the chosen frame has arrived.
- **Not testable here:** Safari (WebKit does not start on this machine). The "first frame only" note
  is tested by hiding `ImageDecoder` from the page, which exercises the note, not Safari's decoder.
- **Search volumes** in the page plan are the owner's research (Keyword Planner, 2026-06) and were
  not re-measured.

## Approval

TOUCHPOINT 1 — approved by the owner on 2026-11-11, all four parts. Each part is committed to `main`
once its tests are green; nothing is pushed or deployed without a separate go.
