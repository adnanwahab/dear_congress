import { expect, test } from 'bun:test';
import { emptyDB } from '../engine/engine';
import { mutationRetries } from './mutation-retries';

const request = (key: string, body = { text: 'Need reliable buses' }, voter = 'browser-a') => new Request('http://localhost/api/journal', { method: 'POST', headers: { 'content-type': 'application/json', 'idempotency-key': key, 'x-voter-id': voter }, body: JSON.stringify(body) });

test('concurrent retry commits once with receipt, survives restart, scopes keys and rejects conflict', async () => {
  let db = emptyDB(); let disk = ''; let calls = 0;
  let retries = mutationRetries(() => db, async () => { disk = JSON.stringify(db); }, old => { db = old; });
  const key = crypto.randomUUID();
  const handler = async () => { calls++; await Bun.sleep(5); db.goalVotesByVoter.a = { buses: true }; expect(retries.deferred()).toBe(true); return Response.json({ id: 'saved' }, { status: 202 }); };
  const responses = await Promise.all(Array.from({ length: 20 }, () => retries.run(request(key), '/api/journal', 'POST', handler)));
  expect(calls).toBe(1);
  for (const r of responses) { expect(r.status).toBe(202); expect(await r.json()).toEqual({ id: 'saved' }); }
  db = JSON.parse(disk);
  retries = mutationRetries(() => db, async () => { disk = JSON.stringify(db); }, old => { db = old; });
  expect((await retries.run(request(key), '/api/journal', 'POST', handler)).status).toBe(202);
  expect(calls).toBe(1);
  expect((await retries.run(request(key, { text: 'Changed' }), '/api/journal', 'POST', handler)).status).toBe(409);
  await retries.run(request(key, undefined, 'browser-b'), '/api/journal', 'POST', handler);
  await retries.run(request(key), '/api/votes', 'POST', handler);
  expect(calls).toBe(3);
});

test('old vote retries cannot overwrite a later choice; failed saves roll back and retry', async () => {
  let db = emptyDB(); let fail = false; let effects = 0;
  const retries = mutationRetries(() => db, async () => { if (fail) throw Error('disk unavailable'); }, old => { db = old; });
  const vote = (key: string, yes: boolean) => retries.run(request(key), '/api/votes', 'POST', async () => {
    db.goalVotesByVoter.a = { buses: yes }; retries.effect(() => effects++); return Response.json({ ok: true });
  });
  const first = crypto.randomUUID();
  await vote(first, true); await vote(crypto.randomUUID(), false); await vote(first, true);
  expect(db.goalVotesByVoter.a!.buses).toBe(false); expect(effects).toBe(2);
  fail = true; const failed = crypto.randomUUID();
  await expect(vote(failed, true)).rejects.toThrow('disk unavailable');
  expect(db.goalVotesByVoter.a!.buses).toBe(false); expect(effects).toBe(2);
  fail = false; await vote(failed, true); expect(effects).toBe(3);
});

test('legacy requests remain supported and invalid keys do not execute', async () => {
  let db = emptyDB(); let calls = 0;
  const retries = mutationRetries(() => db, async () => {}, old => { db = old; });
  const handler = async () => { calls++; return Response.json({ ok: true }); };
  expect((await retries.run(request('email@example.com'), '/api/journal', 'POST', handler)).status).toBe(400);
  const req = request(crypto.randomUUID()); req.headers.delete('idempotency-key');
  await retries.run(req, '/api/journal', 'POST', handler); expect(calls).toBe(1);
});

test('local before/after reliability: eight submits create eight legacy records or one keyed record', async () => {
  const measured = [];
  for (const keyed of [false, true]) {
    let db = emptyDB(); let created = 0; let persisted = '';
    const retries = mutationRetries(() => db, async () => { persisted = JSON.stringify(db); }, old => { db = old; });
    const key = crypto.randomUUID();
    await Promise.all(Array.from({ length: 8 }, () => {
      const req = request(key); if (!keyed) req.headers.delete('idempotency-key');
      return retries.run(req, '/api/journal', 'POST', async () => {
        created++; db.answers.push({ id: crypto.randomUUID() } as any);
        if (!retries.deferred()) persisted = JSON.stringify(db);
        return Response.json({ id: created });
      });
    }));
    const records = JSON.parse(persisted).answers.length;
    expect(records).toBe(keyed ? 1 : 8);
    measured.push({ keyed, attempts: 8, creations: records, duplicates: records - 1 });
  }
  console.log('SHE-938 local handler reliability:', JSON.stringify(measured));
});
