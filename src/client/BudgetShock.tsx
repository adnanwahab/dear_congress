import { useEffect, useRef, useState } from 'react';
import './budget-shock.css';

export const BUDGET_LINES = [
  { name: 'Essential service access', baseline: 50, minimum: 50 },
  { name: 'Maintenance', baseline: 30, minimum: 20 },
  { name: 'New projects', baseline: 20, minimum: 10 },
] as const;
export const budgetTotal = (plan: readonly number[]) => plan.reduce((sum, value) => sum + value, 0);
export const workableBudget = (plan: readonly number[]) => plan.length === 3 && plan.every((value, index) => Number.isInteger(value) && value >= BUDGET_LINES[index]!.minimum && value <= BUDGET_LINES[index]!.baseline) && budgetTotal(plan) + 20 <= 100;
const baseline = () => BUDGET_LINES.map(line => line.baseline);

/** Independent fictional fixture. No resident inputs, persistence, or participation APIs. */
export function BudgetShock({ onStart }: { onStart?: () => void }) {
  const [scene, setScene] = useState<'closed' | 'baseline' | 'shock' | 'receipt'>('closed');
  const [reserve, setReserve] = useState(false);
  const [plan, setPlan] = useState<number[]>(baseline);
  const heading = useRef<HTMLHeadingElement>(null);
  const launcher = useRef<HTMLButtonElement>(null);
  const started = useRef(false);
  useEffect(() => { if (scene !== 'closed') heading.current?.focus(); else if (started.current) launcher.current?.focus(); }, [scene]);
  const start = () => { started.current = true; onStart?.(); setReserve(false); setPlan(baseline()); setScene('baseline'); };
  const exit = () => { setReserve(false); setPlan(baseline()); setScene('closed'); };
  const total = budgetTotal(plan) + 20;
  const funding = reserve ? 120 : 100;
  const valid = reserve ? (plan.every((v, i) => Number.isInteger(v) && v >= BUDGET_LINES[i]!.minimum && v <= BUDGET_LINES[i]!.baseline) && total <= funding) : workableBudget(plan);
  return <section className="budget-shock" aria-label="Fictional budget shock exercise">
    <span className="chip">Fictional / hypothetical · local sandbox</span>
    <h2 ref={heading} tabIndex={-1}>Budget shock{scene === 'closed' ? ' · optional exercise' : ` · ${scene === 'baseline' ? '1. Starting assumptions' : scene === 'shock' ? '2. Rebalance' : '3. Tradeoff receipt'}`}</h2>
    <p>All people, costs and conditions in this exercise are invented. Your choices never alter advisory participation, votes, proposals or a real fiscal plan. No points, rewards or ideological ranking.</p>
    {scene === 'closed' ? <button ref={launcher} onClick={start}>Try fictional budget shock</button> : <>
      {scene === 'baseline' ? <><p>The fictional town has 100 tokens: essential service access 50, maintenance 30, and new projects 20. The starting plan uses all 100 tokens.</p><button onClick={() => setScene('shock')}>Reveal hypothetical shock</button></> : <>
        <p>A fictional materials cost increase adds a fixed 20 tokens. Ordinary funding stays at 100; a hypothetical one-time reserve of 20 is also available. The unchanged plan now costs 120. Adjust allocations to leave room for the shock.</p>
        <p><strong>Protected constraints:</strong> essential service access stays at 50; maintenance must retain at least 20; new projects at least 10. These invented minimums represent access and safety commitments for this exercise only.</p>
        <div className="budget-shock-options"><button disabled={scene === 'receipt'} onClick={() => { setReserve(false); setPlan([50, 30, 0]); }}>Explore below-minimum plan</button><button disabled={scene === 'receipt'} onClick={() => { setReserve(false); setPlan([50, 20, 10]); }}>Split reductions</button><button disabled={scene === 'receipt'} onClick={() => { setReserve(true); setPlan(baseline()); }}>Use fictional one-time reserve</button></div>
        <p>With these minimums, the only workable allocation at the original funding level is 50 / 20 / 10. A second workable response uses a fictional reserve below.</p>
        {BUDGET_LINES.map((line, index) => <label key={line.name}>{line.name} (minimum {line.minimum})<select disabled={scene === 'receipt'} value={plan[index]} onChange={e => setPlan(current => current.map((v, i) => i === index ? Number(e.target.value) : v))}>{Array.from({ length: line.baseline / 10 + 1 }, (_, n) => n * 10).map(value => <option key={value} value={value}>{value} tokens</option>)}</select></label>)}
        <p role="status">Hypothetical cost: {total} / {funding} tokens. {valid ? 'Workable within protected constraints.' : 'Not workable: restore protected minimums and stay within funding.'}</p>
        <ul aria-label="Tradeoff receipt">{BUDGET_LINES.map((line, i) => <li key={line.name}>{line.name}: {line.baseline} → {plan[i]} tokens. {i === 0 ? 'Access commitment must remain protected.' : i === 1 ? 'Reducing maintenance delays noncritical repairs.' : 'Reducing new projects postpones expansion.'}{plan[i]! < line.minimum && ' Protected minimum violated.'}</li>)}<li>Fictional cost shock: +20 tokens.</li><li>{reserve ? `Reserve: 20 → ${20 - Math.max(0, total - 100)} tokens. One-time draw: ${Math.max(0, total - 100)} tokens; less buffer remains for another shock.` : 'Reserve untouched: 20 tokens remain for another shock.'}</li></ul>
        {scene === 'shock' && <button disabled={!valid} onClick={() => setScene('receipt')}>Inspect completed receipt</button>}
        {scene === 'receipt' && <><p>Fictional exercise complete. {reserve ? 'This response uses the one-time reserve; inspect the remaining buffer above.' : 'This response defers repairs and expansion.'} Other responses can protect different priorities if their assumptions and funding are explicit.</p><button onClick={() => setScene('shock')}>Revise sandbox plan</button></>}
      </>}
      <div className="budget-shock-options"><button onClick={exit}>Skip</button><button onClick={start}>Restart</button><button onClick={exit}>Exit</button></div>
    </>}
    <details><summary>Complete-text explanation · fictional budget shock</summary><p>Start with 100 invented tokens: access 50, maintenance 30, projects 20. A hypothetical cost shock adds 20, creating a 20-token gap. Keep access at 50, maintenance at least 20 and projects at least 10. Reducing maintenance and projects by 10 each balances 100 including the shock, but delays repairs and expansion. An alternative is a fictional one-time reserve of 20: retain 50 / 30 / 20, pay 120 using 100 funding plus 20 reserve, and preserve services today while exhausting the reserve. Neither response is preferred; reserves cannot cover recurring shocks indefinitely. Real budgets require evidence, authority and distributional review. Every scene is hypothetical. Skip and Exit discard the exercise; Restart restores the starting assumptions. State exists only in this mounted component, with no network writes or storage. No choice changes participation or earns rewards.</p></details>
  </section>;
}
