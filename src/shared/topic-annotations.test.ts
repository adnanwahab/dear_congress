import { expect, test } from 'bun:test';
import { publicTopicAnnotations, type AnnotationRecord } from './topic-annotations';
const record: AnnotationRecord = { id: 'a', topicId: 'transit', layer: 'research', text: 'Question', origin: 'individual-account', moderation: 'approved', consent: 'public-topic', provenance: 'public', locationReviewed: true };
test('annotation projection fails closed for consent, moderation, origin and topic isolation', () => {
  for (const patch of [{ moderation: 'pending' }, { moderation: 'hidden' }, { consent: 'withdrawn' }, { consent: undefined }, { provenance: 'seeded' }, { provenance: 'simulation' }, { locationReviewed: false }, { topicId: 'housing' }, { origin: 'unknown' }, { layer: 'unknown' }]) {
    expect(publicTopicAnnotations('transit', [{ ...record, ...patch } as AnnotationRecord])).toEqual([]);
  }
  const before = structuredClone(record);
  expect(publicTopicAnnotations('transit', [record])).toEqual([{ id: 'a', topicId: 'transit', layer: 'research', text: 'Question', origin: 'individual-account' }]);
  expect(record).toEqual(before);
});
test('source verification requires a reviewed reference and never leaks source data on accounts', () => {
  for (const source of [undefined, { title: 'Unsafe', url: 'javascript:alert(1)', reviewedAt: '2026-11-14' }, { title: 'Missing review', url: 'https://example.org', reviewedAt: '' }]) {
    expect(publicTopicAnnotations('transit', [{ ...record, origin: 'verified-source', source }])).toEqual([]);
  }
  const source = { title: 'Reference', url: 'https://example.org', reviewedAt: '2026-11-14' };
  expect(publicTopicAnnotations('transit', [{ ...record, origin: 'verified-source', source }])[0]?.source).toEqual(source);
  expect(publicTopicAnnotations('transit', [{ ...record, source }])[0]).not.toHaveProperty('source');
});
