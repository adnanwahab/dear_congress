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
      <DivergenceReplay key={household} pair={pair} />
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

/** Replays the existing ledger; the toggle isolates the sole differing assumption. */
export function DivergenceReplay({ pair }: { pair: [Demo.HouseholdRun, Demo.HouseholdRun] }) {
  const id = useId();
  const [credit, setCredit] = useState(false);
  const [month, setMonth] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [replay, setReplay] = useState(0);
  useEffect(() => {
    if (!playing) return;
    const timer = setTimeout(() => {
      if (month >= 3) setPlaying(false);
      else setMonth(month + 1);
    }, 900);
    return () => clearTimeout(timer);
  }, [playing, month, replay]);
  const runs = [pair[0], credit ? pair[1] : pair[0]];
  const balance = (run: Demo.HouseholdRun) => run.events.filter(event => event.month <= month).at(-1)?.balance ?? run.initialBalance;
  const difference = balance(runs[1]!) - balance(runs[0]!);
  return <section className="divergence-replay" aria-labelledby={`${id}-title`}>
    <h5 id={`${id}-title`}>See what changes: one assumption</h5>
    <p>Fictional modeled future · advisory only. Isolate monthly demo credit: $0 → $150. Household, income, costs, starting balance and seed stay fixed. No funding costs, eligibility, behavioral responses or uncertainty distribution are modeled; real effects are unknown.</p>
    <label><input type="checkbox" checked={credit} onChange={event => {
      setCredit(event.target.checked); setMonth(0); setPlaying(true); setReplay(value => value + 1);
    }} /> Apply $150 monthly demo credit</label>
    <p>Illustrative calendar starts January 1, 2030; dates are scenario labels, not observations or implementation commitments.</p>
    <div className="divergence-worlds" key={replay}>
      {runs.map((run, index) => <div key={`${index}-${month}`} className={index === 1 && difference !== 0 ? 'divergence-changed' : ''}>
        <h6>{index === 0 ? 'Before · $0 credit' : `After · $${credit ? 150 : 0} credit`}</h6>
        <p>Modeled balance <strong>{money(balance(run))}</strong></p>
        <p>{index === 1 ? `Difference: ${money(difference)}` : 'Fixed baseline'}</p>
      </div>)}
    </div>
    <p role="status">{month === 0 ? '2030-01-01 · same starting state' : `2030-${String(month + 1).padStart(2, '0')}-01 · month ${month} complete`} · {difference === 0 ? 'No divergence' : `${money(difference)} divergence from demo credit`}</p>
    <button type="button" onClick={() => { setMonth(0); setPlaying(true); setReplay(value => value + 1); }}>Replay changed assumption</button>{' '}
    <button type="button" disabled={!playing} onClick={() => setPlaying(false)}>Pause replay</button>{' '}
    <button type="button" disabled={month >= 3} onClick={() => { setPlaying(false); setMonth(value => Math.min(3, value + 1)); }}>Next month</button>
    <label htmlFor={`${id}-month`}>Inspect month</label>
    <input id={`${id}-month`} type="range" min="0" max="3" step="1" value={month} onChange={event => { setPlaying(false); setMonth(Number(event.target.value)); }} />
    <ol aria-label="Dated divergence event log">
      {[1, 2, 3].filter(value => value <= month).map(value => <li key={value}>
        <time dateTime={`2030-${String(value + 1).padStart(2, '0')}-01`}>2030-{String(value + 1).padStart(2, '0')}-01</time>: Month {value} closed. {credit ? `$150 demo credit added; cumulative difference ${money(value * 150)}.` : 'Credit disabled; no divergence.'}
        {credit && <span> Event: {pair[1].events.find(event => event.month === value && event.kind === 'demo-credit')?.id}</span>}
      </li>)}
    </ol>
  </section>;
}
