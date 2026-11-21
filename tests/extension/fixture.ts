import { test as base, chromium, expect, type BrowserContext, type Page, type Worker } from '@playwright/test';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fixtureBytes } from '../e2e/helpers';

/** The extension as `pnpm build:extension` wrote it. */
export const BUILT = fileURLToPath(new URL('../../dist-extension', import.meta.url));
const FIXTURES = new Set(readdirSync(fileURLToPath(new URL('../fixtures', import.meta.url))));

const TYPES: Record<string, string> = {
  avif: 'image/avif',
  webp: 'image/webp',
  jfif: 'image/jpeg',
  png: 'image/png',
  json: 'application/json',
};

// What the tests call in the service worker. `dispatch` fires an event as the browser would: Playwright
// cannot click a native menu.
declare const chrome: {
  contextMenus: {
    onClicked: { dispatch(info: { menuItemId: string; srcUrl: string }, tab: object): void };
    update(id: string, changes: object): Promise<void>;
  };
};

export type Answer = (response: ServerResponse) => void;

/** Answers with a fixture, as an image host would: no CORS header. */
export const fixture =
  (name: string): Answer =>
  (response) => {
    const bytes = fixtureBytes(name);
    response.writeHead(200, { 'content-type': TYPES[name.split('.').pop()!], 'content-length': bytes.length });
    response.end(bytes);
  };

export interface Extension {
  context: BrowserContext;
  /** The address of `path` on the image host: another origin than any page of the browser. */
  at(path: string): string;
  /** Makes the host answer `path` with this, instead of with the fixture of that name (or 404). */
  serve(path: string, answer: Answer): void;
  /** The extension's service worker as the browser first started it. */
  worker(): Promise<Worker>;
  /** What choosing "PNG" or "JPG" in the menu of an image with this address does. */
  click(target: 'png' | 'jpg', srcUrl: string): Promise<void>;
  /** Clicks, and returns the failure window that opens. */
  failure(target: 'png' | 'jpg', srcUrl: string): Promise<Page>;
  /** Waits for a file of this name in the download folder and returns its bytes. */
  saved(name: string): Promise<Buffer>;
  /** The names in the download folder. */
  folder(): string[];
  /** Stops the service worker, as Chrome does to an idle one. */
  stopWorker(): Promise<void>;
  /** Whether the service worker runs. Asked of the browser: Playwright does not notice one stopping or starting again. */
  workerRuns(): Promise<boolean>;
}

/**
 * Chromium with the built extension, in a profile, a home folder and a download folder of its own, and
 * an image host. Playwright's own download handling gives files random names and ignores the name an
 * extension asks for, so the browser is switched back to its own: files then land in the folder its
 * preferences name, under their real names. The home folder keeps all of it away from the real one.
 */
export const test = base.extend<{ extension: Extension }>({
  // The empty pattern is Playwright's way of saying that this fixture needs no other.
  extension: async ({}, use) => {
    const home = mkdtempSync(join(tmpdir(), 'avifbox-extension-'));
    const [profile, downloads] = [join(home, 'profile'), join(home, 'Downloads')];
    mkdirSync(join(profile, 'Default'), { recursive: true });
    mkdirSync(downloads);
    writeFileSync(
      join(profile, 'Default', 'Preferences'),
      JSON.stringify({ download: { default_directory: downloads, prompt_for_download: false } }),
    );

    const answers = new Map<string, Answer>();
    const host = createServer((request, response) => {
      const path = request.url ?? '/';
      const answer = answers.get(path) ?? (FIXTURES.has(path.slice(1)) ? fixture(path.slice(1)) : null);
      if (answer) return answer(response);
      response.writeHead(404).end();
    });
    await new Promise<void>((resolve) => host.listen(0, '127.0.0.1', resolve));
    const origin = `http://127.0.0.1:${(host.address() as AddressInfo).port}`;

    const context = await chromium.launchPersistentContext(profile, {
      channel: 'chromium', // the headless shell Playwright starts by default loads no extension
      headless: true,
      args: [`--disable-extensions-except=${BUILT}`, `--load-extension=${BUILT}`],
      env: { ...process.env, HOME: home, XDG_CONFIG_HOME: join(home, '.config'), XDG_DOWNLOAD_DIR: downloads },
    });
    const browser = await context.browser()!.newBrowserCDPSession();
    await browser.send('Browser.setDownloadBehavior', { behavior: 'default' });

    const worker = async () => context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
    const workers = async () =>
      (await browser.send('Target.getTargets')).targetInfos.filter((target) => target.type === 'service_worker');
    const click: Extension['click'] = async (menuItemId, srcUrl) =>
      (await worker()).evaluate((info) => chrome.contextMenus.onClicked.dispatch(info, {}), { menuItemId, srcUrl });

    await use({
      context,
      at: (path) => origin + path,
      serve: (path, answer) => void answers.set(path, answer),
      worker,
      click,
      async failure(target, srcUrl) {
        const [page] = await Promise.all([context.waitForEvent('page'), click(target, srcUrl)]);
        await page.waitForLoadState();
        return page;
      },
      async saved(name) {
        // The browser writes under another name and renames at the end: a file of this name is whole.
        await expect.poll(() => readdirSync(downloads), { timeout: 30_000 }).toContain(name);
        return readFileSync(join(downloads, name));
      },
      folder: () => readdirSync(downloads).sort(),
      async stopWorker() {
        for (const { targetId } of await workers()) await browser.send('Target.closeTarget', { targetId });
        await expect.poll(async () => (await workers()).length).toBe(0);
      },
      workerRuns: async () => (await workers()).length > 0,
    });

    await context.close();
    await new Promise((resolve) => host.close(resolve));
    rmSync(home, { recursive: true, force: true });
  },
});

/** The three menu items the browser holds for the extension: updating one that does not exist fails. */
export async function menuItems(worker: Worker): Promise<string[]> {
  return worker.evaluate(async () => {
    const found: string[] = [];
    for (const id of ['save', 'png', 'jpg', 'other'])
      await chrome.contextMenus.update(id, {}).then(
        () => found.push(id),
        () => {},
      );
    return found;
  });
}

export { expect };
