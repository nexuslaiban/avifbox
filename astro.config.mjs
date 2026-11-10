import { defineConfig } from 'astro/config';
import preact from '@astrojs/preact';
import sitemap from '@astrojs/sitemap';

// Clean URLs (`/avif-to-png`) on any static host: one HTML file per route, no trailing slash.
export default defineConfig({
  site: 'https://avifbox.com',
  trailingSlash: 'never',
  build: { format: 'file' },
  integrations: [preact(), sitemap()],
  security: {
    // Files are converted locally; the policy makes "nothing is uploaded" enforceable, not just a promise.
    csp: {
      directives: [
        "default-src 'self'",
        "img-src 'self' blob: data:",
        "connect-src 'self'",
        "worker-src 'self'",
        "font-src 'self'",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
      ],
      scriptDirective: { resources: ["'self'", "'wasm-unsafe-eval'"] },
    },
  },
  vite: {
    worker: { format: 'es' },
    optimizeDeps: { exclude: ['@jsquash/avif'] },
  },
});
