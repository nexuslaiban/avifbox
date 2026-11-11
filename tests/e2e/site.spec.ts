import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SOURCES } from '../../src/content/sources';
import { PNG } from 'pngjs';
import { formatBytes } from '../../src/ui/format';
import {
  addFiles,
  downloadNamed,
  expectSameBytes,
  expectSamePixels,
  pngColourType,
  readPng,
  settled,
  type Raster,
} from './helpers';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const ORIGIN = 'https://avifbox.com';
const TOOLS = [
  '/avif-to-png',
  '/avif-to-jpg',
  '/avif-to-apng',
  '/jfif-to-jpg',
  '/jfif-to-png',
  '/webp-to-png',
  '/webp-to-jpg',
];
const VIEWER = '/avif-viewer';
const GUIDES = ['/what-is-avif', '/how-to-open-avif-file'];
const INFO = ['/about', '/privacy'];
const PAGES = ['/', ...TOOLS, VIEWER, ...GUIDES, ...INFO];
const ORGANIZATION = `${ORIGIN}/#organization`;

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

/** A free application at `url`, as SoftwareApplication data. */
function expectFreeApp(data: Record<string, any>[], url: string): void {
  const app = data.find((block) => block['@type'] === 'SoftwareApplication');
  expect(app, url).toBeTruthy();
  expect(app!.url).toBe(url);
  expect(app!.offers).toMatchObject({ price: '0', priceCurrency: 'USD' });
}

/** The FAQPage data must be the FAQ a visitor sees: the same questions and answers, in the same order. */
async function expectFaqData(page: Page, data: Record<string, any>[], atLeast: number): Promise<void> {
  const faq = data.find((block) => block['@type'] === 'FAQPage');
  expect(faq, page.url()).toBeTruthy();
  const questions = faq!.mainEntity.map((entry: any) => entry.name);
  expect(questions.length, page.url()).toBeGreaterThanOrEqual(atLeast);
  expect(await page.locator('#faq dt').allTextContents()).toEqual(questions);
  const answers = (await page.locator('#faq dd').allTextContents()).map((text) => text.trim());
  expect(faq!.mainEntity.map((entry: any) => entry.acceptedAnswer.text)).toEqual(answers);
}

/** Site-relative link targets inside <main>, without fragments. */
async function contentLinks(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    [...document.querySelectorAll<HTMLAnchorElement>('main a[href^="/"]')].map(
      (a) => a.getAttribute('href')!.split('#')[0],
    ),
  );
}

/** Absolute link targets inside <main>, as written in the markup. */
async function externalLinks(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    [...document.querySelectorAll<HTMLAnchorElement>('main a[href^="http"]')].map((a) => a.getAttribute('href')!),
  );
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
      await expect(page.locator('link[rel=canonical]')).toHaveAttribute(
        'href',
        path === '/' ? `${ORIGIN}/` : `${ORIGIN}${path}`,
      );
      await expect(page.locator('h1')).toHaveCount(1);
      await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    }
    expect(titles.size).toBe(PAGES.length);
    expect(descriptions.size).toBe(PAGES.length);
  });

  // A template drops the space before an inline element that starts a line unless it is written as {' '}.
  test('no link or emphasis is glued to the word next to it', async ({ page }) => {
    let checked = 0;
    for (const path of PAGES) {
      await page.goto(path);
      const { count, glued } = await page.evaluate(() => {
        const text = (node: ChildNode | null) => (node?.nodeType === Node.TEXT_NODE ? (node.textContent ?? '') : '');
        const inline = [...document.querySelectorAll('main :is(a, strong, em, code)')];
        return {
          count: inline.length,
          glued: inline
            .map((node) => [text(node.previousSibling), node.textContent ?? '', text(node.nextSibling)])
            .filter(([before, , after]) => /[\p{L}\p{N},.;:!?)]$/u.test(before) || /^[\p{L}\p{N}(]/u.test(after))
            .map(([before, inner, after]) => `${before.slice(-10)}[${inner}]${after.slice(0, 10)}`),
        };
      });
      expect(glued, `${path}: glued to the next word`).toEqual([]);
      checked += count;
    }
    expect(checked, 'inline elements looked at').toBeGreaterThan(100);
  });

  test('AC-23 tool pages carry SoftwareApplication and FAQ data that match the page, and 900–1,300 words', async ({
    page,
  }) => {
    const counts: Record<string, number> = {};
    for (const path of TOOLS) {
      await page.goto(path);
      const data = await jsonLd(page);
      expectFreeApp(data, `${ORIGIN}${path}`);
      await expectFaqData(page, data, 7);
      counts[path] = await bodyWords(page);
    }
    const outOfRange = Object.entries(counts).filter(([, words]) => words < 900 || words > 1300);
    expect(outOfRange, `word counts: ${JSON.stringify(counts)}`).toEqual([]);
  });

  test('AC-36 WebP to PNG and WebP to JPG reach each other through the output tabs', async ({ page }) => {
    for (const [from, to] of [
      ['/webp-to-png', '/webp-to-jpg'],
      ['/webp-to-jpg', '/webp-to-png'],
    ]) {
      await page.goto(from);
      const other = page.getByRole('navigation', { name: 'Output format' }).getByRole('link');
      await expect(other, from).toHaveCount(1);
      await expect(other).toHaveAttribute('href', to);
    }
  });

  test('AC-32 the home page explains the converter: how-to, what is kept, FAQ, and matching data', async ({ page }) => {
    await page.goto('/');
    expect(await page.title()).toMatch(/^AVIF Converter/);

    const data = await jsonLd(page);
    expect(data.some((block) => block['@type'] === 'WebSite')).toBe(true);
    expectFreeApp(data, `${ORIGIN}/`);
    await expectFaqData(page, data, 6);

    await expect(page.locator('#how-to .steps > li')).toHaveCount(3);
    const converted = await page
      .locator('#formats table a')
      .evaluateAll((links) => links.map((link) => link.getAttribute('href')));
    expect(converted.sort()).toEqual([...TOOLS].sort());

    const words = await bodyWords(page);
    expect(words, 'home page body copy').toBeGreaterThanOrEqual(500);
    expect(words, 'home page body copy').toBeLessThanOrEqual(900);
  });

  test('AC-38 the viewer page carries free-application and FAQ data, 500–900 words, and links onward', async ({
    page,
  }) => {
    await page.goto(VIEWER);
    expect(await page.title()).toMatch(/^AVIF Viewer/);

    const data = await jsonLd(page);
    expectFreeApp(data, `${ORIGIN}${VIEWER}`);
    await expectFaqData(page, data, 5);

    const words = await bodyWords(page);
    expect(words, 'viewer page body copy').toBeGreaterThanOrEqual(500);
    expect(words, 'viewer page body copy').toBeLessThanOrEqual(900);

    // In the copy itself: the viewer's own buttons and links do not count.
    const inCopy = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLAnchorElement>('main a[href^="/"]')]
        .filter((link) => !link.closest('[data-tool]'))
        .map((link) => link.getAttribute('href')!.split('#')[0]),
    );
    for (const target of ['/avif-to-png', '/avif-to-jpg', '/how-to-open-avif-file'])
      expect(inCopy, `the copy should link to ${target}`).toContain(target);
  });

  test('AC-38 the header and the footer of every page link to the viewer', async ({ page }) => {
    for (const path of PAGES) {
      await page.goto(path);
      // In the header it is a link of its own between the two menus, so it shows without opening anything.
      const top = page.locator(`.site-header nav a[href="${VIEWER}"]`);
      await expect(top, `${path}: header`).toHaveCount(1);
      await expect(top, `${path}: header`).toBeVisible();
      await expect(top).toHaveText('AVIF viewer');
      expect(await top.evaluate((link) => link.closest('details') === null), `${path}: outside the menus`).toBe(true);
      await expect(
        page.getByRole('navigation', { name: 'Guides', exact: true }).locator(`a[href="${VIEWER}"]`),
      ).toHaveCount(1);
    }
  });

  test('AC-24 pages link to each other as the sitemap plan says, and no internal link is broken', async ({
    page,
    request,
  }) => {
    const required: Record<string, string[]> = {
      '/avif-to-png': ['/avif-to-jpg', '/what-is-avif'],
      '/avif-to-jpg': ['/avif-to-png', '/how-to-open-avif-file'],
      '/jfif-to-png': ['/jfif-to-jpg'],
      '/jfif-to-jpg': ['/jfif-to-png'],
      '/webp-to-png': ['/avif-to-png', '/webp-to-jpg'],
      '/webp-to-jpg': ['/webp-to-png'],
      '/avif-to-apng': ['/avif-to-png'],
      '/avif-viewer': ['/avif-to-png', '/avif-to-jpg', '/how-to-open-avif-file'],
      '/what-is-avif': ['/avif-to-png', '/avif-to-jpg'],
      '/how-to-open-avif-file': ['/avif-to-png', '/avif-to-jpg'],
      '/': TOOLS,
      '/about': ['/privacy'],
      '/privacy': ['/about'],
    };
    const seen = new Set<string>();
    for (const path of PAGES) {
      await page.goto(path);
      const links = await contentLinks(page);
      for (const target of required[path]) expect(links, `${path} should link to ${target}`).toContain(target);
      const everywhere = await page.evaluate(() =>
        [...document.querySelectorAll<HTMLAnchorElement>('a[href^="/"]')].map(
          (a) => a.getAttribute('href')!.split('#')[0],
        ),
      );
      everywhere.forEach((href) => seen.add(href));
    }
    for (const href of seen) expect((await request.get(href)).status(), href).toBe(200);
  });

  test('AC-26 sample sizes on the page are the real file sizes, and the results come from this converter', async ({
    page,
    browserName,
  }) => {
    await page.goto('/avif-to-png');
    await expect(page.locator('#samples .sample')).toHaveCount(3);
    const cells = page.locator('#samples dd[data-file]');
    const files = await cells.evaluateAll((nodes) =>
      nodes.map((node) => [node.getAttribute('data-file')!, node.textContent!.trim()]),
    );
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
      await expect(page.getByRole('link', { name: `Download sample ${file}`, exact: true })).toHaveAttribute(
        'href',
        `/samples/${file}`,
      );
    }

    // Converting the published source again must reproduce the published result: the same picture in every
    // engine and, in Chromium, which made the samples, the same file. Engines deflate differently.
    await addFiles(page, {
      name: 'transparent.avif',
      mimeType: 'image/avif',
      buffer: readFileSync(join(ROOT, 'public', 'samples', 'transparent.avif')),
    });
    await settled(page, 1);
    const converted = await downloadNamed(page, 'transparent.png');
    const published = readFileSync(join(ROOT, 'public', 'samples', 'transparent.png'));
    expectSamePixels(readPng(converted), readPng(published), 'transparent.png, converted again');
    if (browserName === 'chromium') expectSameBytes(converted, published, 'transparent.png, converted again');
  });

  test('a sample can be loaded into the converter from the drop zone', async ({ page }) => {
    await page.goto('/avif-to-png');
    await page.getByRole('button', { name: 'HDR', exact: true }).click();
    await settled(page, 1);
    await expect(page.getByRole('list', { name: 'Files', exact: true })).toContainText('hdr.avif');
    await expect(page.getByRole('list', { name: 'Files', exact: true })).toContainText('tone-mapped');
  });
});

/** A header menu, found by the text of its button. */
const menu = (page: Page, name: string) =>
  page.locator('.site-header details').filter({ has: page.locator('summary', { hasText: name }) });

test.describe('header menu', () => {
  test('AC-34 both menus are in every page, closed, with all their links and the current page marked', async ({
    page,
  }) => {
    for (const path of PAGES) {
      await page.goto(path);
      await expect(page.locator('.site-header details'), path).toHaveCount(2);
      await expect(page.locator('.site-header details[open]'), path).toHaveCount(0);

      const hrefs = (name: string) =>
        menu(page, name)
          .locator('a')
          .evaluateAll((links) => links.map((link) => link.getAttribute('href')));
      expect((await hrefs('Converters')).sort(), `${path}: Converters`).toEqual([...TOOLS].sort());
      expect((await hrefs('Guides')).sort(), `${path}: Guides`).toEqual([...GUIDES].sort());
      await expect(menu(page, 'Converters').locator('a').first(), path).toBeHidden();

      const inMenu = [...TOOLS, ...GUIDES].includes(path);
      const current = await page
        .locator('.site-header a[aria-current="page"]')
        .evaluateAll((links) => links.map((link) => link.getAttribute('href')));
      expect(current, `${path}: current link`).toEqual(inMenu || path === VIEWER ? [path] : []);
      const marked = page.locator('.site-header details[data-current]');
      await expect(marked, `${path}: current menu`).toHaveCount(inMenu ? 1 : 0);
      if (inMenu) await expect(marked.locator(`a[href="${path}"]`), path).toHaveCount(1);
    }
  });

  test('AC-34 a menu opens by click or keyboard, closes its sibling, and closes on Escape or a click elsewhere', async ({
    page,
  }) => {
    await page.goto('/avif-to-png');
    const converters = menu(page, 'Converters');
    const guides = menu(page, 'Guides');

    await converters.locator('summary').click();
    await expect(converters).toHaveJSProperty('open', true);
    let grouped = 0;
    for (const group of ['AVIF', 'JFIF', 'WebP']) {
      const links = converters.getByRole('list', { name: group, exact: true }).getByRole('link');
      await expect(links.first(), group).toBeVisible();
      for (const label of await links.allTextContents()) expect(label.trim(), group).toMatch(new RegExp(`^${group} `));
      grouped += await links.count();
    }
    expect(grouped, 'converters under a format heading').toBe(TOOLS.length);

    await guides.locator('summary').click();
    await expect(guides).toHaveJSProperty('open', true);
    await expect(converters).toHaveJSProperty('open', false);

    await page.keyboard.press('Escape');
    await expect(guides).toHaveJSProperty('open', false);
    await expect(guides.locator('summary')).toBeFocused();

    await converters.locator('summary').focus();
    await page.keyboard.press('Enter');
    await expect(converters).toHaveJSProperty('open', true);
    await page.keyboard.press('Tab');
    await expect(converters.getByRole('link').first()).toBeFocused();

    await page.locator('h1').click();
    await expect(converters).toHaveJSProperty('open', false);

    await converters.locator('summary').click();
    await converters.getByRole('link', { name: 'JFIF to PNG', exact: true }).click();
    await expect(page).toHaveURL(/\/jfif-to-png$/);
  });

  test('AC-34 an open menu fits a phone screen', async ({ page }) => {
    const width = 412;
    await page.setViewportSize({ width, height: 915 });
    await page.goto('/what-is-avif');
    for (const name of ['Converters', 'Guides']) {
      await menu(page, name).locator('summary').click();
      const links = menu(page, name).getByRole('link');
      const count = await links.count();
      expect(count, name).toBeGreaterThan(0);
      for (let index = 0; index < count; index++) {
        const box = (await links.nth(index).boundingBox())!;
        expect(box.x, `${name} link ${index}`).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width, `${name} link ${index}`).toBeLessThanOrEqual(width);
      }
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, `${name}: horizontal overflow`).toBe(0);
    }
  });

  for (const scheme of ['light', 'dark'] as const) {
    test(`AC-34 an open menu has no serious axe violation (${scheme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
      await page.goto('/avif-to-jpg');
      await menu(page, 'Converters').locator('summary').click();
      await expect(menu(page, 'Converters').getByRole('link').first()).toBeVisible();
      const results = await new AxeBuilder({ page }).analyze();
      const serious = results.violations.filter(
        (violation) => violation.impact === 'serious' || violation.impact === 'critical',
      );
      expect(
        serious.map(
          (violation) => `${violation.id} — ${violation.nodes.map((node) => node.target.join(' ')).join(', ')}`,
        ),
      ).toEqual([]);
    });
  }

  test.describe('without JavaScript', () => {
    test.use({ javaScriptEnabled: false });

    test('AC-34 a menu still opens and closes by click', async ({ page }) => {
      await page.goto('/what-is-avif');
      const converters = menu(page, 'Converters');
      const guides = menu(page, 'Guides');

      await converters.locator('summary').click();
      await expect(converters.getByRole('link').first()).toBeVisible();
      await guides.locator('summary').click();
      await expect(guides.getByRole('link').first()).toBeVisible();
      await expect(converters.locator('a').first()).toBeHidden();
      await guides.locator('summary').click();
      await expect(guides.locator('a').first()).toBeHidden();
    });
  });
});

test.describe('logo', () => {
  test('AC-35 the header mark is an image file with a size, served as SVG', async ({ page, request }) => {
    for (const path of PAGES) {
      await page.goto(path);
      const mark = page.locator('.site-header .brand img');
      await expect(mark, path).toHaveCount(1);
      await expect(mark).toHaveAttribute('src', '/logo.svg');
      await expect(mark).toHaveAttribute('alt', 'AVIFBox');
      await expect(mark).toHaveAttribute('width', /^\d+$/);
      await expect(mark).toHaveAttribute('height', /^\d+$/);
      await expect(page.locator('.site-header .brand svg'), `${path}: inline mark`).toHaveCount(0);
    }
    const file = await request.get('/logo.svg');
    expect(file.status()).toBe(200);
    expect(file.headers()['content-type']).toContain('image/svg+xml');
  });

  const accents = { light: [0xc8, 0x33, 0x0f], dark: [0xff, 0x7a, 0x4d] };
  for (const scheme of ['light', 'dark'] as const) {
    test(`AC-35 the mark is filled with the accent colour of the ${scheme} scheme`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto('/');
      const mark = page.locator('.site-header .brand img');
      await expect(mark).toHaveJSProperty('complete', true);
      const shot = PNG.sync.read(await mark.screenshot());
      // The middle of the box's top face: a third of the way down, well clear of the outline.
      const at = (Math.round(shot.height / 3) * shot.width + Math.round(shot.width / 2)) * 4;
      const [red, green, blue] = shot.data.subarray(at, at + 3);
      const off = Math.max(...accents[scheme].map((value, index) => Math.abs(value - [red, green, blue][index])));
      expect(off, `pixel rgb(${red}, ${green}, ${blue})`).toBeLessThanOrEqual(2);
    });
  }
});

/** The images inside an ICO file. Each has to be a 32-bit PNG of the size its entry declares. */
function icoImages(ico: Buffer): Raster[] {
  expect([ico.readUInt16LE(0), ico.readUInt16LE(2)], 'ICO header: reserved, type').toEqual([0, 1]);
  return Array.from({ length: ico.readUInt16LE(4) }, (_, index) => {
    const entry = 6 + index * 16;
    const [size, offset] = [ico.readUInt32LE(entry + 8), ico.readUInt32LE(entry + 12)];
    const png = ico.subarray(offset, offset + size);
    // The format takes PNG images in RGBA only, whatever a lenient reader accepts.
    expect(pngColourType(png), `ICO entry ${index}: PNG colour type`).toBe(6);
    const image = readPng(png);
    expect([ico[entry], ico[entry + 1]], `ICO entry ${index}: declared size`).toEqual([image.width, image.height]);
    return image;
  });
}

test.describe('icons', () => {
  // The background of the mark in favicon.svg.
  const BACKGROUND = [0xc8, 0x33, 0x0f, 255];

  test('AC-42 /favicon.ico holds 16, 32 and 48 px images, and the touch icon is 180 px and opaque', async ({
    request,
  }) => {
    const ico = await request.get('/favicon.ico');
    expect(ico.status(), '/favicon.ico').toBe(200);
    const images = icoImages(await ico.body());
    expect(images.map((image) => [image.width, image.height])).toEqual([
      [16, 16],
      [32, 32],
      [48, 48],
    ]);
    for (const image of images) expect(image.at(0, 0), `${image.width} px: corner`).toEqual(BACKGROUND);

    const touch = await request.get('/apple-touch-icon.png');
    expect(touch.status(), '/apple-touch-icon.png').toBe(200);
    expect(touch.headers()['content-type']).toBe('image/png');
    const icon = readPng(await touch.body());
    expect([icon.width, icon.height]).toEqual([180, 180]);
    expect(icon.at(0, 0), 'corner').toEqual(BACKGROUND);
    // iOS paints a transparent icon on black.
    const transparent = icon.data.filter((_, index) => index % 4 === 3 && icon.data[index] !== 255).length;
    expect(transparent, 'pixels that are not opaque').toBe(0);
  });

  test('AC-42 every page names the touch icon and still declares the SVG favicon alone', async ({ page }) => {
    for (const path of PAGES) {
      await page.goto(path);
      await expect(page.locator('link[rel="apple-touch-icon"]'), path).toHaveAttribute('href', '/apple-touch-icon.png');
      expect(
        await page.locator('link[rel~="icon"]').evaluateAll((links) => links.map((link) => link.getAttribute('href'))),
        `${path}: declared icons`,
      ).toEqual(['/favicon.svg']);
    }
  });
});

test.describe('who runs the site', () => {
  test('AC-33 every footer links to /about and /privacy, and the Organization data is one entity', async ({
    page,
    request,
  }) => {
    for (const path of PAGES) {
      await page.goto(path);
      const footer = await page
        .locator('footer a')
        .evaluateAll((links) => links.map((link) => link.getAttribute('href')));
      for (const target of INFO) expect(footer, `${path}: footer link to ${target}`).toContain(target);
    }

    for (const path of ['/', '/about']) {
      await page.goto(path);
      const organization = (await jsonLd(page)).find((block) => block['@type'] === 'Organization');
      expect(organization, `${path}: Organization data`).toBeTruthy();
      expect(organization).toMatchObject({ '@id': ORGANIZATION, name: 'AVIFBox', url: ORIGIN });

      // Search engines ask for a logo they can fetch, at least 112 px on each side.
      expect(organization!.logo, path).toMatch(new RegExp(`^${ORIGIN}/[^/]+\\.png$`));
      const file = new URL(organization!.logo).pathname;
      expect((await request.get(file)).headers()['content-type'], file).toBe('image/png');
      const png = readFileSync(join(ROOT, 'dist', file));
      expect(Math.min(png.readUInt32BE(16), png.readUInt32BE(20)), `${file}: shorter side`).toBeGreaterThanOrEqual(112);
    }

    for (const path of GUIDES) {
      await page.goto(path);
      const article = (await jsonLd(page)).find((block) => block['@type'] === 'Article');
      for (const role of ['author', 'publisher'])
        expect(article?.[role]?.['@id'], `${path}: Article.${role}`).toBe(ORGANIZATION);
    }
  });

  test('AC-33 /about says how to reach the site, and /privacy says what it does and does not see', async ({ page }) => {
    await page.goto('/about');
    await expect(page.locator('main a[href="mailto:hello@avifbox.com"]').first()).toBeVisible();

    await page.goto('/privacy');
    const text = ((await page.locator('main').textContent()) ?? '').replace(/\s+/g, ' ');
    const claims = [
      /converted on your own device/i,
      /never uploaded/i,
      /no cookies/i,
      /no analytics/i,
      /no ads/i,
      /served by Cloudflare/i,
    ];
    expect(claims.filter((claim) => !claim.test(text)).map(String), '/privacy: statements missing').toEqual([]);
    expect(await externalLinks(page)).toContain('https://www.cloudflare.com/privacypolicy/');
  });
});

test.describe('citations', () => {
  test('AC-30 external links are registered sources, the guides cite them, and the corrected facts are in', async ({
    page,
  }) => {
    const registered = new Set<string>(Object.values(SOURCES));
    for (const href of registered) expect(href).toMatch(/^https:\/\//);

    const cited: Record<string, Set<string>> = {};
    for (const path of PAGES) {
      await page.goto(path);
      const links = await externalLinks(page);
      expect(
        links.filter((href) => !registered.has(href)),
        `${path}: links outside the registry`,
      ).toEqual([]);
      cited[path] = new Set(links);

      const text = (await page.locator('main').textContent()) ?? '';
      expect(/about 95%/i.test(text), `${path}: still says "about 95%"`).toBe(false);
      if (GUIDES.includes(path)) {
        expect(text.includes('26.8'), `${path}: names Photoshop 26.8`).toBe(true);
        expect(text.includes('23.2'), `${path}: still names Photoshop 23.2`).toBe(false);
      }
    }

    for (const path of GUIDES) expect(cited[path].size, `${path}: sources cited`).toBeGreaterThanOrEqual(4);
    expect([...cited['/how-to-open-avif-file']]).toContain(SOURCES.av1Extension);
    for (const path of TOOLS) expect(cited[path].size, `${path}: sources cited`).toBeGreaterThanOrEqual(1);
  });
});

test.describe('guide dates', () => {
  test('AC-31 guides show when they were updated, and the Article data and the sitemap agree', async ({
    page,
    request,
  }) => {
    const sitemap = await (await request.get('/sitemap-0.xml')).text();
    const lastmod = new Map(
      [...sitemap.matchAll(/<url><loc>([^<]+)<\/loc>(?:<lastmod>([^<]+)<\/lastmod>)?/g)].map((match) => [
        match[1],
        match[2],
      ]),
    );
    expect(lastmod.size).toBe(PAGES.length);

    for (const path of GUIDES) {
      await page.goto(path);
      const article = (await jsonLd(page)).find((block) => block['@type'] === 'Article')!;
      expect(article.dateModified, path).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(article.datePublished <= article.dateModified, `${path}: published before modified`).toBe(true);

      const time = page.locator('main time');
      await expect(time, path).toHaveCount(1);
      await expect(time).toHaveAttribute('datetime', article.dateModified);
      await expect(time.locator('..')).toHaveText(/^Updated /);
      // The date people read is the same day as the one machines read.
      const printed = new Date(`${await time.textContent()} UTC`);
      expect(printed.toISOString().slice(0, 10), path).toBe(article.dateModified);

      expect(lastmod.get(`${ORIGIN}${path}`)?.slice(0, 10), `${path}: sitemap lastmod`).toBe(article.dateModified);
    }

    const dated = [...lastmod].filter(([, day]) => day).map(([url]) => url);
    expect(dated.sort()).toEqual(GUIDES.map((path) => `${ORIGIN}${path}`).sort());
  });
});

/** Layout shift score of a page whose web fonts only arrive after it has been painted in fallback fonts. */
async function shiftWithLateFonts(page: Page, path: string): Promise<number> {
  let release = (): void => {};
  const held = new Promise<void>((resolve) => (release = resolve));
  await page.route('**/*.woff2', async (route) => {
    await held;
    await route.continue();
  });
  await page.goto(path, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => performance.getEntriesByName('first-contentful-paint').length > 0);
  // Without this the test could pass having measured nothing: the first paint must be in fallback fonts.
  const early = await page.evaluate(
    () => performance.getEntriesByType('resource').filter((entry) => entry.name.endsWith('.woff2')).length,
  );
  expect(early, `${path}: web fonts arrived before the first paint`).toBe(0);

  release();
  await page.waitForFunction(
    () =>
      document.fonts.status === 'loaded' &&
      [...document.fonts].some((face) => face.family.includes('Big Shoulders') && face.status === 'loaded'),
  );
  await page.unroute('**/*.woff2');
  // Two frames: one lays the text out again in the web font, the next has the shift on record.
  return page.evaluate(
    () =>
      new Promise<number>((resolve) =>
        requestAnimationFrame(() =>
          requestAnimationFrame(() => resolve((window as unknown as { layoutShift(): number }).layoutShift())),
        ),
      ),
  );
}

test.describe('layout stability', () => {
  const viewports = { phone: { width: 412, height: 915 }, desktop: { width: 1280, height: 800 } };

  for (const [name, viewport] of Object.entries(viewports)) {
    test(`AC-29 web fonts that arrive late do not move the page (${name})`, async ({ page }) => {
      await page.setViewportSize(viewport);
      // Chrome does not reliably score movement inside the entrance animation, which starts at opacity 0.
      // Without the animation every shift counts.
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.addInitScript(() => {
        let total = 0;
        const add = (entries: PerformanceEntry[]) => {
          for (const entry of entries as (PerformanceEntry & { value: number; hadRecentInput: boolean })[])
            if (!entry.hadRecentInput) total += entry.value;
        };
        const observer = new PerformanceObserver((list) => add(list.getEntries()));
        observer.observe({ type: 'layout-shift', buffered: true });
        (window as unknown as { layoutShift(): number }).layoutShift = () => {
          add(observer.takeRecords());
          return total;
        };
      });

      const scores: Record<string, number> = {};
      for (const path of PAGES) scores[path] = Number((await shiftWithLateFonts(page, path)).toFixed(3));
      // 0.1 is the upper bound of a "good" Cumulative Layout Shift in Core Web Vitals.
      const moved = Object.entries(scores).filter(([, score]) => score > 0.1);
      expect(moved, `layout shift per page: ${JSON.stringify(scores)}`).toEqual([]);
    });
  }
});

test.describe('accessibility', () => {
  for (const scheme of ['light', 'dark'] as const) {
    test(`AC-28 no serious axe violations (${scheme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
      for (const path of PAGES) {
        await page.goto(path);
        const results = await new AxeBuilder({ page }).analyze();
        const serious = results.violations.filter(
          (violation) => violation.impact === 'serious' || violation.impact === 'critical',
        );
        expect(
          serious.map(
            (violation) =>
              `${path}: ${violation.id} — ${violation.nodes.map((node) => node.target.join(' ')).join(', ')}`,
          ),
        ).toEqual([]);
      }
    });
  }

  test('AC-28 the converter with results on screen has no serious axe violations', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/avif-to-png');
    await addFiles(page, 'anim.avif', 'hdr-pq.avif', 'corrupt.avif');
    await settled(page, 3);
    const results = await new AxeBuilder({ page }).include('[data-tool]').analyze();
    const serious = results.violations.filter(
      (violation) => violation.impact === 'serious' || violation.impact === 'critical',
    );
    expect(
      serious.map(
        (violation) => `${violation.id} — ${violation.nodes.map((node) => node.target.join(' ')).join(', ')}`,
      ),
    ).toEqual([]);
  });

  for (const scheme of ['light', 'dark'] as const) {
    test(`AC-28 the viewer with an animation and a chosen frame on screen has no serious axe violations (${scheme})`, async ({
      page,
    }) => {
      await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
      await page.goto(VIEWER);
      await addFiles(page, 'anim.avif');
      const frames = page.getByRole('list', { name: 'Frames of anim.avif', exact: true });
      await expect(frames.getByRole('button')).toHaveCount(5);
      await frames.getByRole('button', { name: 'Frame 3', exact: true }).click();
      await expect(page.getByRole('button', { name: 'Save as PNG', exact: true })).toBeEnabled();
      const results = await new AxeBuilder({ page }).include('[data-tool]').analyze();
      const serious = results.violations.filter(
        (violation) => violation.impact === 'serious' || violation.impact === 'critical',
      );
      expect(
        serious.map(
          (violation) => `${violation.id} — ${violation.nodes.map((node) => node.target.join(' ')).join(', ')}`,
        ),
      ).toEqual([]);
    });
  }

  test('AC-28 the file picker can be opened from the keyboard', async ({ page }) => {
    await page.goto('/avif-to-png');
    const choose = page.getByRole('button', { name: 'Choose files' });
    await choose.focus();
    const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.keyboard.press('Enter')]);
    expect(chooser.isMultiple()).toBe(true);
  });
});
