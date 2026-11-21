import { useEffect, useState } from 'preact/hooks';
import { MAX_FILES, MAX_FILE_BYTES, admit } from '../engine/limits';
import { outputName, stem, uniqueStem } from '../engine/names';
import type { JobRunner } from '../engine/pool';
import type { ConvertEvent, ConvertOptions, ImageInfo } from '../engine/types';

// The converter's state: the list of files, what each one turned into, and the current settings.
// Results are always for the current settings — changing one re-converts the whole list.

export interface OutputItem {
  name: string;
  blob: Blob;
  url: string;
  width: number;
  height: number;
  frame: number | null;
  /** Included in "Download all". Only animation frames can be deselected. */
  selected: boolean;
}

export interface Detail {
  info: ImageInfo;
  frameCount: number;
  width: number;
  height: number;
  toneMapped: boolean;
}

export interface Item {
  id: number;
  file: File;
  /** Output name without extension, unique within the list. */
  base: string;
  status: 'pending' | 'done' | 'error';
  error: string | null;
  detail: Detail | null;
  outputs: OutputItem[];
}

export interface State {
  items: Item[];
  options: ConvertOptions;
  notice: string | null;
}

export { defaultOptions } from '../engine/options';

const megabytes = MAX_FILE_BYTES / (1024 * 1024);
/** How long a setting must stay unchanged before files are converted again. */
const RESTART_DELAY_MS = 120;

export class ConverterStore {
  private state: State;
  private readonly listeners = new Set<() => void>();
  private readonly jobs = new Map<number, number>(); // item id -> running job
  private nextId = 1;
  private restart: ReturnType<typeof setTimeout> | undefined;

  constructor(
    private readonly runner: JobRunner,
    options: ConvertOptions,
  ) {
    this.state = { items: [], options, notice: null };
  }

  getState = (): State => this.state;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  add(files: File[]): void {
    const { accepted, tooLarge, overflow } = admit(files, this.state.items.length);
    const taken = new Set(this.state.items.map((item) => item.base.toLowerCase()));
    const added = accepted.map((file): Item => {
      const id = this.nextId++;
      return {
        id,
        file,
        base: uniqueStem(stem(file.name), taken),
        status: 'pending',
        error: null,
        detail: null,
        outputs: [],
      };
    });
    this.update({ items: [...this.state.items, ...added], notice: admissionNotice(tooLarge, overflow) });
    for (const item of added) this.start(item);
  }

  remove(id: number): void {
    this.stop(id);
    this.update({ items: this.state.items.filter((item) => item.id !== id) });
  }

  clear(): void {
    for (const item of this.state.items) this.stop(item.id);
    this.update({ items: [], notice: null });
  }

  setOptions(patch: Partial<ConvertOptions>): void {
    const options = { ...this.state.options, ...patch };
    const keys = Object.keys(options) as (keyof ConvertOptions)[];
    if (keys.every((key) => options[key] === this.state.options[key])) return;
    for (const item of this.state.items) this.stop(item.id);
    const items = this.state.items.map((item): Item => ({ ...item, status: 'pending', error: null, outputs: [] }));
    this.update({ items, options });
    // Old results go at once; the new run waits until the setting has settled. A held arrow key on the
    // quality slider changes it many times a second, and each change would otherwise restart every file.
    clearTimeout(this.restart);
    this.restart = setTimeout(() => {
      for (const item of this.state.items) if (item.status === 'pending' && !this.jobs.has(item.id)) this.start(item);
    }, RESTART_DELAY_MS);
  }

  toggle(id: number, index: number): void {
    this.patch(id, (item) => ({
      outputs: item.outputs.map((output, i) => (i === index ? { ...output, selected: !output.selected } : output)),
    }));
  }

  /** Selects or deselects every output of an item at once. */
  selectAll(id: number, selected: boolean): void {
    this.patch(id, (item) => ({ outputs: item.outputs.map((output) => ({ ...output, selected })) }));
  }

  private start(item: Item): void {
    const job = this.runner.submit(item.file, this.state.options, {
      onEvent: (event) => this.patch(item.id, (current) => applyEvent(current, event, this.state.options)),
      onDone: () => this.finish(item.id, { status: 'done' }),
      onError: (error) => this.finish(item.id, { status: 'error', error }),
    });
    this.jobs.set(item.id, job);
  }

  private finish(id: number, patch: Partial<Item>): void {
    this.jobs.delete(id);
    this.patch(id, () => patch);
  }

  /** Cancels an item's job if it has one and releases the object URLs of its outputs. */
  private stop(id: number): void {
    const job = this.jobs.get(id);
    if (job !== undefined) this.runner.cancel(job);
    this.jobs.delete(id);
    for (const output of this.state.items.find((item) => item.id === id)?.outputs ?? [])
      URL.revokeObjectURL(output.url);
  }

  private patch(id: number, change: (item: Item) => Partial<Item>): void {
    this.update({ items: this.state.items.map((item) => (item.id === id ? { ...item, ...change(item) } : item)) });
  }

  private update(patch: Partial<State>): void {
    this.state = { ...this.state, ...patch };
    for (const listener of this.listeners) listener();
  }
}

/** The store's state, re-rendering the component that reads it on every change. */
export function useStore(store: ConverterStore): State {
  const [state, setState] = useState(store.getState);
  useEffect(() => store.subscribe(() => setState(store.getState())), [store]);
  return state;
}

function applyEvent(item: Item, event: ConvertEvent, options: ConvertOptions): Partial<Item> {
  if (event.type === 'info') {
    const { info, frameCount, width, height, toneMapped } = event;
    return { detail: { info, frameCount, width, height, toneMapped } };
  }
  const { blob, width, height, frame } = event.output;
  const position = frame === null ? undefined : { frame, of: item.detail?.frameCount ?? frame + 1 };
  const output: OutputItem = {
    name: outputName(item.base, options.target, position),
    blob,
    url: URL.createObjectURL(blob),
    width,
    height,
    frame,
    selected: true,
  };
  return { outputs: [...item.outputs, output] };
}

function admissionNotice(tooLarge: File[], overflow: number): string | null {
  const parts: string[] = [];
  if (tooLarge.length === 1) parts.push(`“${tooLarge[0].name}” is over ${megabytes} MB and was skipped.`);
  if (tooLarge.length > 1) parts.push(`${tooLarge.length} files over ${megabytes} MB were skipped.`);
  if (overflow > 0) {
    const left = overflow === 1 ? '1 file was left out' : `${overflow} files were left out`;
    parts.push(`${left}: a batch holds ${MAX_FILES} files. Download these, clear the list, then add the rest.`);
  }
  return parts.length > 0 ? parts.join(' ') : null;
}

/** Outputs that "Download all" would include. */
export function selectedOutputs(state: State): OutputItem[] {
  return state.items.flatMap((item) =>
    item.status === 'done' ? item.outputs.filter((output) => output.selected) : [],
  );
}

export interface Totals {
  files: number;
  done: number;
  failed: number;
  /** Bytes in and out, counting finished items only so the two are comparable. */
  inputBytes: number;
  outputBytes: number;
  outputs: number;
}

export function totals(state: State): Totals {
  const done = state.items.filter((item) => item.status === 'done');
  const selected = selectedOutputs(state);
  return {
    files: state.items.length,
    done: done.length,
    failed: state.items.filter((item) => item.status === 'error').length,
    inputBytes: done.reduce((sum, item) => sum + item.file.size, 0),
    outputBytes: selected.reduce((sum, output) => sum + output.blob.size, 0),
    outputs: selected.length,
  };
}
