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
