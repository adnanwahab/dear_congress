import { expect, test } from 'bun:test';
import { saveClip, readClips, observeClips, clipsMarkdown, CLIP_KEY, type ClipSource } from './evidence-clips';
const source: ClipSource = {kind: 'sample-proposal', id: 'same', claim: 'A claim', citation: 'Fictional sample background', url: 'https://example.org/source', revision: 'one'};
function store() { const data = new Map<string,string>(); return {getItem: (k: string) => data.get(k) ?? null, setItem: (k: string,v: string) => {data.set(k,v);} }; }
test('clips freeze notes and citations; observed revisions only mark stale within kind', () => {
  const s = store(); saveClip(s, source, 'My original note', '2026-11-14T12:00:00Z');
  observeClips(s, {...source, kind: 'synthetic-outcome', revision: 'two'});
  expect(readClips(s)[0]!.stale).toBe(false);
  observeClips(s, {...source, claim: 'Changed', revision: 'two'});
  const c = readClips(s)[0]!;
  expect(c.stale).toBe(true); expect(c.note).toBe('My original note'); expect(c.source).toEqual(source);
  const md = clipsMarkdown([c]); expect(md).toContain('https://example.org/source'); expect(md).toContain('2026-11-14T12:00:00Z'); expect(md).toContain('Stale'); expect(md).toContain('My original note');
});
test('corrupt and blocked storage fail without replacing existing data', () => {
  const s = store(); s.setItem(CLIP_KEY, '{broken'); expect(() => saveClip(s, source, 'note')).toThrow(); expect(s.getItem(CLIP_KEY)).toBe('{broken');
  expect(() => saveClip({getItem: () => null, setItem: () => {throw new Error('blocked');}}, source, '')).toThrow('blocked');
});
test('empty notebook and unsafe source rejection', () => {
  const s = store(); expect(readClips(s)).toEqual([]); expect(() => saveClip(s, {...source, url: 'javascript:alert(1)'}, '')).toThrow(); expect(readClips(s)).toEqual([]);
});
