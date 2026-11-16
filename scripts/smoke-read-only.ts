import { strict as assert } from 'node:assert';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const directory = await mkdtemp(join(tmpdir(), 'dear-congress-paused-'));
for (const key of Object.keys(process.env)) {
  if (!['PATH', 'HOME', 'TMPDIR', 'TEMP', 'TMP'].includes(key)) delete process.env[key];
}
Object.assign(process.env, {
  NODE_ENV: 'production', PORT: '0', DB_PATH: join(directory, 'db.json'),
  HBL_DB_PATH: join(directory, 'governance.sqlite'), HBL_SINGLE_WRITER: '1',
  HBL_MERGE_ENABLED: '0', HBL_MERGE_DRY_RUN: '1', HBL_KILL_SWITCH: '1',
  OUTCOMES_MODE: 'off', DEBUG_REQUEST_LOGS: '0', LAUNCH_READ_ONLY: '1',
  ANON_COOKIE_SECRET: crypto.randomUUID() + crypto.randomUUID(),
});
let server: { url: URL; stop(closeConnections?: boolean): void } | undefined;
try {
  ({ server } = await import('../server'));
  const request = (path: string, method = 'GET') => fetch(new URL(path, server!.url), { method, signal: AbortSignal.timeout(10_000) });
  const before = await readFile(process.env.DB_PATH!, 'utf8').catch(() => null);
  const stateBefore = await (await request('/api/state')).text();
  for (const [path, method] of [
    ['/api/journal', 'POST'], ['/api/entries', 'POST'], ['/api/publish_draft', 'POST'],
    ['/api/journal/example', 'PATCH'], ['/api/votes', 'POST'], ['/api/live', 'POST'],
    ['/api/hbl/repos/dear_congress/pulls/7/ballot', 'PUT'], ['/api/reset', 'POST'],
  ]) {
    const response = await request(path!, method!);
    assert.equal(response.status, 503, path);
    assert.equal((await response.json()).code, 'writes_paused');
    assert.equal(response.headers.get('cache-control'), 'no-store');
  }
  assert.equal(await (await request('/api/state')).text(), stateBefore);
  assert.equal(await readFile(process.env.DB_PATH!, 'utf8').catch(() => null), before);
  for (const path of ['/', '/journal', '/votes', '/documentation']) {
    const page = await request(path);
    assert.equal(page.status, 200);
    assert.match(await page.text(), /Read-only mode: public submissions and votes/);
  }
  assert.equal((await request('/api/demo')).status, 200);
  console.log('Read-only route smoke passed');
} finally {
  server?.stop(true);
  await rm(directory, { recursive: true, force: true });
}
