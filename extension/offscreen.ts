// The hidden document. A service worker has no `Worker`, no `ImageDecoder` and no
// `URL.createObjectURL`; the engine needs the first two and a download of a file needs the third.
import { Pool } from '../src/engine/pool';
import type { Api } from './api';
import { isJob } from './protocol';
import { saver } from './save';

declare const chrome: Pick<Api, 'runtime'>;

const take = saver({
  fetch: (url, init) => fetch(url, init),
  runner: new Pool(),
  address: (file) => URL.createObjectURL(file),
  release: (url) => URL.revokeObjectURL(url),
  // This message starts the service worker when Chrome has stopped it since the click.
  report: (result) => void chrome.runtime.sendMessage(result).catch(() => {}),
  close: () => window.close(),
});

// The answer is whether the job was taken. It is given at once, so the background's sending ends then.
chrome.runtime.onMessage.addListener((message, _sender, respond) => {
  if (isJob(message)) respond(take(message));
});
