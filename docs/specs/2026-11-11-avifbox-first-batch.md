# AVIFBox — first batch (greenfield)

Date: 2026-11-11 · Source: "欧美工具类蓝海 Keywords 调研" round 3 (final sitemap + `/avif-to-png` landing spec).
Approval: owner delegated the whole pipeline up front ("过程你全权负责"), so TOUCHPOINT 1 is pre-approved.

## Change

Build avifbox.com from an empty repo: a static, pure-frontend image converter. Files never leave the
browser; hosting is a static CDN.

**Pages (8 + 404)**

| Route | Role |
|---|---|
| `/` | Hub. Generic converter (any supported input → PNG or JPG); absorbs "avif converter" intent |
| `/avif-to-png` | Flagship tool page, site hub for AVIF pages |
| `/avif-to-jpg`, `/jfif-to-png`, `/jfif-to-jpg`, `/webp-to-png` | First-batch tool pages, same engine |
| `/what-is-avif`, `/how-to-open-avif-file` | Measured support pages; link targets of the first batch. The latter embeds an AVIF viewer |

**Engine** (Web Worker pool, no server): probe → decode → encode.

- Decode: browser-native (`createImageBitmap` / `ImageDecoder`) read back in strips; WASM libavif
  (`@jsquash/avif`, lazy) for HDR sources and as fallback when the browser cannot decode AVIF.
- Encode: own PNG/APNG writer (truecolor lossless, or ≤256-colour palette "Optimized"), canvas JPEG.
- Animated sources (AVIF sequence, animated WebP): every frame as its own PNG/JPG with a per-frame
  picker, or one animated PNG (APNG).
- HDR (PQ/HLG `nclx`): own tone mapping to 8-bit SDR, two modes — *Keep brightness*, *Keep colour*.
- Optional Display P3 output (ICC profile embedded) instead of sRGB.
- Limits: 50 files per batch, 50 MB per file. No pixel cap for PNG output.

**Out of scope** (deliberately, per the research doc): second-batch `→ AVIF` pages (need a WASM
encoder), FR/ES/DE localisation, `/avif-vs-*` and `/how-to-convert-*` pages (unmeasured), GIF export,
ads, analytics, blog, domain registration and deployment.

Existing behaviour changed: none (empty repo).

## Acceptance criteria

Each criterion maps 1:1 to a test. `E` = Playwright against the built site, `U` = Vitest unit,
`B` = assertions on the build output.

### Conversion

- **AC-01** (E) Given the lossless fixture `still.avif` dropped on `/avif-to-png`, when conversion
  finishes, then the download is `still.png` and its pixels equal the reference exactly.
- **AC-02** (E) Given `alpha.avif`, then the PNG keeps alpha (0 in the transparent area, 255 in the
  opaque area). When a background colour is chosen, then every output pixel is opaque.
- **AC-03** (E) Given `alpha.avif` on `/avif-to-jpg`, then the output is a JPEG whose transparent area
  is the matte colour (white by default), and quality 50 yields a smaller file than quality 95.
- **AC-04** (E) Given `photo.avif` (>256 colours), when *Optimized* is selected, then the PNG is
  palette-based (colour type 3) and smaller than the *Truecolor* output of the same file.
- **AC-05** (E) Given `anim.avif` (5 frames, 200 ms each), then five outputs `anim-001.png … anim-005.png`
  appear; unticking one frame removes it from the ZIP; choosing *Animated PNG* yields one APNG with
  `acTL.num_frames = 5` and 200 ms frame delays.
- **AC-06** (E) Given `hdr-pq.avif` (10-bit, BT.2020 PQ), then the row is flagged HDR, the neutral
  patches match the documented tone curve within ±2 levels, and *Keep brightness* and *Keep colour*
  give different pixels on the saturated highlight patch.
- **AC-07** (E) Given *Display P3* output, then the PNG carries an `iCCP` chunk; with sRGB it carries none.
- **AC-08** (E) Given `photo.jfif` on `/jfif-to-jpg`, then the output is `photo.jpg` with bytes identical
  to the input (lossless rename). When *Re-encode* is chosen, then the bytes differ and it is a valid JPEG.
- **AC-09** (E) Given `photo.jfif` on `/jfif-to-png` and `lossless.webp` on `/webp-to-png`, then PNGs are
  produced with the source dimensions; the WebP result equals the reference exactly.
- **AC-10** (E) Given three files, two of them with the same name, when *Download all* is clicked, then
  a ZIP with three uniquely named entries is downloaded.
- **AC-11** (E) Given 51 files, then 50 are queued and a notice reports 1 skipped. (U) A file over
  50 MB is rejected with a reason.
- **AC-12** (E) Given an image pasted with Ctrl+V, then it is queued and converted.
- **AC-13** (E) Given a full conversion run, then the page makes no network request other than
  same-origin GETs, and the document CSP restricts `connect-src` to `'self'`.
- **AC-14** (E) Given a corrupt file next to a valid one, then the corrupt row shows an error and the
  valid one still converts.

### Engine units

- **AC-15** (U) `probe` reads format, dimensions, bit depth, alpha, animation, CICP and HDR from real
  fixtures (AVIF, WebP, JPEG/JFIF, PNG) and rejects non-images.
- **AC-16** (U) PNG writer: output round-trips through a reference decoder for RGBA, RGB and palette
  images; opaque input is written without an alpha channel; ≤256 unique colours are written as an
  exact palette; APNG carries `acTL`/`fcTL`/`fdAT` with correct sequence numbers; ICC is embedded on request.
- **AC-17** (U) Quantizer: ≤256 colours out, fully transparent pixels stay fully transparent, a smooth
  gradient keeps PSNR ≥ 35 dB.
- **AC-18** (U) HDR math: PQ and HLG EOTF hit their reference points (PQ 0.5081 → 100 nits, 0.7518 →
  1000 nits; HLG 0.75 → 203 nits at a 1000-nit peak); the tone curve is the identity below its knee,
  monotonic, and maps the source peak to SDR white; *Keep colour* preserves channel ratios; *Keep
  brightness* preserves luminance.
- **AC-19** (U) Decoder routing: HDR → WASM tone-mapped path; AVIF that the browser fails to decode →
  WASM 8-bit path; a non-AVIF failure is reported as an error.
- **AC-20** (U) Output naming: extension swap, de-duplication, frame numbering, ZIP folder per
  animated input.

### Site

- **AC-21** (B) The build emits the 8 routes plus `404.html`; `sitemap` lists exactly the 8 canonical
  URLs; `robots.txt` points at the sitemap.
- **AC-22** (B) Every page has a unique `<title>`, a meta description of 70–160 characters, a
  canonical URL on `https://avifbox.com`, and exactly one `<h1>`.
- **AC-23** (B) Every tool page has parseable `SoftwareApplication` and `FAQPage` JSON-LD, ≥7 FAQ
  entries identical to the visible FAQ, and 900–1,300 words of body copy (tool UI excluded).
- **AC-24** (B) Internal links follow the sitemap table (`/avif-to-png` ↔ `/avif-to-jpg`,
  `/jfif-to-png` ↔ `/jfif-to-jpg`, `/webp-to-png` → `/avif-to-png`, `/avif-to-png` → `/what-is-avif`,
  `/avif-to-jpg` → `/how-to-open-avif-file`) and no internal link points at a missing file.
- **AC-25** (E) The drop zone states the limits and animated-AVIF support before any file is added;
  the four trust badges are visible.
- **AC-26** (B) The sample section offers three source/result pairs; each displayed size equals the
  real file size; results are produced by this engine (`pnpm samples`).
- **AC-27** (E) On `/how-to-open-avif-file`, dropping an AVIF shows a preview plus its metadata.
- **AC-28** (E) Every page passes axe with no serious or critical violation, in light and dark scheme;
  the drop zone is operable by keyboard.

## Decisions worth recording

- **JFIF → JPG is a rename by default.** JFIF is JPEG; re-encoding would only lose quality.
- **Results are live.** Conversion starts on drop and re-runs when a setting changes, so the sizes on
  screen are measured, never estimated.
- **HDR detection reads the container `colr`/`nclx` box only.** A file that signals HDR solely in the
  AV1 bitstream falls back to the browser's own rendering.
