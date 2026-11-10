import type { Target } from './types';

/** File name without its last extension, safe to use as a download or ZIP entry name. */
export function stem(fileName: string): string {
  const clean = fileName.replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_');
  const dot = clean.lastIndexOf('.');
  return (dot > 0 ? clean.slice(0, dot) : clean) || 'image';
}

/** Returns `base`, or `base (2)`, `base (3)`… if taken, and records the result in `taken`. */
export function uniqueStem(base: string, taken: Set<string>): string {
  let candidate = base;
  for (let n = 2; taken.has(candidate.toLowerCase()); n++) candidate = `${base} (${n})`;
  taken.add(candidate.toLowerCase());
  return candidate;
}

/** `photo.png`, or `anim-003.png` for frame 2 of an animation. */
export function outputName(base: string, target: Target, position?: { frame: number; of: number }): string {
  if (!position) return `${base}.${target}`;
  const digits = Math.max(3, String(position.of).length);
  return `${base}-${String(position.frame + 1).padStart(digits, '0')}.${target}`;
}

/** Makes every name in the list distinct, as an archive needs: `a.png`, `a (2).png`… */
export function uniqueNames(names: string[]): string[] {
  const taken = new Set<string>();
  return names.map((name) => {
    const dot = name.lastIndexOf('.');
    return uniqueStem(name.slice(0, dot), taken) + name.slice(dot);
  });
}
