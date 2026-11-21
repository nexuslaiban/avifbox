import { expect, it } from 'vitest';
import { defaultOptions } from '../../src/engine/options';
import { defaultOptions as fromStore } from '../../src/ui/store';

it('the settings a page starts with belong to the engine, and the store still exports them', () => {
  expect(defaultOptions('jpg')).toEqual({
    target: 'jpg',
    pngMode: 'truecolor',
    quality: 90,
    background: null,
    animation: 'frames',
    tone: 'brightness',
    gamut: 'srgb',
    keepJpeg: true,
  });
  expect(defaultOptions('png', 'apng').animation).toBe('apng');
  expect(fromStore).toBe(defaultOptions);
});
