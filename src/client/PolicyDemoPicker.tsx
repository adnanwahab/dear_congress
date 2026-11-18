import {useState} from 'react';
import {POLICY_DEMOS, POLICY_DEMO_SOURCE, type PolicyDemoId} from '../shared/policy-demo-catalog';

/** Integration seam only. onSelect must invoke the existing authorized server
 * creation/save flow; it must not turn a browser mapping ID into authority. */
export function PolicyDemoPicker({onSelect}: {onSelect?: (id: PolicyDemoId) => Promise<void>}) {
  const [selected, setSelected] = useState<PolicyDemoId>('housing');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const demo = POLICY_DEMOS.find(row => row.id === selected)!;
  async function choose() {
    if (!onSelect || busy) return;
    setBusy(true); setMessage('Opening the proposal save flow…');
    try { await onSelect(selected); setMessage('Continue in the proposal save flow. No simulation has been created by this picker.'); }
    catch { setMessage('Unable to open this draft. No save or simulation success is claimed. Try again.'); }
    finally { setBusy(false); }
  }
  return <section aria-label="Policy simulation demonstrations" style={{maxWidth:'60rem', overflowWrap:'anywhere'}}>
    <h2>Explore a proposed policy</h2>
    <p>Illustrative drafts in a synthetic jurisdiction. Candidate mappings from HBL #{563}; human acceptance and legal applicability review remain open.</p>
    <label>Choose a policy <select value={selected} disabled={busy} onChange={event => {setSelected(event.target.value as PolicyDemoId); setMessage('');}}>
      {POLICY_DEMOS.map(row => <option key={row.id} value={row.id}>{row.id === 'unsupported' ? 'Unsupported constitutional draft — Not Modeled' : row.id[0]!.toUpperCase()+row.id.slice(1)}</option>)}
    </select></label>
    <h3>{demo.input.source.title}</h3>
    <p>{demo.input.baseline.versionId} → {demo.input.source.versionId}. Prior proposal baseline, not enacted law. The baseline adds no clause.</p>
    {demo.input.legal.clauses.map(clause => <div key={clause.clauseId}>
      <h4>{clause.clauseId}</h4><p>Before: {clause.beforeText || '(no added clause)'}</p><p>After: {clause.afterText}</p>
    </div>)}
    <p>{demo.id === 'unsupported' ? 'Not Modeled. Legal diff retained.' : `Software mapping: ${demo.mappingId}. 100 matched pairs, seed 42, 24 months; recorded checkpoints 0, 12 and 24.`}</p>
    <p>{demo.limitation}</p>
    <p>Not Available: {demo.unsupportedMetrics.join(', ')}. Results are synthetic model outputs, not real-world forecasts or calibrated probabilities.</p>
    <details><summary>Reproduction and mapping identity</summary>
      <p>Proposal: {demo.input.source.proposalId}. Legal SHA-256: <code>{demo.legalHash}</code></p>
      <p>Model: <code>{demo.modelVersion}</code>. Mapping: {demo.mappingVersion}.</p>
      <p>Candidate source: {POLICY_DEMO_SOURCE.repository}@{POLICY_DEMO_SOURCE.commit}.</p>
    </details>
    <p>Select policy → inspect exact amendment → save a public version → See What Changes → explore recorded futures and explanations.</p>
    {!onSelect && <p>Save integration is pending SHE-1032 and human acceptance. No preview URL is available here.</p>}
    <button type="button" disabled={!onSelect || busy} onClick={choose}>{busy ? 'Opening…' : 'Use this illustrative draft'}</button>
    <p role="status">{message}</p>
  </section>;
}
