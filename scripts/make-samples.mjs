// Regenerates the result files in public/samples/ by running the real converter on the sample
// sources, so the sizes published on the site are what the site itself produces.
//
//   pnpm samples        (builds the site first)
import { execFileSync, spawn } from 'node:child_process';
import { copyFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const samples = join(root, 'public', 'samples');
const PORT = 4323;

/** source file, the settings to choose (by label), the download to take, and the name to save it under. */
const RECIPES = [
  { source: 'photo.avif', choose: [], download: 'photo.png', saveAs: 'photo.png' },
  { source: 'photo.avif', choose: ['Optimized'], download: 'photo.png', saveAs: 'photo-optimized.png' },
  { source: 'transparent.avif', choose: [], download: 'transparent.png', saveAs: 'transparent.png' },
  { source: 'animated.avif', choose: ['Animated PNG'], download: 'animated.png', saveAs: 'animated.png' },
];

execFileSync('pnpm', ['build'], { cwd: root, stdio: 'inherit' });
const server = spawn('pnpm', ['exec', 'astro', 'preview', '--port', String(PORT), '--ignore-lock'], { cwd: root, stdio: 'ignore' });

try {
  const base = `http://localhost:${PORT}`;
  for (let attempt = 0; ; attempt++) {
    if (
      await fetch(base).then(
        (r) => r.ok,
        () => false,
      )
    )
      break;
    if (attempt > 100) throw new Error('preview server did not start');
    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  const browser = await chromium.launch();
  for (const recipe of RECIPES) {
    const page = await browser.newPage();
    await page.goto(`${base}/avif-to-png`);
    await page.locator('input[type=file]').first().setInputFiles(join(samples, recipe.source));
    const done = page.locator('.cv-list > li[data-status=done]');
    await done.waitFor();
    if (recipe.choose.length > 0) await page.locator('details.cv-advanced summary').click();
    for (const label of recipe.choose) {
      await page.getByRole('radio', { name: label }).check();
      await done.waitFor();
    }
    const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('link', { name: `Download ${recipe.download}`, exact: true }).click()]);
    copyFileSync(await download.path(), join(samples, recipe.saveAs));
    console.log(`${recipe.source} -> ${recipe.saveAs}`);
    await page.close();
  }
  await browser.close();
} finally {
  server.kill();
}
