import { readFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import { expect, it } from 'vitest';

const PUBLIC = new URL('../../extension/public/', import.meta.url);
const manifest = JSON.parse(readFileSync(new URL('manifest.json', PUBLIC), 'utf8')) as Record<string, unknown>;

it('AC-57 the manifest asks for what the extension needs and nothing else', () => {
  expect(manifest.manifest_version).toBe(3);
  expect(manifest.permissions).toEqual(['contextMenus', 'downloads', 'offscreen']);
  expect(manifest.host_permissions).toEqual(['<all_urls>']);
  for (const key of [
    'optional_permissions',
    'optional_host_permissions',
    'content_scripts',
    'web_accessible_resources',
    'externally_connectable',
  ])
    expect(manifest, key).not.toHaveProperty(key);
  expect(manifest.content_security_policy).toEqual({
    extension_pages: "script-src 'self' 'wasm-unsafe-eval'; object-src 'self';",
  });
  expect(manifest.incognito).toBe('not_allowed');
  expect(manifest.minimum_chrome_version).toBe('116');
  expect(manifest.background).toEqual({ service_worker: 'background.js', type: 'module' });
});

it('AC-57 the manifest names icons of 16, 32, 48 and 128 pixels, each a PNG of that size', () => {
  const icons = manifest.icons as Record<string, string>;
  expect(Object.keys(icons)).toEqual(['16', '32', '48', '128']);
  for (const [size, file] of Object.entries(icons)) {
    const png = PNG.sync.read(readFileSync(new URL(file, PUBLIC)));
    expect([png.width, png.height], file).toEqual([Number(size), Number(size)]);
  }
});
