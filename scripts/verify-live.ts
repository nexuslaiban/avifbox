// Compares the live site with `dist/`: the last step of `pnpm run deploy`, or alone as `pnpm verify:live`.
// Exits with 1 when anything differs, or when there was nothing to compare.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkSite } from './site-check.ts';

const DIST = fileURLToPath(new URL('../dist', import.meta.url));
// The site is for browsers, and a host may answer a client it does not know differently.
const USER_AGENT =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36';

const build = new Map<string, Uint8Array>();
for (const name of readdirSync(DIST, { recursive: true, encoding: 'utf8' })) {
  const file = join(DIST, name);
  if (statSync(file).isFile()) build.set(name.split(sep).join('/'), readFileSync(file));
}

const { origin, files, headers, failures } = await checkSite(build, (url) =>
  fetch(url, { redirect: 'manual', headers: { 'user-agent': USER_AGENT } }),
);

console.log(`${origin || 'no site'}: ${files} files and ${headers} headers compared with dist/`);
if (failures.length === 0) {
  console.log('ok: the site serves this build, with the headers of _headers, and plain HTTP leads to HTTPS');
} else {
  console.error(`FAILED: ${failures.length} ${failures.length === 1 ? 'difference' : 'differences'}`);
  for (const failure of failures) console.error(`  ${failure}`);
  process.exitCode = 1;
}
