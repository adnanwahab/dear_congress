import { useState } from 'react';
import { CASES, COMPOSITION_VERSION, GROUPS, LIMITS, composition, compositionReport, type ClaimProvenance, type CompositionEvent } from '../shared/response-composition';
import './response-composition.css';

export function ResponseComposition() {
  const [weights, setWeights] = useState([1, 1]);
  const [caseId, setCaseId] = useState('sourced');
  const [history, setHistory] = useState<CompositionEvent[]>([]);
  const [error, setError] = useState('');
  const result = composition(weights);
  const selected = CASES.find(c => c.id === caseId)!;
  const provenance: ClaimProvenance = { kind: selected.kind, source: selected.source, date: '2026-11-14', limitation: selected.limitation, review: 'pending human review' };
  function update(nextWeights: number[], nextCase: string, action: string) {
    setWeights(nextWeights); setCaseId(nextCase);
    setHistory(rows => [...rows, { at: new Date().toISOString(), action, weights: [...nextWeights], caseId: nextCase, provenance: COMPOSITION_VERSION, review: 'pending human review' }]);
  }
  const report = compositionReport(weights, caseId, history);
  function download() {
    try {
      const url = URL.createObjectURL(new Blob([report], { type: 'application/json' }));
      const a = document.createElement('a'); a.href = url; a.download = 'illustrative-response-composition.json'; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000); setError('');
    } catch { setError('Download unavailable. Select and copy the full report below, or use your browser’s Print command.'); }
  }
  return <section className="panel response-composition" aria-labelledby="composition-title" id="response-composition">
    <h2 id="composition-title">Who responded? Explore response composition</h2>
    <p>{LIMITS}</p>
    <p>Ready immediately from bundled fixtures, including offline. Proposal loading or errors do not affect this exercise. Nothing is saved; reload resets the exercise.</p>
    <label>Evidence case <select value={caseId} onChange={e => update(weights, e.target.value, 'Changed evidence case')}>{CASES.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}</select></label>
    <h3>{selected.title}</h3><p>{selected.text}</p>
    <p><strong>{provenance.kind}</strong> · authored {provenance.date} · {provenance.review}<br />Source: {provenance.source ?? 'Missing — no source supplied'}<br />{provenance.limitation}</p>
    <p><strong>Primary source:</strong> the complete original fictional count record below, {COMPOSITION_VERSION}/groups, authored 2026-11-14. Primary describes origin, not truth or representativeness; this record is synthetic.</p>
    <div className="composition-groups">{GROUPS.map((g, i) => <fieldset key={g.name}><legend>{g.name}</legend>
      <p>Illustrative input: {g.support} support, {g.oppose} oppose, {g.unsure} unsure · 2026-11-14 · synthetic estimate, pending human review.</p>
      <label>Response multiplier for {g.name}: {weights[i]}×<input type="range" min="0" max="5" step="0.25" value={weights[i]} onPointerDown={e => { if (e.pointerType !== "touch") return; const box = e.currentTarget.getBoundingClientRect(); if (!box.width) return; const ratio = Math.max(0, Math.min(1, (e.clientX - box.left) / box.width)); const next = [...weights]; next[i] = Math.round(ratio * 20) / 4; update(next, caseId, `Touched ${g.name}`); }} onInput={e => { const next = [...weights]; next[i] = Number(e.currentTarget.value); update(next, caseId, `Reweighted ${g.name}`); }} /></label>
    </fieldset>)}</div>
    <p>Use arrow keys on sliders or drag by touch. Each group keeps its preferences; only its contribution changes. These multipliers are assumptions, not population weights.</p>
    <div role="status" aria-live="polite" aria-atomic="true"><h3>Illustrative weighted responses: {result.total}</h3>{['Support', 'Oppose', 'Unsure'].map((label, i) => <p key={label}>{label}: {result.counts[i]} weighted responses · {result.percentages[i]}</p>)}</div>
    <p><strong>Editorial inference</strong> · 2026-11-14 · pending human review: Changing who responds can change the displayed percentages even when no individual preference changes. This arithmetic cannot correct unknown selection bias.</p>
    <button onClick={() => update([1, 1], 'sourced', 'Reset exercise')}>Reset exercise</button>{' '}
    <button onClick={download}>Export illustrative report</button>{' '}
    <button onClick={() => { try { window.print(); } catch { setError('Print unavailable. Select and copy the full report below.'); } }}>Print exercise</button>
    {error && <p role="alert">{error}</p>}
    <h3>Provenance and human-review log</h3><p>{history.length} changes this session · pending human review. Fixture revision {COMPOSITION_VERSION}. This log records assumptions, not approval.</p>
    <label>Full report — select and copy if export or print is unavailable<textarea readOnly value={report} rows={8} /></label><pre className="composition-print-report">{report}</pre>
  </section>;
}
