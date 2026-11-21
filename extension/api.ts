// The part of Chrome's extension API this extension calls, described here rather than taken from
// `@types/chrome`: that package would make `chrome` a global of the whole project, the engine included.
// The scripts that run in the browser declare `chrome` as this; the logic is handed it.

interface Event<Listener> {
  addListener(listener: Listener): void;
}

export interface MenuItem {
  id: string;
  parentId?: string;
  title: string;
  contexts: ['image'];
}

export interface Api {
  runtime: {
    /** Fires when the extension is installed or updated, and when the browser is. */
    onInstalled: Event<() => void>;
    /** A message from another part of this extension. Nothing outside it can send one. */
    onMessage: Event<(message: unknown, sender: unknown, respond: (response?: unknown) => void) => void>;
    /** Resolves with what a listener answered. Rejects when no other part of the extension is listening. */
    sendMessage(message: unknown): Promise<unknown>;
    getURL(path: string): string;
    getContexts(filter: { contextTypes: ['OFFSCREEN_DOCUMENT'] }): Promise<unknown[]>;
  };
  contextMenus: {
    onClicked: Event<(info: { menuItemId: string | number; srcUrl?: string }) => void>;
    removeAll(): Promise<void>;
    create(item: MenuItem): unknown;
  };
  offscreen: {
    /** Resolves when the document has loaded. Rejects when one is open already: Chrome allows one. */
    createDocument(options: { url: string; reasons: ('WORKERS' | 'BLOBS')[]; justification: string }): Promise<void>;
  };
  downloads: {
    /** Rejects when the browser refuses the name. */
    download(options: { url: string; filename: string }): Promise<number>;
  };
  windows: {
    create(options: { url: string; type: 'popup'; width: number; height: number }): Promise<unknown>;
  };
}
