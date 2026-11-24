# avifbox.com

Static, pure-frontend image converter (AVIF / JFIF / WebP → PNG / JPG). Files are converted in the
visitor's browser; there is no backend. Spec: `docs/specs/2026-11-11-avifbox-first-batch.md`.

`extension/` is a Chrome extension (Manifest V3) on the same engine: right-click an image, save it as
PNG or JPG. Spec: `docs/specs/2026-11-21-extension-save-image-as.md`; map: `extension/DESIGN.md`. Not
published in any store.

## Workflow manifest

- Stack: TypeScript / Astro 7 (static output) + Preact island / pnpm 10, Node ≥ 22.23
- Dev: `pnpm dev`
- Test: `pnpm test` (Vitest, unit — single file: `pnpm test tests/unit/png.test.ts`)
  `pnpm test:e2e` (Playwright, builds first — single test: `pnpm test:e2e -g "AC-05"`, one browser: `--project=firefox`,
  the extension alone: `--project=extension`)
- Build: `pnpm build` → `dist/` · `pnpm build:extension` (Vite) → `dist-extension/`, which Chrome loads unpacked
- Lint/Typecheck: `pnpm check` (astro check) · format: `pnpm format` (Prettier)
- Deploy: `pnpm run deploy` → Cloudflare Workers static assets on the custom domain `avifbox.com`
  (`wrangler.jsonc`). It runs `pnpm check`, `pnpm test` and the whole E2E run, uploads `dist/`, runs
  `pnpm verify:live`, then tells IndexNow; a step that fails stops the rest. About three minutes. Needs
  `CLOUDFLARE_API_TOKEN` in `.env` (git-ignored) and port 4322 free. `public/_headers` (cache + worker
  CSP) ships with the assets. Canonical origin is hard-coded as `https://avifbox.com` in
  `astro.config.mjs`, `src/content/site.ts` and `public/robots.txt`.
- CI: a push to `main` deploys — `.github/workflows/deploy.yml` runs `pnpm run deploy` on GitHub, with
  the token as the secret `CLOUDFLARE_API_TOKEN` of the environment `production`; one deploy at a time.
  Work that should not go live yet goes to another branch. A tag `extension-v<version>` (the manifest's
  version) attaches the extension zip to a GitHub Release (`.github/workflows/extension.yml`). Spec:
  `docs/specs/2026-11-24-github-actions.md`. `pnpm run deploy` from a machine still works.
- Live check: `pnpm verify:live` asks the live site for every file of `dist/` and compares the bytes,
  and every header of `_headers` (`scripts/site-check.ts`, run by Node as TypeScript).
- IndexNow: `pnpm indexnow before` (ahead of the upload) notes the pages the live site does not serve
  as built, `pnpm indexnow after` (behind the live check) sends them to `api.indexnow.org`
  (`scripts/indexnow.ts`). Only changed pages are sent: the protocol asks for that. The key is the
  file `public/<key>.txt`, public by design. The note is `.indexnow-owed.json` (git-ignored) and stays
  until IndexNow accepts it: when a deploy stops after the upload the site is already live, and
  `pnpm indexnow after` or the next deploy sends what is owed. Do not delete it. A run on GitHub keeps
  its note in GitHub's Actions cache instead (`indexnow-owed-*`): a machine and GitHub do not see each
  other's note.
- Quirks:
  - `pnpm deploy` is a pnpm built-in, not the script — use `pnpm run deploy`.
  - GitHub refuses a push that changes `.github/workflows/` unless gh's token has the `workflow`
    scope: `env -u GH_TOKEN gh auth refresh -h github.com -s workflow` (opens a browser).
  - Cloudflare injects its Web Analytics beacon into HTML on free zones by default. The CSP blocks it,
    which leaves a console error on every page: keep it disabled in the dashboard (Web Analytics →
    Manage RUM Settings). Local E2E cannot see what the edge injects; `pnpm verify:live` can, and
    every deploy ends with it.
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
  - `pnpm fixtures` needs ffmpeg with libaom-av1 and libwebp, and ImageMagick (`magick`); fixtures are
    committed.
  - Playwright is pinned to 1.63.0 to match the browser builds in `~/.cache/ms-playwright`. Its WebKit
    needs two system packages on Ubuntu 26.04: `sudo apt install libevent-2.1-7t64 libmanette-0.2-0`.
    Nothing else works: WebKit's wrapper resets `LD_LIBRARY_PATH`, and a link in the build's `sys/lib`
    that dangles stops the launch with a bare ENOENT.
  - The `webkit` project is WebKit, not Safari. This build has `ImageDecoder` (Safari had it in
    Technology Preview only on 2026-11-12) and, on Linux, does not convert a wide-gamut image for an
    sRGB canvas. Safari's codecs and colour can only be checked by hand on a real device.
  - Tests that only run axe are skipped in the `webkit` project (`AXE_IN_WEBKIT` in
    `tests/e2e/site.spec.ts`): with several browsers running at once, Playwright's WebKit can hang
    inside axe for good. A new axe test needs the same skip, or the deploy will stop on it by chance.
  - Compare whole files and images with `expectSameBytes` / `expectSamePixels`
    (`tests/e2e/helpers.ts`), never `toEqual`: when large buffers differ it hangs the worker for
    minutes instead of failing.
  - Firefox returns an unusable frame when the same `ImageDecoder` frame index is decoded twice in a
    worker — decode each frame once (`src/engine/decode.ts`).
  - Chrome fires `load`, not `error`, for a truncated AVIF in an `<img>` and draws nothing. Whether a
    file decoded is the engine's call, not the image element's (`src/ui/Viewer.tsx`).
  - `.band` hides horizontal overflow, so `scrollWidth - clientWidth` is 0 even when the tool sticks
    out of a phone screen. Measure bounding boxes (`tests/e2e/viewer.spec.ts`).
  - Extension: its service worker has no `Worker`, no `ImageDecoder` and no `URL.createObjectURL`. The
    engine runs in the hidden (offscreen) document; do not move it.
  - Extension: `chrome` is typed by `extension/api.ts`, not `@types/chrome`, which would make it a
    global of the engine too. A new API call is added to that interface first.
  - Extension tests (`tests/extension/fixture.ts`) run against `dist-extension/`. Playwright only
    builds it when it starts its own server: with a preview server already on port 4322, run
    `pnpm build:extension` first or the tests see the old build.
  - Extension tests cannot click the native menu; they fire `contextMenus.onClicked` in the service
    worker. Playwright's download handling ignores the name an extension asks for, so the fixture
    gives the browser its own home and download folder and switches it back to its own handling.
  - Playwright does not notice an extension's service worker stopping or starting again: its handle
    stays and no new one is announced. Ask the browser (`Target.getTargets`), as AC-72 does.
  - Node gives an address of an extension no origin (`new URL('chrome-extension://…').origin` is
    `"null"`). Build such addresses from the service worker's own address.
