// Regenerates tests/fixtures/*. Needs ffmpeg (libaom-av1, libwebp) on PATH.
// The fixtures are committed; run this only when a fixture has to change.
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'tests', 'fixtures');
mkdirSync(out, { recursive: true });
const f = (name) => join(out, name);
const ffmpeg = (...args) => execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], { stdio: 'inherit' });

// Identity-matrix 4:4:4 lossless AV1: decoded RGB equals the source RGB exactly.
const LOSSLESS = ['-c:v', 'libaom-av1', '-still-picture', '1', '-crf', '0', '-aom-params', 'lossless=1'];
const tagged = (fmt, primaries, transfer) => `format=${fmt},setparams=color_primaries=${primaries}:color_trc=${transfer}:colorspace=gbr:range=pc`;

// --- still: 64x48 test card, lossless, 8-bit sRGB. still.png is the pixel reference.
ffmpeg('-f', 'lavfi', '-i', 'testsrc2=s=64x48:d=1', '-frames:v', '1', '-pix_fmt', 'rgb24', f('still.png'));
ffmpeg('-i', f('still.png'), '-frames:v', '1', '-vf', tagged('gbrp', 'bt709', 'iec61966-2-1'), ...LOSSLESS, f('still.avif'));
ffmpeg('-i', f('still.png'), '-frames:v', '1', '-c:v', 'libwebp', '-lossless', '1', f('lossless.webp'));

// --- alpha: left half opaque red, top-right half-transparent blue, bottom-right fully transparent.
{
  const w = 64,
    h = 48;
  const raw = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const px = x < 32 ? [255, 0, 0, 255] : y < 24 ? [0, 0, 255, 128] : [0, 0, 0, 0];
      raw.set(px, (y * w + x) * 4);
    }
  }
  writeFileSync(f('alpha.raw'), raw);
  ffmpeg(
    '-f',
    'rawvideo',
    '-pix_fmt',
    'rgba',
    '-s',
    `${w}x${h}`,
    '-i',
    f('alpha.raw'),
    '-filter_complex',
    `[0:v]split[c][a];[c]${tagged('gbrp', 'bt709', 'iec61966-2-1')}[color];[a]alphaextract,format=gray,setparams=colorspace=bt709:range=pc[alpha]`,
    '-map',
    '[color]',
    '-map',
    '[alpha]',
    '-frames:v',
    '1',
    ...LOSSLESS,
    f('alpha.avif'),
  );
  rmSync(f('alpha.raw'));
}

// --- animated: 5 frames at 5 fps (200 ms each).
ffmpeg('-f', 'lavfi', '-i', 'testsrc2=s=64x48:r=5:d=1', '-pix_fmt', 'yuv420p', '-c:v', 'libaom-av1', '-crf', '20', f('anim.avif'));
ffmpeg('-f', 'lavfi', '-i', 'testsrc2=s=64x48:r=5:d=0.6', '-c:v', 'libwebp_anim', '-lossless', '1', '-loop', '0', f('anim.webp'));

// --- HDR: 10-bit BT.2020 PQ patches, lossless. Codes are 10-bit PQ code values per channel.
{
  const patch = 8;
  const rows = [
    // neutral ramp: black, ~5 nits, 100 nits, 203 nits (SDR white), ~480 nits, 1000 nits
    [
      [0, 0, 0],
      [256, 256, 256],
      [520, 520, 520],
      [594, 594, 594],
      [692, 692, 692],
      [769, 769, 769],
    ],
    // colours: saturated primaries at 1000 nits, a bright orange, a bright green-ish, a dim SDR-range red
    [
      [769, 0, 0],
      [0, 769, 0],
      [0, 0, 769],
      [769, 594, 256],
      [692, 769, 520],
      [520, 256, 256],
    ],
  ];
  const w = rows[0].length * patch,
    h = rows.length * patch;
  const raw = Buffer.alloc(w * h * 6);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const code = rows[Math.floor(y / patch)][Math.floor(x / patch)];
      code.forEach((c, i) => raw.writeUInt16LE(Math.round((c / 1023) * 65535), (y * w + x) * 6 + i * 2));
    }
  }
  writeFileSync(f('hdr.raw'), raw);
  ffmpeg(
    '-f',
    'rawvideo',
    '-pix_fmt',
    'rgb48le',
    '-s',
    `${w}x${h}`,
    '-i',
    f('hdr.raw'),
    '-frames:v',
    '1',
    '-vf',
    tagged('gbrp10le', 'bt2020', 'smpte2084'),
    ...LOSSLESS,
    f('hdr-pq.avif'),
  );
  rmSync(f('hdr.raw'));
  writeFileSync(f('hdr-pq.json'), JSON.stringify({ patch, width: w, height: h, rows }, null, 2) + '\n');
}

// --- wide gamut: one flat Display P3 colour (200,100,50), lossless.
{
  const w = 16,
    h = 16;
  const raw = Buffer.alloc(w * h * 3);
  for (let i = 0; i < w * h; i++) raw.set([200, 100, 50], i * 3);
  writeFileSync(f('p3.raw'), raw);
  ffmpeg(
    '-f',
    'rawvideo',
    '-pix_fmt',
    'rgb24',
    '-s',
    `${w}x${h}`,
    '-i',
    f('p3.raw'),
    '-frames:v',
    '1',
    '-vf',
    tagged('gbrp', 'smpte432', 'iec61966-2-1'),
    ...LOSSLESS,
    f('p3.avif'),
  );
  rmSync(f('p3.raw'));
}

// --- photo-like: far more than 256 colours. Lossy AVIF plus the same picture as a .jfif (a JPEG).
ffmpeg('-f', 'lavfi', '-i', 'mandelbrot=s=320x240:r=1', '-frames:v', '1', '-pix_fmt', 'rgb24', f('photo.png'));
ffmpeg('-i', f('photo.png'), '-frames:v', '1', '-pix_fmt', 'yuv420p', '-c:v', 'libaom-av1', '-still-picture', '1', '-crf', '24', f('photo.avif'));
ffmpeg('-i', f('photo.png'), '-frames:v', '1', '-c:v', 'mjpeg', '-q:v', '3', '-f', 'mjpeg', f('photo.jfif'));
rmSync(f('photo.png'));

// --- corrupt: a valid AVIF header with the payload cut off.
{
  const still = readFileSync(f('still.avif'));
  writeFileSync(f('corrupt.avif'), still.subarray(0, Math.floor(still.length * 0.6)));
}

console.log('fixtures written to', out);
