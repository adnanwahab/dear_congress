import { expect, test } from 'bun:test';
import { DEMO_ITEMS } from '../engine/demo';
import { evidencePacket, serializeEvidencePacket } from './evidence-packet';
const now = new Date('2026-11-14T12:00:00Z');

test('exports isolate exact sample text and allowlist metadata without private fields', () => {
  for (const item of DEMO_ITEMS) {
    const before = JSON.stringify(item);
    const packet = evidencePacket({ ...item, journals: ['PRIVATE'], fullText: 'UNLICENSED', votes: ['SECRET'] } as any, now);
    const json = serializeEvidencePacket(packet);
    expect(json).not.toContain('PRIVATE'); expect(json).not.toContain('UNLICENSED'); expect(json).not.toContain('SECRET');
    expect(packet.proposal.proposedText).toBe(item.proposedText);
    expect(packet.repository).toBe('adnanwahab/dear_congress');
    expect(packet.evidenceSummary.review).toBe('Unreviewed');
    expect(packet.citations[0]?.sourceDate).toBeNull();
    expect(packet.citations[0]?.url).toBe(item.sourceUrl);
    expect(JSON.stringify(item)).toBe(before);
    expect(() => serializeEvidencePacket({ ...packet, journals: [] } as any)).toThrow();
    expect(() => serializeEvidencePacket({ ...packet, repository: 'another/repo' } as any)).toThrow();
  }
});

test('missing and unsafe citations stay missing; invalid dates cannot become checked', () => {
  for (const sourceUrl of ['', 'javascript:alert(1)', 'http://example.com', 'https://user:password@example.com']) {
    const packet = evidencePacket({ ...DEMO_ITEMS[0]!, sourceUrl }, now);
    expect(packet.citations).toEqual([]);
    expect(packet.gaps).toContain('Background citation missing or unsafe');
    expect(() => serializeEvidencePacket(packet)).not.toThrow();
  }
  for (const checkedAt of ['2026-02-31', '2027-01-01', 'nonsense']) {
    const packet = evidencePacket({ ...DEMO_ITEMS[0]!, background: { ...DEMO_ITEMS[0]!.background!, checkedAt } }, now);
    expect(packet.citations[0]!.checkedAt).toBeNull();
  }
});

test('new snapshot preserves material text changes without inventing human review', () => {
  const before = evidencePacket(DEMO_ITEMS[0]!, now);
  const after = evidencePacket({ ...DEMO_ITEMS[0]!, proposedText: 'Changed proposal' }, now);
  expect(before.proposal.proposedText).not.toBe(after.proposal.proposedText);
  expect(after.materialUpdateLog[0]!.humanReview).toBe('Not recorded');
  expect(() => serializeEvidencePacket({ ...after, schemaVersion: 2 } as any)).toThrow();
});

test('schema rejects malformed nested metadata and unsafe inserted citations', () => {
  const packet = evidencePacket(DEMO_ITEMS[0]!, now);
  for (const mutate of [
    (p: any) => p.proposal.title = 42,
    (p: any) => p.citations[0].publisher = 42,
    (p: any) => p.proposal.id = '',
    (p: any) => p.citations[0].url = 'javascript:alert(1)',
    (p: any) => p.citations[0].sourceDate = '2026-11-14',
    (p: any) => p.citations[0].fullText = 'copyrighted',
    (p: any) => p.materialUpdateLog[0].humanReview = 'Approved',
  ]) {
    const copy = structuredClone(packet); mutate(copy);
    expect(() => serializeEvidencePacket(copy)).toThrow();
  }
});
