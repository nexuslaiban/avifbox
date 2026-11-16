import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';

const { scripts } = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8')) as {
  scripts: Record<string, string>;
};

it('AC-47, AC-55 a deploy tests first, uploads, checks the live site, then tells IndexNow, and a step that fails stops the rest', () => {
  // Joined by `&&` and nothing else: a step runs only if the one before it passed.
  expect(scripts.deploy.split(' && ')).toEqual([
    'pnpm check',
    'pnpm test',
    // CI makes Playwright build and start its own server instead of reusing one that may serve an older build.
    'CI=1 pnpm test:e2e',
    // Which pages the upload changes can only be seen while the site still serves the old ones.
    'pnpm indexnow before',
    'wrangler deploy',
    'pnpm verify:live',
    'pnpm indexnow after',
  ]);
  expect(scripts.indexnow).toBe('node scripts/tell-indexnow.ts');
});
