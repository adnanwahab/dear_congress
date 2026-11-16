import { useState } from 'react';
import type { Proposal } from '../engine/types';
import { budgetMoney, budgetUnits } from '../shared/plan-budget';
import { runViewTransition } from './motion';

const DRAG_TYPE = 'application/x-civic-workbench';
export function workbenchCost(p: Proposal): number | null {
  try { return budgetUnits(p.costB); } catch { return null; }
}

/** A deliberately separate, unsaved fiscal experiment. No votes or synthesis API calls. */
export function PlanWorkbench({ proposals, lane, loading = false }: { proposals: Proposal[]; lane: string; loading?: boolean }) {
  const [selected, setSelected] = useState<string[]>([]);
  const [log, setLog] = useState<string[]>([]);
  const [message, setMessage] = useState('Choose a policy to begin.');
  const policies = proposals.filter((p, i) => proposals.findIndex(other => other.id === p.id) === i);
  const chosen = policies.filter(p => selected.includes(p.id));
  const total = chosen.reduce((sum, p) => sum + (workbenchCost(p) ?? 0), 0);
  const remaining = 40000 - total;
  const conflicts = chosen.flatMap(p => p.rightsIssue ? [`${p.title}: rights constraint — ${p.rightsIssue}`] : workbenchCost(p) === null ? [`${p.title}: cost unavailable`] : []);
  if (remaining < 0) conflicts.unshift(`Over budget by ${budgetMoney(-remaining)}. Remove policies to fit $40B.`);
  function change(id: string, add: boolean) {
    const p = policies.find(p => p.id === id);
    if (!p || loading || selected.includes(id) === add) return;
    const cost = workbenchCost(p);
    if (add && (p.rightsIssue || cost === null)) { setMessage(`${p.title} unavailable: ${p.rightsIssue || 'cost unknown or invalid'}.`); return; }
    const entry = `${add ? 'Added' : 'Removed'} ${p.title} (${budgetMoney(cost ?? 0)}).`;
    void runViewTransition(() => {
      setSelected(ids => add ? [...ids, id] : ids.filter(value => value !== id));
      setLog(entries => [...entries, entry]); setMessage(entry);
    }, 'plan-rerank');
  }
  function zone(add: boolean) {
    return {
      onDragOver: (e: React.DragEvent) => { if (e.dataTransfer.types.includes(DRAG_TYPE)) e.preventDefault(); },
      onDrop: (e: React.DragEvent) => { e.preventDefault(); change(e.dataTransfer.getData(DRAG_TYPE), add); },
    };
  }
  function card(p: Proposal, add: boolean) {
    const cost = workbenchCost(p);
    const blocked = !!p.rightsIssue || cost === null;
    return <li key={p.id} draggable={!loading && (!add || !blocked)} onDragStart={e => { e.dataTransfer.setData(DRAG_TYPE, p.id); e.dataTransfer.effectAllowed = 'move'; }}>
      <b>{p.title}</b> · {cost === null ? 'Cost unknown' : budgetMoney(cost)} / year
      <p className="muted"><span className="badge">{p.emergent ? 'Citizen idea' : 'Catalog policy'}</span> <span className="badge">{p.costEstimate ? `${p.costEstimate} model estimate` : 'Illustrative assumption'}</span> <span className="badge">Source: {p.id} · {p.jurisdiction}</span></p>
      <p>{p.rightsIssue ? `Rights blocked: ${p.rightsIssue}` : cost === null ? 'Add unavailable until a valid cost is supplied.' : 'Budget arithmetic only; evidence, feasibility and policy interactions need review.'}</p>
      <button disabled={loading || (add && blocked)} onClick={() => change(p.id, add)} aria-label={`${add ? 'Add' : 'Remove'} ${p.title}`}>{add ? 'Add' : 'Remove'}</button>
    </li>;
  }
  return <section className="plan-workbench" aria-label={`Build a plan — ${lane}`} aria-busy={loading}>
    <h4>Build a plan · $40B illustrative workbench</h4>
    <p><span className="badge">{lane === 'real' ? 'Real-input synthesis lane' : `Includes simulated inputs · ${lane} lane`}</span> <span className="badge">Advisory · unsaved what-if</span></p>
    <p>Start empty and explore catalog costs independently of synthesis selections. Drag policies between the two areas, or use Add and Remove with touch or keyboard. No publication, voting or saved synthesis changes occur.</p>
    <p>Costs are illustrative annual USD billions, not independently sourced estimates. Estimate dates, uncertainty, incremental spending and contingency are unknown. This is not a new synthesis or an official plan.</p>
    <p role="status" aria-live="polite">Cost {budgetMoney(total)} · {remaining < 0 ? 'Over budget' : 'Remaining'} {budgetMoney(Math.abs(remaining))}. {message}</p>
    {loading ? <p role="status">Loading policies…</p> : policies.length === 0 ? <p>No policies available. The workbench remains empty.</p> : <div className="plan-workbench-columns">
      <section {...zone(true)} aria-label="Workbench drop area"><h5>In your workbench ({chosen.length})</h5>{!chosen.length && <p>Drop policies here, or select Add below.</p>}<ul>{chosen.map(p => card(p, false))}</ul></section>
      <section {...zone(false)} aria-label="Available policies drop area"><h5>Available policies</h5><p>Drop a selected policy here to remove it.</p><ul>{policies.filter(p => !selected.includes(p.id)).map(p => card(p, true))}</ul></section>
    </div>}
    <h5>Conflicts and explanation</h5>
    {conflicts.length ? <ul>{conflicts.map(c => <li key={c}>{c}</li>)}</ul> : <p>No modeled budget conflicts. Rights-blocked and uncosted policies cannot be added. Other interactions are not modeled; fitting the budget is not policy validation.</p>}
    <details><summary>Inspectable change log ({log.length})</summary>{log.length ? <ol>{log.map((entry, i) => <li key={i}>{entry}</li>)}</ol> : <p>No changes yet.</p>}</details>
  </section>;
}
