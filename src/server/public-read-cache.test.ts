import { expect, test } from 'bun:test';
import { createPublicReadCache } from './public-read-cache';
import { createPublicSecurity, publicHandler } from './public-security';
const request = (path = '/api/legislation', headers: Record<string, string> = {}) => new Request('https://local' + path, { headers });
test('validators, cookie independence, empty 304s and changed representations', async () => {
  const cache = createPublicReadCache('validate');
  let value = 'original';
  const produce = () => Response.json({ value });
  const first = await cache.respond(request(), produce);
  expect(first.headers.get('set-cookie')).toBeNull();
  expect(first.headers.get('cache-control')).toBe('public, no-cache');
  expect(first.headers.get('vary')).toBe('Accept-Encoding');
  const etag = first.headers.get('etag')!;
  for (const tag of [etag, etag.slice(2), `"other", ${etag}`, '*']) {
    const res = await cache.respond(request(undefined, { 'if-none-match': tag, cookie: 'private=one', authorization: 'Bearer ignored' }), produce);
    expect(res.status).toBe(304); expect(await res.text()).toBe('');
    expect(res.headers.get('etag')).toBe(etag);
  }
  value = 'changed';
  const changed = await cache.respond(request(undefined, { 'if-none-match': etag }), produce);
  expect(changed.status).toBe(200); expect(changed.headers.get('etag')).not.toBe(etag);
});
test('15-second bound, coalescing, request refresh and no stale-on-error', async () => {
  let time = 0, reads = 0;
  const cache = createPublicReadCache('short', () => time);
  const produce = async () => { reads++; await Promise.resolve(); return Response.json({ reads }); };
  const results = await Promise.all(Array.from({ length: 12 }, () => cache.respond(request(), produce)));
  expect(reads).toBe(1); expect(await results[0]!.json()).toEqual({ reads: 1 });
  time = 14000;
  const hit = await cache.respond(request(), produce);
  expect(hit.headers.get('age')).toBe('14'); expect(reads).toBe(1);
  expect(hit.headers.get('cache-control')).toBe('public, max-age=15, s-maxage=15, must-revalidate');
  await cache.respond(request(undefined, { 'cache-control': 'no-cache' }), produce); expect(reads).toBe(2);
  time = 29000;
  const error = await cache.respond(request(), () => Response.json({ error: true }, { status: 503 }));
  expect(error.status).toBe(503); expect(error.headers.get('cache-control')).toBe('private, no-store');
  await cache.respond(request(), produce); expect(reads).toBe(3);
});
test('only explicit GET routes are eligible; private responses cannot gain shared caching', async () => {
  const cache = createPublicReadCache('short');
  for (const path of ['/api/state', '/api/demo', '/api/citizen-proposals', '/api/journals', '/api/ballot_entries', '/api/hbl/auth/session', '/api/topics/transit', '/api/legislation/extra']) {
    expect(cache.eligible(path, 'GET')).toBe(false);
    const req = request(path);
    const res = await publicHandler(createPublicSecurity({}), path, 'GET', req, 'local', () => Response.json({ private: true }, { headers: { 'cache-control': 'public, max-age=60' } }));
    expect(res.headers.get('cache-control')).toBe('no-store');
  }
  expect(cache.eligible('/api/legislation', 'POST')).toBe(false);
  expect(createPublicReadCache('off').eligible('/api/legislation', 'GET')).toBe(false);
  expect(() => createPublicReadCache('unknown')).toThrow();
  const cookie = await cache.respond(request(), () => Response.json({}, { headers: { 'set-cookie': 'bad=one' } }));
  expect(cookie.headers.get('cache-control')).toBe('private, no-store');
  const big = await cache.respond(request(), () => new Response('a'.repeat(1048577)));
  expect(big.headers.get('cache-control')).toBe('no-store');
});
test('request no-store refreshes without retaining its response', async () => {
  const cache = createPublicReadCache('short'); let reads = 0;
  const produce = () => Response.json({ reads: ++reads });
  const res = await cache.respond(request(undefined, { 'cache-control': 'no-store' }), produce);
  expect(res.headers.get('cache-control')).toBe('no-store');
  await cache.respond(request(), produce);
  expect(reads).toBe(2);
});
