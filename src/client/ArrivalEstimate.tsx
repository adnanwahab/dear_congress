import { ARRIVAL_MODEL, ARRIVAL_NOTE, formatArrival, ordinal, type ArrivalEstimate } from '../shared/bill-eta';

const date = (iso: string) => <time dateTime={iso}>{formatArrival(iso)}</time>;

/** One-line estimate for catalog cards and the /votes detail. */
export function ArrivalLine({ estimate, className = 'bill-eta' }: { estimate?: ArrivalEstimate; className?: string }) {
  if (!estimate) return <p className={className}>Estimated arrival: unavailable</p>;
  return <p className={className}>Estimated arrival: {date(estimate.expected)} <span>· range {formatArrival(estimate.earliest)} – {formatArrival(estimate.latest)}</span></p>;
}

/** Assumptions, rendered from the same model the estimates use. */
export function ArrivalAssumptions({ id }: { id?: string }) {
  const { cadenceDays, stages, id: model } = ARRIVAL_MODEL;
  return <details id={id} className="bill-arrival-assumptions">
    <summary>How arrival estimates work</summary>
    <p>Arrival means a draft has finished human review and a one-week advisory ballot on that exact revision has closed. Estimates start from the next Monday.</p>
    <ul>
      <li>Reviewers start the next draft in every category each week (range: every {cadenceDays.earliest} to {cadenceDays.latest} days), in ID order.</li>
      {stages.map(stage => <li key={stage.key}>{stage.label}: about {stage.days.expected} days (range {stage.days.earliest}–{stage.days.latest}).</li>)}
      <li>Stages already complete in the review ledger are skipped. A missing or stale review record counts every stage as outstanding.</li>
      <li>Estimates do not read ballot records. Once a publisher opens a ballot, its own closing time is the real date.</li>
    </ul>
    <p>{ARRIVAL_NOTE} Model {model}; dates are UTC.</p>
  </details>;
}

/** Detail panel: expected date, range, queue place, stage dates and assumptions. */
export function ArrivalPanel({ estimate, headingLevel = 2 }: { estimate?: ArrivalEstimate; headingLevel?: 2 | 3 }) {
  if (!estimate) return null;
  const Heading = headingLevel === 3 ? 'h3' : 'h2';
  const queue = estimate.queuePosition == null
    ? 'Review is complete in the ledger; only the advisory ballot remains.'
    : `${ordinal(estimate.queuePosition + 1)} of ${estimate.queueSize} drafts waiting in ${estimate.category}; review would start around ${formatArrival(estimate.startsOn)}.`;
  return <section className="bill-notice bill-arrival" aria-label="Estimated arrival">
    <Heading>Estimated arrival</Heading>
    <p className="bill-arrival-date">{date(estimate.expected)}</p>
    <p>Range {formatArrival(estimate.earliest)} to {formatArrival(estimate.latest)}. {queue}</p>
    <ol className="bill-arrival-stages">{estimate.stages.map(stage => <li key={stage.key} data-done={stage.done ? 'true' : 'false'}>
      {stage.label}: {stage.done || !stage.expected ? 'complete' : <>expected by {date(stage.expected)}</>}
    </li>)}</ol>
    <p>{ARRIVAL_NOTE}</p>
    <ArrivalAssumptions />
  </section>;
}
