# AVIFBox — WebKit in the test run, and four loose ends

Date: 2026-11-12 · Source: the review after batch 2 went live, and a first run of the whole E2E suite
in Playwright's WebKit the same day. Builds on the three specs of 2026-11-11; AC numbers continue from
them (AC-01…39 are unchanged unless listed under "Existing behaviour changed").

## Change

Five parts, in the order they are built.

1. **A failed comparison of files fails at once** (AC-40). Found on the way to part 2:
   `expect(buffer).toEqual(other)` with two different 200 kB buffers spends minutes at 100% CPU
   building a diff. The test timeout cannot interrupt it, so the run hangs instead of failing.
2. **WebKit joins the E2E run** (AC-41). It had never started on the development machine. Run by hand
   on 2026-11-12, 63 of the 65 tests passed as they are; the other two are amended below. Every spec
   runs in WebKit, not only the converter and the viewer.
3. **`/favicon.ico` and `/apple-touch-icon.png`** (AC-42). Both are 404 today. A client that does not
   take an SVG favicon — older Safari among them — asks for the first; iOS asks for the second when a
   page is put on the home screen.
4. **HSTS** (AC-43). The site promises that files stay on the device. That promise rests on the
   script arriving untouched, so a browser that knows the site should never ask for it over plain HTTP.
5. **The AVIF pages link to the viewer from their body** (AC-44). Today only the header and the
   footer do.

Out of scope: `→ AVIF` pages, GIF and WebP export, localisation, `llms.txt`, and a bundled deflate
(see "Found, not fixed"). A git remote is the owner's decision and not a change to the site.

## Existing behaviour changed

- `pnpm test:e2e` starts WebKit as well. On Ubuntu 26.04 that needs two system packages,
  `libevent-2.1-7t64` and `libmanette-0.2-0`. Without them the WebKit project fails; it is not skipped.
- **AC-26 is amended.** "Byte for byte" holds in Chromium, which made the published samples. In every
  engine the result must decode to the same pixels. WebKit's `CompressionStream` deflates differently.
- **AC-07 (Display P3) does not run in WebKit**, for the reason under "Decisions".
- Every page gains `<link rel="apple-touch-icon">`. The declared icon is still `/favicon.svg`.
- Every response gains `Strict-Transport-Security: max-age=31536000`. A browser that has visited the
  site refuses plain HTTP to `avifbox.com` for a year. HTTP already redirects to HTTPS, so nothing
  visible changes. Undoing it takes a deploy with `max-age=0` and visitors coming back.
- The home page gains a card for the viewer, marked "Viewer". The three AVIF tool pages and the two
  guides gain a sentence that links to it. `/avif-to-png` stood at 1,298 words, so two turns of
  phrase that carried no fact are cut there to keep it within AC-23's 1,300. No link is removed.

## Acceptance criteria

`E` = Playwright against the built site, `U` = Vitest.

- **AC-40** (E) Given two files of 300 kB that differ, when a test compares them, then the comparison
  fails in under a second, and the message names what was compared and both sizes. Given two decoded
  images that differ, then the message gives the number of pixels that differ.
- **AC-41** (E) Given `pnpm test:e2e`, then every spec file runs in a `webkit` project as well as in
  Chromium, and passes. The one test skipped in WebKit is AC-07 Display P3, and the skip says why.
  AC-26, amended: given the published `transparent.avif` converted again on `/avif-to-png`, then the
  result decodes to the same pixels as the published `transparent.png` in every engine, and in
  Chromium it is the same file byte for byte.
- **AC-42** (E) `/favicon.ico` is served and is an ICO that holds a 16, a 32 and a 48 px image, each a
  PNG of that size. `/apple-touch-icon.png` is served and is a 180 × 180 PNG without a transparent
  pixel. In both, the corner is the mark's background (`#c8330f`). Every page has
  `<link rel="apple-touch-icon" href="/apple-touch-icon.png">` and still declares `/favicon.svg`.
- **AC-43** (U) `public/_headers` gives every path (`/*`) the header `Strict-Transport-Security` with
  the value `max-age=31536000`: no `includeSubDomains`, no `preload`. After the deploy the header is on
  `https://avifbox.com/` (observed with curl, recorded below).
- **AC-44** (E) Given `/`, `/avif-to-png`, `/avif-to-jpg`, `/avif-to-apng`, `/what-is-avif` and
  `/how-to-open-avif-file`, then the body of the page — outside the header, the footer and the tool —
  links to `/avif-viewer`. On every one of them but the home page, such a link is inside a paragraph.
  AC-23 still holds.

## Decisions worth recording

- **WebKit here is not Safari.** Playwright's build is WebKit trunk (26.6) on its Linux port. Two
  differences matter to this product. It has `ImageDecoder`; Safari has it in Technology Preview only
  (MDN's compatibility data, 2026-11-12). And it hands over a wide-gamut AVIF as stored instead of
  converting it for an sRGB canvas, as Firefox does; that is the port, and Safari on macOS converts
  through the system. So this project checks the engine — script, layout, workers, WASM, the CSP,
  downloads — and not Safari's codecs or colour. The path without `ImageDecoder` is still walked by
  the test that takes it away from the worker, which now runs in WebKit too. A pass on a real iPhone or
  Mac stays with the owner.
- **The copy says Safari has no `ImageDecoder`.** True on 2026-11-12. When a Safari release ships it,
  `/avif-viewer`, `/avif-to-apng` and the viewer's own note need the sentence changed.
- **System packages, not a launcher in the repo.** Playwright's WebKit wrapper resets
  `LD_LIBRARY_PATH`, so libraries cannot be supplied from outside. An earlier fix linked one from
  `/tmp` into Playwright's cache; it broke when `/tmp` was emptied, and the dangling link then stopped
  WebKit before it could report what it lacked.
- **HSTS without `includeSubDomains` and without `preload`.** The site sets no cookie, so a subdomain
  has nothing to leak, and a later subdomain is not bound by today's choice. Preloading cannot be
  taken back in any useful time.
- **`favicon.ico` is not declared in the page.** It is there for clients that ask for the well-known
  path. Declaring it would make some browsers prefer it to the SVG.
- **A sentence, not a fifth card** (amended on 2026-11-12, while building part 5; the approved text
  gave all six pages a card). Five cards wrap as four and one on a desktop. The pages that already
  had four link to the viewer from a sentence where the question comes up — is this file HDR, is it
  animated, can I just look at it — and only the home page, which had two cards, gets a third.
- **Found, not fixed: PNG files from WebKit are larger.** Same pixels, 5% (`transparent.avif`) to 13%
  (`photo.avif`) more bytes than from Chromium, because the browser's own deflate is used. Bundling
  one would make the output the same everywhere; it costs script weight and is not measured yet.

## Approval

TOUCHPOINT 1 — approved by the owner on 2026-11-12, all five parts. Each part is committed to `main`
once its tests are green; nothing is deployed without a separate go. The owner installed the two
system packages the same day. No git remote for now, by the owner's choice.

## Observed

- 2026-11-12, AC-43, AC-42: `wrangler dev` — the host's runtime, run locally — serving `dist/`. `/`
  answers with `Strict-Transport-Security: max-age=31536000` next to the headers it had;
  `/favicon.ico` is `image/vnd.microsoft.icon` and `/apple-touch-icon.png` is `image/png`. The check on
  `https://avifbox.com/` waits for the deploy.
- 2026-11-13, AC-43, AC-42, AC-44: deployed from commit `e85a3d9` as Cloudflare version
  `b2b293c7-2c91-41d4-8ead-fe1b3f698f84`, then read back with curl and a browser User-Agent.
  `https://avifbox.com/` answers with `Strict-Transport-Security: max-age=31536000`, once; so do
  `/favicon.ico` and the worker script under `/_astro/`, which keeps its own Content-Security-Policy.
  `http://avifbox.com/` still answers 301 to HTTPS. `/favicon.ico` (`image/vnd.microsoft.icon`) and
  `/apple-touch-icon.png` (`image/png`) are the files of the build, byte for byte. So are all 14
  pages, the 404 page among them: the edge adds nothing to them.
