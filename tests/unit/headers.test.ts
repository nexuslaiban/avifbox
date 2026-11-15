import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseHeaders } from '../../scripts/site-check';

/** `public/_headers`, read the way the live check reads it. */
const hostHeaders = () => parseHeaders(readFileSync(new URL('../../public/_headers', import.meta.url), 'utf8'));

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
