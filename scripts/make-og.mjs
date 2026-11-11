// Renders public/og.png (1200x630), the image shown when a page is shared, and public/logo.png
// (512x512), the logo named in the Organization data. Run when the brand changes.
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

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

// The logo is the favicon, at a size search engines accept (112 px is their minimum).
const favicon = readFileSync(join(root, 'public', 'favicon.svg'), 'utf8');
await page.setViewportSize({ width: 512, height: 512 });
await page.setContent(`<style>html,body{margin:0}svg{display:block;width:512px;height:512px}</style>${favicon}`);
await page.screenshot({ path: join(root, 'public', 'logo.png') });

await browser.close();
console.log('wrote public/og.png and public/logo.png');
