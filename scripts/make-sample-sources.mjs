// Creates the source AVIF files in public/samples/. Run once; the outputs are committed.
// Needs ffmpeg (libaom-av1) and the Playwright Chromium build.
//
//   node scripts/make-sample-sources.mjs <earthrise.jpg>
//
// earthrise.jpg: "Earthrise" (AS08-14-2383), NASA / Bill Anders, 1968 — public domain. 1280 px version from
// https://commons.wikimedia.org/wiki/File:NASA-Apollo8-Dec24-Earthrise.jpg
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const [earthrise] = process.argv.slice(2);
if (!earthrise) throw new Error('usage: make-sample-sources.mjs <earthrise.jpg>');

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'public', 'samples');
const work = mkdtempSync(join(tmpdir(), 'avifbox-samples-'));
mkdirSync(out, { recursive: true });
const ffmpeg = (...args) =>
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], { stdio: 'inherit' });

const require = createRequire(import.meta.url);
const fontFile = (pkg, file) =>
  readFileSync(join(dirname(require.resolve(`${pkg}/package.json`)), 'files', file)).toString('base64');
const display = fontFile('@fontsource-variable/big-shoulders-display', 'big-shoulders-display-latin-wght-normal.woff2');
const fontFace = `@font-face{font-family:D;src:url(data:font/woff2;base64,${display}) format('woff2');font-weight:100 900}`;

// --- photo: the lower two thirds of Earthrise, 1280x852, ordinary lossy 8-bit 4:2:0 AVIF.
ffmpeg(
  '-i',
  earthrise,
  '-vf',
  'crop=1280:852:0:428',
  '-frames:v',
  '1',
  '-pix_fmt',
  'yuv420p',
  '-c:v',
  'libaom-av1',
  '-still-picture',
  '1',
  '-crf',
  '30',
  '-cpu-used',
  '4',
  join(out, 'photo.avif'),
);

const browser = await chromium.launch();

// --- transparent: a sticker with a soft shadow and see-through tape, to exercise partial alpha.
{
  const page = await browser.newPage({ viewport: { width: 900, height: 600 } });
  await page.setContent(`<style>${fontFace}
    html,body{margin:0;background:transparent}
    .stage{width:900px;height:600px;display:grid;place-items:center;font-family:D}
    .sticker{position:relative;width:620px;padding:34px 40px 30px;background:#c8330f;color:#fffaf0;border:10px solid #fffaf0;border-radius:26px;
      transform:rotate(-6deg);box-shadow:0 30px 50px rgba(27,23,18,.45),0 6px 12px rgba(27,23,18,.35);text-align:center}
    .sticker b{display:block;font-size:150px;font-weight:900;line-height:.9;letter-spacing:.03em}
    .sticker i{display:block;font-style:normal;font-size:44px;font-weight:700;letter-spacing:.16em;margin-top:10px}
    .tape{position:absolute;width:250px;height:74px;background:rgba(255,236,170,.55);transform:rotate(-38deg);left:-70px;top:-6px;box-shadow:0 2px 6px rgba(27,23,18,.25)}
    .tape.two{left:auto;right:-70px;top:auto;bottom:-6px}
  </style><div class="stage"><div class="sticker"><span class="tape"></span><span class="tape two"></span><b>FRAGILE</b><i>CONTAINS ALPHA CHANNEL</i></div></div>`);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: join(work, 'transparent.png'), omitBackground: true });
  await page.close();
  ffmpeg(
    '-i',
    join(work, 'transparent.png'),
    '-filter_complex',
    '[0:v]format=rgba,split[c][a];[c]format=yuv444p[color];[a]alphaextract,format=gray,setparams=colorspace=bt709:range=pc[alpha]',
    '-map',
    '[color]',
    '-map',
    '[alpha]',
    '-frames:v',
    '1',
    '-c:v',
    'libaom-av1',
    '-still-picture',
    '1',
    '-crf:v:0',
    '26',
    '-crf:v:1',
    '12',
    '-cpu-used',
    '4',
    join(out, 'transparent.avif'),
  );
}

// --- animated: a parcel riding a conveyor and getting re-labelled. 24 frames at 12 fps, loops.
{
  const frames = 24;
  const page = await browser.newPage({ viewport: { width: 480, height: 270 } });
  await page.setContent(`<style>${fontFace}
    html,body{margin:0}
    .scene{position:relative;width:480px;height:270px;overflow:hidden;background:#d8c49c;font-family:D}
    .belt{position:absolute;left:0;right:0;bottom:40px;height:34px;border-block:5px solid #1b1712;
      background:repeating-linear-gradient(90deg,#1b1712 0 6px,#564d40 6px 40px);background-position-x:calc(var(--t)*-160px)}
    .box{position:absolute;bottom:79px;left:calc(-150px + var(--t)*640px);width:130px;height:104px;background:#c5ad7c;border:5px solid #1b1712;
      display:grid;place-items:center}
    .box::before{content:'';position:absolute;inset:0 44% 0 44%;background:rgba(255,236,170,.75)}
    .box span{position:relative;background:#fffaf0;border:4px solid #1b1712;padding:0 10px;font-size:40px;font-weight:900;letter-spacing:.04em}
    .gate{position:absolute;left:214px;top:0;width:52px;height:calc(40px + var(--press)*46px);background:#c8330f;border:5px solid #1b1712;border-top:0}
    .sign{position:absolute;left:16px;top:14px;font-size:30px;font-weight:900;letter-spacing:.08em;color:#1b1712}
  </style><div class="scene"><div class="sign">AVIFBOX</div><div class="belt"></div><div class="box"><span></span></div><div class="gate"></div></div>`);
  await page.evaluate(() => document.fonts.ready);
  for (let i = 0; i < frames; i++) {
    const t = i / frames;
    await page.evaluate((time) => {
      const scene = document.querySelector('.scene');
      const press = Math.max(0, 1 - Math.abs(time - 0.5) / 0.09); // the stamp comes down as the box passes
      scene.style.setProperty('--t', String(time));
      scene.style.setProperty('--press', String(press));
      const label = document.querySelector('.box span');
      label.textContent = time < 0.5 ? 'AVIF' : 'PNG';
      label.style.color = time < 0.5 ? '#1b1712' : '#c8330f';
    }, t);
    await page.screenshot({ path: join(work, `f${String(i).padStart(3, '0')}.png`) });
  }
  await page.close();
  ffmpeg(
    '-framerate',
    '12',
    '-i',
    join(work, 'f%03d.png'),
    '-pix_fmt',
    'yuv420p',
    '-c:v',
    'libaom-av1',
    '-crf',
    '32',
    '-cpu-used',
    '4',
    join(out, 'animated.avif'),
  );
}

await browser.close();

// --- hdr: a 10-bit BT.2020 PQ test card. Ramps run from black to 1000 nits; the top strip reaches 4000.
{
  const w = 960,
    h = 540;
  const pq = (nits) => {
    const y = (nits / 10000) ** (2610 / 16384);
    return ((3424 / 4096 + (2413 / 128) * y) / (1 + (2392 / 128) * y)) ** ((2523 / 4096) * 128);
  };
  const rows = [
    { weights: [1, 1, 1], peak: 4000 },
    { weights: [1, 1, 1], peak: 1000 },
    { weights: [1, 0.08, 0.02], peak: 1000 },
    { weights: [1, 0.55, 0.02], peak: 1000 },
    { weights: [0.05, 1, 0.1], peak: 1000 },
    { weights: [0.02, 0.6, 1], peak: 1000 },
  ];
  const raw = Buffer.alloc(w * h * 6);
  for (let y = 0; y < h; y++) {
    const row = rows[Math.min(rows.length - 1, Math.floor((y / h) * rows.length))];
    for (let x = 0; x < w; x++) {
      const level = (x / (w - 1)) ** 2.2 * row.peak; // perceptually even ramp
      row.weights.forEach((weight, c) =>
        raw.writeUInt16LE(Math.round(pq(level * weight) * 65535), (y * w + x) * 6 + c * 2),
      );
    }
  }
  writeFileSync(join(work, 'hdr.raw'), raw);
  ffmpeg(
    '-f',
    'rawvideo',
    '-pix_fmt',
    'rgb48le',
    '-s',
    `${w}x${h}`,
    '-i',
    join(work, 'hdr.raw'),
    '-frames:v',
    '1',
    '-vf',
    'scale=out_color_matrix=bt2020:out_range=tv,format=yuv420p10le,setparams=color_primaries=bt2020:color_trc=smpte2084:colorspace=bt2020nc:range=tv',
    '-c:v',
    'libaom-av1',
    '-still-picture',
    '1',
    '-crf',
    '20',
    '-cpu-used',
    '4',
    join(out, 'hdr.avif'),
  );
}

rmSync(work, { recursive: true });
console.log('sample sources written to', out);
