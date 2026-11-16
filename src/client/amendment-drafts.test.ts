import { expect, test } from 'bun:test';
import { amendmentKey, readAmendments, redline, saveAmendment, type AmendmentSource } from './amendment-drafts';
const source: AmendmentSource = { kind: 'citizen', id: 'same-id', title: 'Pilot', text: 'The pilot shall run for 12 months.', jurisdiction: 'County', origin: 'journal:original · published fixture' };
const fields = { replacement: 'The pilot shall run for 18 months.', rationale: 'Observe two summer seasons', impact: 'Additional cost unknown', citation: 'Fixture source, https://example.test/pilot, section 1, 2026-11-13, illustrative' };
function memory() { const data = new Map<string, string>(); return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => { data.set(k, v); } }; }
test('separate exact snapshots survive reload, retain origin, and never change parent data or votes', () => {
  const storage = memory(); const parent = { ...source, votes: { support: 1 } }; const before = JSON.stringify(parent);
  const first = saveAmendment(storage, parent, parent, fields)[0]!;
  saveAmendment(storage, source, source, { ...fields, replacement: 'The pilot shall run for 24 months.' });
  const recovered = readAmendments(storage, source);
  expect(recovered).toHaveLength(2); expect(recovered[0]).toEqual(first);
  expect(recovered[1]!.id).not.toBe(first.id); expect(first.base).toEqual(source);
  expect(first.publicationPermission).toBe('not-requested'); expect(JSON.stringify(parent)).toBe(before);
  expect(readAmendments(storage, { ...source, kind: 'sample' })).toEqual([]);
  expect(readAmendments(storage, { ...source, id: 'another' })).toEqual([]);
});
test('stale base requires explicit fresh start and corrupt storage is never overwritten', () => {
  const storage = memory(); saveAmendment(storage, source, source, fields);
  const old = storage.getItem(amendmentKey(source));
  expect(() => saveAmendment(storage, { ...source, text: 'Changed source' }, source, fields)).toThrow('source changed');
  expect(storage.getItem(amendmentKey(source))).toBe(old);
  storage.setItem(amendmentKey(source), '{bad');
  expect(() => saveAmendment(storage, source, source, fields)).toThrow();
  expect(storage.getItem(amendmentKey(source))).toBe('{bad');
});
test('failed storage writes retain earlier versions; blanks, unchanged and oversized edits fail', () => {
  const storage = memory(); saveAmendment(storage, source, source, fields);
  const old = storage.getItem(amendmentKey(source));
  expect(() => saveAmendment({ ...storage, setItem: () => { throw new Error('quota'); } }, source, source, fields)).toThrow('quota');
  for (const patch of [{ replacement: source.text }, { rationale: ' ' }, { citation: '' }, { impact: 'x'.repeat(3001) }, { replacement: 'x'.repeat(10001) }]) {
    expect(() => saveAmendment(storage, source, source, { ...fields, ...patch })).toThrow();
  }
  expect(storage.getItem(amendmentKey(source))).toBe(old);
});
test('redline reconstructs both exact inputs, including repeated clauses, Unicode and whitespace', () => {
  for (const [a,b] of [[source.text,fields.replacement], ['😀 clause\n😀 clause','😁 clause\n😀 clause'], ['same','same'], ['','added'], ['deleted',''], [' x\n',' x \n'], ['repeat repeat','repeat different repeat']]) {
    const d = redline(a!,b!);
    expect(d.prefix + d.removed + d.suffix).toBe(a!);
    expect(d.prefix + d.added + d.suffix).toBe(b!);
  }
  expect(redline(source.text, fields.replacement)).toMatchObject({ removed: '2', added: '8' });
});
test('lineage retains forks and both merge parents without rewriting snapshots', () => {
  const storage = memory();
  const first = saveAmendment(storage, source, source, fields)[0]!;
  const fork = saveAmendment(storage, source, source, { ...fields, replacement: 'A fork' }, { event: 'fork', parents: [first.id] })[1]!;
  const compromise = saveAmendment(storage, source, source, { ...fields, replacement: 'A compromise' }, { event: 'compromise', parents: [first.id, fork.id] })[2]!;
  const rows = saveAmendment(storage, source, source, { ...fields, replacement: 'Merged proposal' }, { event: 'merge', parents: [fork.id, compromise.id] });
  expect(readAmendments(storage, source)).toEqual(rows);
  expect(rows[0]).toEqual(first);
  const snapshot = storage.getItem(amendmentKey(source));
  for (const lineage of [{ event: 'fork' as const, parents: [] }, { event: 'merge' as const, parents: [first.id, first.id] }, { event: 'revision' as const, parents: ['missing'] }]) {
    expect(() => saveAmendment(storage, source, source, fields, lineage)).toThrow('parent');
  }
  expect(storage.getItem(amendmentKey(source))).toBe(snapshot);
  expect(() => saveAmendment(storage, { ...source, origin: 'other' }, { ...source, origin: 'other' }, fields, { event: 'fork', parents: [first.id] })).toThrow('parent');
});
test('legacy ancestry stays unknown and corrupt relationships fail without storage mutation', () => {
  const storage = memory(); const first = saveAmendment(storage, source, source, fields)[0]!;
  delete first.lineage;
  storage.setItem(amendmentKey(source), JSON.stringify([first]));
  expect(readAmendments(storage, source)[0]!.lineage).toBeUndefined();
  const corrupt = JSON.stringify([{ ...first, lineage: { event: 'fork', parents: [first.id] } }]);
  storage.setItem(amendmentKey(source), corrupt);
  expect(() => readAmendments(storage, source)).toThrow('relationships');
  expect(storage.getItem(amendmentKey(source))).toBe(corrupt);
});
