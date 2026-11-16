import { expect, test } from 'bun:test';
import { journalRetries } from './journal-retry';
import type { DB, JournalEntry } from '../engine/types';
const key = crypto.randomUUID();
const request = (text = 'A bus', path = '/api/publish_draft') => new Request(`https://civic.test${path}`, { method: 'POST', body: JSON.stringify({ text, idempotencyKey: key }) });
test('concurrent and restarted retries create once; conflicts, deleted posts and owners stay isolated', async () => {
  const db = { entries: [] } as unknown as DB;
  const save = async () => {};
  const retry = journalRetries(() => db, save);
  let calls = 0;
  const run = async () => {
    calls++;
    const entry = { id: String(calls), text: 'A bus', author: 'You', extraction: { needs: [] } } as unknown as JournalEntry;
    db.entries.push(entry);
    return Response.json({ entryId: entry.id, entry });
  };
  const responses = await Promise.all([retry(request(), 'one', run), retry(request(), 'one', run)]);
  expect(calls).toBe(1);
  expect(await responses[0]!.json()).toEqual(await responses[1]!.json());
  const restored = journalRetries(() => JSON.parse(JSON.stringify(db)), save);
  expect((await restored(request(), 'one', run)).status).toBe(200);
  expect(calls).toBe(1);
  expect((await retry(request('changed'), 'one', run)).status).toBe(409);
  expect(JSON.stringify(db.journalRetries)).not.toContain('A bus');
  db.entries = [];
  expect((await retry(request(), 'one', run)).status).toBe(409);
  await retry(request(), 'two', run);
  await retry(request('A bus', '/api/entries'), 'one', run);
  expect(calls).toBe(3);
});
test('interruption leaves a durable claim that refuses a second creation', async () => {
  const db = { entries: [] } as unknown as DB;
  const retry = journalRetries(() => db, async () => {});
  await expect(retry(request(), 'one', async () => { throw Error('process interrupted'); })).rejects.toThrow();
  const restored = journalRetries(() => db, async () => {});
  const response = await restored(request(), 'one', async () => { throw Error('must not run'); });
  expect(response.status).toBe(409);
  expect(await response.text()).toContain('uncertain');
});
