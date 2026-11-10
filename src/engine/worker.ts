import { convert } from './convert';
import { ConvertError } from './errors';
import { decoders } from './decode';
import type { JobReply, JobRequest } from './protocol';

const scope = self as unknown as {
  onmessage: ((event: MessageEvent<JobRequest>) => void) | null;
  postMessage(reply: JobReply): void;
};

function describe(error: unknown): string {
  if (error instanceof ConvertError) return error.message;
  if (error instanceof RangeError) return 'This image needs more memory than this device can give the browser.';
  return 'Could not decode this file. It may be damaged, or use a feature this browser does not support.';
}

scope.onmessage = async ({ data }) => {
  const { job, file, options } = data;
  try {
    for await (const event of convert(file, options, decoders)) scope.postMessage({ job, event });
    scope.postMessage({ job, done: true });
  } catch (error) {
    scope.postMessage({ job, error: describe(error) });
  }
};

scope.postMessage({ ready: true });
