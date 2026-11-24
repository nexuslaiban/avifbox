# AVIFBox

Image converters that run entirely in the browser: AVIF, JFIF and WebP to PNG or JPG.
Nothing is uploaded — decoding and encoding happen on the visitor's device, so the site is a
plain static bundle with no backend.

Live at **[avifbox.com](https://avifbox.com)**.

The same engine is also a browser extension: right-click an image on any page and save it as PNG or
JPG. It lives in [`extension/`](extension/README.md) and is not in any store yet.

## What it does

| Route                                     |                                             |
| ----------------------------------------- | ------------------------------------------- |
| `/`                                       | Hub: any supported image to PNG or JPG      |
| `/avif-to-png`, `/avif-to-jpg`            | AVIF, including animated, 10/12-bit and HDR |
| `/avif-to-apng`                           | Animated AVIF to one animated PNG           |
| `/jfif-to-jpg`, `/jfif-to-png`            | JFIF to JPG is a lossless rename by default |
| `/webp-to-png`, `/webp-to-jpg`            | WebP, including animated                    |
| `/avif-viewer`                            | The picture, its facts, its frames; save it |
| `/what-is-avif`, `/how-to-open-avif-file` | Guides; the second embeds the viewer        |
| `/about`, `/privacy`                      | What the site is, and what it can see       |

- Batches of 50 files, 50 MB each, downloadable as one ZIP
- Animated input: one file per frame with a frame picker, or a single animated PNG
- HDR (PQ / HLG): tone-mapped to SDR by the engine, _Keep brightness_ or _Keep colour_
- Optional Display P3 output with an embedded ICC profile
- PNG presets: lossless Truecolor, or a 256-colour Optimized palette

## Develop

```sh
pnpm install
pnpm dev          # local dev server
pnpm test         # unit tests (Vitest)
pnpm test:e2e     # builds, then runs Playwright: the site in Chromium, Firefox and WebKit, the extension in Chromium
pnpm check        # type check
pnpm build        # static site in dist/
pnpm build:extension  # the browser extension in dist-extension/, to load unpacked in Chrome
pnpm run deploy   # all of the tests, upload, verify:live, then tell IndexNow what changed
pnpm verify:live  # compares the live site with dist/, file by file and header by header
```

A push to `main` deploys: GitHub Actions runs `pnpm run deploy` (`.github/workflows/deploy.yml`). A
tag `extension-v<version>`, the version of `extension/public/manifest.json`, attaches the built
extension as a zip to a GitHub Release (`.github/workflows/extension.yml`).

## Layout

```
src/engine/    conversion engine, framework-free: probe → decode → encode
src/ui/        Preact converter and viewer, plus the state store
src/content/   page copy and site constants
src/pages/     Astro routes
extension/     browser extension (Chrome, Manifest V3) built on the engine: right-click an image, save as PNG or JPG
tests/unit/    engine, store, extension logic and live-check tests (Node)
tests/e2e/     conversion, viewer, failure report, site structure and accessibility tests (real browsers)
tests/extension/  the built extension loaded into Chromium
scripts/       fixture, sample, share-image, logo and icon generators, the live check, the IndexNow notice
docs/specs/    the specification the tests are written against
```

The engine decodes with the browser where it can and falls back to a WASM build of libavif
(`@jsquash/avif`, loaded on demand) for HDR sources and for browsers without AVIF support. PNG and
APNG are written by `src/engine/png.ts`; JPG comes from the browser's own encoder.

## Credits

- Sample photo: “Earthrise”, NASA / Bill Anders, 1968 — public domain
- Display P3 ICC profile: [Compact-ICC-Profiles](https://github.com/saucecontrol/Compact-ICC-Profiles), CC0
- AVIF decoding for HDR: libavif via [jSquash](https://github.com/jamsinclair/jSquash), Apache-2.0

## Licence

The code is licensed under the [GNU Affero General Public License v3.0](LICENSE) (AGPL-3.0-only).

The written content of the pages (the copy in `src/content/` and `src/pages/`), the name AVIFBox and
the logo are not covered by that licence: all rights reserved.
