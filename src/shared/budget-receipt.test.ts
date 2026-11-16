import { test, expect } from 'bun:test';
import { receiptMoney, receiptValue, RESIDENT_DENOMINATORS } from './budget-receipt';
import type { BudgetRow } from './plan-budget';
const row: BudgetRow = { id: 'one', title: 'Bus service', jurisdiction: 'Houston', amount: 600, cumulative: 600, source: 'Illustrative catalog assumption', date: 'Not recorded' };
test('annual millions convert to dollars and only matching Census residents are used', () => {
  expect(receiptValue(row, 'annual')).toBe(600000000);
  expect(receiptValue(row, 'resident')).toBeCloseTo(260.351127, 5);
  for (const [jurisdiction, d] of Object.entries(RESIDENT_DENOMINATORS)) {
    expect(receiptValue({ ...row, jurisdiction }, 'resident')).toBe(600000000 / d.residents);
    expect(d.source).toContain('census.gov/');
  }
  expect(receiptValue({ ...row, amount: 0 }, 'resident')).toBe(0);
  expect(() => receiptValue({ ...row, jurisdiction: 'Unknown' }, 'resident')).toThrow('No sourced');
  expect(receiptValue({ ...row, jurisdiction: 'Unknown' }, 'annual')).toBe(600000000);
});
test('invalid amounts fail closed and small nonzero amounts never round to zero', () => {
  for (const amount of [-1, NaN, Infinity, .1, Number.MAX_SAFE_INTEGER]) expect(() => receiptValue({ ...row, amount }, 'annual')).toThrow();
  expect(receiptMoney(.001)).toBe('Less than $0.01');
  expect(receiptMoney(0)).toBe('$0.00');
});
