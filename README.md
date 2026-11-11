# AVIFBox

Image converters that run entirely in the browser: AVIF, JFIF and WebP to PNG or JPG.
Nothing is uploaded — decoding and encoding happen on the visitor's device, so the site is a
plain static bundle with no backend.

## What it does

| Route                                     |                                             |
| ----------------------------------------- | ------------------------------------------- |
| `/`                                       | Hub: any supported image to PNG or JPG      |
| `/avif-to-png`, `/avif-to-jpg`            | AVIF, including animated, 10/12-bit and HDR |
| `/jfif-to-jpg`, `/jfif-to-png`            | JFIF to JPG is a lossless rename by default |
| `/webp-to-png`                            | WebP, including animated                    |
| `/what-is-avif`, `/how-to-open-avif-file` | Guides; the second embeds a viewer          |
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
pnpm test:e2e     # builds, then runs Playwright in Chromium and Firefox
pnpm check        # type check
pnpm build        # static site in dist/
```

## Layout

```
src/engine/    conversion engine, framework-free: probe → decode → encode
src/ui/        Preact converter and viewer, plus the state store
src/content/   page copy and site constants
src/pages/     Astro routes
tests/unit/    engine and store tests (Node)
tests/e2e/     conversion, site structure and accessibility tests (real browsers)
scripts/       fixture, sample, share-image and logo generators
docs/specs/    the specification the tests are written against
```

The engine decodes with the browser where it can and falls back to a WASM build of libavif
(`@jsquash/avif`, loaded on demand) for HDR sources and for browsers without AVIF support. PNG and
APNG are written by `src/engine/png.ts`; JPG comes from the browser's own encoder.

## Credits

- Sample photo: “Earthrise”, NASA / Bill Anders, 1968 — public domain
- Display P3 ICC profile: [Compact-ICC-Profiles](https://github.com/saucecontrol/Compact-ICC-Profiles), CC0
- AVIF decoding for HDR: libavif via [jSquash](https://github.com/jamsinclair/jSquash), Apache-2.0
