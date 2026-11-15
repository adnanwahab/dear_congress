import { useState } from 'react';
import type { BillObservation } from '../shared/legislation';
import { metadataFreshness } from '../shared/legislation';
import { PolicyMeasurements } from './PolicyMeasurements';
import { ParticipationNotice } from './ParticipationNotice';
import './mission-control.css';

/** Read-only projection. Official identity is never joined to a sample proposal. */
export function MissionControl({ bills, now = Date.now() }: { bills: BillObservation[]; now?: number }) {
  const [selected, setSelected] = useState('');
  const bill = bills.find(b => b.id === selected) ?? (!selected ? bills[0] : undefined);
  return <section className="mission-control" aria-labelledby="mission-title" id="mission-control">
    <header className="mission-heading"><p className="workflow-eyebrow">Civic delivery observatory · read-only prototype</p>
      <h2 id="mission-title">Civic Mission Control</h2>
      <p>Follow the evidence from discussion to delivery. Start with an official record, open its citation, then inspect what remains unknown.</p>
      <p><strong>Independent civic prototype. No governmental authorization.</strong> No vote, outreach or model run occurs here.</p>
      <a href="#mission-evidence">Inspect institutional evidence ↓</a>{' · '}<a href="#policy-measurements">Inspect measurement limits ↓</a>
    </header>
    <div className="mission-wall">
      <section className="panel mission-evidence" id="mission-evidence"><h3>Institutional evidence</h3>
        <p>Official metadata is separate from the fictional proposal selected elsewhere on this page. No relationship is inferred.</p>
        {!bills.length ? <p><strong>Unknown.</strong> No official metadata available. This is not a complete catalog.</p> : <label>Official record<select value={bill?.id ?? selected} onChange={e => setSelected(e.target.value)}>
          {!bill && <option value={selected}>Previously selected record unavailable</option>}
          {bills.map(b => <option key={b.id} value={b.id}>{b.type.toUpperCase()} {b.number} · Congress {b.congress}: {b.title}</option>)}
        </select></label>}
        {bill && <><h4>{bill.title}</h4><p>US · {bill.chamber} · {bill.id}</p>
          <ol className="mission-timeline"><li>Introduced, as reported: {bill.introducedDate}</li><li>Latest reported action ({bill.latestAction.actionDate}): {bill.latestAction.text}</li></ol>
          <p><strong>Current legal status: Unknown.</strong> This partial timeline does not verify enactment, implementation or effective dates.</p>
          <p>Sponsors listed in metadata: {bill.sponsors.join('; ') || 'Unknown'}. Listing is not a reply or endorsement of this service.</p>
          <details><summary>Open primary source and metadata receipt</summary>
            <a href={bill.sourceUrl} target="_blank" rel="noopener noreferrer">Open Congress.gov record</a>
            <dl><dt>Origin / method</dt><dd>Congress.gov detail metadata, read from the existing identity-bound importer archive. Full text and complete action history not checked.</dd>
              <dt>Retrieved</dt><dd>{bill.checkedAt}</dd><dt>Upstream updated</dt><dd>{bill.upstreamUpdatedAt ?? 'Unknown'}</dd>
              <dt>Freshness</dt><dd>{metadataFreshness(bill, now)}</dd><dt>Snapshot SHA-256</dt><dd>{bill.sourceHash}</dd>
              <dt>Uncertainty</dt><dd>Coverage is incomplete. A hash checks content consistency, not source authenticity. No legal-status or causal inference is made.</dd></dl>
          </details><p>{metadataFreshness(bill, now)} · age calculated from retrieval time; stale after 24 hours.</p></>}
        {!bill && selected && <p role="status">Selected record unavailable. Choose another record explicitly.</p>}
      </section>
      <div className="mission-unknowns">{[
        ['Outstanding institutional action', 'No reviewed next-action mapping or responsible-office commitment is available.'],
        ['Public meeting deadline', 'No sourced meeting notice, timezone or deadline has been imported. Do not rely on this wall for filing deadlines.'],
        ['Sponsor reply', 'No verified correspondence is registered. Browser-local sponsor cards remain simulations.'],
      ].map(([title, reason]) => <section className="panel" key={title}><h3>{title}</h3><p className="mission-unknown">Unknown</p><p>{reason}</p><details><summary>Inspect evidence gap: {title}</summary><p>Origin, timestamp and primary-source receipt: unavailable. No status has been inferred from votes, model results or sample activity.</p></details></section>)}</div>
      <div className="mission-measurements"><PolicyMeasurements /></div>
      <section className="panel"><h3>Model evidence</h3><p>No model receipt is bound to this official record. Modeled outcomes are not measured delivery.</p><a href="/synth">Open the existing synthesis and model receipt explorer</a><p>The explorer keeps its own scenario identity, assumptions and run receipts. Opening it does not run a model.</p></section>
      <ParticipationNotice />
    </div>
  </section>;
}
