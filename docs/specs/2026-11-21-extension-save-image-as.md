# AVIFBox — a browser extension: right-click an image, save it as PNG or JPG

Date: 2026-11-21 · Source: the owner's question whether the tool can be a Chrome / Firefox extension,
and the choice of form B ("right-click an image, save as PNG / JPG") over form A (the site's converter
opened from the toolbar). Builds on the seven earlier specs; AC numbers continue from them (AC-01…56
are unchanged).

## Change

A Chrome extension (Manifest V3, Chrome 116 and later; other Chromium browsers are expected to run
the same package) in the same repository, built from the site's engine without changing it.

1. **The menu** (AC-58). On an image, the page's context menu gains "Save image as PNG or JPG" with
   two items under it: "PNG" and "JPG".
2. **A click saves one file** (AC-60…AC-68). The extension fetches the image from its address, converts
   it on the device with the site's engine and the site's default settings, and hands the result to the
   browser's download manager under the image's own name with the new extension.
3. **A failure is said, never silent** (AC-67…AC-72). When the image cannot be fetched, is too large or
   cannot be converted, a small window says why and points to the browser's own "Save image as…" and
   the site.

What is where, all under `extension/`:

| Part                    | Runs as                                               | Does                                                                 |
| ----------------------- | ----------------------------------------------------- | -------------------------------------------------------------------- |
| `background.ts`         | service worker                                        | adds the menu; click → job; result → download, or the failure window |
| `offscreen.ts`          | hidden ("offscreen") document, with the engine's pool | fetch → convert → result; closes itself a minute after its last job  |
| `notice.html`           | small window                                          | shows one failure                                                    |
| `save.ts`, `menus.ts`   | — (Chrome, `fetch` and the pool are handed in)        | the logic of the two sides, unit-tested                              |
| `protocol.ts`, `api.ts` | — (types)                                             | the messages between the two sides; the part of Chrome's API in use  |

`pnpm build:extension` (Vite, the version Astro already brings) writes `dist-extension/`, which
Chrome loads unpacked. `README.md` and `CLAUDE.md` say how to build, load and test it.

Out of scope: Firefox (see "Decisions"); publishing (store accounts and listings, screenshots, the
package to upload, a section on the site's `/privacy`, Edge's store); localisation; settings (quality,
PNG mode, background colour, HDR mode, Display P3); an animated PNG from an animated image; private
windows; images a page made itself (`blob:` addresses); images in local files (`file:` addresses work
only where the user has allowed the extension to read files, and are not tested); pictures that are
not image elements (CSS backgrounds, canvases, video posters); several images at once; the site's
converter inside the extension (form A); a request that never ends (the browser's own time limit
ends it); telling the user about a download the browser stopped after it had accepted it.

## Existing behaviour changed

- No behaviour of the site changes.
- `defaultOptions` moves from `src/ui/store.ts` to the engine (`src/engine/options.ts`); the store
  exports it as before. The bundler splits the site's scripts differently for it, so three script
  files get new names and the ten pages that load them name those. The next deploy of the site uploads
  them and tells IndexNow of those pages, though no visitor sees a difference.
- `package.json` gains the script `build:extension` and the development dependency `vite` (a direct
  dependency now; the same version Astro uses). `tsconfig.json` includes `extension/`, so
  `pnpm check` covers it. `.gitignore` and `.prettierignore` gain `dist-extension`.
- `scripts/make-og.mjs` also renders the mark into `extension/public/icons/`. `scripts/make-fixtures.mjs`
  writes one more fixture, `anim-webp-first.png` (the first frame of `anim.webp`), and needs
  ImageMagick for it: ffmpeg does not read an animated WebP.
- `tests/e2e/helpers.ts` gains the reading of the HDR fixture's layout, moved out of AC-06's test so
  that AC-63 shares it. AC-06 checks what it checked.
- `pnpm test:e2e` also builds the extension, and Playwright has a fourth project, `extension`
  (Chromium only), whose tests are in `tests/extension/`. The three existing projects keep
  `tests/e2e/` and do not run them. `pnpm run deploy` runs `pnpm test:e2e`, so a failing extension
  test now stops a deploy of the site. The chain AC-47 reads is unchanged.

## Acceptance criteria

`U` = Vitest, `X` = Playwright with the built extension loaded in Chromium. Every X test has a browser
profile, a home folder and a download folder of its own, and starts the image host it needs: a small
HTTP server on another origin than any page, which sends no CORS header.

### The package

- **AC-57** (U) `extension/public/manifest.json` is Manifest V3 and: `permissions` are exactly
  `contextMenus`, `downloads` and `offscreen`; `host_permissions` is exactly `<all_urls>`; it declares
  no optional permission, no content script, no web-accessible resource and no
  `externally_connectable`; `content_security_policy.extension_pages` is exactly
  `script-src 'self' 'wasm-unsafe-eval'; object-src 'self';`; `incognito` is `not_allowed`;
  `minimum_chrome_version` is `116`; the background is the module service worker `background.js`; icons
  of 16, 32, 48 and 128 pixels are named, and each named file is a PNG of that size.
- **AC-58** (U, X) On install, and on every update, the extension removes the menu items it had and,
  when they are gone, creates three, shown on images only: `save` "Save image as PNG or JPG", and under it `png` "PNG" and
  `jpg` "JPG" (U). All three exist in the loaded extension (X).
- **AC-59** (X) `dist-extension/` holds the manifest, every file the manifest names, and the pages
  `offscreen.html` and `notice.html`; neither page has an inline script; and the X criteria below pass
  against it as built, under the manifest's own policy.

### Saving

- **AC-60** (X) "PNG" on `still.avif` puts `still.png` in the download folder: 64×48, pixels equal to
  `tests/fixtures/still.png`. "PNG" on `lossless.webp` puts `lossless.png` there with the same pixels.
  "PNG" on `still.png`, served under the name `card.png`, puts `card.png` there with the same pixels.
- **AC-61** (X) "JPG" on `alpha.avif` puts `alpha.jpg` there: a JPEG whose fully transparent area is
  white. "JPG" on `photo.jfif` puts `photo.jpg` there with bytes identical to the file that was served.
- **AC-62** (X) "PNG" on an animated image (`anim.webp`) puts exactly one file there, `anim.png`: a
  still PNG (no `acTL` chunk), 64×48, equal to the animation's first frame as libwebp decodes it
  (`tests/fixtures/anim-webp-first.png`).
- **AC-63** (X) "PNG" on `hdr-pq.avif` puts `hdr-pq.png` there, tone-mapped as the site does by
  default: black stays black, the 1000-nit patch is white, and the neutral patches are within ±2
  levels of the engine's _Keep brightness_ curve. (This is the WebAssembly decoder running inside the
  extension.)
- **AC-64** (U) The name the browser is asked to save under is the last segment of the path of the
  image's address, percent-decoded, without its last extension, with `.png` or `.jpg` instead. The
  characters `\ / : * ? " < > | %` and control characters become `_`. Before the extension a name is
  cut to 120 bytes of UTF-8, never inside a character. The query and the fragment are not part of it.
  The name is `image` when the address has no path segment to take it from, when the segment is not
  valid percent-encoding, and for an address that is not `http:`, `https:` or `file:`. Examples:
  `https://cdn.example/a/photo.avif?w=800#x` → `photo.png`; `…/My%20photo.final.webp` →
  `My photo.final.jpg`; `…/photo:large` → `photo_large.png`; `…/a%2Fb.avif` → `a_b.png`;
  `…/100%25.avif` → `100_.png`; `https://cdn.example/` → `image.png`; `…/%E0%A4%A.avif` →
  `image.png`; `data:image/avif;base64,AAAA` → `image.png`; a segment of 100 Chinese characters (300
  bytes) → its first 40 characters and `.png`.
- **AC-65** (U, X) When the browser refuses the name (it does for a leading dot, `~` or space, for
  names Windows reserves, and for some characters this list does not know), the file is saved as
  `image.png` or `image.jpg` (U: the download is asked for again under that name, once). "PNG" on an
  image whose address ends in `/.hidden.avif` puts `image.png` in the download folder (X).
- **AC-66** (X) The name comes from the address that was clicked, wherever it leads: "PNG" on
  `/moved.avif`, which the host redirects to `/still.avif`, puts `moved.png` in the download folder.
  "PNG" on a `data:` address holding `still.avif` puts `image.png` there. Both have the pixels of
  `still.png`.

### Fetching and converting

- **AC-67** (U) Fetching the image is one call of `fetch` for its address, with
  `credentials: 'include'` and nothing else: no header is added, nothing is retried, and redirects are
  the browser's to follow. The answer that counts is the last one. A status that is not 2xx is the
  failure "Could not fetch this image: the site answered 404." (with the status it gave). A fetch that
  fails, or a body whose reading fails, is the failure "Could not fetch this image. The site may have
  refused the request, the image may exist only inside the page, or AVIFBox may not be allowed to read
  it (see the extension’s site access in the browser’s settings)." A body of more than 50 MB is the
  failure "This image is larger than 50 MB, the most AVIFBox converts.", and reading stops when the
  limit is passed, whatever length the site announced.
- **AC-68** (U) Converting uses the settings a page of the site starts with for that target
  (`defaultOptions`). The result is the first file the engine puts out. The job is cancelled as soon
  as that file is there and counts as ended then: nothing the engine sends afterwards is used, and no
  end of the job is waited for. An error of the engine is the failure, in the engine's words (an empty
  body is its "Not a supported image…"). A job that ends without a file is the failure "Something went
  wrong while saving this image. Please try again."
- **AC-69** (X) In the loaded extension nothing is saved and the failure window opens with: "Could not
  fetch this image: the site answered 404." for an address the host answers with 404; the engine's
  "Not a supported image. AVIFBox reads AVIF, WebP, JPG/JFIF and PNG." for `hdr-pq.json` (not an
  image); the engine's "Could not decode this file. It may be damaged, or use a feature this browser
  does not support." for `corrupt.avif`; the "Could not fetch this image. The site may have refused…"
  failure for a `blob:` address.

### The two sides

- **AC-70** (X) The failure window is a page of the extension, in English (`lang="en"`), with the
  title "This image was not saved – AVIFBox". It shows the heading (`h1`) "This image was not saved",
  the failure as text (markup in it is shown, not interpreted), the sentences "You can still save it
  with the browser’s own “Save image as…”. AVIF, WebP, JPG and PNG files can be converted at
  avifbox.com.", where "avifbox.com" links to `https://avifbox.com/` and opens in a new tab
  (`target="_blank"`, `rel="noopener"`), and a "Close" button. The button has the focus when the
  window opens, and is described by the failure, so that a screen reader that starts at the focus
  reads it; the button and the Escape key close the window, also when it was opened with a
  fragment that cannot be decoded (it then shows no failure). axe finds no violation in it. With
  the longest failure (the "Could not fetch this image. The site may have refused…" one) the page
  needs no scrolling in 460 × 320 pixels.
- **AC-71** (U) Background. The listeners for the click and for the result are registered when the
  service worker's script runs, not later. A click on `png` or `jpg` opens the hidden document when
  none is open (reasons `WORKERS` and `BLOBS`), opens no second one when one is, and sends it
  `{ srcUrl, target }`, which the document answers with `true` when it takes the job. Clicks that come
  while the document is still opening wait for that opening: one document, every job delivered. An
  opening that failed is not remembered: the next click tries again. A click on anything else does
  nothing. A click that could not be delivered, or that got any other answer than `true`, opens the
  failure window with "Something went wrong while saving this image. Please try again." A result
  that carries an address is downloaded under the first of its names the browser accepts; when it
  accepts none, the failure window opens with "The browser refused to save this image." A result that
  carries a failure opens the failure window with that failure. A message that is no result is left
  alone. The failure window is a popup window of 460 × 360 on the extension's `notice.html`, the
  message in the fragment of its address. The result handler needs nothing a click stored: it is tried
  with no click before it.
- **AC-72** (X) The service worker may stop between the click and the result. With the image host
  holding its answer back, "PNG" is clicked, the service worker is stopped, and the host then answers:
  `still.png` is in the download folder, once.
- **AC-73** (U) The hidden document closes itself 60 seconds after its last job ended. It does not
  close while a job runs, however long, and a job that arrives restarts the count. The address of each
  result is released 60 seconds after the result was handed over, whether or not other jobs keep the
  document open. The document says whether it took a job (`true`), and takes none once it has asked to
  be closed (`false`, and nothing is fetched).

## Decisions worth recording

Platform facts are from Chrome's documentation and the specifications unless marked **tried**: those
were measured on 2026-11-21 with a throwaway extension in Playwright's Chromium 153, headless.

- **Why a hidden document.** A service worker has no `Worker`, no `ImageDecoder` and no
  `URL.createObjectURL`. The engine needs the first two and a download of a blob needs the third.
  `chrome.offscreen` gives a document that has all three (**tried**: `ImageDecoder`, `OffscreenCanvas`
  and WebAssembly work in a worker of it under the manifest's policy). Only `chrome.runtime` exists
  there, so the menu, the download and the failure window are the service worker's.
- **The engine is used as it is**: its `Pool`, its worker, its messages. The Viewer already takes one
  output and cancels the job (`saveJpg`); the extension does the same. Cancelling stops the worker, but
  a frame it had begun may have been decoded for nothing, and the pool calls no handler afterwards:
  the first file is the end of the job.
- **Access to every site, asked for at install** (`host_permissions: <all_urls>`). An image is usually
  on another origin than its page, and reading it from an extension needs host permission for that
  origin; `activeTab` covers the page's origin only. (**Tried**: with the permission, a cross-origin
  image without CORS headers is read whole.) Asking at first use instead
  (`optional_host_permissions`) would move the same sentence — "Read and change all your data on all
  websites" — from the install dialog to a prompt, at this price: `permissions.request` has to be the
  first, synchronous call of the click handler; neither Playwright nor any switch can answer the
  prompt, so the tests would need a second manifest and the real one would only ever be tried by hand;
  and there is a "denied" state to carry. The owner chose the install dialog.
- **The request carries the site's cookies**, because some images are only there for a signed-in
  visitor. That is more than the page's own request for the image may have carried: for an extension
  with host permission the browser also sends cookies marked `SameSite`. A page can therefore point the
  user's click at an address of its choosing on a site where the user is signed in. What it gets for
  it is one `GET`, which the user made with three deliberate clicks and whose answer the page never
  sees. `credentials: 'omit'` is the alternative, and signed-in images would then fail. The owner
  chose to send the cookies.
- **No header is added to the request.** With `Accept: */*`, a site that negotiates the format often
  answers with the JPEG or PNG it holds rather than the AVIF it made for the browser. That is the
  better source, and "JPG" then saves it untouched. No `Referer` is sent (**tried**), so a site that
  checks it refuses; that is the "may have refused" failure.
- **`chrome.downloads`, not a hidden link.** A link with `download` clicked in the hidden document
  worked six times in a row (**tried**) and would spare the install warning "Manage your downloads".
  But Playwright replaces the browser's download handling, which is where Chrome limits downloads
  nobody clicked for and where "Ask where to save each file" is honoured, so what a real browser does
  with a link in a document without a window could not be seen. The API is the documented way and
  follows the user's setting.
- **The name is the browser's to refuse.** Chrome rejects more names than a list here could keep up
  with (**tried**: leading `.`, `~` and space, `CON`, `nul`, U+202E, `desktop.ini`…). So the result
  carries its names in order of preference, `[name, image.ext]`, and the background takes the first the
  browser accepts. It changes `%` to `_` without a word (**tried**), so the name asks for that itself.
  A name of 304 characters is accepted and then the download is cancelled without a word (**tried**),
  hence the cut: file systems count 255 bytes or 255 characters, the browser adds a suffix while it
  writes, and Windows counts the folder too. Chrome changes the extension to fit the content type
  (**tried**: `a.png.exe` with AVIF content became `a.png.avif`), so a name cannot disguise a file.
  Two files of one name are the browser's business: it writes `still (1).png` (**tried**).
- **One click, one file, the first frame.** A frame per file is what the site does with an animation,
  and it has a picker for it. A menu item cannot ask.
- **A window for a failure**, not a notification: a notification needs a permission with its own
  install warning, and an operating system that silences Chrome's notifications (common on macOS) would
  make a failure silent again. `chrome.windows.create` needs no permission, and Playwright can read
  the window. The message travels in the address's fragment and is written as text. The window is
  460 × 360: its longest text needs 275 pixels at that width (**tried**), and the height an extension
  asks for includes the title bar.
- **Nothing is trusted that a page controls.** The image's address and bytes are the page's. The
  address is only ever fetched (see the cookies above for what that gives a page). The bytes only go
  to the decoders, in a worker. The name is cleaned and its extension is ours. The failure text is the
  engine's or one of the sentences above. No page can message the extension: it has no content script,
  no web-accessible resource and no `externally_connectable`.
- **The click handler does not wait for the result.** A stopped service worker loses what it was
  waiting for, and Chrome stops one after 30 idle seconds. So the hidden document reports with a
  message of its own, which wakes the service worker, and the result handler works from that message
  alone. The one thing the background keeps is the opening of the document while it lasts, so that two
  quick clicks do not both try to open it: Chrome allows one.
- **A job is sent as soon as the document is open.** `offscreen.createDocument` resolves "when the
  offscreen document is created and has completed its initial page load" (Chrome's reference), and a
  module script has run by then: its listener is there. The document answers a job at once with
  whether it took it, so the sending ends then, and "delivered" does not hang on what Chrome does with
  a message nobody answers.
- **The hidden document owns its lifetime.** Chrome does not close one, and one that stays keeps the
  engine's memory for the session. It knows when it is idle. Each result's address is released a
  minute after it was handed over, as the site's own `saveAs` does: the download has long begun by
  then, and one that has begun keeps its blob. A click in the instant the document closes fails with
  "Please try again": rare, and said. For that, a document that has asked to be closed takes no job
  (it is there for a moment more, and a job it took then would vanish with it without a word), and a
  job nobody took counts as one that was not delivered.
- **Not in private windows** (`incognito: not_allowed`). Chrome would run one copy for both kinds of
  window, so an image from a private window would be fetched with the ordinary cookies and its
  download listed in the ordinary history.
- **The extension describes the browser's API itself** (`api.ts`): an interface with the ten-odd
  functions it calls, and the two scripts that call Chrome declare `chrome` as it. `@types/chrome`
  would make `chrome` a global of the whole project, the engine included, where it must not be used.
- **Build.** Vite's module-preload polyfill is switched off (Chrome 116 needs none) and the base is
  relative. The pages name their scripts with `src`; AC-59 holds the build to that.
- **Tests.** Playwright cannot click a native menu, so a test fires `contextMenus.onClicked` in the
  service worker (**tried**). Under Playwright's download handling the name an extension asks for is
  ignored and files get random names (**tried**), so the tests give the browser a home folder and a
  download folder of their own and switch it back to its own handling (`Browser.setDownloadBehavior`
  `default`): files then land under their real names (**tried**; the real download folder was not
  touched). Playwright does not notice a service worker that stops or starts again (**tried**: its
  handle stays, and no new one is announced), so AC-72 stops it through the browser's debugging
  protocol (`Target.closeTarget`) and asks the same protocol whether one runs. Every window gets
  Playwright's own viewport, whatever size it was opened with, so the size of the failure window is
  checked by giving it that size. What stays untested by machine: the native menu's look, and Chrome
  outside Playwright — "Observed" records a run by hand before anything is published.
- **Firefox later, not never.** It has no `chrome.offscreen`, but its background page is a document:
  `save.ts` runs there unchanged, and a manifest may name both `background.scripts` and
  `background.service_worker` (Chrome 121, Firefox 121). Playwright cannot load an extension into
  Firefox, so that port is tested by hand or with other tools: a spec of its own.

## Approval

Form B was chosen by the owner on 2026-11-21 ("做 B"). Reviewed the same day by two other models
(Codex and Antigravity); what they found is worked in above. The owner then decided the two questions
left open, both as written here: host permission is asked for at install, not at first use, and the
request for the image carries the site's cookies.

## Observed

- 2026-11-21, the tree this spec was committed with: `pnpm check` 0 errors in 102 files; `pnpm test`
  204 tests; `CI=1 pnpm test:e2e` 190 passed and 11 skipped, of which the extension's 18 (the site's
  172 and its 11 skips are what they were), in Playwright 1.63.0's Chromium 153, headless. `pnpm build:extension` writes 15 files, 1.2 MB, of which
  the WebAssembly decoder is 1.17 MB.
- 2026-11-21, how far the tests reach: each of 23 small breakages of `save.ts` and `menus.ts` made
  `pnpm test` fail. A result handler made to need what the click left in memory failed AC-72 and nothing
  else. Listeners registered one turn late (`setTimeout(…, 0)` around the start) passed every X test:
  the browser forgives that much, so it is the unit test of `start` and the three lines of
  `background.ts` that hold AC-71's first sentence.
- 2026-11-21, the implementation was reviewed by Codex and Antigravity. Taken from them: AC-58's test
  now holds the creating back until the removing is done; the failure window attaches what closes it
  before it reads its address. Found in the author's own review: a document that had asked to be
  closed still took jobs (now AC-73's last sentence). Not taken: making `background.js` one file
  without the 183-byte chunk it shares with the hidden document; a module service worker may import
  one, and AC-72 restarts it on this build.
- 2026-11-21, `pnpm verify:live` on the site built from this tree: ten pages and three script files
  are not what the live site serves, by the names of those files alone (each page has the length it
  had). Nothing was deployed.
- Not observed yet: the extension in a Chrome with a window, by hand — the native menu, the install
  warning, a download with "Ask where to save each file" switched on, a signed-in image. To be
  recorded here before anything is published.
