import { useState } from 'react';
import type { PackageResult, Proposal } from '../engine/types';
import { budgetAlternative, budgetMoney, budgetSummary, budgetUnits, planLedger } from '../shared/plan-budget';

export function PlanBudget({ pkg, proposals, lane }: { pkg: PackageResult; proposals: Proposal[]; lane: string }) {
  const [candidate, setCandidate] = useState('');
  const [revision, setRevision] = useState<ReturnType<typeof budgetAlternative> | null>(null);
  const [filter, setFilter] = useState('');
  let baseline: ReturnType<typeof planLedger>;
  try { baseline = planLedger(pkg.items.map(i => i.proposal), pkg.budget, pkg.totalCost); }
  catch (e) { return <section aria-label="Plan budget"><p role="alert">{String(e instanceof Error ? e.message : e)}</p></section>; }
  let preview: ReturnType<typeof budgetAlternative> | null = null;
  let error = '';
  if (candidate) try { preview = budgetAlternative(pkg, candidate, proposals); } catch (e) { error = String(e instanceof Error ? e.message : e); }
  const ledger = revision?.after ?? baseline;
  const rows = ledger.rows.filter(r => `${r.title} ${r.jurisdiction}`.toLowerCase().includes(filter.toLowerCase()));
  const exportText = budgetSummary(ledger, pkg.id, lane);
  return <section className="budget-ledger" aria-label="Plan budget ledger">
    <h4>Where does the budget go?</h4>
    <p>USD billions per year, across the jurisdictions named below. All amounts are simulated model assumptions, not independently sourced estimates. One-time costs are not separately modeled.</p>
    <p>Program cost is the model’s annual allocation. Existing spending and net incremental spending are unknown. Contingency: $0 modeled reserve; real-world contingency and uncertainty ranges are unknown. Costs stay fixed in this ledger; the budget and synthesis weights are adjustable above.</p>
    <p><b>{budgetMoney(ledger.total)}</b> allocated + <b>{budgetMoney(ledger.unallocated)}</b> unallocated = {budgetMoney(ledger.budget)} budget. Precision: $1 million.</p>
    {!!baseline.displayRounding && <p>The synthesis headline rounds to $0.01B: {budgetMoney(baseline.total)} + {budgetMoney(baseline.displayRounding)} rounding adjustment = {budgetMoney(baseline.total + baseline.displayRounding)}. Rounding is not spending.</p>}
    {revision && <p role="status">Local plan revision committed for this ledger only. Original synthesis selections are preserved. <button onClick={() => { setRevision(null); setCandidate(''); }}>Restore original ledger</button></p>}
    <label>Filter ledger items <input value={filter} onChange={e => setFilter(e.target.value)} /></label>
    <p>{rows.length} of {ledger.rows.length} items shown. Totals always include every item.</p>
    <div className="budget-table-scroll" role="region" aria-label="Budget allocation table" tabIndex={0}><table>
      <caption>Allocation waterfall: cumulative cost equals the sum of all preceding annual allocations. Each bar starts at the previous cumulative amount. Text values provide the same information.</caption>
      <thead><tr><th scope="col">Item / jurisdiction</th><th scope="col">Estimate source / date</th><th scope="col">Annual allocation</th><th scope="col">Cumulative</th><th scope="col">Waterfall</th></tr></thead>
      <tbody>{rows.map(r => <tr key={r.id}><th scope="row">{r.title}<br />{r.jurisdiction}</th><td>{r.source}<br />Date: {r.date}<br />Uncertainty: unknown</td><td>{budgetMoney(r.amount)}</td><td>{budgetMoney(r.cumulative)}</td><td><span className="budget-track" aria-hidden="true"><span style={{ marginLeft: `${ledger.budget ? (r.cumulative - r.amount) / ledger.budget * 100 : 0}%`, width: `${ledger.budget ? r.amount / ledger.budget * 100 : 0}%` }} /></span></td></tr>)}</tbody>
      <tfoot><tr><th scope="row">Total (all items)</th><td>Contingency not modeled</td><td>{budgetMoney(ledger.total)}</td><td>Unallocated {budgetMoney(ledger.unallocated)}</td><td /></tr></tfoot>
    </table></div>
    <details><summary>Excluded alternatives and marginal funding</summary><ul>{pkg.scoreAudit.proposals.filter(p => p.status === 'excluded').map(p => {
      let marginal = 'Unknown cost — inclusion unavailable';
      try { marginal = `${budgetMoney(budgetUnits(p.costB))} annual cost; ${budgetMoney(Math.max(0, budgetUnits(p.costB) - baseline.unallocated))} additional funding needed without removals`; } catch {}
      return <li key={p.id}>{p.title}: {p.reason}. {marginal}. Additional money does not override other exclusion gates.</li>;
    })}</ul></details>
    {!revision && <><label>If we add an item, what would come out? <select value={candidate} onChange={e => setCandidate(e.target.value)}><option value="">Choose a budget-excluded item</option>{pkg.deferred.filter(d => d.reason === "Doesn't fit the remaining budget" && d.replaceIds).map(d => <option key={d.id} value={d.id}>{d.title}</option>)}</select></label>
      {error && <p role="alert">{error}</p>}
      {preview && <div role="status"><p>Budget-only alternative from the synthesis engine’s deterministic replacement calculation. This is not a fresh score optimization; stability protections and all policy trade-offs still require review. Original selections remain unchanged.</p>
        <p>Before {budgetMoney(preview.before.total)} → after {budgetMoney(preview.after.total)}. Net dollar delta: {preview.delta < 0 ? '−' : '+'}{budgetMoney(Math.abs(preview.delta))}. Uncertainty: unknown for both plans.</p>
        <ul>{preview.removed.map(r => <li key={r.id}>Remove {r.title}: −{budgetMoney(r.amount)}</li>)}{preview.added.map(r => <li key={r.id}>Add {r.title}: +{budgetMoney(r.amount)}</li>)}</ul>
        <button onClick={() => { setRevision(preview); setCandidate(''); }}>Commit local ledger revision</button> <button onClick={() => setCandidate('')}>Cancel preview</button>
      </div>}</>}
    <p><a download={`plan-budget-v1-${lane}-${pkg.id}.json`} href={`data:application/json;charset=utf-8,${encodeURIComponent(exportText)}`}>Download shareable versioned budget summary</a></p>
    <p className="muted">This fiscal snapshot contains item titles, costs and assumptions only. It does not verify outcomes, enact policy, save votes or reproduce synthesis from changing private inputs.</p>
  </section>;
}
