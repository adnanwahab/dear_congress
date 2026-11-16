import type { DemoItem } from '../engine/demo';

export const CLAIM_KINDS = ['primary source', 'editorial inference', 'user claim', 'synthetic estimate'] as const;
export type EvidenceClaimKind = typeof CLAIM_KINDS[number];
/** Public, citation-only projection. Never accept journals, source bodies or browser ballots. */
export function evidencePacket(item: DemoItem, now = new Date()) {
  let url: string | null = null;
  try {
    const parsed = new URL(item.sourceUrl);
    if (parsed.protocol === 'https:' && !parsed.username && !parsed.password) url = parsed.href;
  } catch { /* Missing or unsafe citation remains explicit. */ }
  const date = item.background?.checkedAt;
  const checkedAt = date && /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(Date.parse(date)) && new Date(date).toISOString().slice(0, 10) === date && Date.parse(date) <= now.getTime() ? date : null;
  return {
    schemaVersion: 1 as const,
    repository: 'adnanwahab/dear_congress' as const,
    kind: 'fictional-demo' as const,
    proposal: { id: item.id, title: item.title, jurisdiction: item.jurisdiction, currentText: item.currentText, proposedText: item.proposedText },
    // Exact exported text binds the snapshot without inventing an upstream revision number.
    exportedAt: now.toISOString(),
    evidenceSummary: { version: 1, text: item.summary, author: 'Editorial sample; individual author not recorded', review: 'Unreviewed', sourceDate: null, kind: 'editorial inference' as EvidenceClaimKind, limitations: 'Fictional scenario. Background references do not substantiate its wording or effects.' },
    citations: url ? [{ url, title: item.background?.name ?? 'Title unavailable', publisher: item.background?.publisher ?? 'Publisher unavailable', sourceDate: null, checkedAt, scope: item.background?.scope ?? 'Scope undocumented', linkVerification: 'HTTPS syntax checked; reachability and content not verified', content: 'Citation metadata only; no source full text' }] : [],
    assumptions: ['Current and proposed rules are fictional editorial text.', 'No measured policy effects or claim-level sources supplied.'],
    gaps: ['Primary-source claims: not supplied', 'User claims: not included', 'Synthetic estimates: not included', ...(url ? [] : ['Background citation missing or unsafe'])],
    materialUpdateLog: [{ version: 1, provenance: 'Existing public sample snapshot; no upstream revision history supplied', humanReview: 'Not recorded' }],
  };
}
export type EvidencePacket = ReturnType<typeof evidencePacket>;

/** Validate the closed export contract, including every nested field, before serialization. */
export function serializeEvidencePacket(packet: EvidencePacket): string {
  for (const value of [packet.proposal.id, packet.proposal.title, packet.proposal.jurisdiction, packet.proposal.currentText, packet.proposal.proposedText, packet.evidenceSummary.text, packet.exportedAt]) {
    if (typeof value !== 'string' || !value.trim()) throw new Error('Invalid required text field');
  }
  if (!Array.isArray(packet.citations) || packet.citations.length > 1) throw new Error('Invalid citations');
  for (const citation of packet.citations) {
    for (const value of [citation.url, citation.title, citation.publisher, citation.scope]) {
      if (typeof value !== 'string' || !value.trim()) throw new Error('Invalid citation metadata');
    }
    if (citation.checkedAt !== null && typeof citation.checkedAt !== 'string') throw new Error('Invalid source check date');
  }
  const item: DemoItem = {
    ...packet.proposal, topic: '', source: '', sponsors: [], support: 0, oppose: 0, unsure: 0,
    summary: packet.evidenceSummary.text, sourceUrl: packet.citations[0]?.url ?? '',
    background: packet.citations[0] ? { name: packet.citations[0].title, publisher: packet.citations[0].publisher, scope: packet.citations[0].scope, checkedAt: packet.citations[0].checkedAt } : undefined,
  };
  const expected = evidencePacket(item, new Date(packet.exportedAt));
  validateShape(packet, expected);
  // Reject unknown fields (including accidental private fields), altered statuses and invalid URLs.
  if (JSON.stringify(packet) !== JSON.stringify(expected)) throw new Error('Evidence packet does not match schema version 1');
  return JSON.stringify(expected, null, 2);
}

/** Closed JSON shape validation; null means explicitly unavailable, never an optional value. */
function validateShape(value: unknown, template: unknown): void {
  if (template === null) { if (value !== null) throw new Error('Expected unavailable value'); return; }
  if (Array.isArray(template)) {
    if (!Array.isArray(value) || value.length !== template.length) throw new Error('Invalid array');
    template.forEach((row, index) => validateShape(value[index], row)); return;
  }
  if (typeof template === 'object') {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid object');
    const fields = template as Record<string, unknown>;
    if (Object.keys(value).length !== Object.keys(fields).length) throw new Error('Unexpected fields');
    for (const key of Object.keys(fields)) {
      if (!Object.hasOwn(value, key)) throw new Error('Missing field');
      validateShape((value as Record<string, unknown>)[key], fields[key]);
    }
    return;
  }
  if (typeof value !== typeof template || (typeof value === 'number' && !Number.isFinite(value))) throw new Error('Invalid field type');
}
