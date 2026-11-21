// The extension's service worker. Chrome stops it when it is idle and starts it again for an event, so
// everything it does is in `menus.ts`, which keeps nothing between events but the opening of the document.
import type { Api } from './api';
import { start } from './menus';

declare const chrome: Api;

start(chrome);
