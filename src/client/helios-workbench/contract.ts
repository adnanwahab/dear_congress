/** Public-only projection. The adapter must authorize/filter before returning data. */
export interface RevisionKey {
  repository: 'adnanwahab/dear_congress';
  kind: 'hfl';
  billId: string;
  revision: string;
}
export interface Source extends RevisionKey {
  text: string;
  /** SHA-256 of exact UTF-8 text, separate from the catalog record digest. */
  textHash: string;
  provenance: string;
  attribution: string;
  editorialStatus: string;
}
export interface Round {
  id: string;
  opensAt: string;
  closesAt: string;
  state: 'open' | 'closed' | 'blocked';
  support: number;
  oppose: number;
  unsure: number;
  electorate: string;
}
export interface Amendment extends Source {
  id: string;
  parentRevision: string;
  origin: 'ai';
  rationale: string;
  round: Round | null;
}
export interface PublicObjection extends RevisionKey {
  id: string;
  text: string;
  attribution: string;
  status: 'unresolved' | 'declined' | 'accepted';
  response: string;
  visibility: 'public';
}
export interface Snapshot {
  source: Source;
  round: Round | null;
  objections: PublicObjection[];
  amendments: Amendment[];
}
export type Choice = 'support' | 'oppose' | 'unsure';
export type Submission = RevisionKey & { requestId: string } & (
  { action: 'objection'; text: string; consentPublic: true } |
  { action: 'vote'; roundId: string; choice: Choice; consent: true }
);
export interface WorkbenchAdapter {
  load(key: RevisionKey, signal: AbortSignal): Promise<Snapshot>;
  /** Return only after durable save; enforce auth, scope, current revision/window,
   * idempotency and public consent on the server. Never auto-publish revisions. */
  submit(value: Submission): Promise<{ receipt: string }>;
}
export const keyOf = (key: RevisionKey) => JSON.stringify([key.repository, key.kind, key.billId, key.revision]);
export const sameRevision = (a: RevisionKey, b: RevisionKey) => keyOf(a) === keyOf(b);
export async function textHash(text: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}
export function counts(round: Round) {
  const values = [round.support, round.oppose, round.unsure];
  if (!values.every(value => Number.isSafeInteger(value) && value >= 0) || !Number.isSafeInteger(values.reduce((a,b) => a+b,0))) return null;
  return { total: round.support + round.oppose + round.unsure, decisive: round.support + round.oppose };
}
export function validRound(round: Round | null) {
  return !round || (!!round.id && !!round.electorate && !!counts(round) && Number.isFinite(Date.parse(round.opensAt)) && Date.parse(round.opensAt) < Date.parse(round.closesAt));
}
export async function verifySnapshot(key: RevisionKey, data: Snapshot) {
  if (key.repository !== 'adnanwahab/dear_congress' || key.kind !== 'hfl' || !/^HFL-\d{3}$/.test(key.billId) || !sameRevision(key, data.source)) throw new Error('scope');
  const sources = [data.source, ...data.amendments];
  for (const source of sources) {
    if (!source.text || await textHash(source.text) !== source.textHash) throw new Error('hash');
  }
  const revisions = new Set([key.revision]);
  const ids = new Set(['no-change']);
  const rounds = new Set(data.round ? [data.round.id] : []);
  if (!validRound(data.round)) throw new Error('round');
  for (const amendment of data.amendments) {
    if (!amendment.id || ids.has(amendment.id)) throw new Error('duplicate option');
    ids.add(amendment.id);
    if (amendment.repository !== key.repository || amendment.kind !== key.kind || amendment.billId !== key.billId || amendment.parentRevision !== key.revision || amendment.origin !== 'ai' || revisions.has(amendment.revision) || !validRound(amendment.round)) throw new Error('amendment');
    revisions.add(amendment.revision);
    if (amendment.round) {
      if (rounds.has(amendment.round.id)) throw new Error('reused round');
      rounds.add(amendment.round.id);
    }
  }
  // Private or unrelated objections must never be rendered even if an adapter errs.
  return { ...data, objections: data.objections.filter(o => o.visibility === 'public' && sameRevision(key, o)) };
}
