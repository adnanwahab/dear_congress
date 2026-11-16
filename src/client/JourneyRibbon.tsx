import { useId, useState } from 'react';
import type { DemoItem, DemoPayload } from '../engine/demo';
import { STAGES, type Stage } from '../shared/civic-stages';

const ORDER: Stage[] = ['published', 'feed', 'votes', 'draft', 'sponsors', 'outcomes'];
interface Card { id: string; office: string; stage: number; updatedAt: string }
const LANES = ['Drafted', 'Ready to send', 'Replied', 'Introduced or offered', 'Stalled'];

/** Read-only projections: no request, storage writer or participation callback. */
export function JourneyRibbon({ stage, item, data, loading, failed, cards, route }: {
  stage: Stage; item?: DemoItem; data: DemoPayload | null; loading: boolean; failed: boolean;
  cards: Card[]; route: (stage: Stage, id?: string) => string;
}) {
  const [preview, setPreview] = useState(stage);
  const id = useId();
  const meta = STAGES[preview];
  const card = cards.find(card => card.id === item?.id);
  const counts = item && data?.browserCounts?.[item.id];
  return <section className="panel journey-ribbon" aria-label="Preview the six-stage journey">
    <div className="panel-head"><h2>Explore the journey</h2><span>Preview only</span></div>
    <p id={`${id}-help`}>Drag, use arrow keys, or tap a stage. Only Open navigates. Previewing never publishes, votes or sponsors.</p>
    <label className="sr" htmlFor={`${id}-range`}>Journey stage preview</label>
    <input id={`${id}-range`} type="range" min={1} max={6} step={1} value={meta.n}
      aria-valuetext={`${meta.n} of 6: ${meta.title}`} aria-describedby={`${id}-help`}
      onInput={event => setPreview(ORDER[Number(event.currentTarget.value) - 1]!)} />
    <ol className="journey-steps">{ORDER.map((key, index) => <li key={key}>
      <button type="button" aria-pressed={preview === key} aria-controls={`${id}-artifact`} onClick={() => setPreview(key)}>
        <span aria-hidden="true">{index + 1} · </span>{STAGES[key].title}
      </button>
    </li>)}</ol>
    <div id={`${id}-artifact`} className="journey-artifact" aria-live="polite" aria-atomic="true" aria-busy={loading}>
      <p className="workflow-eyebrow">Preview · Stage {meta.n} of 6</p><h3>{meta.title}</h3><p>{meta.description}</p>
      {loading ? <p>Loading journey artifact…</p> : failed ? <p>Journey artifact unavailable. Retry loading proposals below.</p> : !item ? <p>No sample proposal available for this selection. Change your filters or choose a proposal below.</p> : <>
        <h4>{item.title}</h4><p>Fictional sample · {item.jurisdiction}</p>
        {preview === 'published' && <><strong>{item.background?.publisher ?? item.source}</strong><p>{item.background?.scope ?? 'Background reference only.'} This scenario is not enacted law.</p><p>{item.sourceUrl}</p></>}
        {preview === 'feed' && <p>{item.summary}</p>}
        {preview === 'votes' && <><p>Unverified browser votes — advisory: {counts ? `Support ${counts.support} · Oppose ${counts.oppose} · Not sure ${counts.unsure}` : 'Unavailable'}</p><p>Synthetic demo data — illustrative: Support {item.support} · Oppose {item.oppose} · Not sure {item.unsure}. Not verified residents.</p></>}
        {preview === 'draft' && <><p><strong>Illustrative current approach:</strong> {item.currentText}</p><p><strong>Proposed sample clause:</strong> {item.proposedText}</p></>}
        {preview === 'sponsors' && <><p>Possible offices, not confirmed sponsors: {item.sponsors.join(' · ') || 'None listed'}</p><p>{card ? `Browser-local simulated card: ${card.office} · ${LANES[card.stage]}` : 'No browser-local sponsor card for this proposal.'} Nothing sent.</p></>}
        {preview === 'outcomes' && <p>{card && card.stage >= 2 ? `Simulated outreach: ${LANES[card.stage]} · ${card.updatedAt}` : 'No simulated outcome recorded for this proposal.'} No verified policy implementation is established.</p>}
      </>}
    </div>
    <a className="workflow-next" href={route(preview, item?.id)}>Open {meta.title} →</a>
  </section>;
}
