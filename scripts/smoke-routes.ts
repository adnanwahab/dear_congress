import { strict as assert } from 'node:assert';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { replaySnapshot } from '../src/server/audit-replay';
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
  for (const topic of ['transit', 'housing', 'childcare']) {
    const page = await get(`/topics/${topic}`);
    assert.equal(page.status, 200);
    assert.match(await page.text(), /topic hub/);
    const hub = await get(`/api/topics/${topic}`);
    assert.equal(hub.status, 200);
    assert.equal((await hub.json()).topic.id, topic);
  }
  assert.equal((await get('/topics/unknown')).status, 404);
  assert.equal((await get('/bills/HFL-101')).status, 404);
  assert.equal((await get('/api/topics/unknown')).status, 404);
  const auditIndex = await get('/api/audit-samples');
  assert.equal(auditIndex.status, 200);
  const { samples } = await auditIndex.json();
  assert.equal(samples.length, 1);
  const audit = await get(samples[0].url);
  assert.equal(audit.status, 200);
  const auditBytes = await audit.text();
  assert.equal(replaySnapshot(JSON.parse(auditBytes), samples[0].snapshotId).score, 0.599);
  assert.equal(await (await get(samples[0].url)).text(), auditBytes);
  assert.equal((await get('/api/audit-samples/' + '0'.repeat(64))).status, 404);
  assert.equal((await fetch(new URL(samples[0].url, server!.url), { method: 'POST' })).status, 404);
  const startLive = await fetch(new URL('/api/live', server!.url), {method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({proposalId:'demo-housing'})});
  assert.equal(startLive.status,200);
  const live = await startLive.json();
  const ownerCookie = startLive.headers.get('set-cookie')!.split(';')[0]!;
  assert.equal((await get('/votes?live='+live.code)).status,200);
  const phone = await get('/live/'+live.code);
  assert.equal(phone.status,200);
  assert.match(await phone.text(), /noindex,nofollow/);
  const qr = await get('/api/live/'+live.code+'/qr');
  assert.equal(qr.status,200); assert.match(await qr.text(), /<svg/);
  const livePost = (action:string, cookie:string, body:unknown) => fetch(new URL('/api/live/'+live.code+'/'+action,server!.url),{method:'POST',headers:{'content-type':'application/json',cookie},body:JSON.stringify(body)});
  const voter = await get('/api/live/'+live.code);
  const voterCookie = voter.headers.get('set-cookie')!.split(';')[0]!;
  assert.equal((await livePost('vote',voterCookie,{stance:1})).status,200);
  const changed = await livePost('vote',voterCookie,{stance:-1});
  assert.equal((await changed.json()).total,1);
  assert.equal((await livePost('end',voterCookie,{})).status,403);
  assert.equal((await livePost('end',ownerCookie,{})).status,200);
  assert.equal((await livePost('vote',voterCookie,{stance:0})).status,409);
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
  for (const path of ['/bills', '/bills/HFL-051', '/bills?q=community&category=Friendship%2C+community%2C+and+belonging', '/', '/account', '/journal', '/needs', '/vote', '/vote/happybearlandia', '/vote/happybearlandia/pr/282', '/votes', '/feed', '/proposals/new', '/synth', '/embed', '/map', '/published', '/draft', '/sponsors', '/outcomes', '/documentation', '/map/']) {
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
