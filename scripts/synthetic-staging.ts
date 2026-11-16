import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// This process cannot target a remote staging/production URL. Every run owns its DB.
const directory = await mkdtemp(join(tmpdir(), 'civic-synthetic-'));
for (const key of Object.keys(process.env)) {
  if (!['PATH', 'HOME', 'TMPDIR', 'TEMP', 'TMP'].includes(key)) delete process.env[key];
}
Object.assign(process.env, {
  NODE_ENV: 'production', PORT: '0', DB_PATH: join(directory, 'db.json'),
  HBL_DB_PATH: join(directory, 'governance.sqlite'), HBL_SINGLE_WRITER: '1',
  HBL_MERGE_ENABLED: '0', HBL_MERGE_DRY_RUN: '1', HBL_KILL_SWITCH: '1',
  OUTCOMES_MODE: 'off', ANON_COOKIE_SECRET: crypto.randomUUID() + crypto.randomUUID(),
});
let server: { url: URL; stop(closeConnections?: boolean): void } | undefined;
const checks: string[] = [];
try {
  ({ server } = await import('../server'));
  const post = (path: string, body: unknown, cookie = '') => fetch(new URL(path, server!.url), {
    method: 'POST', redirect: 'error', signal: AbortSignal.timeout(15000),
    headers: { 'content-type': 'application/json', origin: server!.url.origin, cookie }, body: JSON.stringify(body),
  });
  const text = 'Synthetic monitor fixture. No resident participation.';
  const journal = await post('/api/publish_draft', { kind: 'journal', inference: 'none', text, labels: [] });
  assert.equal(journal.status, 200);
  const published = await journal.json();
  assert.equal(published.entry.text, text);
  checks.push('isolated consent-first journal write');
  const round = await post('/api/live', { proposalId: 'demo-transit' });
  assert.equal(round.status, 200);
  const { code } = await round.json();
  const owner = round.headers.get('set-cookie')!.split(';')[0]!;
  const vote = await post(`/api/live/${code}/vote`, { stance: 1 }, owner);
  assert.equal(vote.status, 200);
  assert.equal((await vote.json()).total, 1);
  checks.push('isolated sample advisory vote');
  assert.equal((await post(`/api/live/${code}/end`, {}, owner)).status, 200);
  assert.equal((await post(`/api/live/${code}/vote`, { stance: 1 }, owner)).status, 409);
  checks.push('closed-round write rejected');
  await Bun.write('synthetic-staging.json', JSON.stringify({ passed: true, isolation: 'disposable local production-router staging', checks }, null, 2));
} catch {
  await Bun.write('synthetic-staging.json', JSON.stringify({ passed: false, checks }, null, 2));
  process.exitCode = 1;
} finally {
  server?.stop(true);
  await rm(directory, { recursive: true, force: true });
}
