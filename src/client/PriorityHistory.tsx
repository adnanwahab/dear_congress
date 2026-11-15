import { useEffect, useRef, useState } from 'react';
import { validPrioritySamples, type PrioritySample } from '../shared/priority-history';
import { runViewTransition } from './motion';

const color = (id: string) => `hsl(${Array.from(id).reduce((h, c) => (h * 31 + c.codePointAt(0)!) % 360, 0)} 55% 45%)`;

export function PriorityHistory() {
  const [samples, setSamples] = useState<PrioritySample[] | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [index, setIndex] = useState(0);
  const generation = useRef(0);
  const transition = useRef<ViewTransition | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    setError(false);
    fetch('/api/priority-history', { signal: controller.signal }).then(async response => {
      if (!response.ok) throw new Error('History unavailable');
      const data = await response.json();
      if (!validPrioritySamples(data.samples)) throw new Error('Invalid history');
      if (!controller.signal.aborted) { setSamples(data.samples); setIndex(Math.max(0, data.samples.length - 1)); }
    }).catch(() => { if (!controller.signal.aborted) setError(true); });
    return () => { controller.abort(); generation.current++; transition.current?.skipTransition(); };
  }, [attempt]);
  const visible = (samples ?? []).filter(s => (!from || s.recordedAt.slice(0, 10) >= from) && (!to || s.recordedAt.slice(0, 10) <= to));
  const selected = Math.min(index, Math.max(0, visible.length - 1));
  const sample = visible[selected];
  const firstTime = Date.parse(visible[0]?.recordedAt ?? '');
  const lastTime = Date.parse(visible.at(-1)?.recordedAt ?? '');
  const x = (i: number) => 10 + (lastTime > firstTime ? (Date.parse(visible[i]!.recordedAt) - firstTime) / (lastTime - firstTime) : 0) * 580;
  const y = (rank: number) => 10 + (rank - 1) * 260 / Math.max(1, ...visible.map(v => v.ranks.length - 1));
  const change = (next: number) => {
    const revision = ++generation.current;
    transition.current?.skipTransition();
    void runViewTransition(() => { if (generation.current === revision) setIndex(next); }, 'priority-history', t => { transition.current = t; }).catch(() => { if (generation.current === revision) setIndex(next); });
  };
  const dateChange = () => { generation.current++; transition.current?.skipTransition(); setIndex(0); };
  return <details className="priority-history"><summary>Priority time machine</summary>
    <p>Recorded shared-need model rankings, including simulated priority priors. Counts are journal records and allocation ballots, not verified people. No historical interpolation. Latest 365 changes retained.</p>
    {error ? <><p role="alert">Priority history unavailable. Current priorities are unchanged.</p><button onClick={() => setAttempt(n => n + 1)}>Retry history</button></> : samples === null ? <p role="status">Loading priority history…</p> : <>
      <label>From date <input type="date" value={from} onChange={e => { dateChange(); setFrom(e.target.value); }} /></label>{' '}
      <label>Through date <input type="date" value={to} onChange={e => { dateChange(); setTo(e.target.value); }} /></label>
      {!sample ? <p role="status">Historical priorities unavailable for this window. No recorded snapshots.</p> : <>
        {visible.length < 2 && <p>Change over time unavailable: only one recorded snapshot in this window.</p>}
        <label>Recorded snapshot <select value={selected} onChange={e => change(Number(e.target.value))}>{visible.map((s, i) => <option key={s.recordedAt + i} value={i}>{s.recordedAt}</option>)}</select></label>
        <div className="row"><button disabled={selected === 0} onClick={() => change(selected - 1)}>Previous snapshot</button><button disabled={selected === visible.length - 1} onClick={() => change(selected + 1)}>Next snapshot</button></div>
        <p role="status">{sample.recordedAt} · {sample.journals} non-synthetic public journal records ({sample.realJournals} real, {sample.sampleJournals} sample) · {sample.simulatedPrior} simulated prior residents · {sample.allocations} allocation ballots · measured outcomes {sample.measuredOutcomes ? 'enabled' : 'off'} · source: {sample.source}</p>
        <svg viewBox="0 0 600 300" role="img" aria-label="Priority rank paths across recorded snapshots. Rank one is at the top. Exact values follow in the table." style={{ width: '100%', maxHeight: 300 }}>
          {sample.ranks.map(need => <g key={need.id} stroke={color(need.id)} fill="none">{visible.slice(1).map((s, i) => {
            const a = visible[i]!.ranks.find(r => r.id === need.id), b = s.ranks.find(r => r.id === need.id);
            return a && b ? <path key={i} d={`M${x(i)},${y(a.rank)} L${x(i + 1)},${y(b.rank)}`} opacity=".6" /> : null;
          })}<circle style={{ viewTransitionName: `priority-history-${Array.from(need.id, c => c.codePointAt(0)!.toString(16)).join('-')}` }} cx={x(selected)} cy={y(need.rank)} r="4" fill={color(need.id)}><title>{need.label}: rank {need.rank}</title></circle></g>)}
          <text x="10" y="295" fill="currentColor" fontSize="12">{visible[0]!.recordedAt.slice(0, 10)}</text>
          <text x="590" y="295" textAnchor="end" fill="currentColor" fontSize="12">{visible.at(-1)!.recordedAt.slice(0, 10)}</text>
        </svg>
        <p className="muted">Rank 1 is at the top. Lines connect recorded samples only; they do not estimate ranks between dates.</p>
        <table style={{ viewTransitionName: 'priority-history-sample' }}><caption>Exact recorded ranks at {sample.recordedAt}</caption><thead><tr><th>Rank</th><th>Need</th><th>Model score</th></tr></thead><tbody>{sample.ranks.map(r => <tr key={r.id}><td>{r.rank}</td><th scope="row">{r.label}</th><td>{r.demand}</td></tr>)}</tbody></table>
        <details><summary>All samples and denominators in this window</summary>{visible.map((s, i) => <section key={i}><h3>{s.recordedAt}</h3><p>{s.journals} journal records ({s.realJournals} real, {s.sampleJournals} sample); {s.simulatedPrior} simulated prior residents; {s.allocations} allocation ballots; {s.source}; measured outcomes {s.measuredOutcomes ? 'enabled' : 'off'}</p><ol>{s.ranks.map(r => <li key={r.id}>{r.label}: rank {r.rank}, score {r.demand}</li>)}</ol></section>)}</details>
      </>}
    </>}
  </details>;
}
