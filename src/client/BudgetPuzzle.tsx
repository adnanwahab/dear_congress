import { useState } from 'react';
import { budgetMoney, budgetUnits } from '../shared/plan-budget';

// Fictional game IDs deliberately do not reference catalog proposals or votes.
export const PUZZLE_PROGRAMS = [
  { id: 'quest-homes', name: 'Harbor homes', costB: 16, goal: 'Reduce housing waits', gains: 'Families on the fictional housing waitlist get more places to live.', tradeoff: 'Construction takes time; nearby residents face building disruption.', deferred: 'Waitlisted families keep waiting for these additional homes.' },
  { id: 'quest-buses', name: 'Night-link buses', costB: 14, goal: 'Connect evening trips', gains: 'Night workers and riders without cars gain more evening service.', tradeoff: 'Road users face works during bus-stop upgrades; low-use routes may cost more per rider.', deferred: 'Night riders receive no additional service from this program.' },
  { id: 'quest-clinics', name: 'Neighborhood clinics', costB: 12, goal: 'Shorten routine care waits', gains: 'Residents far from existing clinics gain nearby appointments.', tradeoff: 'Staff recruitment takes time and may draw workers from other providers.', deferred: 'Residents retain existing travel and appointment waits.' },
  { id: 'quest-learning', name: 'Learning commons', costB: 10, goal: 'Expand evening learning', gains: 'Learners and caregivers gain shared study space and evening classes.', tradeoff: 'Staff take evening shifts; people unable to attend gain less.', deferred: 'Learners receive no additional evening space or classes.' },
  { id: 'quest-shade', name: 'Cool walking routes', costB: 8, goal: 'Make hot-weather walks easier', gains: 'Walkers and outdoor workers gain shade on selected routes.', tradeoff: 'Trees need water and maintenance; unserved streets see no direct benefit.', deferred: 'Walkers on these routes receive no additional shade.' },
] as const;
export const PUZZLE_PLANS = [
  { name: 'Homes and evening access', ids: ['quest-homes', 'quest-buses', 'quest-learning'] },
  { name: 'Care, learning and cooler streets', ids: ['quest-clinics', 'quest-learning', 'quest-shade'] },
] as const;
const PLAY_BUDGET = budgetUnits(40);

export function puzzleTotal(ids: readonly string[]) {
  if (new Set(ids).size !== ids.length || ids.some(id => !PUZZLE_PROGRAMS.some(p => p.id === id))) throw new Error('Unknown or duplicate fictional program. Reset the puzzle.');
  return PUZZLE_PROGRAMS.filter(p => ids.includes(p.id)).reduce((sum, p) => sum + budgetUnits(p.costB), 0);
}

/** Synchronous bundled fixture. No fetch, storage, simulator, or publication access. */
export function BudgetPuzzle() {
  const [selected, setSelected] = useState<string[]>([]);
  const [reviewed, setReviewed] = useState(false);
  const [notice, setNotice] = useState('Choose programs, then review who gains and who waits.');
  let total: number;
  try { total = puzzleTotal(selected); }
  catch { return <section className="card budget-puzzle" aria-label="Budget puzzle"><p role="alert">The fictional plan could not be calculated. Your civic votes are unaffected.</p><button onClick={() => { setSelected([]); setReviewed(false); }}>Reset puzzle</button></section>; }
  const remaining = PLAY_BUDGET - total;
  function choose(ids: string[]) {
    setSelected(ids); setReviewed(false);
    setNotice('Plan changed. Review the tradeoffs when you are ready.');
  }
  return <section className="card budget-puzzle" aria-label="Budget-balancing policy puzzle">
    <h2>Can you balance a $40B play budget?</h2>
    <p><span className="badge">Demo sandbox · fictional programs · awaiting review</span></p>
    <p>Spend up to $40B per fictional year. Choose which goals to support, review the people helped and the opportunities deferred, then try a different plan. There is no single winning policy mix; leaving money unallocated is allowed.</p>
    <p className="muted">Source: bundled game fixture, version 1. Costs and effects are invented for learning, not measured evidence or model projections. Choices stay in this page’s memory and reset on leaving or reloading. They never become votes, public synthesis, or simulator inputs.</p>
    <fieldset><legend>Choose from five fictional programs</legend>
      <div className="budget-puzzle-programs">{PUZZLE_PROGRAMS.map(p => <label key={p.id} className="budget-puzzle-program">
        <span><input type="checkbox" checked={selected.includes(p.id)} onChange={() => choose(selected.includes(p.id) ? selected.filter(id => id !== p.id) : [...selected, p.id])} /> <b>{p.name} · ${p.costB}B</b></span>
        <span>Goal: {p.goal}.</span><span>Who gains: {p.gains}</span><span>Tradeoff: {p.tradeoff}</span>
      </label>)}</div>
    </fieldset>
    <p role="status" aria-live="polite">Allocated {budgetMoney(total)} of $40B. {remaining < 0 ? `Over budget by ${budgetMoney(-remaining)}. Remove programs to make the plan feasible.` : `Unallocated ${budgetMoney(remaining)}.`} {notice}</p>
    <div className="budget-puzzle-actions"><button disabled={remaining < 0 || selected.length === 0} onClick={() => { setReviewed(true); setNotice('Plan fits the play budget. Read the benefits and deferred goals below.'); }}>Review my plan</button>
      <button onClick={() => { choose([]); setNotice('Puzzle reset. Choose programs to begin again.'); }}>Reset puzzle</button></div>
    {reviewed && <section aria-label="Your fictional plan tradeoffs"><h3>A feasible plan, with tradeoffs</h3>
      <p>Fitting the budget does not prove a plan is fair, effective or preferable. All programs draw from the same limited play budget. Real taxes, existing services, interactions and uncertainty are not modeled.</p>
      <ul>{PUZZLE_PROGRAMS.map(p => <li key={p.id}><b>{p.name} · {selected.includes(p.id) ? 'Funded' : 'Deferred'}:</b> {selected.includes(p.id) ? `${p.gains} ${p.tradeoff}` : p.deferred}</li>)}</ul>
      <p>{budgetMoney(remaining)} remains unallocated for other priorities or a reserve; no benefits from that remainder are assumed. Which deferred goal matters most to you, and what would you give up to fund it?</p>
    </section>}
    <details><summary>Explore two viable plans · neither is a recommendation</summary>
      <p>These examples serve different goals. Compare funded and deferred groups using the same review above. You may change either example.</p>
      {PUZZLE_PLANS.map(plan => <div key={plan.name}><p><b>{plan.name}</b> · {budgetMoney(puzzleTotal(plan.ids))} allocated. {PUZZLE_PROGRAMS.filter(p => (plan.ids as readonly string[]).includes(p.id)).map(p => p.name).join(', ')}.</p><button onClick={() => choose([...plan.ids])}>Try {plan.name}</button></div>)}
    </details>
  </section>;
}
