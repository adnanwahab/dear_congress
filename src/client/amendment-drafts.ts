/** Private preparation only. These records never authorize publication or ballots. */
export interface AmendmentSource {
  kind: 'sample' | 'citizen'; id: string; title: string; text: string;
  jurisdiction: string; origin: string;
}
export interface AmendmentFields {
  replacement: string; rationale: string; impact: string; citation: string;
}
export interface AmendmentDraft extends AmendmentFields {
  version: 1; id: string; savedAt: string; base: AmendmentSource;
  author: 'This browser · unverified'; publicationPermission: 'not-requested';
}
export interface DraftStorage { getItem(key: string): string | null; setItem(key: string, value: string): void; }
export const amendmentKey = (source: AmendmentSource) => `civic_amendments_v1:${source.kind}:${encodeURIComponent(source.id)}`;
export function sameBase(a: AmendmentSource, b: AmendmentSource) {
  return a.kind === b.kind && a.id === b.id && a.text === b.text && a.origin === b.origin
    && a.title === b.title && a.jurisdiction === b.jurisdiction;
}
export function validateAmendment(fields: AmendmentFields, base: AmendmentSource) {
  for (const [key, limit] of [['replacement', 10000], ['rationale', 3000], ['impact', 3000], ['citation', 2000]] as const) {
    if (typeof fields[key] !== 'string' || !fields[key].trim() || fields[key].length > limit) throw new Error(`Provide ${key} (up to ${limit} characters).`);
  }
  if (fields.replacement === base.text) throw new Error('Change the proposal text before saving an amendment.');
  // A citation is a source note, not a remotely fetched resource or trusted HTML/link.
}
export function readAmendments(storage: DraftStorage, source: AmendmentSource): AmendmentDraft[] {
  const raw = storage.getItem(amendmentKey(source));
  if (!raw) return [];
  const rows: unknown = JSON.parse(raw);
  if (!Array.isArray(rows) || rows.length > 30 || !rows.every(row => {
    if (!row || row.version !== 1 || typeof row.id !== 'string' || typeof row.savedAt !== 'string' || !Number.isFinite(Date.parse(row.savedAt))
      || row.author !== 'This browser · unverified' || row.publicationPermission !== 'not-requested'
      || !row.base || row.base.kind !== source.kind || row.base.id !== source.id
      || !['id','title','text','jurisdiction','origin'].every(key => typeof row.base[key] === 'string')) return false;
    try { validateAmendment(row, row.base); return true; } catch { return false; }
  })) throw new Error('Saved amendments could not be read. Existing storage was left untouched.');
  return rows;
}
export function saveAmendment(storage: DraftStorage, source: AmendmentSource, base: AmendmentSource, fields: AmendmentFields): AmendmentDraft[] {
  if (!sameBase(source, base)) throw new Error('The source changed. Review the current source and start a fresh amendment. Your saved versions are retained.');
  validateAmendment(fields, base);
  const rows = readAmendments(storage, source);
  if (rows.length >= 30) throw new Error('This proposal has 30 saved local versions. Keep these records before clearing browser storage.');
  const next: AmendmentDraft = { ...fields, version: 1, id: crypto.randomUUID(), savedAt: new Date().toISOString(),
    base: { kind: base.kind, id: base.id, title: base.title, text: base.text, jurisdiction: base.jurisdiction, origin: base.origin }, author: 'This browser · unverified', publicationPermission: 'not-requested' };
  const result = [...rows, next];
  storage.setItem(amendmentKey(source), JSON.stringify(result));
  return result;
}
/** One bounded changed span; exact Unicode code points and whitespace are retained. */
export function redline(before: string, after: string) {
  const a = Array.from(before), b = Array.from(after);
  let start = 0, end = 0;
  while (start < a.length && start < b.length && a[start] === b[start]) start++;
  while (end < a.length - start && end < b.length - start && a[a.length - end - 1] === b[b.length - end - 1]) end++;
  return { prefix: a.slice(0, start).join(''), removed: a.slice(start, a.length - end).join(''),
    added: b.slice(start, b.length - end).join(''), suffix: end ? a.slice(a.length - end).join('') : '' };
}
