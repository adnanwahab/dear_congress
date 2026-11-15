import { AudioBriefing } from './AudioBriefing';
import type { DemoItem } from '../engine/demo';
import './argument-map.css';
import { ConsensusTerrain } from './ConsensusTerrain';

// Deliberately independent of the catalog: editing proposal text invalidates the map.
export const PILOT_TEXT = 'Fund a twelve-month pilot of fifteen-minute service through 10 p.m. on three priority corridors, with quarterly public reporting.';
export const PILOT_SCOPE = 'adnanwahab/dear_congress:fictional-demo:demo-transit:v1';
// Pin editorial and provenance fields; changing any requires a new reviewed script.
const original = JSON.stringify({ id: 'demo-transit', title: 'Run frequent buses on evenings and weekends', topic: 'Transit', jurisdiction: 'City', source: 'Transit planning', background: { name: 'METRO', publisher: 'Metropolitan Transit Authority of Harris County', scope: 'Regional transit agency background only; not a city bill', checkedAt: null }, sourceUrl: 'https://www.ridemetro.org/', summary: 'Pilot 15-minute bus service on three high-demand corridors until 10 p.m. Measure missed trips, access to jobs, and ridership before expanding.', currentText: 'Evening and weekend service follows the existing lower-frequency schedule.', proposedText: PILOT_TEXT, sponsors: ['Transit board', 'City mobility committee'] });
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
      {JSON.stringify(item, (key, value) => ['support', 'oppose', 'unsure'].includes(key) ? undefined : value) === original ? <AudioBriefing clauseId={`${prefix}-clause`} /> : <p>No briefing is available for this source revision.</p>}
      <ConsensusTerrain scope={PILOT_SCOPE} />
      <p>Corrections and citation reports are not open in this read-only pilot. Human evidence review and argument moderation are required before public contributions.</p>
    </> : <p>No reviewed arguments yet. No argument map is available for this proposal revision.</p>}
  </section>;
}
