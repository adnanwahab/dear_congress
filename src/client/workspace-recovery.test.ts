import { expect, test } from 'bun:test';
import { blankWorkspace, WORKSPACE_KEY } from './proposal-workspace';
import { checksum, persistWorkspace, readRecovery, type Exclusive } from './workspace-recovery';

function fixture() {
  const data = new Map<string, string>();
  const storage = { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => { data.set(k, v); } };
  let queue = Promise.resolve();
  const lock: Exclusive = (_name, work) => { const next = queue.then(work); queue = next.then(() => {}, () => {}); return next; };
  return { data, storage, lock };
}
test('concurrent tabs cannot silently overwrite; explicit retry retains previous revision', async () => {
  const { data, storage, lock } = fixture();
  const a = { ...blankWorkspace(), text: 'A 🚌\n  exact spacing' }, b = { ...a, text: 'B' };
  const [first, stale] = await Promise.all([persistWorkspace(storage, lock, null, 'a', a), persistWorkspace(storage, lock, null, 'b', b)]);
  expect(first.conflict).toBe(false); expect(stale.conflict).toBe(true);
  expect(readRecovery(storage.getItem(WORKSPACE_KEY))?.values).toEqual(a);
  const resolved = await persistWorkspace(storage, lock, stale.raw, 'b', b);
  expect(resolved.conflict).toBe(false);
  expect([...data.entries()].filter(([key]) => key.includes(':history:')).map(([, raw]) => readRecovery(raw)?.values)).toEqual([a]);
  expect(readRecovery(resolved.raw)?.values).toEqual(b);
});
test('checksums detect altered values; legacy envelopes remain readable and corruption is not overwritten', async () => {
  const { storage, lock } = fixture();
  const saved = await persistWorkspace(storage, lock, null, 'a', blankWorkspace());
  const corrupt = JSON.stringify({ ...JSON.parse(saved.raw!), values: { ...blankWorkspace(), title: 'altered' } });
  storage.setItem(WORKSPACE_KEY, corrupt);
  expect(() => readRecovery(corrupt)).toThrow('checksum');
  await expect(persistWorkspace(storage, lock, corrupt, 'a', blankWorkspace())).rejects.toThrow();
  expect(storage.getItem(WORKSPACE_KEY)).toBe(corrupt);
  expect(readRecovery(JSON.stringify({ version: 1, id: 'old', savedAt: '2026-11-13', values: blankWorkspace() }))?.id).toBe('old');
  expect(checksum('a')).not.toBe(checksum('b'));
});
test('no locking or quota failure preserves saved work; deletion is a conflict', async () => {
  const { storage, lock } = fixture();
  await expect(persistWorkspace(storage, undefined, null, 'a', blankWorkspace())).rejects.toThrow('locking');
  const saved = await persistWorkspace(storage, lock, null, 'a', blankWorkspace());
  const broken = { ...storage, setItem: () => { throw new Error('quota'); } };
  await expect(persistWorkspace(broken, lock, saved.raw, 'a', blankWorkspace())).rejects.toThrow('quota');
  expect(storage.getItem(WORKSPACE_KEY)).toBe(saved.raw);
  expect((await persistWorkspace(storage, lock, 'deleted revision', 'a', blankWorkspace())).conflict).toBe(true);
});
