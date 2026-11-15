import { expect, test, type Page } from '@playwright/test';
import { addFiles, fileRows, settled } from './helpers';

const reportLink = (page: Page) => page.getByRole('link', { name: 'Email hello@avifbox.com' });

/** The draft the link opens in a mail program. */
async function draft(page: Page) {
  const address = new URL((await reportLink(page).getAttribute('href')) ?? '');
  return {
    to: `${address.protocol}${address.pathname}`,
    subject: address.searchParams.get('subject'),
    lines: (address.searchParams.get('body') ?? '').split('\r\n'),
  };
}

test.describe('reporting a failure', () => {
  test('AC-50 the converter offers one link to report failed files, and the draft holds their errors', async ({
    page,
  }) => {
    await page.goto('/avif-to-png');
    const notAnImage = { name: 'notes.avif', mimeType: 'image/avif', buffer: Buffer.from('%PDF-1.7 not an image') };
    await addFiles(page, 'still.avif', 'corrupt.avif', notAnImage);
    await settled(page, 3);
    const errors = await fileRows(page).locator('.cv-error').allTextContents();
    expect(errors).toHaveLength(2);

    await expect(reportLink(page)).toHaveCount(1);
    const { to, subject, lines } = await draft(page);
    expect(to).toBe('mailto:hello@avifbox.com');
    expect(subject).toBe('AVIFBox problem report: /avif-to-png');
    expect(lines).toContain('Page: https://avifbox.com/avif-to-png');
    for (const error of errors) expect(lines).toContain(`Error: ${error}`);
    expect(lines).toContain(`Browser: ${await page.evaluate(() => navigator.userAgent)}`);
    // What a file is called is the visitor's business.
    expect(lines.join('\n')).not.toMatch(/corrupt|notes/);
  });

  test('AC-50 the converter offers no such link while every file converts', async ({ page }) => {
    await page.goto('/avif-to-png');
    await addFiles(page, 'still.avif', 'alpha.avif');
    await settled(page, 2);

    await expect(fileRows(page).first()).toHaveAttribute('data-status', 'done');
    await expect(reportLink(page)).toHaveCount(0);
  });

  test('AC-50 the viewer offers the link when it cannot open a file, and not once it can', async ({ page }) => {
    await page.goto('/avif-viewer');
    await addFiles(page, 'corrupt.avif');
    await expect(page.locator('.vw-stage')).toContainText(/could not decode/i);

    await expect(reportLink(page)).toHaveCount(1);
    const { subject, lines } = await draft(page);
    expect(subject).toBe('AVIFBox problem report: /avif-viewer');
    expect(lines).toContain(`Error: ${await page.locator('.vw-stage').innerText()}`);

    await addFiles(page, 'still.avif');
    await expect(page.getByRole('img', { name: 'Preview of still.avif' })).toBeVisible();
    await expect(reportLink(page)).toHaveCount(0);
  });

  test('AC-50 /privacy says what the link does, and carries the day that was added', async ({ page }) => {
    await page.goto('/privacy');
    const text = ((await page.locator('#contact').textContent()) ?? '').replace(/\s+/g, ' ');
    const claims = [
      /opens a draft in your own mail program/i,
      /the page, the error message and your browser’s user-agent/i,
      /nothing is sent unless you send it/i,
      /your file is not attached/i,
    ];

    expect(claims.filter((claim) => !claim.test(text)).map(String), '/privacy: statements missing').toEqual([]);
    await expect(page.locator('.dateline time')).toHaveAttribute('datetime', '2026-11-15');
  });
});
