// Compares the live site with `dist/`: a step of `pnpm run deploy`, or alone as `pnpm verify:live`.
// Exits with 1 when anything differs, or when there was nothing to compare.
import { ask, readBuild } from './deployed.ts';
import { checkSite } from './site-check.ts';

const { origin, files, headers, failures } = await checkSite(readBuild(), ask);

console.log(`${origin || 'no site'}: ${files} files and ${headers} headers compared with dist/`);
if (failures.length === 0) {
  console.log('ok: the site serves this build, with the headers of _headers, and plain HTTP leads to HTTPS');
} else {
  console.error(`FAILED: ${failures.length} ${failures.length === 1 ? 'difference' : 'differences'}`);
  for (const failure of failures) console.error(`  ${failure}`);
  process.exitCode = 1;
}
