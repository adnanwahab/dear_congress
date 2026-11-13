import { expect, test } from 'bun:test';
import { advisoryMutation, type VoteRequest } from './advisory-mutation';
import { MutationError } from './mutation-status';
const draft = { proposalId: 'demo-housing', title: 'Housing', stance: 1 };
function storage() { const values = new Map<string, string>(); return { getItem: (k: string) => values.get(k) ?? null, setItem: (k: string, v: string) => { values.set(k, v); } }; }
function deferred() { let resolve!: (v: any) => void; let reject!: (e: any) => void; const promise = new Promise<any>((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; }
test('synchronous lock prevents rapid duplicate writes; only acknowledgement confirms', async () => {
  const pending = deferred(); let calls = 0;
  const store = storage();
  const mutation = advisoryMutation((async () => { calls++; return pending.promise; }) as VoteRequest, store, () => {});
  const first = mutation.submit(draft);
  expect(await mutation.submit({ ...draft, stance: -1 })).toBe(false);
  expect(calls).toBe(1); expect(mutation.state.phase).toBe('submitting');
  pending.resolve({ ok: true }); expect(await first).toBe(true);
  expect(mutation.state.message).toContain('Server confirmed');
  const restored = advisoryMutation((async () => ({})) as VoteRequest, store, () => {});
  expect(restored.state.phase).toBe('confirmed');
  expect(restored.state.message).toContain('Previous server acknowledgement');
});
for (const failure of ['offline', '500', 'missing acknowledgement'] as const) test(`${failure}: exact choice survives failure and reload without automatic POST`, async () => {
  const store = storage(); let calls = 0; const bodies: any[] = [];
  const request = (async (_path: string, body: any) => { calls++; bodies.push(body); if (calls === 1) { if (failure === 'missing acknowledgement') return {}; throw failure === '500' ? new MutationError('server error', 500, null) : new TypeError('offline'); } return { ok: true }; }) as VoteRequest;
  const mutation = advisoryMutation(request, store, () => {});
  expect(await mutation.submit(draft)).toBe(false);
  expect(mutation.state.message).toContain('could not confirm whether');
  const restored = advisoryMutation(request, store, () => {});
  expect(calls).toBe(1); expect(restored.state.phase).toBe('failed');
  expect(await restored.submit()).toBe(true); expect(bodies[1]).toEqual(bodies[0]);
});
test('timeout aborts transport and preserves an unconfirmed choice for explicit retry', async () => {
  const request = ((_path, _body, _method, signal) => new Promise((_resolve, reject) => signal!.addEventListener('abort', () => reject(new Error('aborted'))))) as VoteRequest;
  const mutation = advisoryMutation(request, storage(), () => {}, 5);
  expect(await mutation.submit(draft)).toBe(false);
  expect(mutation.pending).toBe(false); expect(mutation.state.phase).toBe('failed');
  expect(mutation.state.message).toContain('could not confirm whether');
});
test('429 respects Retry-After without automatic resubmission or changing target', async () => {
  let calls = 0;
  const request = (async () => { calls++; throw new MutationError('rate limited', 429, '60'); }) as VoteRequest;
  const mutation = advisoryMutation(request, storage(), () => {});
  await mutation.submit(draft); expect(mutation.state.message).toContain('Too many requests');
  expect(await mutation.submit()).toBe(false);
  expect(await mutation.submit({ ...draft, proposalId: 'other' })).toBe(false);
  expect(calls).toBe(1);
});
test('reload while pending does not claim a save or automatically submit', async () => {
  const pending = deferred(); const store = storage();
  const mutation = advisoryMutation((async () => pending.promise) as VoteRequest, store, () => {});
  const first = mutation.submit(draft);
  const restored = advisoryMutation((async () => { throw new Error('must not submit'); }) as VoteRequest, store, () => {});
  expect(restored.state.phase).toBe('failed'); expect(restored.state.message).toContain('interrupted');
  pending.resolve({ ok: true }); await first;
});
test('unavailable storage is explicit and never prevents submitting', async () => {
  const mutation = advisoryMutation((async () => ({ ok: true })) as VoteRequest, { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } }, () => {});
  expect(await mutation.submit(draft)).toBe(true);
  expect(mutation.state.message).toContain('Receipt recovery unavailable');
});
test('lost response after acceptance retries an upsert without creating another ballot', async () => {
  const ballots = new Map<string, number>(); let calls = 0;
  const request = (async (_path: string, body: any) => {
    const vote = body.votes[0]; ballots.set(vote.proposalId, vote.stance);
    if (++calls === 1) throw new TypeError('response lost after save');
    return { ok: true };
  }) as VoteRequest;
  const store = storage();
  const mutation = advisoryMutation(request, store, () => {});
  expect(await mutation.submit(draft)).toBe(false);
  expect(ballots.size).toBe(1);
  const reload = advisoryMutation(request, store, () => {});
  expect(await reload.submit()).toBe(true);
  expect(ballots.size).toBe(1); expect(ballots.get(draft.proposalId)).toBe(1);
});
