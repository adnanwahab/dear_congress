import { useEffect, useState } from 'react';
import type { OutcomesFile } from '../server/outcomes';
import { healthReport, sourceHealth } from '../shared/source-health';

export function SourceHealth() {
  const [file, setFile] = useState<OutcomesFile | null>(null);
  const [state, setState] = useState('Loading source records…');
  const [exported, setExported] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    setState('Loading source records…');
    void fetch('/api/outcomes', { signal: controller.signal }).then(async response => {
      if (!response.ok) throw new Error();
      const body = await response.json();
      if (body.outcomes && (!Array.isArray(body.outcomes.series) || body.outcomes.series.some((row: any) => !row || typeof row.needId !== 'string' || !row.source || typeof row.source.name !== 'string' || typeof row.source.url !== 'string') || (body.outcomes.errors !== undefined && (!Array.isArray(body.outcomes.errors) || body.outcomes.errors.some((error: any) => !error || typeof error.needId !== 'string' || typeof error.at !== 'string'))))) throw new Error();
      setFile(body.outcomes ?? null);
      setState(body.outcomes ? 'Recorded snapshot loaded. Provider availability has not been checked live.' : 'No source snapshot available.');
    }).catch(() => { if (!controller.signal.aborted || !disposed) setState('Source records unavailable or offline. No replacement measurements supplied.'); })
      .finally(() => clearTimeout(timeout));
    let disposed = false;
    return () => { disposed = true; clearTimeout(timeout); controller.abort(); };
  }, [attempt]);
  return <section className="panel source-health" aria-labelledby="source-health-title" id="source-health">
    <h2 id="source-health-title">Data-source health</h2>
    <p role="status">{state}</p>
    <p>Recorded fetch dates do not verify accuracy. The repository includes starter fixtures. No verified policy effects are available. Freshness warning threshold: 30 days; provider release schedules may differ.</p>
    <button type="button" className="outline" onClick={() => setAttempt(value => value + 1)}>Retry source records</button>{' '}
    <button type="button" className="outline" onClick={() => setExported(value => !value)}>Show export / print text</button>
    {sourceHealth(file).map(source => <div className="card" key={source.needId}>
      <h3>{source.needId} · {source.status}</h3>
      <p>Impacted views: Needs conditions and measured synthesis previews. Existing values retain their original periods; missing values remain missing.</p>
      <dl><dt>Last recorded successful fetch</dt><dd>{source.latest?.fetchedAt ?? 'Not recorded'}</dd>
        <dt>Observation period</dt><dd>{source.latest?.year ?? 'Missing'}</dd>
        <dt>Source identity</dt><dd>{source.latest?.source?.name ?? 'Missing source'} · {source.latest?.source?.url ?? 'No URL'}</dd>
        <dt>Limitations</dt><dd>{source.latest?.source?.caveat ?? 'Coverage and completeness are not documented.'}</dd>
        <dt>Schema changes</dt><dd>Unknown — no schema comparison log is recorded.</dd>
        <dt>Material updates / human review</dt><dd>Not recorded — no approval or verified review is implied.</dd></dl>
      {source.errors.map((error, index) => <p key={index}>Fetch incident recorded {error.at}: provider refresh failed for {source.needId}. Retained rows may be incomplete; a data steward must inspect the ingestion log.</p>)}
    </div>)}
    <p>Primary source: the original provider record. Editorial inference: an interpretation of records. User claim: an unverified participant statement. Synthetic estimate: invented model or demonstration data. A provider URL alone does not classify a fixture as primary evidence.</p>
    {exported && <><p>Select and copy this report to save it. Browser print includes all visible incident details; no download service is required.</p><pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{healthReport(file)}</pre></>}
  </section>;
}
