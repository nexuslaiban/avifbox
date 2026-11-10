import { expect, test } from '@playwright/test';
import { SDR_WHITE, toneMap, type HdrImage } from '../../src/engine/hdr';
import {
  addFiles,
  download,
  downloadLink,
  downloadNamed,
  dropFiles,
  fileRows,
  fixtureBytes,
  inflateSync,
  pasteFiles,
  pngChunks,
  pngColourType,
  readJpeg,
  readPng,
  setRange,
  settled,
  upload,
  zipEntries,
} from './helpers';

const reference = () => readPng(fixtureBytes('still.png'));

test.describe('AVIF to PNG', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/avif-to-png');
  });

  test('AC-01 a dropped AVIF becomes a pixel-identical PNG', async ({ page }) => {
    await dropFiles(page, page.getByTestId('dropzone'), 'still.avif');
    await settled(page, 1);
    const png = readPng(await downloadNamed(page, 'still.png'));
    expect([png.width, png.height]).toEqual([64, 48]);
    expect(png.data).toEqual(reference().data);
  });

  test('AC-02 transparency is kept, or filled when a background is chosen', async ({ page }) => {
    await addFiles(page, 'alpha.avif');
    await settled(page, 1);
    const kept = readPng(await downloadNamed(page, 'alpha.png'));
    expect(kept.at(5, 5)).toEqual([255, 0, 0, 255]);
    expect(kept.at(40, 5)[3]).toBe(128);
    expect(kept.at(40, 40)[3]).toBe(0);

    await page.getByRole('checkbox', { name: 'Fill transparent areas' }).check();
    await settled(page, 1);
    const filled = readPng(await downloadNamed(page, 'alpha.png'));
    expect(filled.at(40, 40)).toEqual([255, 255, 255, 255]);
    expect(filled.at(40, 5)).toEqual([127, 127, 255, 255]);
    for (let i = 3; i < filled.data.length; i += 4) expect(filled.data[i]).toBe(255);
  });

  test('AC-04 Optimized writes a smaller palette PNG', async ({ page }) => {
    await addFiles(page, 'photo.avif');
    await settled(page, 1);
    const truecolor = await downloadNamed(page, 'photo.png');
    expect(pngColourType(truecolor)).toBe(2);

    await page.getByRole('radio', { name: 'Optimized' }).check();
    await settled(page, 1);
    const optimized = await downloadNamed(page, 'photo.png');
    expect(pngColourType(optimized)).toBe(3);
    expect(optimized.length).toBeLessThan(truecolor.length);
    expect(readPng(optimized).width).toBe(320);
  });

  test('AC-05 an animated AVIF is split into frames that can be picked, or kept as one APNG', async ({ page }) => {
    await addFiles(page, 'anim.avif');
    await settled(page, 1);
    const names = ['anim-001.png', 'anim-002.png', 'anim-003.png', 'anim-004.png', 'anim-005.png'];
    for (const name of names) await expect(downloadLink(page, name)).toBeVisible();
    const first = readPng(await downloadNamed(page, 'anim-001.png'));
    const last = readPng(await downloadNamed(page, 'anim-005.png'));
    expect([first.width, first.height]).toEqual([64, 48]);
    expect(first.data).not.toEqual(last.data);

    await page.getByRole('checkbox', { name: 'Frame 3', exact: true }).uncheck();
    const zip = zipEntries((await download(page, page.getByRole('button', { name: /Download all/ }))).bytes);
    expect(Object.keys(zip).sort()).toEqual(names.filter((n) => n !== 'anim-003.png'));

    await page.getByRole('radio', { name: 'Animated PNG' }).check();
    await settled(page, 1);
    const apng = pngChunks(await downloadNamed(page, 'anim.png'));
    const acTL = apng.find((c) => c.type === 'acTL')!;
    expect(acTL.data.readUInt32BE(0)).toBe(5);
    const fcTLs = apng.filter((c) => c.type === 'fcTL');
    expect(fcTLs).toHaveLength(5);
    for (const c of fcTLs) expect(c.data.readUInt16BE(20) / c.data.readUInt16BE(22)).toBeCloseTo(0.2, 3);
  });

  test('AC-06 an HDR AVIF is tone-mapped, with two modes', async ({ page }) => {
    const layout = JSON.parse(fixtureBytes('hdr-pq.json').toString()) as { patch: number; width: number; height: number; rows: number[][][] };
    const data = new Uint16Array(layout.width * layout.height * 4);
    for (let y = 0; y < layout.height; y++) {
      for (let x = 0; x < layout.width; x++) {
        const code = layout.rows[Math.floor(y / layout.patch)][Math.floor(x / layout.patch)];
        data.set([...code.map((c) => Math.round((c / 1023) * 65535)), 65535], (y * layout.width + x) * 4);
      }
    }
    const source: HdrImage = { data, width: layout.width, height: layout.height, transfer: 'pq', primaries: 9 };
    const centre = (column: number, row: number): [number, number] => [column * layout.patch + 4, row * layout.patch + 4];
    const expectClose = (actual: number[], expected: ArrayLike<number>) => {
      for (let c = 0; c < 4; c++) expect(Math.abs(actual[c] - expected[c])).toBeLessThanOrEqual(2);
    };

    await addFiles(page, 'hdr-pq.avif');
    await settled(page, 1);
    await expect(fileRows(page).first()).toContainText('HDR');
    await expect(page.getByRole('radio', { name: 'Keep brightness' })).toBeChecked();

    const brightness = readPng(await downloadNamed(page, 'hdr-pq.png'));
    const expectedBrightness = toneMap(source, 'brightness', 'srgb');
    for (let row = 0; row < 2; row++) {
      for (let column = 0; column < 6; column++) {
        const [x, y] = centre(column, row);
        expectClose(brightness.at(x, y), expectedBrightness.subarray((y * layout.width + x) * 4));
      }
    }
    // Sanity anchors that do not depend on our own implementation: black stays black, the 1000-nit
    // peak becomes white, and 100 nits sits where SDR white at 203 nits puts it.
    expect(brightness.at(...centre(0, 0))).toEqual([0, 0, 0, 255]);
    expect(brightness.at(...centre(5, 0))).toEqual([255, 255, 255, 255]);
    const grey100 = Math.round(255 * (1.055 * (100 / SDR_WHITE) ** (1 / 2.4) - 0.055));
    expect(Math.abs(brightness.at(...centre(2, 0))[0] - grey100)).toBeLessThanOrEqual(3);

    await page.getByRole('radio', { name: 'Keep colour' }).check();
    await settled(page, 1);
    const colour = readPng(await downloadNamed(page, 'hdr-pq.png'));
    const expectedColour = toneMap(source, 'colour', 'srgb');
    const [x, y] = centre(3, 1); // bright orange
    expectClose(colour.at(x, y), expectedColour.subarray((y * layout.width + x) * 4));
    expect(colour.at(x, y)).not.toEqual(brightness.at(x, y));
  });

  test('AC-07 Display P3 output keeps the wide-gamut values and embeds the profile', async ({ page }) => {
    await addFiles(page, 'p3.avif');
    await settled(page, 1);
    const srgb = await downloadNamed(page, 'p3.png');
    expect(pngChunks(srgb).map((c) => c.type)).not.toContain('iCCP');
    const converted = readPng(srgb).at(8, 8);
    expect(converted).not.toEqual([200, 100, 50, 255]);
    expect(converted[0]).toBeGreaterThan(200); // P3 orange is more saturated than sRGB can say with 200

    await page.getByRole('radio', { name: 'Display P3' }).check();
    await settled(page, 1);
    const p3 = await downloadNamed(page, 'p3.png');
    const iccp = pngChunks(p3).find((c) => c.type === 'iCCP')!;
    expect(iccp.data.toString('latin1', 0, 10)).toBe('Display P3');
    expect(inflateSync(iccp.data.subarray(12)).length).toBe(736);
    expect(readPng(p3).at(8, 8)).toEqual([200, 100, 50, 255]);
  });

  test('AC-10 several files download as one ZIP with unique names', async ({ page }) => {
    await addFiles(page, 'still.avif', upload('alpha.avif', 'still.avif'), 'photo.avif');
    await settled(page, 3);
    const zip = await download(page, page.getByRole('button', { name: /Download all/ }));
    expect(zip.name).toMatch(/\.zip$/);
    const entries = zipEntries(zip.bytes);
    expect(Object.keys(entries).sort()).toEqual(['photo.png', 'still (2).png', 'still.png']);
    expect(readPng(Buffer.from(entries['still.png'])).data).toEqual(reference().data);
    expect(readPng(Buffer.from(entries['still (2).png'])).at(40, 40)[3]).toBe(0);
  });

  test('AC-11 a batch is capped at 50 files and says how many were left out', async ({ page }) => {
    await addFiles(page, ...Array.from({ length: 51 }, (_, i) => upload('still.avif', `file-${i}.avif`)));
    await expect(fileRows(page)).toHaveCount(50);
    await expect(page.getByRole('status')).toContainText('1 file was left out');
    await expect(page.getByRole('status')).toContainText('50');
    await settled(page, 50);
  });

  test('AC-12 an image pasted from the clipboard is converted', async ({ page }) => {
    await pasteFiles(page, 'still.avif');
    await settled(page, 1);
    expect(readPng(await downloadNamed(page, 'still.png')).data).toEqual(reference().data);
  });

  test('AC-13 nothing leaves the browser', async ({ page, baseURL }) => {
    const requests: { url: string; method: string }[] = [];
    page.on('request', (request) => requests.push({ url: request.url(), method: request.method() }));
    await page.reload();
    await addFiles(page, 'still.avif', 'hdr-pq.avif', 'anim.avif');
    await settled(page, 3);
    await download(page, page.getByRole('button', { name: /Download all/ }));

    expect(requests.length).toBeGreaterThan(0);
    for (const request of requests) {
      const url = new URL(request.url);
      if (url.protocol === 'blob:' || url.protocol === 'data:') continue;
      expect(url.origin, request.url).toBe(new URL(baseURL!).origin);
      expect(request.method, request.url).toBe('GET');
    }
    const csp = await page.locator('meta[http-equiv="content-security-policy"]').getAttribute('content');
    expect(csp).toContain("connect-src 'self'");
    expect(csp).toContain("default-src 'self'");
  });

  test('AC-14 a damaged file fails on its own row without stopping the batch', async ({ page }) => {
    await addFiles(page, 'corrupt.avif', 'still.avif', upload('still.png', 'notes.avif'));
    await settled(page, 3);
    const rows = fileRows(page);
    await expect(rows.filter({ hasText: 'corrupt.avif' })).toHaveAttribute('data-status', 'error');
    await expect(rows.filter({ hasText: 'corrupt.avif' })).toContainText(/could not|damaged/i);
    await expect(rows.filter({ hasText: 'still.avif' })).toHaveAttribute('data-status', 'done');
    // A PNG wearing an .avif name is identified by its content and converted anyway.
    await expect(rows.filter({ hasText: 'notes.avif' })).toHaveAttribute('data-status', 'done');
  });

  test('a file that is not an image is refused with a reason', async ({ page }) => {
    await addFiles(page, { name: 'report.avif', mimeType: 'image/avif', buffer: Buffer.from('%PDF-1.7 definitely not an image') });
    await settled(page, 1);
    await expect(fileRows(page).first()).toHaveAttribute('data-status', 'error');
    await expect(fileRows(page).first()).toContainText(/not a supported image/i);
  });

  test('files can be removed and the list cleared', async ({ page }) => {
    await addFiles(page, 'still.avif', 'alpha.avif');
    await settled(page, 2);
    await page.getByRole('button', { name: 'Remove still.avif' }).click();
    await expect(fileRows(page)).toHaveCount(1);
    await page.getByRole('button', { name: 'Clear all' }).click();
    await expect(fileRows(page)).toHaveCount(0);
  });

  test('AC-25 the drop zone states its limits and the trust badges are shown', async ({ page }) => {
    const zone = page.getByTestId('dropzone');
    await expect(zone).toContainText('50 files');
    await expect(zone).toContainText('50 MB');
    await expect(zone).toContainText(/animated avif/i);
    await expect(zone).toContainText(/paste/i);
    for (const badge of ['No upload', 'No account', 'No watermark', 'Free']) {
      await expect(page.getByRole('list', { name: 'Why AVIFBox' }).getByText(badge, { exact: false }).first()).toBeVisible();
    }
  });
});

test.describe('other tools', () => {
  test('AC-03 AVIF to JPG flattens transparency and honours quality', async ({ page }) => {
    await page.goto('/avif-to-jpg');
    await addFiles(page, 'alpha.avif', 'photo.avif');
    await settled(page, 2);
    const flat = await downloadNamed(page, 'alpha.jpg');
    expect(flat.subarray(0, 3)).toEqual(Buffer.from([0xff, 0xd8, 0xff]));
    const pixels = readJpeg(flat);
    for (const c of pixels.at(52, 40).slice(0, 3)) expect(c).toBeGreaterThan(245); // transparent -> white matte
    expect(pixels.at(5, 20)[0]).toBeGreaterThan(200); // opaque red survives

    await setRange(page.getByRole('slider', { name: 'Quality' }), 95);
    await settled(page, 2);
    const high = await downloadNamed(page, 'photo.jpg');
    await setRange(page.getByRole('slider', { name: 'Quality' }), 50);
    await settled(page, 2);
    const low = await downloadNamed(page, 'photo.jpg');
    expect(low.length).toBeLessThan(high.length);
    expect(readJpeg(low).width).toBe(320);
  });

  test('AC-08 JFIF to JPG is a lossless rename unless re-encoding is asked for', async ({ page }) => {
    await page.goto('/jfif-to-jpg');
    await addFiles(page, 'photo.jfif');
    await settled(page, 1);
    const original = fixtureBytes('photo.jfif');
    expect(await downloadNamed(page, 'photo.jpg')).toEqual(original);

    await page.getByRole('radio', { name: 'Re-encode' }).check();
    await settled(page, 1);
    const reencoded = await downloadNamed(page, 'photo.jpg');
    expect(reencoded).not.toEqual(original);
    expect([readJpeg(reencoded).width, readJpeg(reencoded).height]).toEqual([320, 240]);
  });

  test('AC-09 JFIF to PNG and WebP to PNG', async ({ page }) => {
    await page.goto('/jfif-to-png');
    await addFiles(page, 'photo.jfif');
    await settled(page, 1);
    const fromJfif = readPng(await downloadNamed(page, 'photo.png'));
    expect([fromJfif.width, fromJfif.height]).toEqual([320, 240]);

    await page.goto('/webp-to-png');
    await addFiles(page, 'lossless.webp');
    await settled(page, 1);
    expect(readPng(await downloadNamed(page, 'lossless.png')).data).toEqual(reference().data);
  });

  test('AC-05 an animated WebP is split into frames too', async ({ page }) => {
    await page.goto('/webp-to-png');
    await addFiles(page, 'anim.webp');
    await settled(page, 1);
    for (const name of ['anim-001.png', 'anim-002.png', 'anim-003.png']) await expect(downloadLink(page, name)).toBeVisible();
  });

  test('the home page converts to PNG or JPG', async ({ page }) => {
    await page.goto('/');
    await addFiles(page, 'still.avif');
    await settled(page, 1);
    expect(readPng(await downloadNamed(page, 'still.png')).data).toEqual(reference().data);
    await page.getByRole('radio', { name: 'JPG', exact: true }).check();
    await settled(page, 1);
    expect(readJpeg(await downloadNamed(page, 'still.jpg')).width).toBe(64);
  });
});
