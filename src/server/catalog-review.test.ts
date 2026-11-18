import { describe, expect, test } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CatalogReviewStore } from './catalog-review';
import { billCollection } from '../shared/bill-catalog';

describe('catalog expert review persistence and authorization', () => {
  test('decisions persist across restart and retain an audit event', () => {
    const dir = mkdtempSync(join(tmpdir(), 'catalog-review-'));
    const path = join(dir, 'test.sqlite');
    const token = 'a'.repeat(40);
    const reviewers = [{ id: 'legal-1', name: 'Legal Reviewer', token, roles: ['legal' as const] }];
    const bill = billCollection.bills[58]!;
    try {
      let store = new CatalogReviewStore(path, reviewers);
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
    const bill = billCollection.bills[58]!;
    try {
      expect(() => store.decide(new Request('https://local'), bill.id, { revision: bill.revision, jurisdiction: bill.jurisdiction, category: 'legal', decision: 'approved', reason: 'This should be rejected.' })).toThrow();
      const req = new Request('https://local', { headers: { authorization: `Bearer ${token}` } });
      expect(() => store.decide(req, bill.id, { revision: 'stale', jurisdiction: bill.jurisdiction, category: 'evidence', decision: 'approved', reason: 'This revision has changed.' })).toThrow('Stale');
      expect((store.db.query('SELECT count(*) n FROM review_decisions').get() as { n: number }).n).toBe(0);
    } finally { store.close(); rmSync(dir, { recursive: true, force: true }); }
  });
});
