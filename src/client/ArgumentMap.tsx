import type { DemoItem } from '../engine/demo';
import './argument-map.css';

// Deliberately independent of the catalog: editing proposal text invalidates the map.
export const PILOT_TEXT = 'Fund a twelve-month pilot of fifteen-minute service through 10 p.m. on three priority corridors, with quarterly public reporting.';
export const PILOT_SCOPE = 'adnanwahab/dear_congress:fictional-demo:demo-transit:v1';
const points = [
  { id: 'for', title: 'Reasons for', claim: 'More frequent evening service could reduce waiting for riders whose shifts end late.', limits: 'No corridor-specific ridership, staffing or travel-time study has been supplied.', condition: 'Evidence that the proposed schedule does not improve access for evening riders.', reply: 'Frequency alone may not help if connections or reliability remain poor.' },
  { id: 'concern', title: 'Concerns', claim: 'Extra service could divert limited operating funds from other routes.', limits: 'No operating budget or comparison with alternative service plans has been supplied.', condition: 'A funded operating plan showing additional service without reducing essential routes.', reply: 'A time-limited pilot with public reporting could reveal whether the added cost is justified.' },
] as const;

/** Read-only editorial fixture. No submissions, ranking, persistence or vote authority. */
export function ArgumentMap({ item, namespace = 'fictional-demo' }: { item: DemoItem; namespace?: string }) {
  const available = namespace === 'fictional-demo' && item.id === 'demo-transit' && item.proposedText === PILOT_TEXT;
  const prefix = `argument-${item.id}`;
  return <section className="argument-map" aria-label="Compare arguments">
    <h3>Compare arguments before voting</h3>
    <p>Read-only fictional pilot · advisory only. These examples have not been reviewed as the strongest arguments. No ranking uses popularity or political preference.</p>
    {available ? <>
      <details><summary>Read the proposal clause</summary><blockquote id={`${prefix}-clause`}>{PILOT_TEXT}</blockquote><small>Clause 1 · {PILOT_SCOPE}. This map applies only to this exact sample text.</small></details>
      <div className="argument-map-sides">{points.map(point => <section key={point.id} aria-labelledby={`${prefix}-${point.id}`}>
        <h4 id={`${prefix}-${point.id}`}>{point.title}</h4>
        <ul><li><p>{point.claim}</p><p><strong>unverified assertion</strong> · Evidence strength: unassessed</p><p>No claim-level source supplied. Background agency links do not substantiate this claim.</p><p><strong>Uncertainty:</strong> {point.limits}</p><a href={`#${prefix}-clause`} onClick={e => {
          const clause = e.currentTarget.ownerDocument.getElementById(`${prefix}-clause`);
          if (clause?.parentElement?.tagName === 'DETAILS') (clause.parentElement as HTMLDetailsElement).open = true;
        }}>Proposal clause 1</a><p><strong>What would change my mind:</strong> {point.condition}</p>
        <details><summary>Read counterargument</summary><ul><li>{point.reply}<p><strong>unverified assertion</strong> · Evidence strength: unassessed. No source or evidence assessment supplied.</p></li></ul></details>
        </li></ul>
      </section>)}</div>
      <p>Corrections and citation reports are not open in this read-only pilot. Human evidence review and argument moderation are required before public contributions.</p>
    </> : <p>No reviewed arguments yet. No argument map is available for this proposal revision.</p>}
  </section>;
}
