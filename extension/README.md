# AVIFBox browser extension

Right-click an image on any page and save it as PNG or JPG. The image is fetched and converted on the
device with the engine of [avifbox.com](https://avifbox.com) (`../src/engine/`), then handed to the
browser's download manager under its own name with the new extension. Chrome 116 and later, Manifest V3.

Specification, acceptance criteria and the record of decisions:
[`docs/specs/2026-11-21-extension-save-image-as.md`](../docs/specs/2026-11-21-extension-save-image-as.md).
How the parts work together: [`DESIGN.md`](DESIGN.md).

## Usage

```sh
pnpm build:extension                   # writes ../dist-extension/
pnpm test                              # the logic of both sides (Vitest), with the site's unit tests
pnpm test:e2e --project=extension      # the built extension in Chromium (Playwright)
```

To try it by hand: open `chrome://extensions`, switch on "Developer mode", choose "Load unpacked" and
pick `dist-extension/`. Then right-click an image → "Save image as PNG or JPG" → "PNG" or "JPG".

It is not published in any store yet.

## What it asks the browser for

| In the manifest                | Why                                                                             |
| ------------------------------ | ------------------------------------------------------------------------------- |
| `contextMenus`                 | the menu item on images                                                         |
| `downloads`                    | handing the converted file to the download manager, under a name                |
| `offscreen`                    | a hidden document: a service worker has no `Worker` and no `ImageDecoder`       |
| `host_permissions: <all_urls>` | an image is usually on another origin than its page, and has to be read from it |
| `'wasm-unsafe-eval'` (CSP)     | the WebAssembly AVIF decoder, used for HDR images                               |
| `incognito: not_allowed`       | one copy would serve both kinds of window, with the ordinary cookies            |

It has no content script, no page can message it, and it sends nothing anywhere: the only request it
makes is the one for the image that was clicked.

## Layout

```
background.ts    service worker: hands Chrome to menus.ts
menus.ts         the menu, a click as a job, a result as a download or the failure window
offscreen.html   hidden document
offscreen.ts     hands fetch, the engine's pool and the document's functions to save.ts
save.ts          fetch → convert → result; the file's name; the document's lifetime
notice.html      the failure window (notice.ts, notice.css)
protocol.ts      the two messages: Job and Result
api.ts           the part of Chrome's extension API that is called, as an interface
public/          manifest.json and the icons, copied into the build as they are
vite.config.ts   the build
```

The icons are rendered from `../public/favicon.svg` by `node scripts/make-og.mjs`.
