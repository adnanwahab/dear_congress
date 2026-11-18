import { describe, expect, test } from 'bun:test';
import { publishCitizenProposal } from './citizen-proposals';
import { exportPolicyPreviewSource, savedVersionHash, sanitizePreviewSourceUrl, type PublicLegalVersion, type ReviewedPreviewMapping } from './policy-preview-source';
import { canonicalLegal, exactClauseDiff, legalHash } from './policy-preview-diff';
const owner = 'publishing-browser';
function fixture() {
  const store = { entries: [], citizenProposals: [] as (ReturnType<typeof publishCitizenProposal>['record'] & { legalVersions: PublicLegalVersion[] })[] };
  const p = publishCitizenProposal(store, owner, { title: 'Public proposal', problem: 'Public problem', proposedChange: 'Original text', jurisdiction: 'city', confirmedPublic: true, idempotencyKey: crypto.randomUUID() }).record;
  const make = (version: number, clauses: PublicLegalVersion['clauses']): PublicLegalVersion => {
    const data = { version, versionId: `${p.id}:v${version}`, title: p.title, type: 'bill' as const, clauses, createdAt: p.publishedAt };
    return { ...data, contentHash: savedVersionHash(data) };
  };
  const base = make(1, [{ clauseId: 'same', text: 'Unchanged' }, { clauseId: 'change', text: '  Café\r\nold 🏛️\t' }, { clauseId: 'gone', text: 'Remove this.' }]);
  const next = make(2, [{ clauseId: 'same', text: 'Unchanged' }, { clauseId: 'change', text: '  Café\r\nnew 🏛️\t' }, { clauseId: 'new', text: 'Add this.\n' }]);
  const record = Object.assign(p, { legalVersions: [base, next] });
  const selection = { proposalId: p.id, versionId: next.versionId, baseVersionId: base.versionId, expectedHash: next.contentHash, expectedBaseHash: base.contentHash, confirmedPublicTransfer: true };
  const run = (reviews: ReviewedPreviewMapping[] = []) => exportPolicyPreviewSource(store, owner, selection, 'https://civic.example/?tracking=secret#fragment', reviews);
  return { store, record, base, next, selection, run };
}
describe('immutable public revision exporter', () => {
  test('golden add/remove/modify preserves exact text, IDs and prior records', () => {
    const f = fixture(), before = JSON.stringify(f.store);
    expect(f.run().legal.clauses).toEqual([
      { clauseId: 'change', sourcePolicyId: null, operation: 'modify', beforeText: '  Café\r\nold 🏛️\t', afterText: '  Café\r\nnew 🏛️\t' },
      { clauseId: 'gone', sourcePolicyId: null, operation: 'remove', beforeText: 'Remove this.', afterText: '' },
      { clauseId: 'new', sourcePolicyId: null, operation: 'add', beforeText: '', afterText: 'Add this.\n' },
    ]);
    expect(f.run().metadata.jurisdiction).toBe('city');
    expect(f.run().baseline.kind).toBe('prior-proposal-version');
    expect(JSON.stringify(f.store)).toBe(before);
    expect(JSON.stringify(f.run())).toBe(JSON.stringify(f.run()));
    const result = f.run(); result.legal.clauses[0]!.afterText = 'mutation';
    expect(f.next.clauses[1]!.text).toBe('  Café\r\nnew 🏛️\t');
  });
  test('HBL #558 fixture hash and sorted-key serialization match exactly', () => {
    const legal = { baseVersionId: 'housing-demo-v1', clauses: [{ clauseId: 'housing-section-2', sourcePolicyId: 'h_lots', operation: 'add', beforeText: '', afterText: 'Section 2. Permit additional homes on eligible residential parcels through the reviewed housing and zoning mechanism.' }] };
    expect(legalHash(legal)).toBe('bcb6466a4803cc00cdba7102c4c4d2bc8925d09cb046737a314390af5421be8e');
    expect(canonicalLegal({ z: 'é', a: '\r\n' })).toBe('{"a":"\\r\\n","z":"é"}');
  });
  test('no-change is local and cannot masquerade as an HBL request', () => {
    const f = fixture(); f.next.clauses = structuredClone(f.base.clauses); f.next.contentHash = savedVersionHash(f.next); f.selection.expectedHash = f.next.contentHash;
    expect(f.run().status).toBe('no-change'); expect(f.run().legal.clauses).toEqual([]);
  });
  test('stale hash, mutated source, absent prior version and future baseline fail closed', () => {
    const f = fixture(); f.selection.expectedHash = 'stale'; expect(f.run).toThrow('Stale');
    f.selection.expectedHash = f.next.contentHash; f.selection.baseVersionId = 'missing'; expect(f.run).toThrow('not found');
    f.selection.baseVersionId = f.next.versionId; f.selection.expectedBaseHash = f.next.contentHash; expect(f.run).toThrow('prior');
    f.next.clauses[0]!.text = 'tampered'; expect(f.run).toThrow('hash mismatch');
  });
  test('permission and transfer consent are checked before exporting', () => {
    const f = fixture();
    expect(() => exportPolicyPreviewSource(f.store, 'wrong browser', f.selection, 'https://civic.example')).toThrow('publishing browser');
    f.selection.confirmedPublicTransfer = false; expect(f.run).toThrow('Confirm');
    f.selection.confirmedPublicTransfer = true; f.record.publishedAt = ''; expect(f.run).toThrow('publication');
  });
  test('URL sanitation removes query/fragment and rejects credential or script URLs', () => {
    expect(sanitizePreviewSourceUrl('https://example.org/law?secret=x#private')).toBe('https://example.org/law');
    for (const url of ['javascript:alert(1)', 'https://user:password@example.org/', 'not a URL']) expect(() => sanitizePreviewSourceUrl(url)).toThrow();
    expect(fixture().run().source.url).not.toContain('secret');
  });
  test('only separately reviewed exact transition mappings are modeled; modify carries no numeric effects', () => {
    const f = fixture();
    const review = (clauseId: string, sourcePolicyId: ReviewedPreviewMapping['sourcePolicyId']): ReviewedPreviewMapping => ({ repository: 'adnanwahab/dear_congress', proposalId: f.record.id, baseVersionId: f.base.versionId, versionId: f.next.versionId, baseHash: f.base.contentHash, versionHash: f.next.contentHash, clauseId, sourcePolicyId, reviewUrl: 'https://github.com/adnanwahab/dear_congress/pull/1' });
    expect(f.run().status).toBe('not-modeled');
    const reviews = [review('change', 'h_lots'), review('gone', 'f_drainage'), review('new', 't_brt')];
    expect(f.run(reviews).status).toBe('ready');
    expect(f.run(reviews).legal.clauses[0]!.operation).toBe('modify');
    expect(Object.keys(f.run(reviews).legal.clauses[0]!)).toEqual(['clauseId', 'sourcePolicyId', 'operation', 'beforeText', 'afterText']);
    reviews[0]!.versionHash = 'old review'; expect(f.run(reviews).status).toBe('not-modeled');
    f.next.type = 'constitutional-amendment'; f.next.contentHash = savedVersionHash(f.next); f.selection.expectedHash = f.next.contentHash;
    expect(f.run(reviews).legal.clauses.every(c => c.sourcePolicyId === null)).toBe(true);
  });
  test('no journals, votes, account/owner keys, location or record internals are serialized', () => {
    const f = fixture(); f.record.votesByVoterHash.SECRET_VOTER = 'support'; f.record.sourceEntryId = 'SECRET_JOURNAL'; f.record.jurisdictionName = 'SECRET_PLACE';
    const result = JSON.stringify(f.run());
    for (const secret of ['SECRET_VOTER', 'SECRET_JOURNAL', 'SECRET_PLACE', f.record.ownerHash, f.record.publishKeyHash]) expect(result).not.toContain(secret);
    f.next.clauses[0]!.text = 'Contact private@example.org'; f.next.contentHash = savedVersionHash(f.next); f.selection.expectedHash = f.next.contentHash;
    expect(f.run).toThrow('Personal');
  });
  test('legacy public version 1 resolves without writing versions; private draft IDs never resolve', () => {
    const f = fixture(); delete (f.record as { legalVersions?: PublicLegalVersion[] }).legalVersions;
    f.selection.versionId = 'browser-private-version'; expect(f.run).toThrow('not found');
    expect(f.record.legalVersions).toBeUndefined();
  });
  test('duplicate IDs and oversized union fail without corrupting text', () => {
    expect(() => exactClauseDiff([{ clauseId: 'x', text: 'a' }, { clauseId: 'x', text: 'b' }], [])).toThrow('Unique');
    const f = fixture(); f.base.clauses = Array.from({ length: 32 }, (_, i) => ({ clauseId: `old-${i}`, text: 'old' })); f.next.clauses = [{ clauseId: 'new', text: 'new' }];
    f.base.contentHash = savedVersionHash(f.base); f.next.contentHash = savedVersionHash(f.next); f.selection.expectedBaseHash = f.base.contentHash; f.selection.expectedHash = f.next.contentHash;
    expect(f.run).toThrow('32-clause');
  });
});
