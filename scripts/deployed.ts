// The build on disk and the live site, for the scripts that compare the two.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIST = fileURLToPath(new URL('../dist', import.meta.url));
// The site is for browsers, and a host may answer a client it does not know differently.
const USER_AGENT =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36';

/** `dist/` as path → bytes. */
export function readBuild(): Map<string, Uint8Array> {
  const build = new Map<string, Uint8Array>();
  for (const name of readdirSync(DIST, { recursive: true, encoding: 'utf8' })) {
    const file = join(DIST, name);
    if (statSync(file).isFile()) build.set(name.split(sep).join('/'), readFileSync(file));
  }
  return build;
}

/** One request to the live site, as a browser sends it, redirects not followed. */
export const ask = (url: string): Promise<Response> =>
  fetch(url, { redirect: 'manual', headers: { 'user-agent': USER_AGENT } });
