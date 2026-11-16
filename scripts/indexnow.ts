// Tells IndexNow which pages of the site are new or have changed, so that the search engines taking
// part fetch them without waiting for their next crawl.
// Pure: the build, the way to ask the site and the way to send are handed in (`tell-indexnow.ts` does that).
import { address, type Fetch } from './site-check.ts';

/** `dist/` as path → bytes. */
export type Build = Map<string, Uint8Array>;

/** What telling needs from `fetch`: one request with a method, headers and a body. */
export type Send = (url: string, init: RequestInit) => Promise<Response>;

/** Any engine that takes part passes a notice on to the others. */
const ENDPOINT = 'https://api.indexnow.org/indexnow';

/** What the protocol says each answer means. */
const ACCEPTED: Record<number, string> = { 200: 'submitted', 202: 'received, the key is still to be verified' };
const REFUSED: Record<number, string> = {
  400: 'invalid format',
  403: 'the key is not valid (not found, or its file does not hold it)',
  422: 'the addresses do not belong to the host, or the key does not fit the protocol',
  429: 'too many requests',
};

const text = (bytes: Uint8Array | undefined) => new TextDecoder().decode(bytes ?? new Uint8Array());
const locations = (xml: string) => [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);

/** The pages of the build, as its sitemap lists them. */
export function pagesOf(build: Build): string[] {
  const sitemaps = locations(text(build.get('sitemap-index.xml')));
  const pages = sitemaps.flatMap((sitemap) => locations(text(build.get(new URL(sitemap).pathname.slice(1)))));
  if (pages.length === 0) throw new Error('the sitemap of the build lists no page');
  return pages;
}

/** The key of the build: the one text file at its root whose content is its own name. */
export function keyOf(build: Build): string {
  const keys = [...build].flatMap(([file, bytes]) => {
    const name = /^([A-Za-z0-9-]{8,128})\.txt$/.exec(file)?.[1];
    return name && text(bytes).trim() === name ? [name] : [];
  });
  if (keys.length !== 1)
    throw new Error(`the build holds ${keys.length || 'no'} IndexNow key ${keys.length > 1 ? 'files' : 'file'}`);
  return keys[0];
}

/** Whether the site answers `url` with status 200 and exactly `built`. A request that gets no answer is a no. */
async function serves(fetch: Fetch, url: string, built: Uint8Array | undefined): Promise<boolean> {
  const response = await fetch(url).catch(() => null);
  if (!built || response?.status !== 200) return false;
  const served = new Uint8Array(await response.arrayBuffer());
  return served.length === built.length && served.every((byte, at) => byte === built[at]);
}

/**
 * The pages IndexNow has not heard of as the build has them: those the site does not serve as built.
 * To be asked before the upload; afterwards the site serves them all.
 */
export async function news(build: Build, fetch: Fetch): Promise<string[]> {
  const pages = pagesOf(build);
  const key = keyOf(build);
  const { origin } = new URL(pages[0]);
  // A site that has not shown its key has told IndexNow nothing: every page is news.
  if (!(await serves(fetch, `${origin}/${key}.txt`, build.get(`${key}.txt`)))) return pages;

  const fileAt = new Map([...build.keys()].map((file) => [origin + address(file).path, file]));
  const changed: string[] = [];
  for (const page of pages) if (!(await serves(fetch, page, build.get(fileAt.get(page) ?? '')))) changed.push(page);
  return changed;
}

/**
 * The pages IndexNow is still owed: those `noted` earlier and never sent, and those this upload has `changed`.
 * In the order of the sitemap; an address the build no longer lists is dropped.
 */
export function owed(build: Build, noted: string[], changed: string[]): string[] {
  const due = new Set([...noted, ...changed]);
  return pagesOf(build).filter((page) => due.has(page));
}

/** Sends IndexNow the addresses of `pages` and says what it answered. Anything but an acceptance is an error. */
export async function tell(build: Build, pages: string[], send: Send): Promise<string> {
  const known = new Set(pagesOf(build));
  const strangers = pages.filter((page) => !known.has(page));
  if (strangers.length > 0) throw new Error(`not a page of this build: ${strangers.join(', ')}`);
  const key = keyOf(build);
  if (pages.length === 0) return 'no page changed: nothing to tell IndexNow';

  const { host, origin } = new URL(pages[0]);
  const response = await send(ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ host, key, keyLocation: `${origin}/${key}.txt`, urlList: pages }),
  }).catch((error: Error) => {
    throw new Error(`IndexNow gave no answer (${error.message})`);
  });

  const accepted = ACCEPTED[response.status];
  if (accepted)
    return `IndexNow was told of ${pages.length} ${pages.length === 1 ? 'page' : 'pages'} (${response.status}: ${accepted})`;
  const refused = REFUSED[response.status];
  throw new Error(`IndexNow answered ${response.status}${refused ? `: ${refused}` : ''}`);
}
