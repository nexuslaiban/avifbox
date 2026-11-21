// The hidden document's side: fetch the image, convert it with the site's engine, report the file.
// Nothing here touches the browser: the engine's pool and the document's functions are handed in
// (`offscreen.ts` does that).
import { MAX_FILE_BYTES } from '../src/engine/limits';
import { stem } from '../src/engine/names';
import { defaultOptions } from '../src/engine/options';
import type { JobRunner } from '../src/engine/pool';
import type { Target } from '../src/engine/types';
import { TRY_AGAIN, type Job, type Result } from './protocol';

/** What fetching needs from `fetch`. */
export type Fetch = (url: string, init: RequestInit) => Promise<Response>;

export interface Host {
  fetch: Fetch;
  runner: JobRunner;
  /** Gives a file an address the browser can download it from. */
  address(file: Blob): string;
  /** Lets go of such an address, and of the file with it. */
  release(url: string): void;
  /** Tells the background how a job ended. */
  report(result: Result): void;
  /** Closes the document. */
  close(): void;
}

/** A failure the user is told as it is. Any other error is the extension's own: "try again". */
class Failure extends Error {}

const UNREACHABLE =
  'Could not fetch this image. The site may have refused the request, the image may exist only inside the page, ' +
  'or AVIFBox may not be allowed to read it (see the extension’s site access in the browser’s settings).';
const TOO_LARGE = `This image is larger than ${MAX_FILE_BYTES / (1024 * 1024)} MB, the most AVIFBox converts.`;

/** How long the document stays after its last job, and a file's address after it was handed over. */
const LINGER_MS = 60_000;
/**
 * How long a name may be before its extension. File systems count 255 bytes or characters, the browser
 * adds a suffix while it writes, and Windows counts the folder too.
 */
const NAME_BYTES = 120;
/** The browser refuses the first seven, changes `%` without a word, and controls have no place in a name. */
const UNSAFE = /[\\/:*?"<>|%\u0000-\u001f\u007f-\u009f]/g;
const encoder = new TextEncoder();

/** `text` without what would make it longer than `bytes` bytes of UTF-8. Never cuts inside a character. */
function cut(text: string, bytes: number): string {
  let kept = '';
  for (const character of text) {
    bytes -= encoder.encode(character).length;
    if (bytes < 0) break;
    kept += character;
  }
  return kept;
}

/** The last segment of the address's path, readable: `image` when there is none to take. */
function lastSegment(srcUrl: string): string {
  try {
    const { protocol, pathname } = new URL(srcUrl);
    if (!['http:', 'https:', 'file:'].includes(protocol)) return 'image';
    return decodeURIComponent(pathname.slice(pathname.lastIndexOf('/') + 1));
  } catch {
    return 'image'; // not an address, or not valid percent-encoding
  }
}

/** The name to save the image at `srcUrl` under: its own, with the extension of `target`. */
export function nameFor(srcUrl: string, target: Target): string {
  return `${cut(stem(lastSegment(srcUrl).replace(UNSAFE, '_')), NAME_BYTES)}.${target}`;
}

const reached = <T>(answer: Promise<T>): Promise<T> =>
  answer.catch(() => {
    throw new Failure(UNREACHABLE);
  });

/**
 * The image at `srcUrl`, asked for once, with the cookies of its site: some images are only there for
 * a signed-in visitor. No header is added, so a site that negotiates the format may answer with the
 * JPEG or PNG it holds, which is the better source.
 */
export async function fetchImage(srcUrl: string, fetch: Fetch): Promise<Blob> {
  const response = await reached(fetch(srcUrl, { credentials: 'include' }));
  if (!response.ok) throw new Failure(`Could not fetch this image: the site answered ${response.status}.`);

  const reader = response.body?.getReader();
  const pieces: Uint8Array<ArrayBuffer>[] = [];
  // Counted as it arrives: the length a site announces is the site's word.
  for (let size = 0; reader;) {
    const { done, value } = await reached(reader.read());
    if (done) break;
    size += value.length;
    if (size > MAX_FILE_BYTES) {
      void reader.cancel().catch(() => {});
      throw new Failure(TOO_LARGE);
    }
    pieces.push(value);
  }
  return new Blob(pieces);
}

/**
 * The first file the engine makes of `file`. The job is stopped as soon as that file is there: of an
 * animation it is the first frame, and no menu item can ask which others are wanted.
 */
export function firstFile(runner: JobRunner, file: Blob, target: Target): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const job = runner.submit(file, defaultOptions(target), {
      onEvent(event) {
        if (event.type !== 'output') return;
        runner.cancel(job);
        resolve(event.output.blob);
      },
      onDone: () => reject(new Failure(TRY_AGAIN)),
      onError: (message) => reject(new Failure(message)),
    });
  });
}

async function save({ srcUrl, target }: Job, host: Host): Promise<Result> {
  try {
    const file = await firstFile(host.runner, await fetchImage(srcUrl, host.fetch), target);
    // The browser refuses more names than a list could keep up with, so it is given a second to fall back on.
    return { url: host.address(file), names: [...new Set([nameFor(srcUrl, target), `image.${target}`])] };
  } catch (error) {
    return { failure: error instanceof Failure ? error.message : TRY_AGAIN };
  }
}

/**
 * Returns what takes a job and says whether it did: it saves the image, reports how that ended and
 * looks after the document's lifetime. Chrome closes no hidden document, and one that stays keeps the
 * engine's memory, so it closes itself a minute after its last job.
 */
export function saver(host: Host): (job: Job) => boolean {
  let running = 0;
  let closing: ReturnType<typeof setTimeout> | undefined;
  let closed = false;

  function close(): void {
    closed = true;
    host.close();
  }

  async function run(job: Job): Promise<void> {
    const result = await save(job, host);
    host.report(result);
    // As the site's own `saveAs` does: the download has long begun by then, and one that has begun keeps its file.
    if ('url' in result) setTimeout(() => host.release(result.url), LINGER_MS);
    if (--running === 0) closing = setTimeout(close, LINGER_MS);
  }

  return (job) => {
    // A document that has asked to be closed is there for a moment more, and would take the job with it.
    if (closed) return false;
    clearTimeout(closing);
    running++;
    void run(job);
    return true;
  };
}
