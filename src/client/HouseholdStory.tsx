import { useId, useRef, useState, useEffect } from 'react';
import type * as Demo from './household-story-demo';

type DemoModule = typeof Demo;
const loadDemo = () => import('./household-story-demo');
const money = (value: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
const eventNames: Record<Demo.HouseholdEvent['kind'], string> = {
  income: 'Income logged', rent: 'Rent paid', 'other-costs': 'Other costs paid', 'demo-credit': 'Demo credit logged',
};

export function HouseholdStory({ load = loadDemo }: { load?: () => Promise<DemoModule> }) {
  const id = useId();
  const [demo, setDemo] = useState<DemoModule | null>(null);
  const [household, setHousehold] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const request = useRef(0);
  useEffect(() => () => { request.current++; }, []);
  async function open() {
    const current = ++request.current;
    setStatus('loading');
    try {
      const result = await load();
      if (current !== request.current) return;
      // Generate before presenting success so a simulator failure also offers retry.
      result.simulateHouseholdPair(result.DEFAULT_STORY_HOUSEHOLD);
      setDemo(result);
      setHousehold(result.DEFAULT_STORY_HOUSEHOLD);
      setStatus('ready');
    } catch {
      if (current === request.current) setStatus('error');
    }
  }
  const pair = demo && household ? demo.simulateHouseholdPair(household) : null;
  return <section className="household-story" aria-labelledby={`${id}-title`} data-no-stage-swipe>
    <h4 id={`${id}-title`}>Follow a household across two futures</h4>
    <span className="entry-source">Synthetic sandbox · unreviewed demo</span>
    <p>Explore a three-month budget ledger for the same synthetic household in both runs. These illustrative dollars are not effects of the selected policy package, measured outcomes, real resident stories or votes.</p>
    {status !== 'ready' && <button type="button" className="ghost small" disabled={status === 'loading'} onClick={open}>
      {status === 'loading' ? 'Loading household demo…' : status === 'error' ? 'Retry household demo' : 'Open household demo'}
    </button>}
    <p role={status === 'idle' ? undefined : 'status'}>{status === 'loading' ? 'Loading local synthetic event logs.' : status === 'error' ? 'Household demo could not load. Retry to try again.' : status === 'ready' ? `Following ${household} in both runs.` : 'Demo is optional. No resident data is used.'}</p>
    {pair && demo && <>
      <label htmlFor={`${id}-household`}>Synthetic household ID</label>
      <select id={`${id}-household`} value={household} onChange={event => {
        if (demo.STORY_HOUSEHOLDS.includes(event.target.value)) setHousehold(event.target.value);
      }}>{demo.STORY_HOUSEHOLDS.map(value => <option key={value} value={value}>{value}</option>)}</select>
      <p className="muted s">Deterministic default: seed modulo population size. All households use identical income and costs; only starting balances vary. This tiny population is not representative.</p>
      <div className="household-table" role="region" aria-label="Paired synthetic household event logs" tabIndex={0}>
        <table>
          <caption>Same household, population, seed and common assumptions; only the demo credit differs. No emotions or unlogged events are inferred.</caption>
          <thead><tr><th scope="col">Trace</th><th scope="col">Baseline future</th><th scope="col">Demo credit future</th></tr></thead>
          <tbody>
            <tr><th scope="row">Run ID</th>{pair.map(run => <td key={run.id}>{run.id}</td>)}</tr>
            <tr><th scope="row">Household</th>{pair.map(run => <td key={run.id}>{run.householdId}</td>)}</tr>
            <tr><th scope="row">Provenance</th>{pair.map(run => <td key={run.id}>Population {run.assumptions.populationId} · {run.assumptions.populationSize} households · seed {run.assumptions.seed} · assumptions {run.assumptions.id}</td>)}</tr>
            <tr><th scope="row">Common monthly assumptions (USD)</th>{pair.map(run => <td key={run.id}>Income {money(run.assumptions.monthlyIncome)}; rent {money(run.assumptions.monthlyRent)}; other costs {money(run.assumptions.otherMonthlyCosts)}. No interest, taxes or other changes modeled.</td>)}</tr>
            <tr><th scope="row">Monthly demo credit</th>{pair.map(run => <td key={run.id}>{money(run.monthlyCredit)} · illustrative assumption</td>)}</tr>
            <tr><th scope="row">Starting balance</th>{pair.map(run => <td key={run.id}>{money(run.initialBalance)}</td>)}</tr>
            {[1, 2, 3].map(month => <tr key={month}><th scope="row">Month {month}</th>{pair.map(run => <td key={run.id}><ol>{run.events.filter(event => event.month === month).map(event => <li key={event.id}>
              {eventNames[event.kind]}: {money(event.change)}. Modeled balance: {money(event.balance)}.
              <details><summary>Event source</summary><code>{event.id}</code> · local ledger simulator, {run.assumptions.id}</details>
            </li>)}</ol></td>)}</tr>)}
          </tbody>
        </table>
      </div>
      <p className="muted s">Source: bundled household-ledger-v1 simulator assumptions, not external evidence. The existing snapshot API hands off a frozen plan but supplies no household event logs. This local demo does not call that API, send this selection to an external world, or change a stored plan.</p>
      <button type="button" className="ghost small" onClick={() => { request.current++; setDemo(null); setHousehold(''); setStatus('idle'); }}>Close household demo</button>
    </>}
  </section>;
}
