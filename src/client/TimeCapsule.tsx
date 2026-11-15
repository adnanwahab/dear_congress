import { useState } from 'react';
import { SYNTHETIC_METRICS } from '../shared/policy-measurements';
import { sealSessionForecast, type CapsuleDraft, type CapsuleReceipt } from '../shared/time-capsule';

export function TimeCapsule() {
  const [draft, setDraft] = useState<CapsuleDraft>({ metricId: '', jurisdiction: '', horizon: '', target: '', prediction: '' });
  const [receipt, setReceipt] = useState<CapsuleReceipt | null>(null);
  const [error, setError] = useState('');
  const metric = SYNTHETIC_METRICS.find(row => row.id === draft.metricId);
  const baseline = metric?.history.find(row => row.revision === metric.baselineRevision);
  const update = (key: keyof CapsuleDraft, value: string) => setDraft(old => ({ ...old, [key]: value }));
  return <section className="panel" id="time-capsule" aria-labelledby="time-capsule-title">
    <h2 id="time-capsule-title">Civic Time Capsule</h2>
    <p>Synthetic rehearsal: write a measurable prediction, freeze its baseline, then inspect the evidence gap. No real policy effects or governmental authorization are implied.</p>
    <p>Private to this page session. Reloading or leaving loses the forecast. This is not a durable or tamper-proof seal; public sharing and cross-device retrieval are unavailable. <a href="/account">Participation &amp; privacy</a></p>
    {!receipt ? <form onSubmit={event => { event.preventDefault(); try { setReceipt(sealSessionForecast(draft)); setError(''); } catch (cause) { setError((cause as Error).message); } }}>
      <p><label>Metric <select required value={draft.metricId} onChange={e => update('metricId', e.target.value)}><option value="">Choose a synthetic metric</option>{SYNTHETIC_METRICS.map(row => <option key={row.id} value={row.id}>{row.label}</option>)}</select></label></p>
      <p><label>Jurisdiction <select required value={draft.jurisdiction} onChange={e => update('jurisdiction', e.target.value)}><option value="">Choose jurisdiction</option><option>Fictional transit pilot</option></select></label></p>
      {baseline && <p>Selected baseline: {baseline.value} {baseline.unit}, {baseline.period}; {baseline.population}. Origin: {baseline.sourceVersion}, revision {baseline.revision}. Invented fixture; no external source or retrieval timestamp. Method: illustrative fixture construction; uncertainty unavailable.</p>}
      <p><label>Forecast horizon (UTC date) <input required type="date" value={draft.horizon} onInput={e => update('horizon', e.currentTarget.value)} /></label></p>
      <p><label>Predicted threshold {metric ? `(${metric.direction === 'lower' ? 'at most' : 'at least'}, ${baseline?.unit})` : ''} <input required type="number" step="any" value={draft.target} onInput={e => update('target', e.currentTarget.value)} /></label></p>
      <p><label>Explicit prediction and assumptions <textarea required maxLength={1000} value={draft.prediction} onInput={e => update('prediction', e.currentTarget.value)} /></label></p>
      <p>Your threshold is a personal forecast, not an observed value or calibrated model estimate. No vote or model run is submitted.</p>
      <button type="submit">Freeze session forecast</button>
      {error && <p role="alert">{error}</p>}
    </form> : <div role="status">
      <h3>Session forecast frozen</h3>
      <p>{receipt.prediction}</p>
      <p>{receipt.metric}: {receipt.direction === 'lower' ? 'at most' : 'at least'} {receipt.target} {receipt.baseline.unit} by {receipt.horizon} UTC in {receipt.jurisdiction}. Personal estimate; uncertainty not supplied.</p>
      <p>Frozen at {receipt.sealedAt} using this device’s clock, not a trusted timestamp. Baseline: {receipt.baseline.value} {receipt.baseline.unit} ({receipt.baseline.period}), {receipt.baseline.sourceVersion}, revision {receipt.baseline.revision}.</p>
      <p>Result unavailable: no matching observed public evidence is connected. A future comparison requires the same metric definition, jurisdiction, population, unit, method and forecast period. Missing evidence is not a failed prediction. Synthetic observations and model runs cannot verify real effects.</p>
      <p>No model run receipt is attached. Existing model receipts remain in the <a href="/synth">synthetic mechanism sandbox</a>; they are not public outcome evidence. This private forecast is never an official result.</p>
      <details><summary>Inspect frozen session receipt</summary><pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{JSON.stringify(receipt, null, 2)}</pre></details>
    </div>}
  </section>;
}
