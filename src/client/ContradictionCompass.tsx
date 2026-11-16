import { useState } from 'react';
import { claimUrl, compareClaims, compassExport, COMPASS_CASES, type ClaimProvenance } from '../shared/claim-provenance';

export function ConflictCard({ title, claims }: { title: string; claims: readonly ClaimProvenance[] }) {
  const result = compareClaims(claims);
  const [exportError, setExportError] = useState(false);
  function download() {
    try {
      const url = URL.createObjectURL(new Blob([compassExport(claims)], { type: 'application/json' }));
      const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'claim-comparison.json'; anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch { setExportError(true); }
  }
  return <article className="card compass-case">
    <h3>{title}</h3><p><strong>{result.status}</strong>{result.conflicts.length > 0 && ` · Differing fields: ${result.conflicts.join(', ')}`}</p>
    <div className="compass-sources">{claims.map(claim => <section key={claim.revision} aria-label={claim.title}>
      <h4>{claim.title}</h4><p>{claim.kind} · {claim.publisher}</p>
      <p>{claimUrl(claim) ? <a href={claimUrl(claim)!} target="_blank" rel="noopener noreferrer">Original document: {claim.title}</a> : 'Source unavailable — no external document supplied'}</p>
      <dl><dt>Scope</dt><dd>{claim.scope}</dd><dt>Period</dt><dd>{claim.period}</dd><dt>Recorded</dt><dd>{claim.recordedAt} · retrieval not verified</dd><dt>Review</dt><dd>{claim.review} · {claim.revision}</dd>
        {Object.entries(claim.fields).map(([field, value]) => <div key={field}><dt>{field}</dt><dd>{value}</dd></div>)}</dl>
      <p>Limitations: {claim.limitations}</p>
      <details className="compass-history"><summary>Revision and human-review history</summary><ul>{claim.history.map(row => <li key={row.revision}>{row.revision} · {row.at} · {row.actor} · {row.reason} · {row.review}</li>)}</ul></details>
    </section>)}</div>
    <button className="outline compass-download" onClick={download}>Export comparison JSON</button>
    {exportError && <p role="alert">Download unavailable. Copy the comparison below or print this page.</p>}
    <details className="compass-export"><summary>Copyable export / print fallback</summary><pre>{compassExport(claims)}</pre></details>
  </article>;
}
export function ContradictionCompass() {
  return <section className="panel" aria-labelledby="compass-title"><h2 id="compass-title">Contradiction compass</h2>
    <p>Compare explicit dates, definitions, status and reported values within matching scope, period and claim kind. Differences request human review; no source is automatically selected as true. Absence of a detected difference is not verification.</p>
    <p>Primary source: original publisher document. Editorial inference: an interpretation. User claim: a contributor assertion. Synthetic estimate: invented or modeled data. These categories never establish truth by themselves.</p>
    <p>Bundled examples load with the page and remain readable offline after loading. External links require connectivity; unavailable documents stay unverified. No live document fetch or automated extraction occurs.</p>
    {COMPASS_CASES.map(example => <ConflictCard key={example.id} title={example.title} claims={example.claims} />)}
  </section>;
}
