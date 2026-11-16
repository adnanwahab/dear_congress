import { useState } from 'react';
import { responsibilityPaths } from '../shared/responsibility';
import './responsibility.css';

export function ResponsibilityExplorer({ loading = false, failed = false, proposal }: { loading?: boolean; failed?: boolean; proposal?: { title: string; jurisdiction: string } }) {
  const [pathId, setPathId] = useState('federal');
  const [outline, setOutline] = useState(false);
  const path = responsibilityPaths.find(p => p.id === pathId)!;
  return <section className="panel responsibility" aria-label="Government responsibility explorer" aria-busy={loading}>
    <h2>Who turns an idea into policy?</h2>
    <p><strong>Educational model · not verified authority for a proposal.</strong> Explore the offices behind each handoff. This is a simplified process, not evidence that a policy is authorized, funded or implemented.</p>
    <p role="status">{loading ? 'Loading proposal context. Institutional examples remain available.' : failed ? 'Proposal context unavailable. Retry loading proposals above; these general examples remain available.' : proposal ? `Fictional sample: ${proposal.title} · Scenario jurisdiction: ${proposal.jurisdiction}. Office assignment remains unverified.` : 'No sample selected. Explore general institutional roles below.'}</p>
    <div className="responsibility-controls"><label>Explore jurisdiction<select value={pathId} onChange={e => setPathId(e.target.value)}>{responsibilityPaths.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}</select></label><label><input type="checkbox" checked={outline} onChange={e => setOutline(e.target.checked)} /> Text-only outline</label></div>
    <p><strong>Overlap / uncertainty:</strong> {path.uncertainty}</p>
    <ol className={outline ? 'responsibility-outline' : 'responsibility-flow'} aria-label={`${path.label} responsibility flow`}>
      {path.steps.map((step, index) => <li key={`${path.id}-${step.role}`}>
        <details open={outline}><summary><strong>{index + 1}. {step.role}</strong><br />{step.office}</summary><p>{step.detail}</p></details>
        <a href={step.source} target="_blank" rel="noopener noreferrer"><span aria-hidden="true">{index < path.steps.length - 1 ? '→ ' : ''}</span>{step.role} authority source: {step.publisher} (opens new tab)</a>
      </li>)}
    </ol>
    <p>Sources describe real institutions; connections to fictional proposals are unverified. Follow each source to check scope and current rules. No vote is cast, no draft is submitted, and no office is contacted by using this explorer.</p>
  </section>;
}
