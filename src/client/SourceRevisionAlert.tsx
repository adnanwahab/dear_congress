import { useEffect, useState } from 'react';
import type { Measurement } from '../shared/policy-measurements';
import { revisionDiff, snapshotHash, type SourceRevision } from '../shared/source-revisions';

/** Local demonstration only: never writes to measurements, ballots or review authority. */
export function SourceRevisionAlert({ sourceId, measurement }: { sourceId: string; measurement: Measurement }) {
  const [changed, setChanged] = useState(false);
  const [snapshots, setSnapshots] = useState<SourceRevision[] | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    let active = true;
    setSnapshots(null);
    setError(false);
    const correction = { ...measurement, revision: measurement.revision + '-correction', value: measurement.value + 1, sourceVersion: measurement.sourceVersion + '/correction' };
    Promise.all([measurement, correction].map(async (row, i): Promise<SourceRevision> => ({
      sourceId, revision: row.revision, detectedAt: i ? '2026-11-14' : '2026-11-13', providerChangedAt: null,
      kind: 'synthetic estimate', limitations: 'Invented correction for testing; no provider was contacted. Provider change time unknown.',
      measurement: row, hash: await snapshotHash(row),
    }))).then(rows => { if (active) setSnapshots(rows); }).catch(() => { if (active) setError(true); });
    return () => { active = false; };
  }, [sourceId, measurement]);
  const before = snapshots?.[0];
  const after = snapshots?.[1];
  return <section className="source-revision-alert" aria-label="Source revision demonstration">
    <h4>Source revision alert · synthetic demonstration</h4>
    <p>Primary source: original publisher record. Editorial inference: an interpretation. User claim: a participant assertion. Synthetic estimate: invented or modeled data. This example is a synthetic estimate.</p>
    <button type="button" onClick={() => setChanged(value => !value)} disabled={!snapshots}>{changed ? 'Return to published snapshot' : 'Simulate dataset correction'}</button>
    <p role="status">{error ? 'Hash unavailable. Original measurement remains visible; retry by reloading. No review recorded.' : !snapshots ? 'Preparing local snapshot hashes…' : changed ? 'Material update detected 2026-11-14 · Reviewer acknowledgment required' : 'Published snapshot retained · No source monitoring is running'}</p>
    {before && <p>Published claim pinned to {before.revision} · {before.measurement.value} {before.measurement.unit} · {before.measurement.period}</p>}
    {changed && before && after && <>
      <p>{after.limitations} Source identity: {after.sourceId}. No authenticated reviewer acknowledgment has been recorded.</p>
      <dl>{revisionDiff(before, after).map(diff => <div key={diff.field}><dt>{diff.field}</dt><dd>Before: {diff.before} → After: {diff.after}</dd></div>)}</dl>
    </>}
    {snapshots && <pre className="source-revision-print">{JSON.stringify({ snapshots, reviewLog: [], publishedRevision: before?.revision }, null, 2)}</pre>}
    {snapshots && <details><summary>Retained snapshots and export text</summary>
      <p>Available offline after this page loads. Copy this record if downloading or printing is unavailable. Hashes cover the listed measurement fields, not a public dataset.</p>
      <pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{JSON.stringify({ snapshots: changed ? snapshots : [before], reviewLog: [], publishedRevision: before?.revision }, null, 2)}</pre>
    </details>}
  </section>;
}
