import { expect, test } from 'bun:test';
import { financeExample, financeFreshness, reconcileFinance } from './finance-explorer';
test('consolidation counts final uses once, leaves gaps explicit and preserves input', () => {
  const before = JSON.stringify(financeExample);
  const result = reconcileFinance(financeExample);
  expect([result.funding, result.spending, result.unresolved]).toEqual([100, 75, 25]);
  expect(result.rows.map(a => [a.start, a.end])).toEqual([[0,0],[0,10],[10,25],[25,75]]);
  expect(JSON.stringify(financeExample)).toBe(before);
  expect(reconcileFinance({ ...financeExample, agencies: [] }).funding).toBe(0);
});
test('rejects duplicate, unmatched, overdrawn, cyclic and invalid accounting', () => {
  for (const mutate of [
    (d: typeof financeExample) => { d.agencies.push(d.agencies[0]!); },
    (d: typeof financeExample) => { d.agencies[1]!.received = 90; },
    (d: typeof financeExample) => { d.agencies[3]!.spending = 61; },
    (d: typeof financeExample) => { d.agencies[0]!.spending = NaN; },
    (d: typeof financeExample) => { d.agencies[3]!.transfers.push({ to: 'example-federal', amount: 1 }); },
    (d: typeof financeExample) => { d.agencies[0]!.transfers[0]!.to = 'unknown'; },
  ]) { const d = structuredClone(financeExample); mutate(d); expect(() => reconcileFinance(d)).toThrow(); }
});
test('unknown, stale, invalid, future and recently checked evidence remain distinct', () => {
  const now = Date.parse('2026-11-17');
  expect(financeFreshness(null, now)).toBe('Evidence not checked');
  for (const date of ['2025-01-01', 'invalid', '2027-01-01']) expect(financeFreshness(date, now)).toContain('review required');
  expect(financeFreshness('2026-11-16', now)).toContain('within 90 days');
});
