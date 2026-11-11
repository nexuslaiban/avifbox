import { expect, test } from '@playwright/test';
import { expectSameBytes, expectSamePixels, raster } from './helpers';

/** What a failed comparison says, and how long it took to say it. */
function failure(compare: () => void): { message: string; ms: number } {
  const start = performance.now();
  try {
    compare();
  } catch (error) {
    return { message: (error as Error).message, ms: performance.now() - start };
  }
  throw new Error('the comparison passed');
}

// The specs compare whole files and whole images. When those differ the run has to say so, not hang.
test.describe('comparing files', () => {
  test('AC-40 two large files that differ fail at once, named, with both sizes', () => {
    const size = 300 * 1024;
    const published = Buffer.alloc(size, 1);
    const converted = Buffer.alloc(size + 7, 1);
    converted[1234] = 2;

    const { message, ms } = failure(() => expectSameBytes(converted, published, 'photo.png'));
    expect(message).toContain('photo.png');
    expect(message).toContain(`${size + 7} bytes`);
    expect(message).toContain(`${size} bytes`);
    expect(message).toContain('byte 1234');
    expect(ms).toBeLessThan(1000);

    expectSameBytes(Buffer.from(published), published, 'a copy');
  });

  test('AC-40 two images that differ fail at once with the number of pixels that differ', () => {
    const [width, height] = [640, 480];
    const published = raster(width, height, new Uint8Array(width * height * 4).fill(200));
    const converted = raster(width, height, published.data.slice());
    // Three pixels, one of them different in alpha only.
    converted.data[0] = 199;
    converted.data[4 * 1000 + 1] = 201;
    converted.data[4 * 2000 + 3] = 0;

    const { message, ms } = failure(() => expectSamePixels(converted, published, 'photo.png'));
    expect(message).toBe(`photo.png: 3 of ${width * height} pixels differ`);
    expect(ms).toBeLessThan(1000);

    const cropped = raster(width, height - 1, published.data.slice(0, width * (height - 1) * 4));
    expect(failure(() => expectSamePixels(cropped, published, 'photo.png')).message).toContain('640 × 479');

    expectSamePixels(raster(width, height, published.data.slice()), published, 'a copy');
  });
});
