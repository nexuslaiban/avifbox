import AxeBuilder from '@axe-core/playwright';
import { expect, test } from './fixture';

const UNREACHABLE =
  'Could not fetch this image. The site may have refused the request, the image may exist only inside the page, ' +
  'or AVIFBox may not be allowed to read it (see the extension’s site access in the browser’s settings).';

const said = [
  ['an address the host answers with 404', '/missing.avif', 'Could not fetch this image: the site answered 404.'],
  ['a file that is no image', '/hdr-pq.json', 'Not a supported image. AVIFBox reads AVIF, WebP, JPG/JFIF and PNG.'],
  [
    'a damaged image',
    '/corrupt.avif',
    'Could not decode this file. It may be damaged, or use a feature this browser does not support.',
  ],
  ['an image a page made itself', 'blob:https://example.com/0b0c0d0e-1f2a-4b3c-8d4e-5f6a7b8c9d0e', UNREACHABLE],
] as const;

for (const [what, address, message] of said) {
  test(`AC-69 ${what} saves nothing and says why`, async ({ extension }) => {
    const srcUrl = address.startsWith('/') ? extension.at(address) : address;
    const window = await extension.failure('png', srcUrl);
    await expect(window.getByRole('heading', { level: 1 })).toHaveText('This image was not saved');
    await expect(window.locator('#failure')).toHaveText(message);
    expect(extension.folder()).toEqual([]);
  });
}

test('AC-70 the failure window says what happened and what can still be done', async ({ extension }) => {
  const window = await extension.failure('jpg', extension.at('/missing.avif'));
  expect(new URL(window.url()).pathname).toBe('/notice.html');
  await expect(window.locator('html')).toHaveAttribute('lang', 'en');
  await expect(window).toHaveTitle('This image was not saved – AVIFBox');
  await expect(window.getByRole('heading', { level: 1 })).toHaveText('This image was not saved');
  await expect(window.getByRole('main')).toContainText(
    'You can still save it with the browser’s own “Save image as…”. ' +
      'AVIF, WebP, JPG and PNG files can be converted at avifbox.com.',
  );
  const link = window.getByRole('link', { name: 'avifbox.com', exact: true });
  await expect(link).toHaveAttribute('href', 'https://avifbox.com/');
  await expect(link).toHaveAttribute('target', '_blank');
  await expect(link).toHaveAttribute('rel', 'noopener');

  const close = window.getByRole('button', { name: 'Close', exact: true });
  await expect(close).toBeFocused();
  // The button has the focus, so a screen reader starts there: it reads the failure with it.
  await expect(close).toHaveAccessibleDescription('Could not fetch this image: the site answered 404.');
  expect((await new AxeBuilder({ page: window }).analyze()).violations).toEqual([]);

  await Promise.all([window.waitForEvent('close'), close.click()]);
});

test('AC-70 the Escape key closes the failure window', async ({ extension }) => {
  const window = await extension.failure('png', extension.at('/missing.avif'));
  await expect(window.getByRole('button', { name: 'Close', exact: true })).toBeFocused();
  // The window is gone before the key is let go, which Playwright reports as a failure of the key press.
  await Promise.all([window.waitForEvent('close'), window.keyboard.press('Escape').catch(() => {})]);
});

test('AC-70 a window opened with a fragment that cannot be decoded still closes', async ({ extension }) => {
  const window = await extension.context.newPage();
  await window.goto(new URL('notice.html#%E0%A4%A', (await extension.worker()).url()).href);
  await expect(window.locator('#failure')).toHaveText('');
  await Promise.all([window.waitForEvent('close'), window.getByRole('button', { name: 'Close' }).click()]);
});

test('AC-70 the longest failure fits the window, with room for a title bar', async ({ extension }) => {
  const window = await extension.failure('png', 'blob:https://example.com/0b0c0d0e-1f2a-4b3c-8d4e-5f6a7b8c9d0e');
  await expect(window.locator('#failure')).toHaveText(UNREACHABLE);
  // Playwright gives every window its own viewport. The window is opened 460 x 360; a title bar takes up to 40.
  await window.setViewportSize({ width: 460, height: 320 });
  const page = await window.evaluate(() => [
    document.documentElement.scrollWidth,
    document.documentElement.scrollHeight,
  ]);
  expect(page[0]).toBeLessThanOrEqual(460);
  expect(page[1]).toBeLessThanOrEqual(320);
});

test('AC-70 markup in a failure is shown, not interpreted', async ({ extension }) => {
  const markup = '<img src=x onerror="document.title = 1"><b>bold</b> & 100%';
  const window = await extension.context.newPage();
  // Not `origin`: Node gives none for an address of an extension.
  await window.goto(new URL(`notice.html#${encodeURIComponent(markup)}`, (await extension.worker()).url()).href);
  await expect(window.locator('#failure')).toHaveText(markup);
  await expect(window.locator('#failure *')).toHaveCount(0);
  await expect(window).toHaveTitle('This image was not saved – AVIFBox');
});
