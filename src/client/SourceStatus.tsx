import './source-status.css';

export const SOURCE_STATUS = {
  sample: 'Fictional sample',
  draft: 'Unreviewed draft',
  metadata: 'Source-backed metadata',
  model: 'Modeled scenario',
} as const;
export type SourceStatusKind = keyof typeof SOURCE_STATUS;

/** Editorial display classification only; never grants voting or review authority. */
export function SourceStatus({ kind }: { kind: SourceStatusKind }) {
  return <span className="source-status" data-source-status={kind}>{SOURCE_STATUS[kind]}</span>;
}
export function SourceStatusLegend() {
  return <section className="source-status-legend" aria-label="Source status guide">
    <div>{(Object.keys(SOURCE_STATUS) as SourceStatusKind[]).map(kind => <SourceStatus key={kind} kind={kind} />)}</div>
    <p>Independent advisory beta. Source links do not imply agency endorsement. Metadata is not verified legal status; models are not forecasts.</p>
  </section>;
}
