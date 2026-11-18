import { textHash, type RevisionKey, type Snapshot } from './contract';
export const selection: RevisionKey = { repository: 'adnanwahab/dear_congress', kind: 'hfl', billId: 'HFL-090', revision: 'catalog-r1' };
export async function fixture(): Promise<Snapshot> {
  const source = { ...selection, text: 'Full source <script>alert(1)</script>\nFinal clause.', textHash: '', attribution: 'Fixture author', provenance: 'Synthetic test only', editorialStatus: 'Pending legal review' };
  source.textHash = await textHash(source.text);
  const round = { id: 'round-1', opensAt: '2026-11-01T00:00:00Z', closesAt: '2026-12-01T00:00:00Z', state: 'open' as const, support: 0, oppose: 0, unsure: 0, electorate: 'Unverified browser identities' };
  const text = 'Amended full text <img src=x onerror=alert(1)>';
  return { source, round, objections: [
    { ...selection, id: 'public', text: 'Public dissent', attribution: 'Voluntary public author', status: 'unresolved', response: '', visibility: 'public' },
    { ...selection, id: 'private', text: 'PRIVATE SECRET', attribution: 'Hidden', status: 'unresolved', response: '', visibility: 'private' as any },
  ], amendments: [{ ...source, id: 'amendment-1', text, textHash: await textHash(text), revision: 'catalog-r2', parentRevision: selection.revision, origin: 'ai', rationale: 'Alternative addressing dissent; tradeoffs unverified', round: { ...round, id: 'round-2', unsure: 3 } }] };
}
