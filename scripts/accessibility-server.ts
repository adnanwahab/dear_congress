import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Never inherit service credentials or production storage paths into browser QA.
const directory = await mkdtemp(join(tmpdir(), 'civic-accessibility-'));
for (const key of Object.keys(process.env)) {
  if (!['PATH', 'HOME', 'TMPDIR', 'TEMP', 'TMP'].includes(key)) delete process.env[key];
}
Object.assign(process.env, {
  NODE_ENV: 'production', PORT: '3107', DB_PATH: join(directory, 'db.json'),
  HBL_DB_PATH: join(directory, 'governance.sqlite'), HBL_SINGLE_WRITER: '1',
  HBL_MERGE_ENABLED: '0', HBL_MERGE_DRY_RUN: '1', HBL_KILL_SWITCH: '1',
  OUTCOMES_MODE: 'off', ANON_COOKIE_SECRET: crypto.randomUUID() + crypto.randomUUID(),
});
const { server } = await import('../server');
async function stop() { server.stop(true); await rm(directory, { recursive: true, force: true }); process.exit(0); }
process.on('SIGTERM', stop);
process.on('SIGINT', stop);
