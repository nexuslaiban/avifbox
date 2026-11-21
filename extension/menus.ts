// The background's side: the menu, a click as a job for the hidden document, its result as a download
// or as the failure window. Chrome is handed in (`background.ts` does that).
import type { Api, MenuItem } from './api';
import { TRY_AGAIN, isResult, type Job, type Result } from './protocol';

const MENU: MenuItem[] = [
  { id: 'save', title: 'Save image as PNG or JPG', contexts: ['image'] },
  { id: 'png', parentId: 'save', title: 'PNG', contexts: ['image'] },
  { id: 'jpg', parentId: 'save', title: 'JPG', contexts: ['image'] },
];
const REFUSED = 'The browser refused to save this image.';

/**
 * Registers the listeners. To be called when the service worker's script runs: Chrome starts a stopped
 * worker for the events it listened to then.
 */
export function start(api: Api): void {
  // The one thing kept between events, and only while it lasts: Chrome allows one hidden document,
  // so two quick clicks must not both open it.
  let opening: Promise<void> | null = null;

  async function open(): Promise<void> {
    const documents = await api.runtime.getContexts({ contextTypes: ['OFFSCREEN_DOCUMENT'] });
    if (documents.length > 0) return;
    await api.offscreen.createDocument({
      url: 'offscreen.html',
      reasons: ['WORKERS', 'BLOBS'],
      justification: 'Converts the image in a worker and hands the converted file to the download manager.',
    });
  }

  /** A window, not a notification: that needs a permission, and a system that silences it makes the failure silent. */
  const fail = (message: string) =>
    api.windows.create({
      url: `${api.runtime.getURL('notice.html')}#${encodeURIComponent(message)}`,
      type: 'popup',
      width: 460,
      height: 360,
    });

  async function send(job: Job): Promise<void> {
    try {
      opening ??= open().finally(() => (opening = null));
      await opening;
      // The document's script has run when it counts as open, so its listener is there. It answers
      // `true` for a job it took: a document that is closing itself takes none.
      if ((await api.runtime.sendMessage(job)) !== true) throw new Error('the job was not taken');
    } catch {
      await fail(TRY_AGAIN);
    }
  }

  /** Works from the result alone: the service worker that took the click may have been stopped since. */
  async function finish(result: Result): Promise<void> {
    if ('failure' in result) return void (await fail(result.failure));
    for (const filename of result.names) {
      const accepted = await api.downloads.download({ url: result.url, filename }).then(
        () => true,
        () => false,
      );
      if (accepted) return;
    }
    await fail(REFUSED);
  }

  api.runtime.onInstalled.addListener(async () => {
    await api.contextMenus.removeAll(); // an update finds the items of the version before it
    for (const item of MENU) api.contextMenus.create(item);
  });
  api.contextMenus.onClicked.addListener(({ menuItemId, srcUrl }) => {
    if ((menuItemId === 'png' || menuItemId === 'jpg') && srcUrl) void send({ srcUrl, target: menuItemId });
  });
  api.runtime.onMessage.addListener((message) => {
    if (isResult(message)) void finish(message);
  });
}
