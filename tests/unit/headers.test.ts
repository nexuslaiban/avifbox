import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/** `public/_headers`, the file the host reads, as path → header → value. */
function hostHeaders(): Record<string, Record<string, string>> {
  const rules: Record<string, Record<string, string>> = {};
  let path = '';
  for (const line of readFileSync(new URL('../../public/_headers', import.meta.url), 'utf8').split('\n')) {
    if (!line.trim() || line.startsWith('#')) continue;
    // A path starts its line; the headers under it are indented.
    if (!/^\s/.test(line)) {
      path = line.trim();
      rules[path] = {};
      continue;
    }
    const colon = line.indexOf(':');
    rules[path][line.slice(0, colon).trim()] = line.slice(colon + 1).trim();
  }
  return rules;
}

describe('response headers', () => {
  it('AC-43 every path is served with HSTS for a year, for this host only and not preloaded', () => {
    expect(hostHeaders()['/*']['Strict-Transport-Security']).toBe('max-age=31536000');
  });

  it('reads the file as the host does: the rules that were there are still found', () => {
    const rules = hostHeaders();
    expect(rules['/*']['X-Content-Type-Options']).toBe('nosniff');
    expect(rules['/_astro/*']['Cache-Control']).toBe('public, max-age=31536000, immutable');
  });
});
