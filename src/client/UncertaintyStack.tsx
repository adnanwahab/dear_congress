import { useState } from 'react';
import { estimateExport, METHOD_NOTE, propagateEstimate, UNCERTAINTY_CASES } from '../shared/uncertainty-stack';
import './uncertainty-stack.css';

export function UncertaintyStack() {
  const [id, setId] = useState('traceable');
  const [exportFailed, setExportFailed] = useState(false);
  const value = UNCERTAINTY_CASES.find(c => c.id === id)!;
  const result = propagateEstimate(value);
  const dollars = (n: number) => `$${n.toLocaleString('en-US')}`;
  function download() {
    try {
      const url = URL.createObjectURL(new Blob([estimateExport(value)], { type: 'application/json' }));
      const a = document.createElement('a'); a.href = url; a.download = `uncertainty-${value.revision}.json`; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000); setExportFailed(false);
    } catch { setExportFailed(true); }
  }
  return <section className="uncertainty-stack" aria-labelledby="uncertainty-title">
    <h3 id="uncertainty-title">How uncertainty compounds</h3>
    <p>Fictional shade installation budget · synthetic estimate · revision {value.revision}. No verified policy estimate is registered. All inputs are bundled: no source fetch or loading wait is needed; after the page loads, these cases work offline. Source links require a connection.</p>
    <label>Example case <select value={id} onChange={e => { setId(e.target.value); setExportFailed(false); }}>{UNCERTAINTY_CASES.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}</select></label>
    <p>Primary source means an original record; editorial inference means an interpretation; user claim means an unverified assertion; synthetic estimate means invented model inputs. No primary data source supports these fictional numbers.</p>
    <p>Budget = counted sites × design allowance × dollars per installation × delivery allowance. Every factor must have nonnegative bounded values. Shared dependencies are allowed; combining marginal confidence intervals as if they were hard bounds is not supported.</p>
    <ol className="uncertainty-layers">{value.components.map((p, i) => <li key={p.kind}>
      <h4>{i + 1}. {p.kind}</h4>
      <p><strong>{p.bounds ? `${p.bounds[0]}–${p.bounds[1]}` : 'Bounds unavailable'}</strong> · {p.kind === 'measurement' ? 'sites' : p.kind === 'cost' ? 'dollars per installation' : 'multiplier'} · {p.claim.kind}</p>
      <p>Claim {p.claim.id} · date {p.claim.date ?? 'unknown'} · source {p.claim.source ?? 'missing'}</p>
      <p>{p.claim.limitations}</p>{p.conflict && <p><strong>Conflict:</strong> {p.conflict}</p>}
      {result.steps[i] && <p>Cumulative envelope: {result.steps[i]![0].toLocaleString('en-US')}–{result.steps[i]![1].toLocaleString('en-US')} {i === 0 ? 'sites' : i === 1 ? 'design-adjusted sites' : 'dollars'}</p>}
    </li>)}</ol>
    <div role="status" aria-live="polite"><strong>{result.bounds ? `Combined scenario envelope: ${dollars(result.bounds[0])}–${dollars(result.bounds[1])}` : 'No combined interval can be justified.'}</strong><p>{result.reason}</p></div>
    <p>{METHOD_NOTE.kind} · method {METHOD_NOTE.id} · {METHOD_NOTE.date}. {METHOD_NOTE.limitations}</p>
    <h4>Provenance and material update log</h4>
    <ul>{value.history.map(h => <li key={h.revision}>{h.date} · {h.revision} · {h.review}. {h.change} Inputs: {h.claimIds.join(', ')}.</li>)}</ul>
    <p>Material changes require a new revision and log entry with source IDs and human-review state. Selecting a case changes only this local view.</p>
    <button type="button" className="outline uncertainty-export" onClick={download}>Export uncertainty record</button>
    {exportFailed && <p role="alert">Download unavailable. Copy the complete record below or use your browser’s Print / Save as PDF.</p>}
    <p>Print fallback: this entire stack and its record remain visible when printing. Copy fallback:</p>
    <pre className="uncertainty-print-record">{estimateExport(value)}</pre>
    <label>Complete uncertainty record<textarea readOnly value={estimateExport(value)} rows={6} /></label>
  </section>;
}
