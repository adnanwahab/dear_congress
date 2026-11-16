import { expect, test } from 'bun:test';
import { assetResponse } from './asset-cache';
import { buildBrowser } from './browser-build';

test('manifest assets support opt-in immutable caching, HEAD and conditional GET', async () => {
  const asset = new Blob(['export default 1'], { type: 'text/javascript' });
  const url = 'https://local.test/app-abc123.js';
  const first = assetResponse(new Request(url), asset, true);
  expect(first.headers.get('cache-control')).toBe('public, max-age=31536000, immutable');
  expect(await first.text()).toBe('export default 1');
  for (const validator of [first.headers.get('etag')!, `W/${first.headers.get('etag')}`, '*']) {
    const response = assetResponse(new Request(url, { headers: { 'if-none-match': validator } }), asset, true);
    expect(response.status).toBe(304);
    expect(await response.text()).toBe('');
    expect(response.headers.get('cache-control')).toContain('immutable');
  }
  expect(assetResponse(new Request(url, { headers: { 'if-none-match': '"other"' } }), asset, true).status).toBe(200);
  expect(await assetResponse(new Request(url, { method: 'HEAD' }), asset, true).text()).toBe('');
  expect(assetResponse(new Request(url, { method: 'POST' }), asset, true).status).toBe(405);
  expect(assetResponse(new Request(url), asset, false).headers.get('cache-control')).toBe('no-cache');
});

test('release and rollback manifests never reuse an asset URL for different bytes', async () => {
  const manifests = [];
  const digests = new Map<string, string>();
  for (const production of [true, false, true]) {
    const build = await buildBrowser(production);
    expect(build.success).toBe(true);
    for (const output of build.outputs.filter(o => !o.type.startsWith('text/html'))) {
      const path = '/' + output.path.split('/').pop();
      const digest = new Bun.CryptoHasher('sha256').update(await output.arrayBuffer()).digest('hex');
      if (digests.has(path)) expect(digests.get(path)).toBe(digest);
      digests.set(path, digest);
    }
    const assets = new Map(await Promise.all(build.outputs.filter(o => !o.type.startsWith('text/html')).map(async o => ['/' + o.path.split('/').pop(), await o.text()] as const)));
    const html = await build.outputs.find(o => o.type.startsWith('text/html'))!.text();
    for (const [, path] of html.matchAll(/(?:src|href)="(\/[^"?#]+)"/g)) {
      if (/\.(js|css|png)$/.test(path!)) expect(assets.has(path!)).toBe(true);
    }
    const mapCSS = [...assets.keys()].find(p => /^\/maplibre-gl-.+\.css$/.test(p))!;
    expect(mapCSS).toBeDefined();
    const worker = [...assets.keys()].find(p => /^\/maplibre-gl-worker-.+\.js$/.test(p))!;
    expect(worker).toBeDefined();
    expect([...assets.values()].some(body => body.includes(worker))).toBe(true);
    expect([...assets.keys()].some(p => /^\/social-preview-.+\.png$/.test(p))).toBe(true);
    expect([...assets.values()].some(body => body.includes(mapCSS))).toBe(true);
    for (const previous of manifests) for (const [path, body] of assets) {
      if (previous.has(path)) expect(previous.get(path)).toBe(body);
    }
    manifests.push(assets);
  }
  expect([...manifests[0]!.keys()].sort()).toEqual([...manifests[2]!.keys()].sort());
});
