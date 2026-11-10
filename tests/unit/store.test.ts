import { describe, expect, it, vi } from 'vitest';
import type { JobHandlers, JobRunner } from '../../src/engine/pool';
import { MAX_FILE_BYTES } from '../../src/engine/limits';
import type { ConvertOptions, ImageInfo } from '../../src/engine/types';
import { ConverterStore, selectedOutputs, totals } from '../../src/ui/store';

const OPTIONS: ConvertOptions = {
  target: 'png',
  pngMode: 'truecolor',
  quality: 90,
  background: null,
  animation: 'frames',
  tone: 'brightness',
  gamut: 'srgb',
  keepJpeg: true,
};

const INFO: ImageInfo = { format: 'avif', bitDepth: 8, animated: false, cicp: null, hdr: null };

class FakeRunner implements JobRunner {
  jobs = new Map<number, { file: Blob; options: ConvertOptions; handlers: JobHandlers }>();
  cancelled: number[] = [];
  private next = 1;

  submit(file: Blob, options: ConvertOptions, handlers: JobHandlers): number {
    this.jobs.set(this.next, { file, options, handlers });
    return this.next++;
  }

  cancel(job: number): void {
    this.cancelled.push(job);
    this.jobs.delete(job);
  }

  /** Plays a whole successful conversion with `frames` outputs. */
  finish(job: number, frames = 1): void {
    const { handlers } = this.jobs.get(job)!;
    handlers.onEvent({ type: 'info', info: INFO, frameCount: frames, width: 64, height: 48, toneMapped: false });
    for (let i = 0; i < frames; i++) {
      handlers.onEvent({ type: 'output', output: { blob: new Blob(['x'.repeat(10 + i)]), width: 64, height: 48, frame: frames > 1 ? i : null } });
    }
    handlers.onDone();
    this.jobs.delete(job);
  }
}

const file = (name: string, size = 100): File => new File([new Uint8Array(size)], name);

function setup(options = OPTIONS) {
  const runner = new FakeRunner();
  const store = new ConverterStore(runner, options);
  return { runner, store };
}

describe('ConverterStore', () => {
  it('queues added files and submits each with the current options', () => {
    const { runner, store } = setup();
    store.add([file('a.avif'), file('b.avif')]);
    expect(store.getState().items.map((i) => [i.file.name, i.status])).toEqual([
      ['a.avif', 'pending'],
      ['b.avif', 'pending'],
    ]);
    expect([...runner.jobs.values()].map((j) => j.options)).toEqual([OPTIONS, OPTIONS]);
  });

  it('records details and outputs, then marks the item done', () => {
    const { runner, store } = setup();
    store.add([file('still.avif')]);
    runner.finish(1);
    const [item] = store.getState().items;
    expect(item.status).toBe('done');
    expect(item.detail).toMatchObject({ width: 64, height: 48, frameCount: 1 });
    expect(item.outputs).toHaveLength(1);
    expect(item.outputs[0]).toMatchObject({ name: 'still.png', selected: true, frame: null });
    expect(item.outputs[0].url).toMatch(/^blob:/);
  });

  it('gives files with the same name distinct output names', () => {
    const { runner, store } = setup();
    store.add([file('still.avif'), file('still.avif'), file('STILL.avif')]);
    [1, 2, 3].forEach((job) => runner.finish(job));
    expect(store.getState().items.map((i) => i.outputs[0].name)).toEqual(['still.png', 'still (2).png', 'STILL (3).png']);
  });

  it('numbers animation frames and lets them be deselected', () => {
    const { runner, store } = setup();
    store.add([file('anim.avif')]);
    runner.finish(1, 5);
    const [item] = store.getState().items;
    expect(item.outputs.map((o) => o.name)).toEqual(['anim-001.png', 'anim-002.png', 'anim-003.png', 'anim-004.png', 'anim-005.png']);
    store.toggle(item.id, 2);
    expect(selectedOutputs(store.getState()).map((o) => o.name)).toEqual(['anim-001.png', 'anim-002.png', 'anim-004.png', 'anim-005.png']);
    store.toggle(item.id, 2);
    expect(selectedOutputs(store.getState())).toHaveLength(5);
    store.selectAll(item.id, false);
    expect(selectedOutputs(store.getState())).toHaveLength(0);
    store.selectAll(item.id, true);
    expect(selectedOutputs(store.getState())).toHaveLength(5);
  });

  it('keeps a failure on its own item', () => {
    const { runner, store } = setup();
    store.add([file('bad.avif'), file('good.avif')]);
    runner.jobs.get(1)!.handlers.onError('Could not decode this file.');
    runner.finish(2);
    expect(store.getState().items.map((i) => [i.status, i.error])).toEqual([
      ['error', 'Could not decode this file.'],
      ['done', null],
    ]);
  });

  it('re-converts everything when an option changes', () => {
    const { runner, store } = setup();
    store.add([file('a.avif'), file('b.avif')]);
    runner.finish(1);
    const revoke = vi.spyOn(URL, 'revokeObjectURL');
    const stale = store.getState().items[0].outputs[0].url;

    store.setOptions({ target: 'jpg', quality: 70 });

    expect(runner.cancelled).toEqual([2]); // job 1 had finished; job 2 was still pending
    expect(revoke).toHaveBeenCalledWith(stale);
    expect(store.getState().items.map((i) => [i.status, i.outputs.length])).toEqual([
      ['pending', 0],
      ['pending', 0],
    ]);
    expect([...runner.jobs.values()].map((j) => j.options.target)).toEqual(['jpg', 'jpg']);
    runner.finish(3);
    expect(store.getState().items[0].outputs[0].name).toBe('a.jpg');
    revoke.mockRestore();
  });

  it('does nothing when an option is set to the value it already has', () => {
    const { runner, store } = setup();
    store.add([file('a.avif')]);
    runner.finish(1);
    store.setOptions({ target: 'png' });
    expect(store.getState().items[0].status).toBe('done');
    expect(runner.jobs.size).toBe(0);
  });

  it('removes one item, cancelling its job', () => {
    const { runner, store } = setup();
    store.add([file('a.avif'), file('b.avif')]);
    const [first] = store.getState().items;
    store.remove(first.id);
    expect(runner.cancelled).toEqual([1]);
    expect(store.getState().items.map((i) => i.file.name)).toEqual(['b.avif']);
  });

  it('clears the list and the notice', () => {
    const { runner, store } = setup();
    store.add(Array.from({ length: 51 }, (_, i) => file(`f${i}.avif`)));
    store.clear();
    expect(store.getState()).toMatchObject({ items: [], notice: null });
    expect(runner.cancelled).toHaveLength(50);
  });

  it('caps a batch at 50 files and says how many were left out (AC-11)', () => {
    const { store } = setup();
    store.add(Array.from({ length: 51 }, (_, i) => file(`f${i}.avif`)));
    expect(store.getState().items).toHaveLength(50);
    expect(store.getState().notice).toContain('1 file was left out');
    store.add([file('x.avif'), file('y.avif')]);
    expect(store.getState().notice).toContain('2 files were left out');
  });

  it('refuses a file over 50 MB by name (AC-11)', () => {
    const { store } = setup();
    const huge = file('huge.avif');
    Object.defineProperty(huge, 'size', { value: MAX_FILE_BYTES + 1 });
    store.add([huge, file('ok.avif')]);
    expect(store.getState().items.map((i) => i.file.name)).toEqual(['ok.avif']);
    expect(store.getState().notice).toContain('huge.avif');
    expect(store.getState().notice).toContain('50 MB');
  });

  it('frees a removed name for reuse', () => {
    const { runner, store } = setup();
    store.add([file('a.avif')]);
    store.remove(store.getState().items[0].id);
    store.add([file('a.avif')]);
    runner.finish(2);
    expect(store.getState().items[0].outputs[0].name).toBe('a.png');
  });

  it('notifies subscribers on every change and stops after unsubscribe', () => {
    const { store } = setup();
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    store.add([file('a.avif')]);
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
    store.clear();
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('sums input and output sizes of finished items', () => {
    const { runner, store } = setup();
    store.add([file('a.avif', 100), file('b.avif', 300)]);
    runner.finish(1);
    expect(totals(store.getState())).toEqual({ files: 2, done: 1, failed: 0, inputBytes: 100, outputBytes: 10, outputs: 1 });
  });
});
