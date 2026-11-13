import { strict as assert } from 'node:assert';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CIVIC_STAGES, stageRoute } from '../src/shared/civic-stages';

// Run the real production router/build with disposable state and no service credentials.
const directory = await mkdtemp(join(tmpdir(), 'dear-congress-routes-'));
for (const key of Object.keys(process.env)) {
  if (!['PATH', 'HOME', 'TMPDIR', 'TEMP', 'TMP'].includes(key)) delete process.env[key];
}
Object.assign(process.env, {
  NODE_ENV: 'production', PORT: '0', DB_PATH: join(directory, 'db.json'),
  HBL_DB_PATH: join(directory, 'governance.sqlite'), HBL_SINGLE_WRITER: '1',
  HBL_MERGE_ENABLED: '0', HBL_MERGE_DRY_RUN: '1', HBL_KILL_SWITCH: '1',
  OUTCOMES_MODE: 'off', DEBUG_REQUEST_LOGS: '0',
  ANON_COOKIE_SECRET: crypto.randomUUID() + crypto.randomUUID(),
});
let server: { url: URL; stop(closeConnections?: boolean): void } | undefined;
try {
  ({ server } = await import('../server'));
  const get = (path: string) => fetch(new URL(path, server!.url), { signal: AbortSignal.timeout(10_000) });
  const versionResponse = await get('/version');
  assert.equal(versionResponse.status, 200);
  assert.equal(versionResponse.headers.get('cache-control'), 'no-store');
  assert.equal(versionResponse.headers.get('set-cookie'), null);
  const version = await versionResponse.json();
  assert.equal(version.repository, 'https://github.com/adnanwahab/dear_congress');
  assert.equal(version.mode, 'demo');
  assert.equal(version.environment, 'production');
  assert.equal((await fetch(new URL('/version', server!.url), { method: 'POST' })).status, 405);
  const headVersion = await fetch(new URL('/version', server!.url), { method: 'HEAD' });
  assert.equal(headVersion.status, 200);
  assert.equal(await headVersion.text(), '');
  for (const path of ['/', '/account', '/journal', '/needs', '/vote', '/votes', '/feed', '/proposals/new', '/synth', '/embed', '/map', '/published', '/draft', '/sponsors', '/outcomes', '/documentation', '/map/']) {
    const response = await get(path);
    assert.equal(response.status, 200, path);
    assert.match(response.headers.get('content-type') ?? '', /text\/html/, path);
    const html = await response.text();
    assert.match(html, /id="root"/, path);
    assert.ok(html.includes(`data-build-commit="${version.commit ?? "unknown"}"`), `${path}: build matches endpoint`);
    const assets = [...html.matchAll(/(?:src|href)="(\/[^"?#]+\.(?:js|css))"/g)];
    assert.ok(assets.length >= 2, `${path}: bundled JS and CSS`);
    for (const [, asset] of assets) {
      assert.ok(asset);
      const bundled = await get(asset);
      assert.equal(bundled.status, 200, asset);
      assert.match(bundled.headers.get('content-type') ?? '', asset.endsWith('.js') ? /javascript/ : /css/, asset);
      assert.ok((await bundled.arrayBuffer()).byteLength > 0, asset);
    }
  }
  for (const stage of CIVIC_STAGES) {
    for (const path of [stage.route, stageRoute(stage.next, 'sample /?&雪')]) {
      const response = await get(path);
      assert.equal(response.status, 200, path);
      const destination = CIVIC_STAGES.find(s => s.route === new URL(path, server!.url).pathname)!;
      assert.ok((await response.text()).includes(`<title>${destination.title} | Civic Synthesis</title>`), path);
    }
  }
  const embed = await get('/embed');
  assert.equal(embed.headers.get('content-security-policy'), "frame-ancestors 'self'");
  assert.match((await get('/map')).headers.get('content-security-policy') ?? '', /default-src 'self'/);
  const proposals = await get('/api/citizen-proposals');
  assert.equal(proposals.status, 200);
  assert.match(proposals.headers.get('content-type') ?? '', /application\/json/);
  await proposals.json();
  for (const path of ['/missing-route', '/proposals/missing', '/api/missing-route']) {
    assert.equal((await get(path)).status, 404, path);
  }
  console.log('Route smoke test passed (production HTML, bundled assets, read API, 404s).');
} finally {
  server?.stop(true);
  await rm(directory, { recursive: true, force: true });
}
