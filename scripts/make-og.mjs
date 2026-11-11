// Renders the brand's raster files into public/: og.png (1200x630), the image shown when a page is
// shared, and the mark of favicon.svg as logo.png (512 px, the logo named in the Organization data),
// apple-touch-icon.png (180 px) and favicon.ico (16, 32 and 48 px). Run when the brand changes.
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { PNG } from 'pngjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const font = (pkg, file) =>
  readFileSync(join(dirname(require.resolve(`${pkg}/package.json`)), 'files', file)).toString('base64');
const display = font('@fontsource-variable/big-shoulders-display', 'big-shoulders-display-latin-wght-normal.woff2');
const mono = font(
  '@fontsource-variable/atkinson-hyperlegible-mono',
  'atkinson-hyperlegible-mono-latin-wght-normal.woff2',
);

const html = `<style>
  @font-face{font-family:D;src:url(data:font/woff2;base64,${display}) format('woff2');font-weight:100 900}
  @font-face{font-family:M;src:url(data:font/woff2;base64,${mono}) format('woff2');font-weight:200 800}
  html,body{margin:0}
  .og{width:1200px;height:630px;background:#d8c49c;color:#1b1712;position:relative;overflow:hidden;font-family:D}
  .tape{height:26px;background:repeating-linear-gradient(-45deg,#1b1712 0 26px,#c8330f 26px 52px)}
  .in{padding:44px 64px}
  .brand{display:flex;align-items:center;gap:16px;font-size:58px;font-weight:900;letter-spacing:.03em}
  .brand b{color:#c8330f}
  h1{margin:34px 0 0;font-size:176px;line-height:.84;font-weight:900;text-transform:uppercase;letter-spacing:-.005em}
  h1 em{font-style:normal;color:#c8330f}
  p{margin:30px 0 0;font:700 30px/1.3 M;letter-spacing:.04em;text-transform:uppercase}
  .stamp{position:absolute;right:96px;top:352px;border:6px double #a62a0c;color:#a62a0c;border-radius:10px;padding:14px 26px 10px;
    font-size:62px;font-weight:900;letter-spacing:.07em;transform:rotate(-5deg)}
</style>
<div class="og"><div class="tape"></div><div class="in">
  <div class="brand"><svg viewBox="0 0 32 32" width="64" height="64"><path d="M3 10.5 16 4l13 6.5v11L16 28 3 21.5z" fill="#c8330f" stroke="#1b1712" stroke-width="2.4" stroke-linejoin="round"/><path d="M3 10.5 16 17l13-6.5M16 17v11" fill="none" stroke="#1b1712" stroke-width="2.4" stroke-linejoin="round"/></svg><span>AVIF<b>BOX</b></span></div>
  <h1>AVIF to <em>PNG</em><br>&amp; JPG</h1>
  <p>Converted in your browser · never uploaded</p>
  <div class="stamp">NO UPLOAD</div>
</div></div>`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await page.setContent(html);
await page.evaluate(() => document.fonts.ready);
await page.screenshot({ path: join(root, 'public', 'og.png') });

const favicon = readFileSync(join(root, 'public', 'favicon.svg'), 'utf8');

/** The mark as a PNG of `size` pixels. */
async function mark(size) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(
    `<style>html,body{margin:0}svg{display:block;width:${size}px;height:${size}px}</style>${favicon}`,
  );
  return page.screenshot();
}

/** An ICO file of square PNG images: a directory of 16-byte entries, then the images as they are. */
function ico(images) {
  const directory = Buffer.alloc(6 + 16 * images.length);
  directory.writeUInt16LE(1, 2); // type: icon
  directory.writeUInt16LE(images.length, 4);
  let offset = directory.length;
  images.forEach(({ size, png }, index) => {
    const entry = 6 + 16 * index;
    directory.writeUInt8(size, entry); // width
    directory.writeUInt8(size, entry + 1); // height
    directory.writeUInt16LE(1, entry + 4); // colour planes
    directory.writeUInt16LE(32, entry + 6); // bits per pixel
    directory.writeUInt32LE(png.length, entry + 8);
    directory.writeUInt32LE(offset, entry + 12);
    offset += png.length;
  });
  return Buffer.concat([directory, ...images.map((image) => image.png)]);
}

const save = (name, bytes) => writeFileSync(join(root, 'public', name), bytes);

// Search engines want a logo of at least 112 px.
save('logo.png', await mark(512));
// What iOS puts on the home screen. Opaque, because it paints a transparent icon on black.
save('apple-touch-icon.png', await mark(180));
// For clients that do not take the SVG favicon and ask for the well-known path. ICO takes PNG in RGBA
// only, and a screenshot of an opaque page is RGB, so each one is written again.
const small = [];
for (const size of [16, 32, 48]) small.push({ size, png: PNG.sync.write(PNG.sync.read(await mark(size))) });
save('favicon.ico', ico(small));

await browser.close();
console.log('wrote og.png, logo.png, apple-touch-icon.png and favicon.ico to public/');
