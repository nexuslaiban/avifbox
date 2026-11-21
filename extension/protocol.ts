// What the two sides of the extension tell each other, as messages through `chrome.runtime`.
import type { Target } from '../src/engine/types';

/** Background → hidden document: save the image at `srcUrl` as `target`. */
export interface Job {
  srcUrl: string;
  target: Target;
}

/**
 * Hidden document → background: the address of the converted file with the names to save it under, in
 * order of preference, or why there is no file.
 */
export type Result = { url: string; names: string[] } | { failure: string };

/** Said when the extension failed, not the image. */
export const TRY_AGAIN = 'Something went wrong while saving this image. Please try again.';

const has = (message: unknown, key: string) => typeof message === 'object' && message !== null && key in message;

export const isJob = (message: unknown): message is Job => has(message, 'srcUrl');
export const isResult = (message: unknown): message is Result => has(message, 'url') || has(message, 'failure');
