import { expect, type Locator, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { unzipSync, unzlibSync } from 'fflate';
import jpeg from 'jpeg-js';
import { PNG } from 'pngjs';

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), '..', 'fixtures');

const MIME: Record<string, string> = {
  avif: 'image/avif',
  webp: 'image/webp',
  jfif: 'image/jpeg',
  png: 'image/png',
};

export interface Upload {
  name: string;
  mimeType: string;
  buffer: Buffer;
}

export function fixtureBytes(name: string): Buffer {
  return readFileSync(join(FIXTURES, name));
}

/** A fixture as an upload payload, optionally under a different file name. */
export function upload(fixture: string, as = fixture): Upload {
  return { name: as, mimeType: MIME[fixture.split('.').pop()!], buffer: fixtureBytes(fixture) };
}

/** Resolves once every converter or viewer on the page has hydrated: Astro then drops the island's `ssr` attribute. */
async function hydrated(page: Page): Promise<void> {
  await expect(page.locator('astro-island[ssr]')).toHaveCount(0);
}

/**
 * Resolves once the converter takes drops and pastes anywhere on the page. It attaches those
 * listeners in an effect, a moment after hydrating, and goto() waits for neither. The probe is a
 * dragover carrying a file: the converter accepts it, and nothing else on the page does.
 */
async function listening(page: Page): Promise<void> {
  await page.waitForFunction(() => {
    const transfer = new DataTransfer();
    transfer.items.add(new File([], 'probe'));
    return !document.dispatchEvent(new DragEvent('dragover', { dataTransfer: transfer, cancelable: true }));
  });
}

export async function addFiles(page: Page, ...files: (string | Upload)[]): Promise<void> {
  await hydrated(page);
  await page
    .locator('input[type=file]')
    .first()
    .setInputFiles(files.map((f) => (typeof f === 'string' ? upload(f) : f)));
}

async function dataTransfer(page: Page, files: Upload[]) {
  const payload = files.map((f) => ({ name: f.name, type: f.mimeType, base64: f.buffer.toString('base64') }));
  return page.evaluateHandle((items) => {
    const transfer = new DataTransfer();
    for (const item of items) {
      const bytes = Uint8Array.from(atob(item.base64), (c) => c.charCodeAt(0));
      transfer.items.add(new File([bytes], item.name, { type: item.type }));
    }
    return transfer;
  }, payload);
}

export async function dropFiles(page: Page, target: Locator, ...fixtures: string[]): Promise<void> {
  await listening(page);
  const transfer = await dataTransfer(
    page,
    fixtures.map((f) => upload(f)),
  );
  await target.dispatchEvent('drop', { dataTransfer: transfer });
}

export async function pasteFiles(page: Page, ...fixtures: string[]): Promise<void> {
  await listening(page);
  const transfer = await dataTransfer(
    page,
    fixtures.map((f) => upload(f)),
  );
  await page.evaluate((clipboardData) => {
    document.dispatchEvent(new ClipboardEvent('paste', { clipboardData, bubbles: true, cancelable: true }));
  }, transfer);
}

export const fileRows = (page: Page): Locator => page.getByRole('list', { name: 'Files', exact: true }).locator('> li');

/** Waits until `count` rows are listed and every one of them has finished (converted or failed). */
export async function settled(page: Page, count: number): Promise<void> {
  await expect(fileRows(page)).toHaveCount(count);
  await expect(
    page
      .getByRole('list', { name: 'Files', exact: true })
      .locator('> li:not([data-status=done]):not([data-status=error])'),
  ).toHaveCount(0);
}

/** Opens the animation / HDR / colour-profile options, which start collapsed. */
export async function openAdvanced(page: Page): Promise<void> {
  const panel = page.locator('details.cv-advanced');
  if (!(await panel.evaluate((element) => (element as HTMLDetailsElement).open)))
    await panel.locator('summary').click();
}

export interface Downloaded {
  name: string;
  bytes: Buffer;
}

/** Clicks a control that triggers a download and returns the saved file. */
export async function download(page: Page, trigger: Locator): Promise<Downloaded> {
  const [event] = await Promise.all([page.waitForEvent('download'), trigger.click()]);
  return { name: event.suggestedFilename(), bytes: readFileSync(await event.path()) };
}

export const downloadLink = (page: Page, name: string): Locator =>
  page.getByRole('link', { name: `Download ${name}`, exact: true });

export async function downloadNamed(page: Page, name: string): Promise<Buffer> {
  const file = await download(page, downloadLink(page, name));
  expect(file.name).toBe(name);
  return file.bytes;
}

/**
 * Whole files are compared with this, never with `toEqual`: when two large buffers differ, that spends
 * minutes building a diff which no test timeout can interrupt, and the run hangs instead of failing.
 */
export function expectSameBytes(actual: Buffer, expected: Buffer, what: string): void {
  if (actual.equals(expected)) return;
  let at = 0;
  while (at < actual.length && actual[at] === expected[at]) at++;
  throw new Error(
    `${what}: ${actual.length} bytes, expected the same ${expected.length} bytes; the first difference is at byte ${at}`,
  );
}

export interface Raster {
  width: number;
  height: number;
  data: Uint8Array;
  at(x: number, y: number): number[];
}

export function raster(width: number, height: number, data: Uint8Array): Raster {
  return { width, height, data, at: (x, y) => Array.from(data.subarray((y * width + x) * 4, (y * width + x) * 4 + 4)) };
}

/** Whole images are compared with this, for the reason given at `expectSameBytes`. */
export function expectSamePixels(actual: Raster, expected: Raster, what: string): void {
  const size = (image: Raster) => `${image.width} × ${image.height}`;
  if (size(actual) !== size(expected)) throw new Error(`${what}: ${size(actual)}, expected ${size(expected)}`);
  const [got, want] = [actual.data, expected.data];
  let differing = 0;
  for (let i = 0; i < want.length; i += 4)
    if (got[i] !== want[i] || got[i + 1] !== want[i + 1] || got[i + 2] !== want[i + 2] || got[i + 3] !== want[i + 3])
      differing++;
  if (differing) throw new Error(`${what}: ${differing} of ${want.length / 4} pixels differ`);
}

export function readPng(bytes: Buffer): Raster {
  const png = PNG.sync.read(bytes);
  return raster(png.width, png.height, new Uint8Array(png.data));
}

export function readJpeg(bytes: Buffer): Raster {
  const image = jpeg.decode(bytes, { useTArray: true });
  return raster(image.width, image.height, image.data);
}

export interface Chunk {
  type: string;
  data: Buffer;
}

export function pngChunks(png: Buffer): Chunk[] {
  const chunks: Chunk[] = [];
  for (let at = 8; at < png.length;) {
    const length = png.readUInt32BE(at);
    chunks.push({ type: png.toString('latin1', at + 4, at + 8), data: png.subarray(at + 8, at + 8 + length) });
    at += 12 + length;
  }
  return chunks;
}

export const pngColourType = (png: Buffer): number => pngChunks(png)[0].data[9];

export function zipEntries(zip: Buffer): Record<string, Uint8Array> {
  return unzipSync(new Uint8Array(zip));
}

export { unzlibSync as inflateSync };

/** Sets a range input the way a user dragging it would: value plus input event. */
export async function setRange(slider: Locator, value: number): Promise<void> {
  await slider.evaluate((element, next) => {
    const input = element as HTMLInputElement;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
    setter.call(input, String(next));
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }, value);
}
