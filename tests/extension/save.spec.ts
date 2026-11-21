import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { toneMap } from '../../src/engine/hdr';
import {
  expectClose,
  expectSameBytes,
  expectSamePixels,
  fixtureBytes,
  hdrPatches,
  pngChunks,
  readJpeg,
  readPng,
} from '../e2e/helpers';
import { BUILT, expect, fixture, menuItems, test } from './fixture';

const card = () => readPng(fixtureBytes('still.png'));

test('AC-59 the build holds the manifest, every file it names and the two pages, with no inline script', () => {
  const manifest = JSON.parse(readFileSync(join(BUILT, 'manifest.json'), 'utf8')) as {
    icons: Record<string, string>;
    background: { service_worker: string };
  };
  for (const file of [...Object.values(manifest.icons), manifest.background.service_worker])
    expect(readFileSync(join(BUILT, file)).length, file).toBeGreaterThan(0);
  for (const page of ['offscreen.html', 'notice.html']) {
    const scripts = [...readFileSync(join(BUILT, page), 'utf8').matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)];
    expect(scripts.length, page).toBeGreaterThan(0);
    for (const [, attributes, content] of scripts) {
      expect(attributes, page).toMatch(/\bsrc="/);
      expect(content.trim(), page).toBe('');
    }
    expect(readFileSync(join(BUILT, page), 'utf8'), page).not.toMatch(/\son[a-z]+=|\sstyle=|<style\b/);
  }
});

test('AC-58 the menu has its three items', async ({ extension }) => {
  const worker = await extension.worker();
  await expect.poll(() => menuItems(worker)).toEqual(['save', 'png', 'jpg']);
});

test('AC-60 "PNG" saves an AVIF, a WebP and a PNG under their own names', async ({ extension }) => {
  extension.serve('/card.png', fixture('still.png'));
  await extension.click('png', extension.at('/still.avif'));
  const fromAvif = readPng(await extension.saved('still.png'));
  expect([fromAvif.width, fromAvif.height]).toEqual([64, 48]);
  expectSamePixels(fromAvif, card(), 'still.png');

  await extension.click('png', extension.at('/lossless.webp'));
  expectSamePixels(readPng(await extension.saved('lossless.png')), card(), 'lossless.png');

  await extension.click('png', extension.at('/card.png'));
  expectSamePixels(readPng(await extension.saved('card.png')), card(), 'card.png');
  expect(extension.folder()).toEqual(['card.png', 'lossless.png', 'still.png']);
});

test('AC-61 "JPG" flattens transparency onto white, and saves a JPEG as it is', async ({ extension }) => {
  await extension.click('jpg', extension.at('/alpha.avif'));
  const flat = await extension.saved('alpha.jpg');
  expect([...flat.subarray(0, 3)]).toEqual([0xff, 0xd8, 0xff]);
  const pixels = readJpeg(flat);
  for (const c of pixels.at(52, 40).slice(0, 3)) expect(c).toBeGreaterThan(245); // transparent -> white
  expect(pixels.at(5, 20)[0]).toBeGreaterThan(200); // opaque red survives

  await extension.click('jpg', extension.at('/photo.jfif'));
  expectSameBytes(await extension.saved('photo.jpg'), fixtureBytes('photo.jfif'), 'photo.jpg');
  expect(extension.folder()).toEqual(['alpha.jpg', 'photo.jpg']);
});

test('AC-62 an animation gives one still PNG: its first frame', async ({ extension }) => {
  await extension.click('png', extension.at('/anim.webp'));
  const png = await extension.saved('anim.png');
  expect(pngChunks(png).some((chunk) => chunk.type === 'acTL')).toBe(false);
  const frame = readPng(png);
  expect([frame.width, frame.height]).toEqual([64, 48]);
  expectSamePixels(frame, readPng(fixtureBytes('anim-webp-first.png')), 'anim.png');

  // A second file would have followed the first at once. One that does finish proves the wait was long enough.
  await extension.click('png', extension.at('/still.avif'));
  await extension.saved('still.png');
  expect(extension.folder()).toEqual(['anim.png', 'still.png']);
});

test('AC-63 an HDR AVIF is tone-mapped as the site does by default', async ({ extension }) => {
  await extension.click('png', extension.at('/hdr-pq.avif'));
  const png = readPng(await extension.saved('hdr-pq.png'));
  const { source, centre } = hdrPatches();
  const expected = toneMap(source, 'brightness', 'srgb');
  for (let column = 0; column < 6; column++) {
    const [x, y] = centre(column, 0); // the neutral ramp
    expectClose(png.at(x, y), expected.subarray((y * source.width + x) * 4));
  }
  expect(png.at(...centre(0, 0))).toEqual([0, 0, 0, 255]);
  expect(png.at(...centre(5, 0))).toEqual([255, 255, 255, 255]); // 1000 nits
});

test('AC-65 a name the browser refuses is saved as image', async ({ extension }) => {
  extension.serve('/.hidden.avif', fixture('still.avif'));
  await extension.click('png', extension.at('/.hidden.avif'));
  expectSamePixels(readPng(await extension.saved('image.png')), card(), 'image.png');
  expect(extension.folder()).toEqual(['image.png']);
});

test('AC-66 the name comes from the address that was clicked, wherever it leads', async ({ extension }) => {
  extension.serve('/moved.avif', (response) => response.writeHead(302, { location: '/still.avif' }).end());
  await extension.click('png', extension.at('/moved.avif'));
  expectSamePixels(readPng(await extension.saved('moved.png')), card(), 'moved.png');

  await extension.click('png', `data:image/avif;base64,${fixtureBytes('still.avif').toString('base64')}`);
  expectSamePixels(readPng(await extension.saved('image.png')), card(), 'image.png');
  expect(extension.folder()).toEqual(['image.png', 'moved.png']);
});

test('AC-72 the service worker may stop between the click and the result', async ({ extension }) => {
  let answer = () => {};
  const asked = new Promise<void>((resolve) => {
    extension.serve('/still.avif', (response) => {
      answer = () => fixture('still.avif')(response);
      resolve();
    });
  });
  await extension.click('png', extension.at('/still.avif'));
  await asked; // the hidden document is waiting for the image
  await extension.stopWorker();
  expect(await extension.workerRuns()).toBe(false);
  answer();

  expectSamePixels(readPng(await extension.saved('still.png')), card(), 'still.png');
  expect(await extension.workerRuns()).toBe(true); // the result started it again
  expect(extension.folder()).toEqual(['still.png']);
});
