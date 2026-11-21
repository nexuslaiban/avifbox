import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchImage, firstFile, nameFor, saver, type Host } from '../../extension/save';
import type { Result } from '../../extension/protocol';
import { MAX_FILE_BYTES } from '../../src/engine/limits';
import { defaultOptions } from '../../src/engine/options';
import type { JobHandlers, JobRunner } from '../../src/engine/pool';
import type { ConvertEvent, ConvertOptions } from '../../src/engine/types';

const UNREACHABLE =
  'Could not fetch this image. The site may have refused the request, the image may exist only inside the page, ' +
  'or AVIFBox may not be allowed to read it (see the extension’s site access in the browser’s settings).';
const TOO_LARGE = 'This image is larger than 50 MB, the most AVIFBox converts.';
const TRY_AGAIN = 'Something went wrong while saving this image. Please try again.';

/** A runner that records what it is given and does nothing until the test plays the engine's part. */
function runner() {
  const jobs: { file: Blob; options: ConvertOptions; handlers: JobHandlers }[] = [];
  const cancelled: number[] = [];
  const fake: JobRunner = {
    submit: (file, options, handlers) => jobs.push({ file, options, handlers }),
    cancel: (job) => void cancelled.push(job),
  };
  return { fake, jobs, cancelled };
}

const output = (blob: Blob, frame: number | null = null): ConvertEvent => ({
  type: 'output',
  output: { blob, width: 1, height: 1, frame },
});
const info: ConvertEvent = {
  type: 'info',
  info: { format: 'avif', bitDepth: 8, animated: false, cicp: null, hdr: null },
  frameCount: 1,
  width: 1,
  height: 1,
  toneMapped: false,
};

/** A body of `chunks` pieces of `size` bytes, handed out one at a time as it is read. */
function body(chunks: number, size: number) {
  const seen = { pulled: 0, cancelled: false };
  const piece = new Uint8Array(size);
  const stream = new ReadableStream<Uint8Array<ArrayBuffer>>(
    {
      pull(controller) {
        if (seen.pulled === chunks) return controller.close();
        seen.pulled++;
        controller.enqueue(piece);
      },
      cancel() {
        seen.cancelled = true;
      },
    },
    { highWaterMark: 0 },
  );
  return { stream, seen };
}

describe('AC-64 the name asked of the browser', () => {
  it.each([
    ['https://cdn.example/a/photo.avif?w=800#x', 'png', 'photo.png'],
    ['https://cdn.example/a/My%20photo.final.webp', 'jpg', 'My photo.final.jpg'],
    ['https://cdn.example/a/photo:large', 'png', 'photo_large.png'],
    ['https://cdn.example/a/a%2Fb.avif', 'png', 'a_b.png'],
    ['https://cdn.example/a/100%25.avif', 'png', '100_.png'],
    ['https://cdn.example/a/a%5Cb%3Ac%2Ad%3Fe%22f%3Cg%3Eh%7Ci.avif', 'png', 'a_b_c_d_e_f_g_h_i.png'],
    ['https://cdn.example/a/tab%09and%7Fdel.avif', 'png', 'tab_and_del.png'],
    ['file:///home/me/Pictures/cat.webp', 'jpg', 'cat.jpg'],
    ['https://cdn.example/a/noextension', 'jpg', 'noextension.jpg'],
    ['https://cdn.example/a/%E7%8C%AB.avif', 'png', '猫.png'],
  ] as const)('%s as %s is %s', (address, target, name) => {
    expect(nameFor(address, target)).toBe(name);
  });

  it.each([
    ['https://cdn.example/', 'no path segment'],
    ['https://cdn.example/photos/', 'an empty last segment'],
    ['https://cdn.example/a/%E0%A4%A.avif', 'a segment that is not valid percent-encoding'],
    ['data:image/avif;base64,AAAA', 'a data: address'],
    ['blob:https://example.com/0b0c0d0e-photo.avif', 'a blob: address'],
    ['not an address', 'no address at all'],
  ])('%s (%s) is image.png', (address) => {
    expect(nameFor(address, 'png')).toBe('image.png');
  });

  it('cuts the name to 120 bytes of UTF-8 before the extension, never inside a character', () => {
    const chinese = '图'.repeat(100); // 3 bytes each
    expect(nameFor(`https://cdn.example/${encodeURIComponent(chinese)}.avif`, 'png')).toBe(`${'图'.repeat(40)}.png`);
    expect(nameFor(`https://cdn.example/${'a'.repeat(300)}.avif`, 'jpg')).toBe(`${'a'.repeat(120)}.jpg`);
    // 119 bytes, then a character of 4: it does not fit, and is not cut in two.
    expect(nameFor(`https://cdn.example/${'a'.repeat(119)}${encodeURIComponent('😀')}.avif`, 'png')).toBe(
      `${'a'.repeat(119)}.png`,
    );
    expect(nameFor(`https://cdn.example/${'a'.repeat(120)}.avif`, 'png')).toBe(`${'a'.repeat(120)}.png`);
  });
});

describe('AC-67 fetching the image', () => {
  it('is one request for the address, with the cookies of its site and nothing else', async () => {
    const fetch = vi.fn(async () => new Response(new Uint8Array([1, 2, 3])));
    const blob = await fetchImage('https://cdn.example/a.avif', fetch);
    expect(fetch.mock.calls).toEqual([['https://cdn.example/a.avif', { credentials: 'include' }]]);
    expect([...new Uint8Array(await blob.arrayBuffer())]).toEqual([1, 2, 3]);
  });

  it.each([404, 403, 500, 304])('fails with the status when the site answers %i', async (status) => {
    const fetch = vi.fn(async () => new Response(null, { status }));
    await expect(fetchImage('https://cdn.example/a.avif', fetch)).rejects.toThrow(
      `Could not fetch this image: the site answered ${status}.`,
    );
    expect(fetch).toHaveBeenCalledTimes(1); // nothing is retried
  });

  it('fails when the request gets no answer', async () => {
    const fetch = vi.fn(async (): Promise<Response> => {
      throw new TypeError('Failed to fetch');
    });
    await expect(fetchImage('blob:https://example.com/1', fetch)).rejects.toThrow(UNREACHABLE);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('fails when the body cannot be read to its end', async () => {
    let sent = false;
    const broken = new ReadableStream<Uint8Array<ArrayBuffer>>({
      pull(controller) {
        if (sent) return controller.error(new TypeError('network error'));
        sent = true;
        controller.enqueue(new Uint8Array(10));
      },
    });
    await expect(fetchImage('https://cdn.example/a.avif', async () => new Response(broken))).rejects.toThrow(
      UNREACHABLE,
    );
  });

  it('takes a body of exactly 50 MB', async () => {
    const { stream } = body(50, MAX_FILE_BYTES / 50);
    const blob = await fetchImage('https://cdn.example/a.avif', async () => new Response(stream));
    expect(blob.size).toBe(MAX_FILE_BYTES);
  });

  it('fails on more than 50 MB and stops reading there, whatever length the site announced', async () => {
    const megabyte = 1024 * 1024;
    const { stream, seen } = body(1000, megabyte);
    const response = new Response(stream, { headers: { 'content-length': '10' } });
    await expect(fetchImage('https://cdn.example/a.avif', async () => response)).rejects.toThrow(TOO_LARGE);
    expect(seen.pulled).toBe(51); // the piece that passed the limit was the last one asked for
    expect(seen.cancelled).toBe(true);
  });

  it('gives an empty file for an answer without a body', async () => {
    const blob = await fetchImage('https://cdn.example/a.avif', async () => new Response(null, { status: 204 }));
    expect(blob.size).toBe(0);
  });
});

describe('AC-68 converting', () => {
  it("uses the settings a page of the site starts with, and the engine's first file is the result", async () => {
    const { fake, jobs, cancelled } = runner();
    const file = new Blob(['source']);
    const [first, second] = [new Blob(['first']), new Blob(['second'])];
    const result = firstFile(fake, file, 'png');

    expect(jobs).toHaveLength(1);
    expect(jobs[0].file).toBe(file);
    expect(jobs[0].options).toEqual(defaultOptions('png'));
    jobs[0].handlers.onEvent(info);
    expect(cancelled).toEqual([]);
    jobs[0].handlers.onEvent(output(first, 0));
    // The job has ended here: no `onDone` comes after a cancel, and none is waited for.
    await expect(result).resolves.toBe(first);
    expect(cancelled).toEqual([1]);

    // Whatever a runner still sends is not used.
    jobs[0].handlers.onEvent(output(second, 1));
    jobs[0].handlers.onError('too late');
    jobs[0].handlers.onDone();
    await expect(result).resolves.toBe(first);
  });

  it('asks for a JPG with the JPG settings', () => {
    const { fake, jobs } = runner();
    void firstFile(fake, new Blob(), 'jpg');
    expect(jobs[0].options).toEqual(defaultOptions('jpg'));
  });

  it("fails in the engine's words when the engine reports an error", async () => {
    const { fake, jobs } = runner();
    const result = firstFile(fake, new Blob(), 'png');
    jobs[0].handlers.onError('Not a supported image. AVIFBox reads AVIF, WebP, JPG/JFIF and PNG.');
    await expect(result).rejects.toThrow('Not a supported image. AVIFBox reads AVIF, WebP, JPG/JFIF and PNG.');
  });

  it('fails when the job ends without a file', async () => {
    const { fake, jobs } = runner();
    const result = firstFile(fake, new Blob(), 'png');
    jobs[0].handlers.onEvent(info);
    jobs[0].handlers.onDone();
    await expect(result).rejects.toThrow(TRY_AGAIN);
  });
});

/** The hidden document's surroundings: every request waits until the test answers it. */
function host() {
  const { fake, jobs } = runner();
  const answers: ((response: Response | Error) => void)[] = [];
  const reported: Result[] = [];
  const released: string[] = [];
  let urls = 0;
  const made: Host = {
    fetch: () =>
      new Promise<Response>((resolve, reject) => {
        answers.push((answer) => (answer instanceof Error ? reject(answer) : resolve(answer)));
      }),
    runner: fake,
    address: () => `blob:${++urls}`,
    release: (url) => void released.push(url),
    report: (result) => void reported.push(result),
    close: vi.fn(),
  };
  /** Plays site and engine for request `at`: the image arrives and is converted. */
  async function finish(at: number): Promise<void> {
    answers[at](new Response(new Uint8Array([1])));
    await vi.advanceTimersByTimeAsync(0);
    jobs[at].handlers.onEvent(output(new Blob(['out'])));
    await vi.advanceTimersByTimeAsync(0);
  }
  return { made, answers, jobs, reported, released, finish };
}

describe('the hidden document', () => {
  beforeEach(() => void vi.useFakeTimers());
  afterEach(() => void vi.useRealTimers());

  it('AC-65 reports the file with its names in order of preference: its own, then image', async () => {
    const { made, reported, finish } = host();
    saver(made)({ srcUrl: 'https://cdn.example/a/photo.avif', target: 'png' });
    await finish(0);
    expect(reported).toEqual([{ url: 'blob:1', names: ['photo.png', 'image.png'] }]);
  });

  it('AC-65 names a file once when its own name is image', async () => {
    const { made, reported, finish } = host();
    saver(made)({ srcUrl: 'data:image/avif;base64,AAAA', target: 'jpg' });
    await finish(0);
    expect(reported).toEqual([{ url: 'blob:1', names: ['image.jpg'] }]);
  });

  it('AC-67 reports why an image could not be fetched', async () => {
    const { made, answers, jobs, reported } = host();
    const take = saver(made);
    take({ srcUrl: 'https://cdn.example/a.avif', target: 'png' });
    take({ srcUrl: 'https://cdn.example/b.avif', target: 'png' });
    answers[0](new Response(null, { status: 404 }));
    answers[1](new TypeError('Failed to fetch'));
    await vi.advanceTimersByTimeAsync(0);
    expect(reported).toEqual([
      { failure: 'Could not fetch this image: the site answered 404.' },
      { failure: UNREACHABLE },
    ]);
    expect(jobs).toHaveLength(0); // nothing went to the engine
  });

  it("AC-68 reports the engine's error, and an error of its own as one to try again", async () => {
    const { made, answers, jobs, reported } = host();
    made.address = () => {
      throw new Error('out of memory');
    };
    const take = saver(made);
    take({ srcUrl: 'https://cdn.example/a.avif', target: 'png' });
    take({ srcUrl: 'https://cdn.example/b.avif', target: 'png' });
    answers.forEach((answer) => answer(new Response(null)));
    await vi.advanceTimersByTimeAsync(0);
    expect(jobs.map((job) => job.file.size)).toEqual([0, 0]); // an empty body goes to the engine, which names it
    jobs[0].handlers.onError('Not a supported image. AVIFBox reads AVIF, WebP, JPG/JFIF and PNG.');
    jobs[1].handlers.onEvent(output(new Blob(['out'])));
    await vi.advanceTimersByTimeAsync(0);
    expect(reported).toEqual([
      { failure: 'Not a supported image. AVIFBox reads AVIF, WebP, JPG/JFIF and PNG.' },
      { failure: TRY_AGAIN },
    ]);
  });

  it('AC-73 closes itself 60 seconds after its last job ended', async () => {
    const { made, finish } = host();
    saver(made)({ srcUrl: 'https://cdn.example/a.avif', target: 'png' });
    await vi.advanceTimersByTimeAsync(600_000); // a job that runs for ten minutes keeps it open
    expect(made.close).not.toHaveBeenCalled();
    await finish(0);
    await vi.advanceTimersByTimeAsync(59_999);
    expect(made.close).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(made.close).toHaveBeenCalledTimes(1);
  });

  it('AC-73 counts from a failure as from a file', async () => {
    const { made, answers } = host();
    saver(made)({ srcUrl: 'https://cdn.example/a.avif', target: 'png' });
    answers[0](new Response(null, { status: 404 }));
    await vi.advanceTimersByTimeAsync(60_000);
    expect(made.close).toHaveBeenCalledTimes(1);
  });

  it('AC-73 starts the count again when a job arrives, and does not close while one runs', async () => {
    const { made, finish } = host();
    const take = saver(made);
    take({ srcUrl: 'https://cdn.example/a.avif', target: 'png' });
    await finish(0);
    await vi.advanceTimersByTimeAsync(30_000);
    take({ srcUrl: 'https://cdn.example/b.avif', target: 'png' });
    await vi.advanceTimersByTimeAsync(120_000); // long past the first count
    expect(made.close).not.toHaveBeenCalled();
    await finish(1);
    await vi.advanceTimersByTimeAsync(59_999);
    expect(made.close).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(made.close).toHaveBeenCalledTimes(1);
  });

  it('AC-73 stays open until every job of several has ended', async () => {
    const { made, finish } = host();
    const take = saver(made);
    take({ srcUrl: 'https://cdn.example/a.avif', target: 'png' });
    take({ srcUrl: 'https://cdn.example/b.avif', target: 'png' });
    await finish(0);
    await vi.advanceTimersByTimeAsync(120_000);
    expect(made.close).not.toHaveBeenCalled();
    await finish(1);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(made.close).toHaveBeenCalledTimes(1);
  });

  it('AC-73 says whether it took a job, and takes none once it has asked to be closed', async () => {
    const { made, answers, finish } = host();
    const take = saver(made);
    expect(take({ srcUrl: 'https://cdn.example/a.avif', target: 'png' })).toBe(true);
    await finish(0);
    await vi.advanceTimersByTimeAsync(59_999);
    expect(take({ srcUrl: 'https://cdn.example/b.avif', target: 'png' })).toBe(true); // still open: the count starts again
    await finish(1);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(made.close).toHaveBeenCalledTimes(1);

    // The document is on its way out and would take the job with it, without a word.
    expect(take({ srcUrl: 'https://cdn.example/c.avif', target: 'png' })).toBe(false);
    await vi.advanceTimersByTimeAsync(120_000);
    expect(answers).toHaveLength(2); // nothing was asked for
    expect(made.close).toHaveBeenCalledTimes(1);
  });

  it("AC-73 releases each result's address 60 seconds after handing it over, whatever else is running", async () => {
    const { made, released, finish } = host();
    const take = saver(made);
    take({ srcUrl: 'https://cdn.example/a.avif', target: 'png' });
    take({ srcUrl: 'https://cdn.example/b.avif', target: 'png' }); // keeps the document open throughout
    await finish(0);
    await vi.advanceTimersByTimeAsync(59_999);
    expect(released).toEqual([]);
    await vi.advanceTimersByTimeAsync(1);
    expect(released).toEqual(['blob:1']);
    expect(made.close).not.toHaveBeenCalled();
  });
});
