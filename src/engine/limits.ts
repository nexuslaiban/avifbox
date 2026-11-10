// Safety limits per batch. The real ceiling is the memory of the device doing the work.
export const MAX_FILES = 50;
export const MAX_FILE_BYTES = 50 * 1024 * 1024;

export interface Admission<T> {
  accepted: T[];
  tooLarge: T[];
  /** Files left out because the batch is full. */
  overflow: number;
}

export function admit<T extends { size: number }>(incoming: T[], queued: number): Admission<T> {
  const tooLarge = incoming.filter((file) => file.size > MAX_FILE_BYTES);
  const fits = incoming.filter((file) => file.size <= MAX_FILE_BYTES);
  const accepted = fits.slice(0, Math.max(0, MAX_FILES - queued));
  return { accepted, tooLarge, overflow: fits.length - accepted.length };
}
