import { useEffect, useState } from 'react';
import { comparisonGaps, type LocalPolicyPair } from '../shared/jurisdiction-comparison';
import './jurisdiction-comparison.css';

const loadExamples = () => import('../shared/jurisdiction-comparison').then(m => m.LOCAL_POLICY_PAIRS);
export function JurisdictionComparison({ load = loadExamples }: { load?: () => Promise<LocalPolicyPair[]> }) {
  const [examples, setExamples] = useState(false);
  const [pairs, setPairs] = useState<LocalPolicyPair[]>([]);
  const [phase, setPhase] = useState<'loading' | 'ready' | 'failed'>('loading');
  const [attempt, setAttempt] = useState(0);
  const [selected, setSelected] = useState('matched');
  useEffect(() => {
    if (!examples) return;
    let active = true;
    setPhase('loading');
    Promise.resolve().then(load).then(value => { if (active) { setPairs(value); setPhase('ready'); } }, () => { if (active) setPhase('failed'); });
    return () => { active = false; };
  }, [examples, attempt, load]);
  const pair = pairs.find(p => p.id === selected);
  const gaps = pair ? comparisonGaps(pair.records) : ['No pair available'];
  return <section className="panel jurisdiction-comparison" aria-label="Compare local policy learning">
    <h2>What did two places try and learn?</h2>
    <p>Read-only exploration · no location inference, journal access, voting or external submission.</p>
    <label><input type="checkbox" checked={examples} onChange={e => setExamples(e.target.checked)} /> Explore fictional comparison examples</label>
    {!examples ? <div role="status"><h3>No comparable data</h3><p>No verified jurisdiction policy pairs are connected. Comparable definitions, dates, cited sources and outcome measures are required before displaying a comparison.</p></div> : <>
      <p><strong>Synthetic examples only. All places, policies, dates and numbers below are invented.</strong></p>
      {phase === 'loading' && <p role="status">Loading comparison examples…</p>}
      {phase === 'failed' && <div role="alert"><p>Comparison examples could not load. No results are available.</p><button onClick={() => setAttempt(a => a + 1)}>Retry comparison</button></div>}
      {phase === 'ready' && <><label>Choose a pair<select value={selected} onChange={e => setSelected(e.target.value)}>{pairs.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}</select></label>
        <h3>Comparability and limitations — read first</h3>
        <p>Different definitions or sampling block numeric comparison. Matching labels do not establish equivalent populations or eliminate confounders. No uncertainty intervals or representative sampling are available.</p>
        <p><strong>Causal attribution not established. These observations cannot prove that a policy caused an outcome or that one place performed better.</strong></p>
        {pair && <><div className="local-policy-pair">{pair.records.map(r => <article key={r.id}><h3>{r.jurisdiction}</h3><p>{r.policy}</p><p>Effective: {r.effectiveDate} · Observed: {r.period}</p><p>Definition: {r.measure.definition} ({r.measure.unit}). Population: {r.measure.population}.</p><p>Sampling: {r.measure.sampling}.</p><p>Confounders: {r.confounders.join(' ')}</p><p>Source: {r.source.label} · {r.source.revision} · record {r.id}. <a href="https://github.com/adnanwahab/dear_congress/blob/main/src/shared/jurisdiction-comparison.ts">Inspect synthetic fixture definitions</a></p><p>{r.learned}</p></article>)}</div>
        {gaps.length ? <div role="status"><h3>No comparable data</h3><ul>{gaps.map(g => <li key={g}>{g}</li>)}</ul><p>Numeric comparison withheld. Review source methods before comparing these places.</p></div> : <div role="status"><h3>Descriptive comparison · synthetic</h3><p>Same metric, unit, observation period and sampling definition; confounders remain.</p><dl>{pair.records.map(r => <div key={r.id}><dt>{r.jurisdiction}</dt><dd>{r.measure.value} {r.measure.unit} · {r.period}</dd></div>)}</dl></div>}</>}
        {!pair && <p role="status">No comparable data. No pair is available.</p>}
      </>}
    </>}
  </section>;
}
