import { defineConfig, devices } from '@playwright/test';

const PORT = 4322;

// E2E runs against the production build: CSP, worker chunks and WASM assets only exist there.
export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  reporter: [['list']],
  timeout: 60_000,
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    // The converter and the viewer only: page structure and accessibility do not depend on the engine.
    { name: 'firefox', use: { ...devices['Desktop Firefox'] }, testMatch: ['convert.spec.ts', 'viewer.spec.ts'] },
    // Everything: WebKit is where layout and platform features differ most. It is the engine, not Safari:
    // this build has ImageDecoder and, on Linux, no colour management for decoded images.
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
  webServer: {
    // --ignore-lock keeps the server in the foreground even when Astro detects a coding agent and
    // would otherwise detach it, which Playwright reads as the server exiting early.
    command: `pnpm build && pnpm exec astro preview --port ${PORT} --ignore-lock`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
