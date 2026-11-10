import type { ConvertEvent, ConvertOptions } from './types';

/** Main thread -> worker. */
export interface JobRequest {
  job: number;
  file: Blob;
  options: ConvertOptions;
}

/** Worker -> main thread. `ready` is sent once, when the script has loaded; a job ends with exactly one `done` or `error`. */
export type JobReply =
  { ready: true } | { job: number; event: ConvertEvent } | { job: number; done: true } | { job: number; error: string };
