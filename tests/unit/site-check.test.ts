import { describe, expect, it } from 'vitest';
import { checkSite, type Fetch } from '../../scripts/site-check';

const ORIGIN = 'https://avifbox.com';
/** What `Response` takes as a body: bytes in a buffer of their own. */
type Bytes = Uint8Array<ArrayBuffer>;
const bytes = (text: string): Bytes => new TextEncoder().encode(text);

const RULES = `# Comments and blank lines are skipped.
/*
  X-Content-Type-Options: nosniff

/_astro/*
  Cache-Control: public, max-age=31536000, immutable
`;

/** A small build: the home page, a page, the 404 page, a script, a sample and the header rules. */
function build(): Map<string, Bytes> {
  return new Map([
    ['index.html', bytes(`<link rel="canonical" href="${ORIGIN}/"><h1>Home</h1>`)],
    ['about.html', bytes('<h1>About</h1>')],
    ['404.html', bytes('<h1>Not found</h1>')],
    ['_astro/worker.js', bytes('onmessage = () => {};')],
    ['samples/photo.avif', new Uint8Array([0, 1, 2, 3])],
    ['_headers', bytes(RULES)],
  ]);
}

interface Answer {
  status: number;
  body: Bytes | null;
  headers: Record<string, string>;
}

type Change = (url: string, answer: Answer) => Answer | null;

/**
 * A host that serves the build the way Cloudflare serves `dist/`, and notes what it was asked.
 * `change` rewrites an answer; `null` is a request that fails.
 */
function host(files: Map<string, Bytes>, change: Change = (_, answer) => answer) {
  const asked: string[] = [];
  const serve = (url: URL): Answer => {
    if (url.protocol === 'http:')
      return { status: 301, body: null, headers: { Location: `https://${url.host}${url.pathname}` } };
    const headers: Record<string, string> = { 'X-Content-Type-Options': 'nosniff' };
    if (url.pathname.startsWith('/_astro/')) headers['Cache-Control'] = 'public, max-age=31536000, immutable';
    const name = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
    const file = name === '_headers' ? undefined : (files.get(name) ?? files.get(`${name}.html`));
    return file ? { status: 200, body: file, headers } : { status: 404, body: files.get('404.html') ?? null, headers };
  };
  const fetch: Fetch = async (address) => {
    asked.push(address);
    const answer = change(address, serve(new URL(address)));
    if (!answer) throw new Error('connection refused');
    return new Response(answer.body, answer);
  };
  return { fetch, asked };
}

/** Changes the answer for one address and leaves the others alone. */
const at =
  (address: string, to: (answer: Answer) => Answer | null): Change =>
  (url, answer) =>
    url === address ? to(answer) : answer;

describe('the live check', () => {
  it('AC-45 passes on a site that serves the build as it is, and says how much it compared', async () => {
    const { fetch, asked } = host(build());

    expect(await checkSite(build(), fetch)).toEqual({ origin: ORIGIN, files: 5, headers: 6, failures: [] });

    // Pages at their public addresses, the 404 page at one more address, plain HTTP once.
    for (const path of ['/', '/about', '/_astro/worker.js', '/samples/photo.avif'])
      expect(asked).toContain(ORIGIN + path);
    expect(asked).toContain('http://avifbox.com/');
    expect(asked).toHaveLength(6);
    // Never the file names of the pages, and never the rules: the host serves neither.
    expect(asked.filter((url) => /\.html$|_headers/.test(url))).toEqual([]);
  });

  const BEACON = bytes('<h1>About</h1><script src="https://cdn.example/beacon.js"></script>');
  const breaks: [string, Change, RegExp][] = [
    [
      'a file with other bytes',
      at(`${ORIGIN}/about`, (answer) => ({ ...answer, body: BEACON })),
      /^\/about: differs from the build \(\d+ bytes served, 14 built; the first difference is at byte 14\)$/,
    ],
    [
      'a file answered with another status',
      at(`${ORIGIN}/samples/photo.avif`, (answer) => ({ ...answer, status: 403 })),
      /^\/samples\/photo\.avif: answered 403, expected 200$/,
    ],
    [
      'a header that is missing',
      at(`${ORIGIN}/about`, (answer) => ({ ...answer, headers: {} })),
      /^\/about: X-Content-Type-Options is missing, _headers says "nosniff"$/,
    ],
    [
      'a header with another value',
      at(`${ORIGIN}/_astro/worker.js`, (answer) => ({
        ...answer,
        headers: { ...answer.headers, 'Cache-Control': 'no-cache' },
      })),
      /^\/_astro\/worker\.js: Cache-Control is "no-cache", _headers says "public, max-age=31536000, immutable"$/,
    ],
    [
      'an address that does not exist answered with 200',
      (_, answer) => (answer.status === 404 ? { ...answer, status: 200 } : answer),
      /^\/\S+: answered 200, expected 404$/,
    ],
    [
      'plain HTTP that is not redirected',
      at('http://avifbox.com/', () => ({ status: 200, body: bytes('<h1>Home</h1>'), headers: {} })),
      /^http:\/\/avifbox\.com\/: answered 200, expected a redirect to https:\/\/avifbox\.com\/$/,
    ],
    [
      'plain HTTP redirected somewhere else',
      at('http://avifbox.com/', (answer) => ({ ...answer, headers: { Location: 'https://example.com/' } })),
      /^http:\/\/avifbox\.com\/: redirects to https:\/\/example\.com\/, expected https:\/\/avifbox\.com\/$/,
    ],
    ['a request that gets no answer', at(`${ORIGIN}/about`, () => null), /^\/about: no answer \(connection refused\)$/],
  ];

  it.each(breaks)('AC-45 fails on %s, and names the path', async (_, change, message) => {
    const { failures } = await checkSite(build(), host(build(), change).fetch);

    expect(failures).toHaveLength(1);
    expect(failures[0]).toMatch(message);
  });

  it('AC-45 goes on after a request that gets no answer', async () => {
    const change: Change = (url, answer) => {
      if (url === `${ORIGIN}/about`) return null;
      return url === `${ORIGIN}/samples/photo.avif` ? { ...answer, body: new Uint8Array([0, 1, 9, 3]) } : answer;
    };

    const report = await checkSite(build(), host(build(), change).fetch);

    expect(report.files).toBe(4);
    expect(report.failures).toHaveLength(2);
    expect(report.failures[0]).toMatch(/^\/about: no answer/);
    expect(report.failures[1]).toMatch(/^\/samples\/photo\.avif: differs from the build .* at byte 2\)$/);
  });

  it.each([
    ['an empty build', new Map<string, Bytes>()],
    ['a home page that names no canonical address', build().set('index.html', bytes('<h1>Home</h1>'))],
  ])('AC-46 does not pass on %s: nothing was asked, and it says so', async (_, files) => {
    const { fetch, asked } = host(files);

    const report = await checkSite(files, fetch);

    expect(report.failures).toEqual(['index.html names no canonical address: nothing was checked']);
    expect(asked).toEqual([]);
  });

  it('AC-46 does not pass on a build without _headers: no header was compared', async () => {
    const files = build();
    files.delete('_headers');

    const report = await checkSite(files, host(files).fetch);

    expect(report).toMatchObject({ files: 5, headers: 0 });
    expect(report.failures).toEqual(['the build has no _headers: no header was checked']);
  });

  it('AC-46 does not pass when a rule of _headers matches no file of the build', async () => {
    const files = build().set('_headers', bytes(`${RULES}\n/fonts/*\n  Cache-Control: public, max-age=86400\n`));

    const report = await checkSite(files, host(files).fetch);

    expect(report.failures).toEqual(['_headers: the rule for /fonts/* matches no file of the build']);
  });
});
