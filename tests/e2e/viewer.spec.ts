import { expect, test, type Locator, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { formatBytes } from '../../src/ui/format';
import {
  addFiles,
  download,
  downloadNamed,
  expectSameBytes,
  fixtureBytes,
  readJpeg,
  readPng,
  settled,
} from './helpers';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const VIEWER = '/avif-viewer';
// The viewer has a page of its own and also sits at the top of the guide.
const HOSTS = [VIEWER, '/how-to-open-avif-file'];

/** The facts panel as label → value. */
async function facts(page: Page): Promise<Record<string, string>> {
  return page.locator('.vw-facts dl').evaluate((list) => {
    const text = (selector: string) => [...list.querySelectorAll(selector)].map((node) => node.textContent ?? '');
    const values = text('dd');
    return Object.fromEntries(text('dt').map((label, index) => [label, values[index]]));
  });
}

const save = (page: Page, format: 'PNG' | 'JPG'): Locator =>
  page.getByRole('button', { name: `Save as ${format}`, exact: true });

const strip = (page: Page, file: string): Locator => page.getByRole('list', { name: `Frames of ${file}`, exact: true });

test.describe('viewer', () => {
  for (const path of HOSTS) {
    test(`AC-39 a still AVIF is shown with its facts and saved as PNG or JPG (${path})`, async ({ page }) => {
      await page.goto(path);
      await addFiles(page, 'hdr-pq.avif');
      await expect(page.getByRole('img', { name: 'Preview of hdr-pq.avif' })).toBeVisible();
      await expect
        .poll(() => facts(page))
        .toEqual({
          File: 'hdr-pq.avif',
          Size: formatBytes(fixtureBytes('hdr-pq.avif').length),
          Format: 'AVIF',
          Dimensions: '48 × 16 pixels',
          'Bit depth': '10-bit',
          Colour: 'HDR (PQ), BT.2020 (wide gamut)',
          Animated: 'No',
        });
      await expect(page.getByRole('list', { name: /^Frames of/ })).toHaveCount(0);

      const png = await download(page, save(page, 'PNG'));
      expect(png.name).toBe('hdr-pq.png');
      const raster = readPng(png.bytes);
      expect([raster.width, raster.height]).toEqual([48, 16]);

      const jpg = await download(page, save(page, 'JPG'));
      expect(jpg.name).toBe('hdr-pq.jpg');
      const decoded = readJpeg(jpg.bytes);
      expect([decoded.width, decoded.height]).toEqual([48, 16]);

      // More than one click can do is a link away.
      for (const converter of ['/avif-to-png', '/avif-to-jpg'])
        await expect(page.locator(`.vw a[href="${converter}"]`), converter).toBeVisible();
    });
  }

  test('AC-39 an animated AVIF gets a strip of frames; the chosen frame is shown and is what gets saved', async ({
    page,
  }) => {
    // The converter says what each frame is.
    await page.goto('/');
    await addFiles(page, 'anim.avif');
    await settled(page, 1);
    const first = await downloadNamed(page, 'anim-001.png');
    const second = await downloadNamed(page, 'anim-002.png');
    expect(second.equals(first), 'frames 1 and 2 are the same file').toBe(false);
    await page.getByRole('radio', { name: 'JPG', exact: true }).check();
    await settled(page, 1);
    const secondJpg = await downloadNamed(page, 'anim-002.jpg');

    await page.goto(VIEWER);
    await addFiles(page, 'anim.avif');
    await expect.poll(() => facts(page)).toMatchObject({ Dimensions: '64 × 48 pixels', Animated: 'Yes', Frames: '5' });
    const frames = strip(page, 'anim.avif');
    await expect(frames.getByRole('button')).toHaveCount(5);
    await expect(frames.locator('img')).toHaveCount(5);
    await expect(page.getByText(/only the first frame/i)).toHaveCount(0);

    // To start with the animation plays and no frame is chosen.
    const play = page.getByRole('button', { name: 'Play', exact: true });
    const moving = page.getByRole('img', { name: 'Preview of anim.avif' });
    await expect(play).toHaveAttribute('aria-pressed', 'true');
    await expect(frames.locator('[aria-pressed="true"]')).toHaveCount(0);
    await expect(moving).toBeVisible();

    const two = frames.getByRole('button', { name: 'Frame 2', exact: true });
    await two.click();
    await expect(two).toHaveAttribute('aria-pressed', 'true');
    await expect(frames.locator('[aria-pressed="true"]')).toHaveCount(1);
    await expect(play).toHaveAttribute('aria-pressed', 'false');
    await expect(moving).toHaveCount(0);
    const shown = page.getByRole('img', { name: 'Frame 2 of anim.avif' });
    await expect(shown).toBeVisible();
    expect(await shown.getAttribute('src')).toBe(await two.locator('img').getAttribute('src'));

    const png = await download(page, save(page, 'PNG'));
    expect(png.name).toBe('anim-002.png');
    expectSameBytes(png.bytes, second, 'frame 2 saved as PNG');
    const jpg = await download(page, save(page, 'JPG'));
    expect(jpg.name).toBe('anim-002.jpg');
    expectSameBytes(jpg.bytes, secondJpg, 'frame 2 saved as JPG');

    await play.click();
    await expect(moving).toBeVisible();
    await expect(frames.locator('[aria-pressed="true"]')).toHaveCount(0);
    await expect(play).toHaveAttribute('aria-pressed', 'true');
  });

  test('AC-39 a strip of frames longer than a phone screen scrolls inside the viewer and does not widen it', async ({
    page,
  }) => {
    const width = 412;
    await page.setViewportSize({ width, height: 915 });
    await page.goto(VIEWER);
    // The published sample: 24 frames, far more than fit side by side, and a picture wider than the screen.
    await addFiles(page, {
      name: 'animated.avif',
      mimeType: 'image/avif',
      buffer: readFileSync(join(ROOT, 'public', 'samples', 'animated.avif')),
    });
    const frames = strip(page, 'animated.avif');
    await expect(frames.getByRole('button')).toHaveCount(24);
    await expect.poll(() => facts(page)).toMatchObject({ Dimensions: '480 × 270 pixels' });
    expect(await frames.evaluate((list) => list.scrollWidth - list.clientWidth), 'strip overflow').toBeGreaterThan(0);

    // The page hides what sticks out, so "no horizontal scrolling" cannot tell: measure the parts.
    const parts = {
      'drop zone': page.getByTestId('viewer-drop'),
      result: page.locator('.vw-result'),
      picture: page.getByRole('img', { name: 'Preview of animated.avif' }),
      'Save as JPG': save(page, 'JPG'),
      Play: page.getByRole('button', { name: 'Play', exact: true }),
    };
    for (const [name, part] of Object.entries(parts)) {
      const box = (await part.boundingBox())!;
      expect(box.x, `${name}: left edge`).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width, `${name}: right edge`).toBeLessThanOrEqual(width);
    }
  });

  test('AC-39 a file that cannot be decoded is reported, with nothing to save', async ({ page }) => {
    await page.goto(VIEWER);
    const undecodable = [
      { file: 'corrupt.avif' as const, name: 'corrupt.avif', says: /could not decode/i },
      {
        file: { name: 'notes.avif', mimeType: 'image/avif', buffer: Buffer.from('%PDF-1.7 definitely not an image') },
        name: 'notes.avif',
        says: /not a supported image/i,
      },
    ];
    for (const { file, name, says } of undecodable) {
      await addFiles(page, file);
      await expect.poll(() => facts(page), name).toMatchObject({ File: name });
      await expect(page.locator('.vw-stage'), name).toContainText(says);
      await expect(page.locator('.vw-stage img'), name).toHaveCount(0);
      await expect(page.getByRole('button', { name: /^Save as/ }), name).toHaveCount(0);
    }

    // Not a dead end: the next file opens as usual.
    await addFiles(page, 'still.avif');
    await expect(page.getByRole('img', { name: 'Preview of still.avif' })).toBeVisible();
    await expect(save(page, 'PNG')).toBeEnabled();
    await expect(page.locator('.vw-stage')).not.toContainText(/not a supported image/i);
  });

  test('AC-39 where frames cannot be stepped through, the viewer says only the first frame is available', async ({
    page,
  }) => {
    // Safari has no ImageDecoder. Taking it away from the converter's worker gives the same result here.
    let patched = 0;
    await page.route('**/_astro/worker-*.js', async (route) => {
      const response = await route.fetch();
      patched++;
      await route.fulfill({ response, body: `delete self.ImageDecoder;\n${await response.text()}` });
    });
    await page.goto(VIEWER);
    await addFiles(page, 'anim.avif');

    await expect(page.locator('.vw')).toContainText(/only the first frame is available/i);
    expect(patched, 'worker scripts served without ImageDecoder').toBeGreaterThan(0);
    await expect.poll(() => facts(page)).toMatchObject({ Animated: 'Yes' });
    expect(await facts(page)).not.toHaveProperty('Frames');
    await expect(strip(page, 'anim.avif')).toHaveCount(0);
    // The browser still plays the file itself.
    await expect(page.getByRole('img', { name: 'Preview of anim.avif' })).toBeVisible();

    const png = await download(page, save(page, 'PNG'));
    expect(png.name).toBe('anim.png');
    expect([readPng(png.bytes).width, readPng(png.bytes).height]).toEqual([64, 48]);
  });
});
