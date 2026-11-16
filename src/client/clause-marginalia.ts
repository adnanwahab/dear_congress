import type { AmendmentSource, DraftStorage } from './amendment-drafts';
export interface ClauseAnchor { revisionId: string; line: number; quote: string; source: AmendmentSource; }
export interface ClauseNote { id: string; kind: 'question' | 'proposal'; text: string; anchor: ClauseAnchor; previousAnchors: ClauseAnchor[]; }
export const marginaliaKey = (s: AmendmentSource) => `civic_marginalia_v1:adnanwahab/dear_congress:${s.kind}:${encodeURIComponent(s.id)}`;
/** SHA-256 binds all source identity fields and exact bytes, not a mutable line number. */
export async function clauseRevision(s: AmendmentSource) {
  const bytes = new TextEncoder().encode(JSON.stringify(['adnanwahab/dear_congress', s.kind, s.id, s.origin, s.title, s.jurisdiction, s.text]));
  return 'sha256:' + Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), n => n.toString(16).padStart(2, '0')).join('');
}
export function anchorLine(source: AmendmentSource, revisionId: string, line: number): ClauseAnchor {
  const quote = source.text.split('\n')[line - 1];
  if (!Number.isInteger(line) || quote === undefined || !quote.trim()) throw new Error('Select a nonempty source line.');
  return { revisionId, line, quote, source: { ...source } };
}
export function orphaned(note: ClauseNote, revisionId: string) { return note.anchor.revisionId !== revisionId; }
export async function readMarginalia(storage: DraftStorage, source: AmendmentSource): Promise<ClauseNote[]> {
  const raw = storage.getItem(marginaliaKey(source));
  if (!raw) return [];
  const rows: ClauseNote[] = JSON.parse(raw);
  if (!Array.isArray(rows) || rows.length > 100) throw new Error('Saved notes are invalid; storage was left untouched.');
  for (const n of rows) {
    if (!n || typeof n.id !== 'string' || !['question', 'proposal'].includes(n.kind) || typeof n.text !== 'string' || !n.text.trim() || n.text.length > 3000 || !Array.isArray(n.previousAnchors) || n.previousAnchors.length > 100) throw new Error('Saved notes are invalid; storage was left untouched.');
    for (const a of [n.anchor, ...n.previousAnchors]) {
      if (!a?.source || a.source.kind !== source.kind || a.source.id !== source.id || !['text','origin','title','jurisdiction'].every(k => typeof (a.source as any)[k] === 'string') || a.revisionId !== await clauseRevision(a.source) || anchorLine(a.source, a.revisionId, a.line).quote !== a.quote) throw new Error('Saved anchor is invalid; storage was left untouched.');
    }
  }
  return rows;
}
export function saveMarginalia(storage: DraftStorage, source: AmendmentSource, notes: ClauseNote[]) {
  if (notes.length > 100) throw new Error('This source has reached the 100 private note limit.');
  storage.setItem(marginaliaKey(source), JSON.stringify(notes));
}
export function reviewExcerpt(note: ClauseNote) {
  return JSON.stringify({ purpose: 'Manual review only; not published or submitted', repository: 'adnanwahab/dear_congress', kind: note.kind, text: note.text, anchor: note.anchor }, null, 2);
}
