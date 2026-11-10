const UNITS = ['B', 'KB', 'MB', 'GB'];

/** `1536` -> `1.5 KB`. Three significant digits, binary units. */
export function formatBytes(bytes: number): string {
  let value = bytes;
  let unit = 0;
  while (value >= 999.5 && unit < UNITS.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${unit === 0 ? value : Number(value.toPrecision(3))} ${UNITS[unit]}`;
}

/** How the output size compares with the input: `4.6× larger`, `40% larger`, `38% smaller`. */
export function sizeChange(input: number, output: number): string {
  if (input <= 0 || output === input) return 'same size';
  const percent = Math.max(1, Math.round(Math.abs(output / input - 1) * 100));
  if (output < input) return `${percent}% smaller`;
  return output < input * 2 ? `${percent}% larger` : `${Number((output / input).toFixed(1))}× larger`;
}
