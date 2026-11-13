import { expect, test } from 'bun:test';
import { buildContext, DEFAULT_WEIGHTS, emptyDB, synthesize, makePopulation } from '../engine/engine';
import { PROPOSALS } from '../engine/catalog';
import type { PackageResult, Proposal } from '../engine/types';
import { budgetAlternative, budgetMoney, budgetSummary, budgetUnits, planLedger } from './plan-budget';
const p = (id: string, costB: number | null): Proposal => ({ ...PROPOSALS[0]!, id, title: id, costB });
const budgetFixture = () => {
  const proposals = [p('one', 20), p('two', 15), p('alternative', 12)];
  const pkg = { id: 'A', items: proposals.slice(0, 2).map(proposal => ({ proposal })), budget: 40, totalCost: 35,
    scoreAudit: { proposals: [{ id: 'alternative', title: 'alternative', costB: 12, status: 'excluded', reason: 'Budget' }] },
    deferred: [{ id: 'alternative', title: 'alternative', costB: 12, reason: "Doesn't fit the remaining budget", replaceIds: ['two'] }] } as PackageResult;
  return { pkg, proposals };
};
test('empty zero budget, exact integer accumulation, engine rounding and currency', () => {
  expect(planLedger([], 0).unallocated).toBe(0);
  const ledger = planLedger([p('one', .104), p('two', .202)], 1, .31);
  expect(ledger.total).toBe(306);
  expect(ledger.displayRounding).toBe(4);
  expect(ledger.rows.at(-1)!.cumulative + ledger.unallocated).toBe(1000);
  expect(budgetMoney(306)).toBe('$0.306B');
  expect(budgetMoney(1234567)).toBe('$1,234.567B');
  expect(budgetUnits(.1 + .2)).toBe(300);
});
test('unknown, negative, invalid, excess precision and infeasible values fail closed', () => {
  for (const cost of [null, -1, NaN, Infinity, .0001]) expect(() => planLedger([p('bad', cost)], 40)).toThrow();
  for (const budget of [-1, NaN, Infinity]) expect(() => planLedger([], budget)).toThrow();
  expect(() => planLedger([p('one', 1)], 0)).toThrow('Infeasible');
  expect(() => planLedger([p('one', 1)], 2, 1.1)).toThrow('reconcile');
  expect(() => planLedger([p('one', 1), p('one', 1)], 2)).toThrow('Duplicate');
});
test('replacement preserves source selections and rejects infeasible/stale or nonbudget alternatives', () => {
  const { pkg, proposals } = budgetFixture(); const original = JSON.stringify(pkg);
  const result = budgetAlternative(pkg, 'alternative', proposals);
  expect(result.removed.map(r => r.id)).toEqual(['two']);
  expect(result.after.total).toBe(32000); expect(result.delta).toBe(-3000);
  expect(JSON.stringify(pkg)).toBe(original);
  expect(() => budgetAlternative(pkg, 'missing', proposals)).toThrow();
  expect(() => budgetAlternative(pkg, 'alternative', proposals.map(p => p.id === 'alternative' ? { ...p, costB: 50 } : p))).toThrow();
  pkg.deferred[0]!.replaceIds = [];
  expect(() => budgetAlternative(pkg, 'alternative', proposals)).toThrow('Infeasible');
});
test('missing provenance stays missing; exports contain no private proposal fields', () => {
  const ledger = planLedger([{ ...p('one', 1), sourceText: 'PRIVATE STORY' }], 2);
  expect(ledger.rows[0]!.date).toBe('Not recorded');
  const summary = budgetSummary(ledger, 'A', 'real');
  expect(summary).not.toContain('PRIVATE STORY');
  expect(JSON.parse(summary).schemaVersion).toBe('plan-budget-v1');
  expect(summary).toContain('not independently sourced');
});
test('fixed seed and time replay the same fiscal ledger and engine replacement suggestions', () => {
  const ctx = buildContext(emptyDB(), makePopulation(600, 42), { now: Date.UTC(2026, 10, 13) });
  const run = () => synthesize(ctx, DEFAULT_WEIGHTS, .25, 40).map(pkg => ({ ledger: planLedger(pkg.items.map(i => i.proposal), pkg.budget, pkg.totalCost), swaps: pkg.deferred.map(d => d.replaceIds) }));
  expect(run()).toEqual(run());
});
