import { expect, it, vi } from 'vitest';
import type { Api } from '../../extension/api';
import { start } from '../../extension/menus';

const TRY_AGAIN = 'Something went wrong while saving this image. Please try again.';
const notice = (message: string) => ({
  url: `chrome-extension://abc/notice.html#${encodeURIComponent(message)}`,
  type: 'popup',
  width: 460,
  height: 360,
});

/** Chrome, as far as the background uses it: what it registers can be fired, what it calls is recorded. */
function browser({ open = false } = {}) {
  const on = {
    installed: [] as Parameters<Api['runtime']['onInstalled']['addListener']>[0][],
    message: [] as Parameters<Api['runtime']['onMessage']['addListener']>[0][],
    clicked: [] as Parameters<Api['contextMenus']['onClicked']['addListener']>[0][],
  };
  let documents = open ? 1 : 0;
  const api = {
    runtime: {
      onInstalled: { addListener: (listener) => void on.installed.push(listener) },
      onMessage: { addListener: (listener) => void on.message.push(listener) },
      sendMessage: vi.fn(async (): Promise<unknown> => true),
      getURL: (path) => `chrome-extension://abc/${path}`,
      getContexts: vi.fn(async () => Array<unknown>(documents).fill({})),
    },
    contextMenus: {
      onClicked: { addListener: (listener) => void on.clicked.push(listener) },
      removeAll: vi.fn(async () => {}),
      create: vi.fn(),
    },
    offscreen: {
      createDocument: vi.fn(async () => {
        documents = 1;
      }),
    },
    downloads: { download: vi.fn(async (): Promise<number> => 1) },
    windows: { create: vi.fn(async (): Promise<unknown> => ({})) },
  } satisfies Api;
  return {
    api,
    on,
    install: () => on.installed.forEach((listener) => listener()),
    click: (menuItemId: string, srcUrl?: string) => on.clicked.forEach((listener) => listener({ menuItemId, srcUrl })),
    message: (message: unknown) => on.message.forEach((listener) => listener(message, {}, () => {})),
  };
}

/** Lets everything that is not waiting for the test run to its end. */
const settle = () => new Promise<void>((resolve) => setTimeout(resolve));

it('AC-71 registers its listeners when it starts, not later', () => {
  const chrome = browser();
  start(chrome.api);
  expect([chrome.on.installed.length, chrome.on.clicked.length, chrome.on.message.length]).toEqual([1, 1, 1]);
});

it('AC-58 on install removes the menu items it had and creates the three, on images only', async () => {
  const chrome = browser();
  let removed = () => {};
  chrome.api.contextMenus.removeAll.mockImplementation(() => new Promise<void>((resolve) => (removed = resolve)));
  start(chrome.api);
  expect(chrome.api.contextMenus.create).not.toHaveBeenCalled();
  chrome.install();
  await settle();
  expect(chrome.api.contextMenus.removeAll).toHaveBeenCalledTimes(1);
  expect(chrome.api.contextMenus.create).not.toHaveBeenCalled(); // not before the old ones are gone
  removed();
  await settle();
  expect(chrome.api.contextMenus.create.mock.calls).toEqual([
    [{ id: 'save', title: 'Save image as PNG or JPG', contexts: ['image'] }],
    [{ id: 'png', parentId: 'save', title: 'PNG', contexts: ['image'] }],
    [{ id: 'jpg', parentId: 'save', title: 'JPG', contexts: ['image'] }],
  ]);
  expect(chrome.api.contextMenus.removeAll.mock.invocationCallOrder[0]).toBeLessThan(
    chrome.api.contextMenus.create.mock.invocationCallOrder[0],
  );
});

it.each(['png', 'jpg'] as const)(
  'AC-71 a click on %s opens the hidden document and sends it the job',
  async (target) => {
    const chrome = browser();
    start(chrome.api);
    chrome.click(target, 'https://cdn.example/a.avif');
    await settle();
    expect(chrome.api.runtime.getContexts).toHaveBeenCalledWith({ contextTypes: ['OFFSCREEN_DOCUMENT'] });
    expect(chrome.api.offscreen.createDocument.mock.calls).toEqual([
      [{ url: 'offscreen.html', reasons: ['WORKERS', 'BLOBS'], justification: expect.any(String) }],
    ]);
    expect(chrome.api.runtime.sendMessage.mock.calls).toEqual([[{ srcUrl: 'https://cdn.example/a.avif', target }]]);
    expect(chrome.api.runtime.sendMessage.mock.invocationCallOrder[0]).toBeGreaterThan(
      chrome.api.offscreen.createDocument.mock.invocationCallOrder[0],
    );
    expect(chrome.api.windows.create).not.toHaveBeenCalled();
  },
);

it('AC-71 opens no second document when one is open', async () => {
  const chrome = browser({ open: true });
  start(chrome.api);
  chrome.click('png', 'https://cdn.example/a.avif');
  await settle();
  chrome.click('jpg', 'https://cdn.example/b.avif');
  await settle();
  expect(chrome.api.offscreen.createDocument).not.toHaveBeenCalled();
  expect(chrome.api.runtime.sendMessage.mock.calls).toEqual([
    [{ srcUrl: 'https://cdn.example/a.avif', target: 'png' }],
    [{ srcUrl: 'https://cdn.example/b.avif', target: 'jpg' }],
  ]);
});

it('AC-71 clicks that come while the document opens wait for that opening', async () => {
  const chrome = browser();
  let opened = () => {};
  chrome.api.offscreen.createDocument.mockImplementation(() => new Promise<void>((resolve) => (opened = resolve)));
  start(chrome.api);
  chrome.click('png', 'https://cdn.example/a.avif');
  chrome.click('jpg', 'https://cdn.example/b.avif');
  await settle();
  chrome.click('png', 'https://cdn.example/c.avif');
  await settle();
  expect(chrome.api.offscreen.createDocument).toHaveBeenCalledTimes(1);
  expect(chrome.api.runtime.sendMessage).not.toHaveBeenCalled(); // nobody is there to hear it yet

  opened();
  await settle();
  expect(chrome.api.offscreen.createDocument).toHaveBeenCalledTimes(1);
  expect(chrome.api.runtime.sendMessage.mock.calls).toEqual([
    [{ srcUrl: 'https://cdn.example/a.avif', target: 'png' }],
    [{ srcUrl: 'https://cdn.example/b.avif', target: 'jpg' }],
    [{ srcUrl: 'https://cdn.example/c.avif', target: 'png' }],
  ]);
});

it('AC-71 an opening that failed is said and not remembered: the next click tries again', async () => {
  const chrome = browser();
  chrome.api.offscreen.createDocument.mockRejectedValueOnce(new Error('Only a single offscreen document'));
  start(chrome.api);
  chrome.click('png', 'https://cdn.example/a.avif');
  await settle();
  expect(chrome.api.runtime.sendMessage).not.toHaveBeenCalled();
  expect(chrome.api.windows.create.mock.calls).toEqual([[notice(TRY_AGAIN)]]);

  chrome.click('png', 'https://cdn.example/a.avif');
  await settle();
  expect(chrome.api.offscreen.createDocument).toHaveBeenCalledTimes(2);
  expect(chrome.api.runtime.sendMessage.mock.calls).toEqual([
    [{ srcUrl: 'https://cdn.example/a.avif', target: 'png' }],
  ]);
  expect(chrome.api.windows.create).toHaveBeenCalledTimes(1);
});

it('AC-71 a click on anything else does nothing', async () => {
  const chrome = browser();
  start(chrome.api);
  chrome.click('save', 'https://cdn.example/a.avif');
  chrome.click('other', 'https://cdn.example/a.avif');
  chrome.click('png'); // not on an image
  await settle();
  expect(chrome.api.runtime.getContexts).not.toHaveBeenCalled();
  expect(chrome.api.offscreen.createDocument).not.toHaveBeenCalled();
  expect(chrome.api.runtime.sendMessage).not.toHaveBeenCalled();
  expect(chrome.api.windows.create).not.toHaveBeenCalled();
});

it('AC-71 a click that could not be delivered opens the failure window', async () => {
  const chrome = browser({ open: true });
  chrome.api.runtime.sendMessage.mockRejectedValueOnce(new Error('Receiving end does not exist.'));
  start(chrome.api);
  chrome.click('jpg', 'https://cdn.example/a.avif');
  await settle();
  expect(chrome.api.windows.create.mock.calls).toEqual([[notice(TRY_AGAIN)]]);
});

it.each([undefined, false])(
  'AC-71 a click the document did not take (it answered %s) opens the failure window',
  async (answer) => {
    const chrome = browser({ open: true });
    chrome.api.runtime.sendMessage.mockResolvedValueOnce(answer);
    start(chrome.api);
    chrome.click('png', 'https://cdn.example/a.avif');
    await settle();
    expect(chrome.api.windows.create.mock.calls).toEqual([[notice(TRY_AGAIN)]]);
  },
);

it('AC-71 a result with an address is downloaded under its first name, with no click before it', async () => {
  const chrome = browser();
  start(chrome.api);
  chrome.message({ url: 'blob:chrome-extension://abc/1', names: ['photo.png', 'image.png'] });
  await settle();
  expect(chrome.api.downloads.download.mock.calls).toEqual([
    [{ url: 'blob:chrome-extension://abc/1', filename: 'photo.png' }],
  ]);
  expect(chrome.api.windows.create).not.toHaveBeenCalled();
  expect(chrome.api.runtime.getContexts).not.toHaveBeenCalled();
});

it('AC-65 when the browser refuses the name, the download is asked for again as image, once', async () => {
  const chrome = browser();
  chrome.api.downloads.download.mockRejectedValueOnce(new Error('Invalid filename'));
  start(chrome.api);
  chrome.message({ url: 'blob:chrome-extension://abc/1', names: ['.hidden.png', 'image.png'] });
  await settle();
  expect(chrome.api.downloads.download.mock.calls).toEqual([
    [{ url: 'blob:chrome-extension://abc/1', filename: '.hidden.png' }],
    [{ url: 'blob:chrome-extension://abc/1', filename: 'image.png' }],
  ]);
  expect(chrome.api.windows.create).not.toHaveBeenCalled();
});

it('AC-71 when the browser accepts none of the names, the failure window says so', async () => {
  const chrome = browser();
  chrome.api.downloads.download.mockRejectedValue(new Error('Invalid filename'));
  start(chrome.api);
  chrome.message({ url: 'blob:chrome-extension://abc/1', names: ['.hidden.png', 'image.png'] });
  await settle();
  expect(chrome.api.downloads.download).toHaveBeenCalledTimes(2);
  expect(chrome.api.windows.create.mock.calls).toEqual([[notice('The browser refused to save this image.')]]);
});

it('AC-71 a result with a failure opens the failure window with it', async () => {
  const chrome = browser();
  start(chrome.api);
  chrome.message({ failure: 'Could not fetch this image: the site answered 404.' });
  await settle();
  expect(chrome.api.windows.create.mock.calls).toEqual([
    [notice('Could not fetch this image: the site answered 404.')],
  ]);
  expect(chrome.api.downloads.download).not.toHaveBeenCalled();
});

it('AC-71 a message that is no result is left alone', async () => {
  const chrome = browser();
  start(chrome.api);
  for (const message of [undefined, null, 'text', 7, {}, { srcUrl: 'https://cdn.example/a.avif', target: 'png' }])
    chrome.message(message);
  await settle();
  expect(chrome.api.downloads.download).not.toHaveBeenCalled();
  expect(chrome.api.windows.create).not.toHaveBeenCalled();
});
