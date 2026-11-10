import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { formatBytes } from '../../src/ui/format';
import { addFiles, downloadNamed, settled } from './helpers';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const ORIGIN = 'https://avifbox.com';
const TOOLS = ['/avif-to-png', '/avif-to-jpg', '/jfif-to-jpg', '/jfif-to-png', '/webp-to-png'];
const GUIDES = ['/what-is-avif', '/how-to-open-avif-file'];
const PAGES = ['/', ...TOOLS, ...GUIDES];

/** Words of body copy: everything in <main> except the interactive tool. */
async function bodyWords(page: Page): Promise<number> {
  return page.evaluate(() => {
    const main = document.querySelector('main')!.cloneNode(true) as HTMLElement;
    main.querySelectorAll('[data-tool], script, style').forEach((node) => node.remove());
    const walker = document.createTreeWalker(main, NodeFilter.SHOW_TEXT);
    const parts: string[] = [];
    while (walker.nextNode()) parts.push(walker.currentNode.textContent ?? '');
    return parts
      .join(' ')
      .split(/\s+/)
      .filter((word) => /[\p{L}\p{N}]/u.test(word)).length;
  });
}

async function jsonLd(page: Page): Promise<Record<string, any>[]> {
  const blocks = await page.locator('script[type="application/ld+json"]').allTextContents();
  return blocks.map((block) => JSON.parse(block));
}

/** Site-relative link targets inside <main>, without fragments. */
async function contentLinks(page: Page): Promise<string[]> {
  return page.evaluate(() => [...document.querySelectorAll<HTMLAnchorElement>('main a[href^="/"]')].map((a) => a.getAttribute('href')!.split('#')[0]));
}

test.describe('site structure', () => {
  test('AC-21 every route is built, listed in the sitemap, and robots.txt points at it', async ({ request }) => {
    for (const path of PAGES) expect((await request.get(path)).status(), path).toBe(200);
    expect(existsSync(join(ROOT, 'dist', '404.html'))).toBe(true);
    expect((await request.get('/no-such-page')).status()).toBe(404);

    const index = await (await request.get('/sitemap-index.xml')).text();
    expect(index).toContain(`${ORIGIN}/sitemap-0.xml`);
    const sitemap = await (await request.get('/sitemap-0.xml')).text();
    const listed = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]).sort();
    expect(listed).toEqual(PAGES.map((path) => (path === '/' ? `${ORIGIN}/` : `${ORIGIN}${path}`)).sort());

    expect(await (await request.get('/robots.txt')).text()).toContain(`Sitemap: ${ORIGIN}/sitemap-index.xml`);
  });

  test('AC-22 every page has a unique title, a sized description, a canonical URL and one h1', async ({ page }) => {
    const titles = new Set<string>();
    const descriptions = new Set<string>();
    for (const path of PAGES) {
      await page.goto(path);
      const title = await page.title();
      const description = (await page.locator('meta[name=description]').getAttribute('content')) ?? '';
      expect(title.length, path).toBeGreaterThan(20);
      expect(title.length, `${path} title: ${title}`).toBeLessThanOrEqual(65);
      expect(description.length, `${path} description`).toBeGreaterThanOrEqual(70);
      expect(description.length, `${path} description`).toBeLessThanOrEqual(160);
      titles.add(title);
      descriptions.add(description);
      await expect(page.locator('link[rel=canonical]')).toHaveAttribute('href', path === '/' ? `${ORIGIN}/` : `${ORIGIN}${path}`);
      await expect(page.locator('h1')).toHaveCount(1);
      await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    }
    expect(titles.size).toBe(PAGES.length);
    expect(descriptions.size).toBe(PAGES.length);
  });

  test('AC-23 tool pages carry SoftwareApplication and FAQ data that match the page, and 900–1,300 words', async ({ page }) => {
    const counts: Record<string, number> = {};
    for (const path of TOOLS) {
      await page.goto(path);
      const data = await jsonLd(page);
      const app = data.find((block) => block['@type'] === 'SoftwareApplication');
      expect(app, path).toBeTruthy();
      expect(app!.url).toBe(`${ORIGIN}${path}`);
      expect(app!.offers).toMatchObject({ price: '0', priceCurrency: 'USD' });

      const faq = data.find((block) => block['@type'] === 'FAQPage');
      expect(faq, path).toBeTruthy();
      const questions = faq!.mainEntity.map((entry: any) => entry.name);
      expect(questions.length, path).toBeGreaterThanOrEqual(7);
      expect(await page.locator('#faq dt').allTextContents()).toEqual(questions);
      const answers = (await page.locator('#faq dd').allTextContents()).map((text) => text.trim());
      expect(faq!.mainEntity.map((entry: any) => entry.acceptedAnswer.text)).toEqual(answers);

      counts[path] = await bodyWords(page);
    }
    const outOfRange = Object.entries(counts).filter(([, words]) => words < 900 || words > 1300);
    expect(outOfRange, `word counts: ${JSON.stringify(counts)}`).toEqual([]);
  });

  test('AC-24 pages link to each other as the sitemap plan says, and no internal link is broken', async ({ page, request }) => {
    const required: Record<string, string[]> = {
      '/avif-to-png': ['/avif-to-jpg', '/what-is-avif'],
      '/avif-to-jpg': ['/avif-to-png', '/how-to-open-avif-file'],
      '/jfif-to-png': ['/jfif-to-jpg'],
      '/jfif-to-jpg': ['/jfif-to-png'],
      '/webp-to-png': ['/avif-to-png'],
      '/what-is-avif': ['/avif-to-png', '/avif-to-jpg'],
      '/how-to-open-avif-file': ['/avif-to-png', '/avif-to-jpg'],
      '/': TOOLS,
    };
    const seen = new Set<string>();
    for (const path of PAGES) {
      await page.goto(path);
      const links = await contentLinks(page);
      for (const target of required[path]) expect(links, `${path} should link to ${target}`).toContain(target);
      const everywhere = await page.evaluate(() =>
        [...document.querySelectorAll<HTMLAnchorElement>('a[href^="/"]')].map((a) => a.getAttribute('href')!.split('#')[0]),
      );
      everywhere.forEach((href) => seen.add(href));
    }
    for (const href of seen) expect((await request.get(href)).status(), href).toBe(200);
  });

  test('AC-26 sample sizes on the page are the real file sizes, and the results come from this converter', async ({ page }) => {
    await page.goto('/avif-to-png');
    await expect(page.locator('#samples .sample')).toHaveCount(3);
    const cells = page.locator('#samples dd[data-file]');
    const files = await cells.evaluateAll((nodes) => nodes.map((node) => [node.getAttribute('data-file')!, node.textContent!.trim()]));
    expect(files.map(([file]) => file)).toEqual([
      'photo.avif',
      'photo.png',
      'photo-optimized.png',
      'transparent.avif',
      'transparent.png',
      'animated.avif',
      'animated.png',
    ]);
    for (const [file, shown] of files) {
      expect(shown, file).toBe(formatBytes(statSync(join(ROOT, 'dist', 'samples', file)).size));
      await expect(page.getByRole('link', { name: `Download sample ${file}`, exact: true })).toHaveAttribute('href', `/samples/${file}`);
    }

    // Converting the published source again must reproduce the published result byte for byte.
    await addFiles(page, { name: 'transparent.avif', mimeType: 'image/avif', buffer: readFileSync(join(ROOT, 'public', 'samples', 'transparent.avif')) });
    await settled(page, 1);
    expect(await downloadNamed(page, 'transparent.png')).toEqual(readFileSync(join(ROOT, 'public', 'samples', 'transparent.png')));
  });

  test('a sample can be loaded into the converter from the drop zone', async ({ page }) => {
    await page.goto('/avif-to-png');
    await page.getByRole('button', { name: 'HDR', exact: true }).click();
    await settled(page, 1);
    await expect(page.getByRole('list', { name: 'Files', exact: true })).toContainText('hdr.avif');
    await expect(page.getByRole('list', { name: 'Files', exact: true })).toContainText('tone-mapped');
  });
});

test.describe('viewer', () => {
  test('AC-27 an AVIF dropped on the guide page is shown with its metadata', async ({ page }) => {
    await page.goto('/how-to-open-avif-file');
    await addFiles(page, 'hdr-pq.avif');
    await expect(page.getByRole('img', { name: 'Preview of hdr-pq.avif' })).toBeVisible();
    const facts = page.locator('.vw-facts');
    await expect(facts).toContainText('48 × 16 pixels');
    await expect(facts).toContainText('10-bit');
    await expect(facts).toContainText('HDR (PQ)');
    await expect(facts.getByRole('link', { name: 'Convert to PNG' })).toHaveAttribute('href', '/avif-to-png');

    await addFiles(page, 'anim.avif');
    await expect(facts).toContainText('8-bit');
    await expect(facts.locator('dd').last()).toHaveText('Yes');
  });
});

test.describe('accessibility', () => {
  for (const scheme of ['light', 'dark'] as const) {
    test(`AC-28 no serious axe violations (${scheme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
      for (const path of PAGES) {
        await page.goto(path);
        const results = await new AxeBuilder({ page }).analyze();
        const serious = results.violations.filter((violation) => violation.impact === 'serious' || violation.impact === 'critical');
        expect(serious.map((violation) => `${path}: ${violation.id} — ${violation.nodes.map((node) => node.target.join(' ')).join(', ')}`)).toEqual([]);
      }
    });
  }

  test('AC-28 the converter with results on screen has no serious axe violations', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/avif-to-png');
    await addFiles(page, 'anim.avif', 'hdr-pq.avif', 'corrupt.avif');
    await settled(page, 3);
    const results = await new AxeBuilder({ page }).include('[data-tool]').analyze();
    const serious = results.violations.filter((violation) => violation.impact === 'serious' || violation.impact === 'critical');
    expect(serious.map((violation) => `${violation.id} — ${violation.nodes.map((node) => node.target.join(' ')).join(', ')}`)).toEqual([]);
  });

  test('AC-28 the file picker can be opened from the keyboard', async ({ page }) => {
    await page.goto('/avif-to-png');
    const choose = page.getByRole('button', { name: 'Choose files' });
    await choose.focus();
    const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.keyboard.press('Enter')]);
    expect(chooser.isMultiple()).toBe(true);
  });
});
