import { describe, expect, it } from 'vitest';
import { formatBytes, sizeChange } from '../../src/ui/format';

describe('formatBytes', () => {
  it('uses three significant digits and binary units', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(1536)).toBe('1.5 KB');
    expect(formatBytes(12764)).toBe('12.5 KB');
    expect(formatBytes(1024 * 1024)).toBe('1 MB');
    expect(formatBytes(4.56 * 1024 * 1024)).toBe('4.56 MB');
    expect(formatBytes(50 * 1024 * 1024)).toBe('50 MB');
  });

  it('moves to the next unit rather than printing four digits', () => {
    expect(formatBytes(999)).toBe('999 B');
    expect(formatBytes(1000)).toBe('0.977 KB');
    expect(formatBytes(1023 * 1024)).toBe('0.999 MB');
  });
});

describe('sizeChange', () => {
  it('describes growth as a factor and shrinkage as a percentage', () => {
    expect(sizeChange(1554, 12764)).toBe('8.2× larger');
    expect(sizeChange(1000, 2000)).toBe('2× larger');
    expect(sizeChange(1000, 620)).toBe('38% smaller');
    expect(sizeChange(1000, 999)).toBe('1% smaller');
    expect(sizeChange(1000, 1000)).toBe('same size');
    expect(sizeChange(0, 10)).toBe('same size');
  });
});
