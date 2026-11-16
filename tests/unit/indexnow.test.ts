import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { keyOf, news, owed, tell } from '../../scripts/indexnow';

const ORIGIN = 'https://avifbox.com';
const KEY = '0123456789abcdef0123456789abcdef';
const PAGES = [`${ORIGIN}/`, `${ORIGIN}/about`, `${ORIGIN}/avif-to-png`];
/** What `Response` takes as a body: bytes in a buffer of their own. */
type Bytes = Uint8Array<ArrayBuffer>;
const bytes = (text: string): Bytes => new TextEncoder().encode(text);

/** A small build: three pages in the sitemap, the 404 page, a text file that is no key, and the key file. */
function build(): Map<string, Bytes> {
  const listed = PAGES.map((page) => `<url><loc>${page}</loc></url>`).join('');
  return new Map([
    ['index.html', bytes('<h1>Home</h1>')],
    ['about.html', bytes('<h1>About</h1>')],
    ['avif-to-png.html', bytes('<h1>AVIF to PNG</h1>')],
    ['404.html', bytes('<h1>Not found</h1>')],
    ['robots.txt', bytes('User-agent: *')],
    [`${KEY}.txt`, bytes(KEY)],
    ['sitemap-index.xml', bytes(`<sitemapindex><sitemap><loc>${ORIGIN}/sitemap-0.xml</loc></sitemap></sitemapindex>`)],
    ['sitemap-0.xml', bytes(`<urlset>${listed}</urlset>`)],
  ]);
}

const without = (files: Map<string, Bytes>, ...names: string[]) =>
  new Map([...files].filter(([name]) => !names.includes(name)));

/**
 * A site that serves `files` the way the host serves a build, and notes what it was asked.
 * `change` answers an address itself; `null` from it is a request that gets no answer.
 */
function site(files: Map<string, Bytes>, change: (url: string) => Response | null | undefined = () => undefined) {
  const asked: string[] = [];
  const fetch = async (url: string) => {
    asked.push(url);
    const changed = change(url);
    if (changed === null) throw new Error('connection refused');
    if (changed) return changed;
    const { pathname } = new URL(url);
    const name = pathname === '/' ? 'index.html' : pathname.slice(1);
    const file = files.get(name) ?? files.get(`${name}.html`);
    return file ? new Response(file) : new Response(files.get('404.html') ?? null, { status: 404 });
  };
  return { fetch, asked };
}

/** IndexNow, answering every notice with `status`; `null` is no answer. It keeps what it was sent. */
function indexnow(status: number | null) {
  const sent: { url: string; init: RequestInit }[] = [];
  const send = async (url: string, init: RequestInit) => {
    sent.push({ url, init });
    if (status === null) throw new Error('connection refused');
    return new Response(null, { status });
  };
  return { send, sent };
}

describe('the key', () => {
  it('AC-52 public/ holds one IndexNow key file: 32 hexadecimal characters that are its whole content', () => {
    const dir = new URL('../../public/', import.meta.url);
    const root = new Map(
      readdirSync(dir, { withFileTypes: true })
        .filter((entry) => entry.isFile())
        .map((entry) => [entry.name, new Uint8Array(readFileSync(new URL(entry.name, dir)))] as const),
    );

    const key = keyOf(root);

    expect(key).toMatch(/^[0-9a-f]{32}$/);
    expect(readFileSync(new URL(`${key}.txt`, dir), 'utf8')).toBe(key);
  });
});

describe('the pages a deploy has news of', () => {
  it('AC-53 are all of the sitemap while the site does not show the key', async () => {
    const unannounced = site(without(build(), `${KEY}.txt`));
    expect(await news(build(), unannounced.fetch)).toEqual(PAGES);

    const otherKey = site(new Map([...build(), [`${KEY}.txt`, bytes('another key')]]));
    expect(await news(build(), otherKey.fetch)).toEqual(PAGES);

    const silent = site(build(), (url) => (url.endsWith('.txt') ? null : undefined));
    expect(await news(build(), silent.fetch)).toEqual(PAGES);
  });

  it('AC-53 are none when the site serves the build as it is, and the 404 page is not asked for', async () => {
    const { fetch, asked } = site(build());

    expect(await news(build(), fetch)).toEqual([]);
    expect(asked).toEqual([`${ORIGIN}/${KEY}.txt`, ...PAGES]);
  });

  it('AC-53 are the pages the site does not serve as built, in the order of the sitemap', async () => {
    const differs = site(new Map([...build(), ['about.html', bytes('<h1>About us</h1>')]]));
    expect(await news(build(), differs.fetch)).toEqual([`${ORIGIN}/about`]);

    const missing = site(without(build(), 'avif-to-png.html'));
    expect(await news(build(), missing.fetch)).toEqual([`${ORIGIN}/avif-to-png`]);

    const broken = site(build(), (url) => (url === `${ORIGIN}/` ? new Response('oops', { status: 500 }) : undefined));
    expect(await news(build(), broken.fetch)).toEqual([`${ORIGIN}/`]);

    // The build's own bytes under another status are not the page: a host can answer an error with them.
    const refused = site(build(), (url) =>
      url === `${ORIGIN}/about` ? new Response(build().get('about.html'), { status: 503 }) : undefined,
    );
    expect(await news(build(), refused.fetch)).toEqual([`${ORIGIN}/about`]);

    const several = site(new Map([...build(), ['index.html', bytes('<h1>Old home</h1>')]]), (url) =>
      url === `${ORIGIN}/avif-to-png` ? null : undefined,
    );
    expect(await news(build(), several.fetch)).toEqual([`${ORIGIN}/`, `${ORIGIN}/avif-to-png`]);
  });

  it('AC-53 cannot be told for a build without one key or without pages, and says which', async () => {
    const { fetch, asked } = site(build());

    await expect(news(without(build(), `${KEY}.txt`), fetch)).rejects.toThrow('the build holds no IndexNow key file');
    const twoKeys = new Map([...build(), ['fedcba9876543210.txt', bytes('fedcba9876543210')]]);
    await expect(news(twoKeys, fetch)).rejects.toThrow('the build holds 2 IndexNow key files');
    await expect(news(without(build(), 'sitemap-0.xml'), fetch)).rejects.toThrow(
      'the sitemap of the build lists no page',
    );
    await expect(news(without(build(), 'sitemap-index.xml'), fetch)).rejects.toThrow(
      'the sitemap of the build lists no page',
    );
    expect(asked).toEqual([]);
  });
});

describe('the pages IndexNow is owed', () => {
  const [home, about, avifToPng] = PAGES;

  it('AC-56 are those noted earlier and not sent together with those the upload changes, each once, in the order of the sitemap', () => {
    expect(owed(build(), [avifToPng, about], [about, home])).toEqual([home, about, avifToPng]);
  });

  it('AC-56 keep what was noted earlier when the upload changes nothing: the site may serve it by now, untold', () => {
    expect(owed(build(), [avifToPng, home], [])).toEqual([home, avifToPng]);
  });

  it('AC-56 are the pages the upload changes when nothing was noted earlier', () => {
    expect(owed(build(), [], [avifToPng, about])).toEqual([about, avifToPng]);
    expect(owed(build(), [], [])).toEqual([]);
  });

  it('AC-56 drop a noted address that is no longer a page of the build', () => {
    expect(owed(build(), [`${ORIGIN}/gone`, about], [home])).toEqual([home, about]);
  });
});

describe('telling IndexNow', () => {
  it('AC-54 is one POST that names the host, the key, where the key is, and the pages', async () => {
    const { send, sent } = indexnow(200);

    expect(await tell(build(), PAGES.slice(0, 2), send)).toBe('IndexNow was told of 2 pages (200: submitted)');

    expect(sent).toHaveLength(1);
    expect(sent[0].url).toBe('https://api.indexnow.org/indexnow');
    expect(sent[0].init.method).toBe('POST');
    expect(sent[0].init.headers).toEqual({ 'content-type': 'application/json; charset=utf-8' });
    expect(JSON.parse(sent[0].init.body as string)).toEqual({
      host: 'avifbox.com',
      key: KEY,
      keyLocation: `${ORIGIN}/${KEY}.txt`,
      urlList: PAGES.slice(0, 2),
    });
  });

  it('AC-54 passes on 202 too, and says the key is still to be verified', async () => {
    const { send } = indexnow(202);

    expect(await tell(build(), [`${ORIGIN}/about`], send)).toBe(
      'IndexNow was told of 1 page (202: received, the key is still to be verified)',
    );
  });

  it.each([
    [400, 'IndexNow answered 400: invalid format'],
    [403, 'IndexNow answered 403: the key is not valid (not found, or its file does not hold it)'],
    [422, 'IndexNow answered 422: the addresses do not belong to the host, or the key does not fit the protocol'],
    [429, 'IndexNow answered 429: too many requests'],
    [500, 'IndexNow answered 500'],
    [null, 'IndexNow gave no answer (connection refused)'],
  ])('AC-54 fails on the answer %s and says what it means', async (status, message) => {
    const { send, sent } = indexnow(status);

    await expect(tell(build(), PAGES, send)).rejects.toThrow(new Error(message));
    expect(sent).toHaveLength(1);
  });

  it('AC-54 sends nothing for an empty list, and says so', async () => {
    const { send, sent } = indexnow(200);

    expect(await tell(build(), [], send)).toBe('no page changed: nothing to tell IndexNow');
    expect(sent).toEqual([]);
  });

  it('AC-54 sends nothing when an address is not a page of the build, and names it', async () => {
    const { send, sent } = indexnow(200);

    await expect(
      tell(build(), [`${ORIGIN}/about`, `${ORIGIN}/elsewhere`, 'https://example.com/'], send),
    ).rejects.toThrow(`not a page of this build: ${ORIGIN}/elsewhere, https://example.com/`);
    await expect(tell(without(build(), `${KEY}.txt`), PAGES, send)).rejects.toThrow(
      'the build holds no IndexNow key file',
    );
    expect(sent).toEqual([]);
  });
});
