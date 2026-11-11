# avifbox.com

Static, pure-frontend image converter (AVIF / JFIF / WebP → PNG / JPG). Files are converted in the
visitor's browser; there is no backend. Spec: `docs/specs/2026-11-11-avifbox-first-batch.md`.

## Workflow manifest

- Stack: TypeScript / Astro 7 (static output) + Preact island / pnpm 10, Node ≥ 22.23
- Dev: `pnpm dev`
- Test: `pnpm test` (Vitest, unit — single file: `pnpm test tests/unit/png.test.ts`)
  `pnpm test:e2e` (Playwright, builds first — single test: `pnpm test:e2e -g "AC-05"`, one browser: `--project=firefox`)
- Build: `pnpm build` → `dist/`
- Lint/Typecheck: `pnpm check` (astro check) · format: `pnpm format` (Prettier)
- Deploy: `pnpm run deploy` (builds, then `wrangler deploy`) → Cloudflare Workers static assets on the
  custom domain `avifbox.com` (`wrangler.jsonc`). Needs `CLOUDFLARE_API_TOKEN` in `.env` (git-ignored).
  `public/_headers` (cache + worker CSP) ships with the assets. Canonical origin is hard-coded as
  `https://avifbox.com` in `astro.config.mjs` and `src/content/site.ts`.
- Quirks:
  - `pnpm deploy` is a pnpm built-in, not the script — use `pnpm run deploy`.
  - Cloudflare injects its Web Analytics beacon into HTML on free zones by default. The CSP blocks it,
    which leaves a console error on every page: keep it disabled in the dashboard (Web Analytics →
    Manage RUM Settings). Local E2E cannot see what the edge injects — after a deploy, fetch a page
    with a browser User-Agent and compare it with `dist/`.
  - `astro dev` / `astro preview` detach into the background when started by a coding agent. Use
    `--ignore-lock` for a foreground server (the Playwright config does); stop a detached one with
    `pnpm exec astro preview stop`.
  - E2E runs against the production build on port 4322: the CSP `<meta>`, worker chunks and WASM asset
    only exist there.
  - The generated CSP blocks inline `style="…"` attributes. Use classes.
  - `prettier-plugin-astro` drops the space in `{expr} — text`; write a template literal instead.
  - `public/samples/*.png` are produced by the converter itself. After changing the engine run
    `pnpm samples`, or AC-26 fails (it compares bytes).
  - Tool page copy must stay within 900–1,300 words (AC-23 counts it).
  - `pnpm fixtures` needs ffmpeg with libaom-av1 and libwebp; fixtures are committed.
  - Playwright is pinned to 1.63.0 to match the browser builds in `~/.cache/ms-playwright`. Its WebKit
    needs two system packages on Ubuntu 26.04: `sudo apt install libevent-2.1-7t64 libmanette-0.2-0`.
    Nothing else works: WebKit's wrapper resets `LD_LIBRARY_PATH`, and a link in the build's `sys/lib`
    that dangles stops the launch with a bare ENOENT.
  - The `webkit` project is WebKit, not Safari. This build has `ImageDecoder` (Safari had it in
    Technology Preview only on 2026-11-12) and, on Linux, does not convert a wide-gamut image for an
    sRGB canvas. Safari's codecs and colour can only be checked by hand on a real device.
  - Compare whole files and images with `expectSameBytes` / `expectSamePixels`
    (`tests/e2e/helpers.ts`), never `toEqual`: when large buffers differ it hangs the worker for
    minutes instead of failing.
  - Firefox returns an unusable frame when the same `ImageDecoder` frame index is decoded twice in a
    worker — decode each frame once (`src/engine/decode.ts`).
  - Chrome fires `load`, not `error`, for a truncated AVIF in an `<img>` and draws nothing. Whether a
    file decoded is the engine's call, not the image element's (`src/ui/Viewer.tsx`).
  - `.band` hides horizontal overflow, so `scrollWidth - clientWidth` is 0 even when the tool sticks
    out of a phone screen. Measure bounding boxes (`tests/e2e/viewer.spec.ts`).
