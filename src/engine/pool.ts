import type { JobReply, JobRequest } from './protocol';
import type { ConvertEvent, ConvertOptions } from './types';

export interface JobHandlers {
  onEvent(event: ConvertEvent): void;
  onDone(): void;
  onError(message: string): void;
}

export interface JobRunner {
  /** Queues a conversion and returns its job id. */
  submit(file: Blob, options: ConvertOptions, handlers: JobHandlers): number;
  /** Stops a job. No handler is called for it afterwards. */
  cancel(job: number): void;
}

interface Slot {
  worker: Worker;
  job: number | null;
}

const CRASHED = 'The converter stopped on this file. It probably needs more memory than this device has free.';

function defaultSize(): number {
  const cores = navigator.hardwareConcurrency || 2;
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8;
  return Math.max(1, Math.min(cores - 1, memory <= 4 ? 2 : 4));
}

/** Runs conversions on a small set of workers, started on demand. */
export class Pool implements JobRunner {
  private readonly slots: Slot[] = [];
  private queue: JobRequest[] = [];
  private readonly handlers = new Map<number, JobHandlers>();
  private nextJob = 1;
  private size = 0; // decided when the first worker is needed, so constructing a pool is free

  submit(file: Blob, options: ConvertOptions, handlers: JobHandlers): number {
    const job = this.nextJob++;
    this.handlers.set(job, handlers);
    this.queue.push({ job, file, options });
    this.pump();
    return job;
  }

  cancel(job: number): void {
    this.handlers.delete(job);
    this.queue = this.queue.filter((request) => request.job !== job);
    const slot = this.slots.find((s) => s.job === job);
    if (slot) this.retire(slot); // the only way to stop a running conversion, and it frees its memory at once
    this.pump();
  }

  private pump(): void {
    while (this.queue.length > 0) {
      const slot = this.slots.find((s) => s.job === null) ?? this.spawn();
      if (!slot) return;
      const request = this.queue.shift()!;
      slot.job = request.job;
      slot.worker.postMessage(request);
    }
  }

  private spawn(): Slot | undefined {
    this.size ||= defaultSize();
    if (this.slots.length >= this.size) return undefined;
    const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
    const slot: Slot = { worker, job: null };
    worker.onmessage = ({ data }: MessageEvent<JobReply>) => {
      const handlers = this.handlers.get(data.job);
      if ('event' in data) {
        handlers?.onEvent(data.event);
        return;
      }
      this.handlers.delete(data.job);
      slot.job = null;
      if ('error' in data) handlers?.onError(data.error);
      else handlers?.onDone();
      this.pump();
    };
    worker.onerror = () => {
      const handlers = slot.job === null ? undefined : this.handlers.get(slot.job);
      if (slot.job !== null) this.handlers.delete(slot.job);
      this.retire(slot);
      handlers?.onError(CRASHED);
      this.pump();
    };
    this.slots.push(slot);
    return slot;
  }

  private retire(slot: Slot): void {
    slot.worker.terminate();
    this.slots.splice(this.slots.indexOf(slot), 1);
  }
}
