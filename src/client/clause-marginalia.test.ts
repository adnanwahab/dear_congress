import { expect, test } from 'bun:test';
import { anchorLine, clauseRevision, marginaliaKey, orphaned, readMarginalia, reviewExcerpt, saveMarginalia, type ClauseNote } from './clause-marginalia';
import type { AmendmentSource } from './amendment-drafts';
const source: AmendmentSource = { kind: 'sample', id: 'one', title: 'Test', origin: 'fixture', jurisdiction: 'County', text: 'Repeated line\nRepeated line\n😀 exact bytes' };
const memory = () => { const m = new Map<string,string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string,v: string) => { m.set(k,v); } }; };
test('exact immutable revisions isolate identity, repeated lines, Unicode and changed source', async () => {
  const revision = await clauseRevision(source);
  for (const patch of [{ kind: 'citizen' as const }, { id: 'two' }, { origin: 'different' }, { text: source.text + ' ' }]) expect(await clauseRevision({ ...source, ...patch })).not.toBe(revision);
  expect(anchorLine(source, revision, 2).line).toBe(2);
  expect(anchorLine(source, revision, 3).quote).toBe('😀 exact bytes');
  expect(() => anchorLine(source, revision, 0)).toThrow();
});
test('reload, orphan and explicit reattachment retain original snapshot without moving other notes', async () => {
  const storage = memory(); const revision = await clauseRevision(source);
  const note: ClauseNote = { id: 'n', kind: 'question', text: 'Why?', anchor: anchorLine(source, revision, 2), previousAnchors: [] };
  saveMarginalia(storage, source, [note]);
  const changed = { ...source, text: 'Amended line' }; const next = await clauseRevision(changed);
  const [old] = await readMarginalia(storage, changed);
  expect(orphaned(old!, next)).toBe(true); expect(old!.anchor.quote).toBe('Repeated line');
  saveMarginalia(storage, changed, [{ ...old!, anchor: anchorLine(changed, next, 1), previousAnchors: [old!.anchor] }]);
  const [attached] = await readMarginalia(storage, changed);
  expect(orphaned(attached!, next)).toBe(false); expect(attached!.previousAnchors[0]).toEqual(note.anchor);
  expect(await readMarginalia(storage, { ...source, kind: 'citizen' })).toEqual([]);
  expect(reviewExcerpt(attached!)).toContain('not published or submitted');
});
test('corrupt and cross-source storage fails closed without overwrite', async () => {
  const storage = memory(); const key = marginaliaKey(source);
  storage.setItem(key, '{invalid'); await expect(readMarginalia(storage, source)).rejects.toThrow(); expect(storage.getItem(key)).toBe('{invalid');
  const note = { id: 'n', kind: 'proposal', text: 'Change', anchor: anchorLine(source, await clauseRevision(source), 1), previousAnchors: [] };
  note.anchor.quote = 'tampered'; storage.setItem(key, JSON.stringify([note]));
  await expect(readMarginalia(storage, source)).rejects.toThrow();
});
