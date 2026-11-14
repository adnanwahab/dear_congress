import type { PackageResult, Proposal } from '../engine/types';

/** Integer millions: the synthesis total supports 0.01 billion precision. */
export const BUDGET_VERSION = 'plan-budget-v1';
export function budgetUnits(value: number | null): number {
  if (value === null || !Number.isFinite(value) || value < 0) throw new Error('Unknown, negative or invalid cost/budget. Fiscal ledger unavailable.');
  const units = Math.round(value * 1000);
  if (!Number.isSafeInteger(units) || Math.abs(value * 1000 - units) > 1e-6) throw new Error('Cost exceeds supported precision ($1 million).');
  return units;
}
export function budgetMoney(units: number): string {
  return `$${(units / 1000).toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}B`;
}
export type BudgetRow = { id: string; title: string; jurisdiction: string; source: string; date: string; amount: number; cumulative: number };
export function planLedger(proposals: Proposal[], budgetB: number, displayedTotalB?: number) {
  const budget = budgetUnits(budgetB);
  let total = 0;
  const ids = new Set<string>();
  const rows: BudgetRow[] = proposals.map(p => {
    if (ids.has(p.id)) throw new Error('Duplicate item in fiscal ledger.');
    ids.add(p.id);
    const amount = budgetUnits(p.costB);
    total += amount;
    if (!Number.isSafeInteger(total)) throw new Error('Fiscal total exceeds supported range.');
    return { id: p.id, title: p.title, jurisdiction: p.jurisdiction, source: p.costEstimate ? `${p.costEstimate} model estimate` : 'Illustrative catalog assumption', date: 'Not recorded', amount, cumulative: total };
  });
  if (total > budget) throw new Error('Infeasible plan: costs exceed the budget.');
  // The engine rounds its total to hundredths of a billion. Expose that residual.
  const displayed = displayedTotalB === undefined ? total : budgetUnits(displayedTotalB);
  if (displayedTotalB !== undefined && Math.round(total / 10) * 10 !== displayed) throw new Error('Item costs do not reconcile with the synthesis total.');
  return { rows, total, budget, unallocated: budget - total, displayRounding: displayed - total };
}

/** Reuse the engine's ranked cheapestIncumbentsToFree result; do not invent a new optimizer. */
export function budgetAlternative(pkg: PackageResult, candidateId: string, proposals: Proposal[]) {
  const candidate = pkg.deferred.find(d => d.id === candidateId);
  if (!candidate || candidate.reason !== "Doesn't fit the remaining budget" || !candidate.replaceIds) throw new Error('No synthesis budget replacement available; other exclusion gates cannot be overridden.');
  const proposal = proposals.find(p => p.id === candidateId);
  if (!proposal || proposal.rightsIssue) throw new Error('Alternative is unavailable or rights blocked.');
  const before = planLedger(pkg.items.map(i => i.proposal), pkg.budget, pkg.totalCost);
  if (budgetUnits(proposal.costB) !== budgetUnits(candidate.costB)) throw new Error('Alternative estimate changed; synthesize again.');
  const remove = new Set(candidate.replaceIds);
  if ([...remove].some(id => !before.rows.some(r => r.id === id))) throw new Error('Replacement refers to an unavailable item.');
  const after = planLedger([...pkg.items.filter(i => !remove.has(i.proposal.id)).map(i => i.proposal), proposal], pkg.budget);
  return { before, after, removed: before.rows.filter(r => remove.has(r.id)), added: after.rows.filter(r => r.id === candidateId), delta: after.total - before.total };
}

export function budgetSummary(ledger: ReturnType<typeof planLedger>, packageId: string, lane: string) {
  return JSON.stringify({ schemaVersion: BUDGET_VERSION, packageId, lane, displayUnits: 'USD billions per year', numericUnits: 'USD millions per year (all ledger numeric fields)', synthesisReplayInputs: 'Not captured; this is a fiscal summary, not a synthesis replay', amounts: 'Simulated assumptions, not independently sourced fiscal estimates', incrementalVsTotal: 'Program cost assumption; net incremental spending and existing baseline unknown', contingency: 'No reserve modeled; real-world contingency unknown', uncertainty: 'No calibrated uncertainty ranges; estimate dates not recorded', replay: 'Frozen fiscal summary only; not a replay of private votes, scoring or stability history', ...ledger }, null, 2);
}
