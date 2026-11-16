import { lazy, Suspense, useId, useRef, useState } from 'react';
import { AudioBriefing } from './AudioBriefing';
import type { DemoItem } from '../engine/demo';
import './argument-map.css';
const FactCheckGame = lazy(() => import('./FactCheckGame').then(mod => ({ default: mod.FactCheckGame })));
import { SteelmanChallenge } from './SteelmanChallenge';
import { ConsensusTerrain } from './ConsensusTerrain';
import { EvidenceConditionCards } from './PolicyComparison';
import { PILOT_TEXT, PILOT_SCOPE } from './evidence-conditions';
export { PILOT_TEXT, PILOT_SCOPE } from './evidence-conditions';

// Pin editorial and provenance fields; changing any requires a new reviewed script.
const original = JSON.stringify({ id: 'demo-transit', title: 'Run frequent buses on evenings and weekends', topic: 'Transit', jurisdiction: 'City', source: 'Transit planning', background: { name: 'METRO', publisher: 'Metropolitan Transit Authority of Harris County', scope: 'Regional transit agency background only; not a city bill', checkedAt: null }, sourceUrl: 'https://www.ridemetro.org/', summary: 'Pilot 15-minute bus service on three high-demand corridors until 10 p.m. Measure missed trips, access to jobs, and ridership before expanding.', currentText: 'Evening and weekend service follows the existing lower-frequency schedule.', proposedText: PILOT_TEXT, sponsors: ['Transit board', 'City mobility committee'] });
const points = [
  { id: 'for', title: 'Reasons for', claim: 'More frequent evening service could reduce waiting for riders whose shifts end late.', limits: 'No corridor-specific ridership, staffing or travel-time study has been supplied.', condition: 'Evidence that the proposed schedule does not improve access for evening riders.', reply: 'Frequency alone may not help if connections or reliability remain poor.' },
  { id: 'concern', title: 'Concerns', claim: 'Extra service could divert limited operating funds from other routes.', limits: 'No operating budget or comparison with alternative service plans has been supplied.', condition: 'A funded operating plan showing additional service without reducing essential routes.', reply: 'A time-limited pilot with public reporting could reveal whether the added cost is justified.' },
] as const;

type CardId = 'claim' | 'reply';
type Side = typeof points[number]['id'];
const initialOrder = (): Record<Side, CardId[]> => ({ for: ['claim', 'reply'], concern: ['claim', 'reply'] });

/** Local editorial tabletop; no persistence, submissions or vote authority. */
export function ArgumentMap({ item, namespace = 'fictional-demo', evidenceConditions = false }: { item: DemoItem; namespace?: string; evidenceConditions?: boolean }) {
  // A keyed child discards personal order and pending drag on every scope/revision change.
  return <Tabletop key={JSON.stringify([namespace, item.id, item.proposedText])} item={item} namespace={namespace} evidenceConditions={evidenceConditions} />;
}

function Tabletop({ item, namespace, evidenceConditions }: { item: DemoItem; namespace: string; evidenceConditions: boolean }) {
  const available = namespace === 'fictional-demo' && item.id === 'demo-transit' && item.proposedText === PILOT_TEXT;
  const prefix = `argument-${useId()}`;
  const [order, setOrder] = useState(initialOrder);
  const [announcement, setAnnouncement] = useState('');
  const drag = useRef<{ side: Side; id: CardId } | null>(null);
  function move(side: Side, id: CardId, target: CardId) {
    if (id === target) return;
    setOrder(previous => ({ ...previous, [side]: previous[side].map(card => card === id ? target : card === target ? id : card) }));
    setAnnouncement(`${side === 'for' ? 'Reasons for' : 'Concerns'}: ${id === 'claim' ? 'Lead claim' : 'Counterargument'} moved. Personal reading order only.`);
  }
  return <section className="argument-map" aria-label="Compare arguments">
    <h3>Compare arguments before voting</h3>
    <p>Fictional evidence tabletop · advisory only. These examples have not been reviewed as the strongest arguments. No ranking uses popularity or political preference.</p>
    {available ? <>
      <p id={`${prefix}-instructions`}>Drag cards within each track, or use Move up and Move down with touch or keyboard. Your reading order lasts only while this map is open. It never changes public rankings or votes and is not verified civic participation.</p>
      <details><summary>Read the proposal clause</summary><blockquote id={`${prefix}-clause`}>{PILOT_TEXT}</blockquote><small>Clause 1 · {PILOT_SCOPE}. This map applies only to this exact sample text.</small></details>
      <button type="button" onClick={() => { setOrder(initialOrder()); drag.current = null; setAnnouncement('Personal reading order reset.'); }}>Reset reading order</button>
      <p aria-live="polite" aria-atomic="true">{announcement}</p>
      <div className="argument-map-sides">{points.map(point => <section key={point.id} aria-labelledby={`${prefix}-${point.id}`}>
        <h4 id={`${prefix}-${point.id}`}>{point.title}</h4>
        <p>Two illustrative cards · equal space does not imply equal evidence.</p>
        <ol aria-describedby={`${prefix}-instructions`}>{order[point.id].map((id, index) => <li key={id} className="argument-card"
          onDragOver={event => { if (drag.current?.side === point.id) event.preventDefault(); }}
          onDrop={event => { event.preventDefault(); const source = drag.current; drag.current = null; if (source?.side === point.id) move(point.id, source.id, id); }}>
          <h5>{id === 'claim' ? 'Lead claim' : 'Counterargument'}</h5>
          <button type="button" className="argument-drag" draggable aria-label={`Drag ${point.title} ${id}`}
            onDragStart={event => { drag.current = { side: point.id, id }; event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', id); }}
            onDragEnd={() => { drag.current = null; }}>⠿ Drag card</button>
          <p>{id === 'claim' ? point.claim : point.reply}</p>
          <p><strong>unverified assertion</strong> · Evidence strength: unassessed</p>
          <p><strong>Claim source:</strong> Fictional editorial example · {PILOT_SCOPE} · {point.id}/{id}. No claim-level source supplied. Background agency links do not substantiate this claim.</p>
          <p><strong>Quality status:</strong> Not reviewed. No citation or evidence assessment supplied.</p>
          <a href={`#${prefix}-clause`} onClick={event => {
            const clause = event.currentTarget.ownerDocument.getElementById(`${prefix}-clause`);
            if (clause?.parentElement?.tagName === 'DETAILS') (clause.parentElement as HTMLDetailsElement).open = true;
          }}>Proposal clause 1</a>
          <details><summary>Why this matters</summary><p>This {id === 'claim' ? 'claim' : 'counterargument'} raises a question about {point.id === 'for' ? 'evening access and service reliability' : 'operating costs and service trade-offs'}. Comparing local access, reliability and budget evidence would help assess the proposal; this example does not establish the result.</p><p><strong>Uncertainty:</strong> {point.limits}</p></details>
          {id === 'claim' && <p><strong>What would change my mind:</strong> {point.condition}</p>}
          <div className="argument-card-actions">{(['up', 'down'] as const).map(direction => <button type="button" key={direction}
            aria-label={`Move ${point.title} ${id} ${direction}`} aria-disabled={direction === 'up' ? index === 0 : index === order[point.id].length - 1}
            onClick={() => { const target = order[point.id][index + (direction === 'up' ? -1 : 1)]; if (target) move(point.id, id, target); }}>Move {direction}</button>)}</div>
        </li>)}</ol>
      </section>)}</div>
      {JSON.stringify(item, (key, value) => ['support', 'oppose', 'unsure'].includes(key) ? undefined : value) === original ? <AudioBriefing clauseId={`${prefix}-clause`} /> : <p>No briefing is available for this source revision.</p>}
      <ConsensusTerrain scope={PILOT_SCOPE} />
      <SteelmanChallenge key={'steelman:' + PILOT_SCOPE + item.proposedText} item={item} />
      <Suspense fallback={null}><FactCheckGame key={`${namespace}:${item.id}:${item.proposedText}`} /></Suspense>
      <p>Corrections and citation reports are not open in this fictional pilot. Human evidence review and argument moderation are required before public contributions.</p>
      {evidenceConditions && <EvidenceConditionCards key={PILOT_SCOPE + item.proposedText} scope={PILOT_SCOPE} />}
    </> : <p>No reviewed arguments yet. No argument map is available for this proposal revision.</p>}
  </section>;
}
