/** Read-only post-deploy smoke checks. No journal or vote data is written. */
const origin = process.argv[2] ?? 'https://civic-synthesis.fly.dev';
const routes = ['/', '/published', '/feed', '/votes', '/draft', '/sponsors', '/outcomes', '/map', '/journal', '/api-docs', '/documentation', '/docs', '/needs', '/synth'];
async function get(path: string) {
  const response = await fetch(new URL(path, origin), { signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
  return response;
}
for (let offset = 0; offset < routes.length; offset += 4) {
  await Promise.all(routes.slice(offset,offset+4).map(async path => {
    const res = await get(path);
    if (!res.headers.get('content-type')?.includes('text/html')) throw new Error(`${path}: expected HTML`);
    console.log(`PASS ${path}`);
  }));
}
const health = await (await get('/healthz')).json();
if (!health.ok) throw new Error('Health endpoint not ready');
const demo = await (await get('/api/demo')).json();
if (demo.items.length !== 12) throw new Error('Expected twelve sample proposals');
const schema = await (await get('/api/journal-client/schema')).json();
if (schema.version !== 2 || !schema.needs.length) throw new Error('Journal schema unavailable');
const feed = await (await get('/api/entries?limit=1')).json();
if (!Array.isArray(feed.entries) || feed.entries.length > 1 || typeof feed.total !== 'number') throw new Error('Journal pagination response invalid');
const worker = await get('/assets/maplibre-worker.mjs');
if (!worker.headers.get('content-type')?.includes('javascript')) throw new Error('Map worker unavailable');
console.log('PASS health, demo scenarios, journal schema/feed, and map worker');
