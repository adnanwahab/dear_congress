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

/** Editorial evidence records; never ballot or merge authority. Versions are immutable. */
export interface QuoteAnchor {
  sourceId: string;
  version: string;
  section: string;
  page?: number;
  line?: number;
  excerpt?: string;
  retention: 'permitted' | 'external-only';
  url?: string;
  redirectedFrom?: string;
}
export interface EvidenceClaim {
  id: string;
  revision: string;
  text: string;
  kind: 'Primary source' | 'Editorial inference' | 'User claim' | 'Synthetic estimate';
  date: string;
  limitations: string;
  status: 'Supported' | 'Conflicting' | 'Missing source';
  anchors: readonly QuoteAnchor[];
  review: readonly { revision: string; date: string; provenance: string; humanReview: 'Pending' | 'Reviewed' }[];
}
export function externalAnchorUrl(anchor: QuoteAnchor): string | null {
  try {
    const url = new URL(anchor.url ?? '');
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}
export function quoteId(claim: EvidenceClaim, anchor: QuoteAnchor, _index: number): string {
  // Encode identities, not array positions of claims or mutable display text.
  return `quote-${encodeURIComponent(claim.id)}-${encodeURIComponent(claim.revision)}-${encodeURIComponent(anchor.sourceId)}-${encodeURIComponent(anchor.version)}-${encodeURIComponent(anchor.section)}-${anchor.page ?? ""}-${anchor.line ?? ""}`;
}
export function evidenceText(claims: readonly EvidenceClaim[]): string {
  return claims.map(c => [c.text, `${c.kind} · ${c.status} · ${c.date} · revision ${c.revision}`, c.limitations,
    ...c.anchors.map(a => `${a.sourceId} @ ${a.version} · ${a.section}${a.page ? ` · page ${a.page}` : ''}${a.line ? ` · line ${a.line}` : ''}\n${a.retention === 'permitted' ? a.excerpt ?? 'Quote unavailable' : 'External document; excerpt retention not permitted'}\n${externalAnchorUrl(a) ?? 'No external link'}${a.redirectedFrom ? `\nRedirect reported from ${a.redirectedFrom}; destination not verified` : ''}`),
    ...c.review.map(r => `${r.revision} · ${r.date} · ${r.provenance} · Human review: ${r.humanReview}`)
  ].join('\n')).join('\n\n');
}
const review = [{ revision: 'v1', date: '2026-11-14', provenance: 'Local repository demonstration authored for SHE-679', humanReview: 'Pending' as const }];
export const EVIDENCE_EXAMPLES: readonly EvidenceClaim[] = [
  { id: 'measurement-contract', revision: 'v1', text: 'The measurement prototype does not establish causal attribution.', kind: 'Primary source', date: '2026-11-14', limitations: 'Source supports application behavior only; no real policy effect is established.', status: 'Supported', anchors: [{ sourceId: 'src/shared/policy-measurements.ts', version: '1305bc091550425a7c6b6038ce8afd3f6acf4d4f', url: 'https://github.com/adnanwahab/dear_congress/blob/1305bc091550425a7c6b6038ce8afd3f6acf4d4f/src/shared/policy-measurements.ts', section: 'assessMetric return value', excerpt: 'Causal attribution not established', retention: 'permitted' }], review },
  { id: 'mixed-transit', revision: 'v1', text: 'The fictional transit pilot shows mixed results.', kind: 'Editorial inference', date: '2026-11-14', limitations: 'Invented fixtures: wait improves while fare burden worsens. No real-world inference or uncertainty estimate.', status: 'Conflicting', anchors: [
    { sourceId: 'synthetic-transit', version: 'synthetic-fixture-v1/wait-2025', section: 'Wait observation, 2025', excerpt: '15 minutes (baseline 20 minutes, 2024)', retention: 'permitted' },
    { sourceId: 'synthetic-transit', version: 'synthetic-fixture-v1/fare-2025', section: 'Fare observation, 2025', excerpt: '6% of income (baseline 4%, 2024)', retention: 'permitted' }], review },
  { id: 'unverified-access', revision: 'v1', text: 'All trips are accessible.', kind: 'User claim', date: '2026-11-14', limitations: 'Fictional example of an unsupported user assertion; no source supplied.', status: 'Missing source', anchors: [], review },
  { id: 'wait-estimate', revision: 'v1', text: 'The synthetic wait observation is 15 minutes in 2025.', kind: 'Synthetic estimate', date: '2026-11-14', limitations: 'Invented value, not a measured public outcome.', status: 'Supported', anchors: [{ sourceId: 'synthetic-transit', version: 'synthetic-fixture-v1/wait-2025', section: 'Wait observation, 2025', excerpt: '15 minutes', retention: 'permitted' }], review },
];

