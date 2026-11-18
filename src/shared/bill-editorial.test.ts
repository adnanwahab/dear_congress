import { test, expect } from 'bun:test';
import { billCollection } from './bill-catalog';
import { editorialGate, type EditorialReview } from './bill-editorial';
import ledger from '../../content/bill-collections/eudaimonia-100-reviews.json';

test('all 110 concepts have current, explicitly unassigned blocked review records', () => {
  expect(ledger).toHaveLength(110);
  expect(new Set(ledger.map(row => row.id)).size).toBe(110);
  for (const bill of billCollection.bills) {
    const gate = editorialGate(bill);
    expect(gate.review?.revision).toBe(bill.revision);
    expect(gate.review?.jurisdiction).toBe(bill.jurisdiction);
    expect(gate.review?.author).toBeNull();
    expect(gate.review?.editor).toBeNull();
    expect(gate.reviewReady).toBe(false);
    expect(gate.review?.publication.status).toBe('blocked');
    expect(gate.advisoryPublicationAllowed).toBe(false);
  }
});
test('human decisions require assignments, evidence and exact revision; readiness never opens ballots', () => {
  const bill = billCollection.bills[0]!;
  const decision = { status: 'approved', reviewer: 'Human reviewer', record: 'docs/reviews/human-record.md' };
  const row: EditorialReview = { ...ledger[0]!, author: 'Author', editor: 'Editor',
    legal: decision, evidence: decision, fiscal: decision, publication: decision };
  expect(editorialGate(bill, [row]).reviewReady).toBe(true);
  expect(editorialGate(bill, [row]).advisoryPublicationAllowed).toBe(false);
  for (const rows of [[], [row, row], [{ ...row, revision: 'stale' }],
    [{ ...row, jurisdiction: 'city' }], [{ ...row, author: ' ' }], [{ ...row, editor: null }],
    ...(['legal', 'evidence', 'fiscal', 'publication'] as const).flatMap(key => [
      [{ ...row, [key]: { ...decision, status: 'pending' } }],
      [{ ...row, [key]: { ...decision, reviewer: null } }],
      [{ ...row, [key]: { ...decision, record: '' } }],
    ])]) expect(editorialGate(bill, rows).reviewReady).toBe(false);
});
