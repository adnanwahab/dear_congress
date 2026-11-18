import type { CSSProperties } from 'react';
import type { CatalogBill } from '../shared/bill-catalog';
import index from '../generated/bill-visualizations.json';

export type LawSceneDefinition = (typeof index.visualizations)[number];

const byBill = new Map(index.visualizations.map(scene => [scene.billId, scene] as const));
export function getLawScene(billId: string): LawSceneDefinition | undefined {
  return byBill.get(billId);
}

const motifSymbols: Record<string, string> = {
  security: '◇', home: '⌂', health: '✚', learning: '✧', work: '◷',
  community: '◎', justice: '⚖', democracy: '✳', technology: '⌘', nature: '✿',
};
const stageNumbers = ['01', '02', '03'];

export function LawVisualization({ bill, scene }: { bill: CatalogBill; scene: LawSceneDefinition }) {
  const metrics = bill.metrics.split(';').map(text => text.trim()).filter(Boolean);
  const dimensions = bill.dimensions.split(';').map(text => text.trim()).filter(Boolean);
  const revisionMismatch = bill.revision !== scene.sourceRevision;
  const style = { '--scene-accent': scene.accent } as CSSProperties;

  return <div role="group" className={`law-scene law-scene--${scene.layout}`} style={style}
    aria-label={`Visualization of draft concept ${bill.id}: ${bill.title}`}>
    <div className="law-scene__heading">
      <div className="law-scene__motif" aria-hidden="true">{motifSymbols[scene.motif] ?? '✦'}</div>
      <div>
        <p className="law-scene__eyebrow">POLICY DESIGN SKETCH · {bill.id}</p>
        <h3>{bill.title}</h3>
        <p className="law-scene__category">{bill.category}</p>
      </div>
    </div>
    {revisionMismatch && <p className="law-scene__stale" role="alert">
      This visualization references an older catalog revision. Reconcile the scene with the current bill before relying on it.
    </p>}
    <div className="law-scene__flow" aria-label="From the stated problem, through the proposal, to suggested measures">
      <section className="law-scene__stage law-scene__stage--problem" aria-label="Problem">
        <div className="law-scene__stage-head"><span>{stageNumbers[0]}</span><strong>THE CHALLENGE</strong></div>
        <p>{bill.problem}</p>
      </section>
      <span className="law-scene__arrow law-scene__arrow--first" aria-hidden="true">→</span>
      <section className="law-scene__stage law-scene__stage--change" aria-label="Proposed policy response">
        <div className="law-scene__stage-head"><span>{stageNumbers[1]}</span><strong>THE PROPOSAL</strong></div>
        <p>{bill.proposedChange}</p>
      </section>
      <span className="law-scene__arrow law-scene__arrow--second" aria-hidden="true">→</span>
      <section className="law-scene__stage law-scene__stage--metrics" aria-label="Suggested success measurements">
        <div className="law-scene__stage-head"><span>{stageNumbers[2]}</span><strong>WHAT TO MEASURE</strong></div>
        <ul>{metrics.map(metric => <li key={metric}>{metric}</li>)}</ul>
      </section>
    </div>
    <div className="law-scene__footer">
      <div className="law-scene__safeguard"><span aria-hidden="true">✳</span><div>
        <strong>Safeguard to review</strong>
        <p>{bill.safeguards}</p>
      </div></div>
      <div className="law-scene__dimensions" aria-label="Catalog flourishing tags">
        {dimensions.map(d => <span key={d} className={d === scene.focusDimension ? 'law-scene__dimension--focus' : ''}>{d}</span>)}
      </div>
    </div>
    <p className="law-scene__disclaimer">Illustrative design, not an enacted law, forecast, evaluated outcome, verified causal claim or funding commitment.</p>
  </div>;
}
