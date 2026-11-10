import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Pool, type JobHandlers } from '../../src/engine/pool';
import type { JobReply, JobRequest } from '../../src/engine/protocol';
import type { ConvertOptions } from '../../src/engine/types';

const OPTIONS = { target: 'png' } as ConvertOptions;

class FakeWorker {
  static created: FakeWorker[] = [];
  onmessage: ((event: MessageEvent<JobReply>) => void) | null = null;
  onerror: ((event: unknown) => void) | null = null;
  terminated = false;
  received: JobRequest[] = [];

  constructor() {
    FakeWorker.created.push(this);
  }

  postMessage(request: JobRequest): void {
    this.received.push(request);
  }

  terminate(): void {
    this.terminated = true;
  }

  reply(reply: JobReply): void {
    this.onmessage?.({ data: reply } as MessageEvent<JobReply>);
  }

  get job(): number {
    return this.received[this.received.length - 1].job;
  }
}

function handlers() {
  const log: string[] = [];
  const h: JobHandlers = {
    onEvent: (event) => log.push(event.type),
    onDone: () => log.push('done'),
    onError: (message) => log.push(`error: ${message}`),
  };
  return { h, log };
}

const live = () => FakeWorker.created.filter((worker) => !worker.terminated);
const blob = new Blob(['x']);
const flush = () => new Promise<void>((resolve) => queueMicrotask(resolve));

describe('Pool', () => {
  beforeEach(() => {
    FakeWorker.created = [];
    vi.stubGlobal('Worker', FakeWorker);
    vi.stubGlobal('navigator', { hardwareConcurrency: 5, deviceMemory: 8 });
  });

  afterEach(() => vi.unstubAllGlobals());

  it('starts workers on demand, up to its size, and queues the rest', () => {
    const pool = new Pool();
    expect(FakeWorker.created).toHaveLength(0);
    for (let i = 0; i < 10; i++) pool.submit(blob, OPTIONS, handlers().h);
    expect(FakeWorker.created).toHaveLength(4);
    expect(FakeWorker.created.map((worker) => worker.job)).toEqual([1, 2, 3, 4]);
  });

  it('hands the next queued job to a worker that finished', () => {
    const pool = new Pool();
    const runs = Array.from({ length: 5 }, handlers);
    runs.forEach((run) => pool.submit(blob, OPTIONS, run.h));
    FakeWorker.created[0].reply({
      job: 1,
      event: { type: 'output', output: { blob, width: 1, height: 1, frame: null } },
    });
    FakeWorker.created[0].reply({ job: 1, done: true });
    expect(runs[0].log).toEqual(['output', 'done']);
    expect(FakeWorker.created[0].job).toBe(5);
    expect(FakeWorker.created).toHaveLength(4);
  });

  it('does not start a worker for jobs that are cancelled in the same turn', async () => {
    const pool = new Pool();
    const jobs = Array.from({ length: 50 }, () => pool.submit(blob, OPTIONS, handlers().h));
    expect(FakeWorker.created).toHaveLength(4);
    for (const job of jobs) pool.cancel(job);
    await flush();
    expect(FakeWorker.created).toHaveLength(4); // the four that were running, and no replacements
    expect(live()).toHaveLength(0);
  });

  it('stops a running job by retiring its worker, and stays silent about it', async () => {
    const pool = new Pool();
    const run = handlers();
    const job = pool.submit(blob, OPTIONS, run.h);
    const worker = FakeWorker.created[0];
    pool.cancel(job);
    expect(worker.terminated).toBe(true);
    worker.reply({ job, done: true });
    worker.onerror?.({});
    expect(run.log).toEqual([]);

    // A late error from the retired worker must not unhook a healthy one.
    const next = handlers();
    pool.submit(blob, OPTIONS, next.h);
    await flush();
    const replacement = live()[0];
    replacement.reply({ job: replacement.job, done: true });
    expect(next.log).toEqual(['done']);
  });

  it('reports a worker that never started differently from one that died while working', () => {
    const pool = new Pool();
    const first = handlers();
    pool.submit(blob, OPTIONS, first.h);
    FakeWorker.created[0].onerror?.({});
    expect(first.log).toHaveLength(1);
    expect(first.log[0]).toMatch(/could not load/i);

    const second = handlers();
    pool.submit(blob, OPTIONS, second.h);
    const worker = live()[0];
    worker.reply({ ready: true });
    worker.onerror?.({});
    expect(second.log).toEqual([expect.stringMatching(/memory/i)]);
  });

  it('replaces a crashed worker so queued jobs still run', () => {
    const pool = new Pool();
    const runs = Array.from({ length: 5 }, handlers);
    runs.forEach((run) => pool.submit(blob, OPTIONS, run.h));
    const crashed = FakeWorker.created[0];
    crashed.reply({ ready: true });
    crashed.onerror?.({});
    expect(crashed.terminated).toBe(true);
    expect(live()).toHaveLength(4);
    expect(live().map((worker) => worker.job)).toContain(5);
  });
});
