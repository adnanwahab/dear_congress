import { useEffect, useState } from 'react';
import { billCollection, type CatalogBill } from '../shared/bill-catalog';
import type { DemoItem } from '../engine/demo';
import { ProposalProvenance } from './ProposalProvenance';
import './governance-prism.css';

export const PRISM_LENSES = ['Cost', 'Law', 'Time', 'Lived impact'] as const;
/** Read-only: a lens never supplies evidence absent from the source record. */
export function GovernancePrism({ bill, sample }: { bill?: CatalogBill; sample?: DemoItem }) {
  const read = () => {
    const params = new URLSearchParams(window.location.search);
    const value = Number(params.get('lens') ?? 0);
    return { lens: Number.isInteger(value) && value >= 0 && value < 4 ? value : 0, static: params.get('prism') === 'static' };
  };
  const [view, setView] = useState(read);
  useEffect(() => {
    const restore = () => setView(read());
    window.addEventListener('popstate', restore);
    return () => window.removeEventListener('popstate', restore);
  }, []);
  const id = bill?.id ?? sample?.id;
  function update(lens: number, staticMode = view.static) {
    const url = new URL(window.location.href);
    url.searchParams.set('lens', String(lens));
    if (staticMode) url.searchParams.set('prism', 'static'); else url.searchParams.delete('prism');
    window.history.pushState(null, '', url);
    setView({ lens, static: staticMode });
  }
  const missing = ['No reviewed fiscal estimate is available.', 'No reviewed legal authority or enacted text is bound to this proposal.', 'No reviewed implementation timeline is available.', 'No verified lived-impact evidence is bound to this proposal.'];
  const hypothetical = view.lens === 1 ? bill?.proposedChange ?? sample?.proposedText : view.lens === 3 ? bill?.problem ?? sample?.summary : undefined;
  return <section className="governance-prism" aria-label="Governance prism" data-static={view.static}>
    <h2>Governance prism</h2>
    <p>One proposal, four lenses. Rotation changes the lens, preserving your selection and filters.</p>
    {!id ? <p>No proposal selected. Choose a proposal to explore its lenses.</p> : <>
      <p>{id} · {bill ? 'Editorial draft' : 'Fictional sample'} · {bill?.title ?? sample?.title}</p>
      <div className="prism-controls" role="group" aria-label="Choose a governance lens">
        {PRISM_LENSES.map((label, index) => <button key={label} aria-pressed={view.lens === index} onClick={() => update(index)}>{label}</button>)}
      </div>
      <div className="prism-controls"><button onClick={() => update((view.lens + 3) % 4)}>Rotate previous lens</button><button onClick={() => update((view.lens + 1) % 4)}>Rotate next lens</button><button aria-pressed={view.static} onClick={() => update(view.lens, !view.static)}>Static / low-power view</button></div>
      <div className="prism-panel" role="region" aria-label={`${PRISM_LENSES[view.lens]} lens`} aria-live="polite" aria-atomic="true">
        <div className="prism-shape" aria-hidden="true" style={{ transform: `rotateY(${view.static ? 0 : -view.lens * 90}deg)` }}>{PRISM_LENSES.map((label, index) => <span key={label} style={{ transform: `rotateY(${index * 90}deg) translateZ(48px)` }}>{label}</span>)}</div>
        <h3>{PRISM_LENSES[view.lens]}</h3><p><strong>Missing data.</strong> {missing[view.lens]}</p>
        {hypothetical && <p><strong>Hypothetical draft context, not evidence:</strong> {hypothetical}</p>}
        {bill && <p>Source: <a href={`/bills/${bill.id}`}>{bill.id} · {billCollection.metadata.collection_id} · version {billCollection.metadata.version} · editorial draft</a><br />Revision: {bill.revision}<br />Evidence not assessed; catalog date {billCollection.metadata.date} is not an evidence check date.</p>}
      </div>
      {sample && <ProposalProvenance item={sample} compact />}
    </>}
  </section>;
}
