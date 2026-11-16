import { type CSSProperties } from 'react';

export type CivicMilestone = {
  id: string;
  label: string;
  timestamp?: string;
  evidence: 'recorded' | 'unknown' | 'fictional';
  href?: string;
};
/** Undated steps have no position on the time axis. Never infer dates from stage order. */
export function orderMilestones(points: CivicMilestone[]) {
  return points.map(point => ({ ...point, timestamp: point.timestamp && Number.isFinite(Date.parse(point.timestamp)) ? point.timestamp : undefined }))
    .sort((a, b) => {
      const datedA = a.evidence === 'recorded' && a.timestamp;
      const datedB = b.evidence === 'recorded' && b.timestamp;
      return datedA && datedB ? Date.parse(datedA) - Date.parse(datedB) : datedA ? -1 : datedB ? 1 : 0;
    });
}
export function CivicTimeline({ points }: { points: CivicMilestone[] }) {
  const ordered = orderMilestones(points);
  const dated = ordered.filter(p => p.evidence === 'recorded' && p.timestamp);
  const start = dated.length ? Date.parse(dated[0]!.timestamp!) : 0;
  const end = dated.length ? Date.parse(dated.at(-1)!.timestamp!) : 0;
  return <section className="civic-timeline" aria-label="Civic milestone timeline">
    <h2>Civic milestone timeline</h2>
    <p>Recorded events appear in time order. Unknown steps have no confirmed date. Reading or following a link sends nothing to a public office.</p>
    <ol>{ordered.map(point => {
      const recorded = point.evidence === 'recorded' && !!point.timestamp;
      const state = point.evidence === 'fictional' ? 'fictional' : recorded ? 'recorded' : 'unknown';
      const position = recorded && end > start ? (Date.parse(point.timestamp!) - start) / (end - start) : 0;
      return <li key={point.id} data-evidence={state} style={{ '--milestone-position': `${position * 100}%` } as CSSProperties}>
        <h3>{point.href ? <a href={point.href}>{point.label}</a> : point.label}</h3>
        <p>{state === 'fictional' ? 'Fictional sample · not an institutional event' : recorded ? 'Recorded in this app · not official institutional verification' : 'Unknown · no recorded evidence'}</p>
        {recorded && <time dateTime={point.timestamp}>{new Date(point.timestamp!).toISOString()}</time>}
        {recorded && <span className="milestone-time-axis" aria-hidden="true"><span /></span>}
      </li>;
    })}</ol>
  </section>;
}
