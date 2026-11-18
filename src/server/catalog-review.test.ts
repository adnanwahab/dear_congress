import { describe, expect, test } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CatalogReviewStore } from './catalog-review';
import { billCollection, originalReviewBills } from '../shared/bill-catalog';

describe('catalog expert review persistence and authorization', () => {
  test('decisions persist across restart and retain an audit event', () => {
    const dir = mkdtempSync(join(tmpdir(), 'catalog-review-'));
    const path = join(dir, 'test.sqlite');
    const token = 'a'.repeat(40);
    const reviewers = [{ id: 'legal-1', name: 'Legal Reviewer', token, roles: ['legal' as const] }];
    const bill = originalReviewBills[58]!;
    try {
      let store = new CatalogReviewStore(path, reviewers);
      expect(store.queue()).toHaveLength(100);
      const req = new Request('https://local/api', { headers: { authorization: `Bearer ${token}` } });
      store.decide(req, bill.id, { revision: bill.revision, jurisdiction: bill.jurisdiction, category: 'legal', decision: 'approved', reason: 'Reviewed the cited authority and limitations.' });
      store.close();
      store = new CatalogReviewStore(path, reviewers);
      const rows = store.db.query('SELECT decision,revision FROM review_decisions WHERE bill_id=?').all(bill.id) as any[];
      expect(rows).toHaveLength(1);
      expect(rows[0].decision).toBe('approved');
      expect(rows[0].revision).toBe(bill.revision);
      expect(store.db.query('SELECT action FROM audit_events').all()).toHaveLength(1);
      store.close();
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
  test('rejects unauthorized and stale-revision decisions', () => {
    const dir = mkdtempSync(join(tmpdir(), 'catalog-review-'));
    const token = 'b'.repeat(40);
    const store = new CatalogReviewStore(join(dir, 'test.sqlite'), [{ id: 'evidence-1', name: 'Evidence Reviewer', token, roles: ['evidence'] }]);
    const bill = originalReviewBills[58]!;
    try {
      expect(() => store.decide(new Request('https://local'), bill.id, { revision: bill.revision, jurisdiction: bill.jurisdiction, category: 'legal', decision: 'approved', reason: 'This should be rejected.' })).toThrow();
      const req = new Request('https://local', { headers: { authorization: `Bearer ${token}` } });
      expect(() => store.decide(req, bill.id, { revision: 'stale', jurisdiction: bill.jurisdiction, category: 'evidence', decision: 'approved', reason: 'This revision has changed.' })).toThrow('Stale');
      const outsideOriginalSet = billCollection.bills.find(candidate => candidate.id === 'HFL-101')!;
      expect(() => store.submit({ billId: outsideOriginalSet.id, revision: outsideOriginalSet.revision, jurisdiction: outsideOriginalSet.jurisdiction, category: 'evidence', findings: 'This bill is outside the original review set.' })).toThrow('Stale');
      expect((store.db.query('SELECT count(*) n FROM review_decisions').get() as { n: number }).n).toBe(0);
    } finally { store.close(); rmSync(dir, { recursive: true, force: true }); }
  });
  test('keeps public suggestions pending across restart and blocks publication until all reviews pass', () => {
    const dir = mkdtempSync(join(tmpdir(), 'catalog-review-'));
    const path = join(dir, 'test.sqlite');
    const token = 'c'.repeat(40);
    const reviewers = [{ id: 'publisher-1', name: 'Publisher', token, roles: ['publisher' as const] }];
    const bill = originalReviewBills[58]!;
    try {
      let store = new CatalogReviewStore(path, reviewers);
      const submission = store.submit({ billId: bill.id, revision: bill.revision, jurisdiction: bill.jurisdiction, category: 'evidence', findings: 'The evidence section needs an additional primary source.', sources: ['https://example.org/source'] });
      expect(submission.status).toBe('pending');
      const req = new Request('https://local/api', { headers: { authorization: `Bearer ${token}` } });
      expect(() => store.publish(req, bill.id, { revision: bill.revision, jurisdiction: bill.jurisdiction, reason: 'Publication review completed.' })).toThrow('legal review is not approved');
      store.close();
      store = new CatalogReviewStore(path, reviewers);
      const row = store.db.query('SELECT status,findings FROM review_submissions WHERE id=?').get(submission.id) as { status: string; findings: string };
      expect(row).toEqual({ status: 'pending', findings: 'The evidence section needs an additional primary source.' });
      expect(store.db.query('SELECT count(*) n FROM review_decisions').get()).toMatchObject({ n: 0 });
      expect(() => store.db.query('DELETE FROM audit_events').run()).toThrow('append-only');
      store.close();
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
});
