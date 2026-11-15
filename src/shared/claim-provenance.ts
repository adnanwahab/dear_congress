/** Read-only claim revisions; never authority for voting, synthesis or merges. */
export type ClaimKind = 'primary source' | 'editorial inference' | 'user claim' | 'synthetic estimate';
export interface ClaimProvenance {
  id: string;
  revision: string;
  kind: ClaimKind;
  publisher: string;
  title: string;
  url: string | null;
  scope: string;
  period: string;
  recordedAt: string;
  limitations: string;
  review: 'pending human review' | 'human reviewed';
  fields: Partial<Record<'date' | 'definition' | 'status' | 'reported value', string>>;
  history: readonly { revision: string; at: string; actor: string; reason: string; review: ClaimProvenance['review'] }[];
}
export function claimUrl(claim: ClaimProvenance): string | null {
  try {
    const url = new URL(claim.url ?? '');
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}
export function compareClaims(claims: readonly ClaimProvenance[]) {
  if (!claims.length || claims.some(c => !claimUrl(c) && c.kind !== 'synthetic estimate')) return { status: 'Missing source', conflicts: [] as string[] };
  if (claims.length < 2) return { status: 'Source supplied — not independently verified', conflicts: [] as string[] };
  const first = claims[0]!;
  if (claims.some(c => c.scope !== first.scope || c.period !== first.period || c.kind !== first.kind)) return { status: 'Not comparable — scope, period or claim kind differs', conflicts: [] as string[] };
  const conflicts = (['date', 'definition', 'status', 'reported value'] as const).filter(field => {
    const values = claims.map(c => c.fields[field]);
    return values.every(v => v !== undefined && v.trim() !== '') && new Set(values).size > 1;
  });
  return { status: conflicts.length ? 'Conflict — human review needed' : 'No explicit conflict detected — not verification', conflicts };
}
const recordedAt = '2026-11-14';
function claim(id: string, values: Partial<ClaimProvenance>): ClaimProvenance {
  return { id, revision: `${id}/v1`, kind: 'synthetic estimate', publisher: 'Fictional pilot team', title: id, url: null,
    scope: 'Fictional transit pilot / all pilot households / minutes', period: '2025', recordedAt,
    limitations: 'Invented demonstration; no external document or policy effect is established.', review: 'pending human review', fields: {},
    history: [{ revision: `${id}/v1`, at: recordedAt, actor: 'Repository fixture author', reason: 'Initial demonstration record', review: 'pending human review' }], ...values };
}
export const COMPASS_CASES = [
  { id: 'sourced', title: 'Source supplied: Senate composition', claims: [claim('constitution-article-i', {
    kind: 'primary source', publisher: 'U.S. Senate', title: 'Constitution, Article I, Section 3, Clause 1',
    url: 'https://www.senate.gov/civics/constitution_item/constitution.htm', scope: 'United States / Senate composition / constitutional text', period: 'Article I text, 1787',
    fields: { 'reported value': 'Two Senators from each State' }, limitations: 'Text citation only; selection provisions were amended by the Seventeenth Amendment. Not a claim about current membership. Link not archived; retrieval and independent human review remain pending.',
  })] },
  { id: 'conflicting', title: 'Conflicting case: synthetic reports', claims: [
    claim('pilot-report-a', { fields: { 'reported value': '15', status: 'provisional' } }),
    claim('pilot-report-b', { fields: { 'reported value': '18', status: 'final' } }),
  ] },
  { id: 'missing', title: 'Missing-source case: user claim', claims: [claim('unverified-pilot-claim', { kind: 'user claim', publisher: 'Example contributor', fields: { status: 'Pilot succeeded' }, limitations: 'Illustrative user claim; no supporting document supplied. Date is the fixture record date, not an observation date.' })] },
] as const;
export function compassExport(claims: readonly ClaimProvenance[]) {
  return JSON.stringify({ schema: 'contradiction-compass-v1', assessment: compareClaims(claims), claims, notice: 'No automatic adjudication. Review states belong to exact revisions.' }, null, 2);
}
