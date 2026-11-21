import { resolve } from 'node:path';
import { defineConfig } from 'vite';

const here = import.meta.dirname;

// Builds the extension into dist-extension/, which Chrome loads unpacked. The manifest and the icons
// are copied from public/ as they are.
export default defineConfig({
  root: here,
  // An extension is served from chrome-extension://<id>/, so every address in it stays relative.
  base: './',
  build: {
    outDir: resolve(here, '../dist-extension'),
    emptyOutDir: true,
    // Chrome has preloaded modules by itself for years, and the polyfill is a script nobody asked for.
    modulePreload: { polyfill: false },
    rolldownOptions: {
      input: [resolve(here, 'offscreen.html'), resolve(here, 'notice.html'), resolve(here, 'background.ts')],
      output: {
        // The manifest names the service worker, so its file keeps its name.
        entryFileNames: (chunk) => (chunk.name === 'background' ? 'background.js' : 'assets/[name]-[hash].js'),
      },
    },
  },
  // The engine's worker is a module, as on the site.
  worker: { format: 'es' },
});
