import type { PublicPull, Viewer } from '../shared/hbl-governance';
import { FEATURES, microscopeStatus, summarizeChanges } from './patch-microscope';

export function PatchMicroscope({ pull, repository, viewer, loading, error, stale, sourceStatus, lastSync }: {
  pull: PublicPull; repository: string; viewer?: Viewer; loading: boolean; error: boolean;
  stale: boolean; sourceStatus: string; lastSync: string | null;
}) {
  const status = microscopeStatus(pull, loading, error, stale);
  const changes = summarizeChanges(pull, repository);
  return <section className="gp-panel gp-microscope" aria-label="Code change microscope" aria-busy={loading}>
    <p className="gp-eyebrow">Read-only patch guide</p><h2>Code change microscope</h2>
    <p role="status">{({ loading: 'Loading source…', stale: 'Stale cached evidence — refresh before review.', error: 'Source error — previously loaded evidence may be outdated.', unavailable: 'File evidence unavailable.', blocked: 'Blocked PR', 'checks-pending': 'Checks pending', 'review-ready': 'Ready for human review · no merge authorization', pending: 'Review evidence pending' })[status]}</p>
    <p className="gp-meta">Source: GitHub · {repository} · PR #{pull.number} · {stale ? 'Stale cache' : sourceStatus} · Last sync: {lastSync ?? 'unavailable'}</p>
    <p className="gp-meta">Revision <code>{pull.version}</code> · Head <code>{pull.headSha}</code> · Base {pull.base} <code>{pull.evidence?.baseSha ?? 'SHA unavailable'}</code></p>
    <p>Permission: {viewer?.authenticated ? viewer.approved ? 'Approved roster account' : 'Membership approval required' : 'Signed out'}. Browsing this guide never casts a vote or approves a merge.</p>
    <details><summary>How files are grouped · interpretation limits</summary><p>First match wins: test directories and test/spec filenames → Tests; workflows, scripts, infrastructure and configuration → Operations; data, migrations, schema, SQL, CSV and JSON → Data; client/components/views/styles, TSX, CSS and HTML → UI; engine/model/domain/shared → Model. Unmatched paths → Operations with low confidence. These are file roles, not verified feature effects. One file can affect several features. Contributor descriptions are not evidence.</p></details>
    {!changes.length && <p>No revision-bound summaries available. Open the official PR for complete evidence.</p>}
    {FEATURES.map(feature => {
      const files = changes.filter(c => c.feature === feature);
      return files.length ? <details key={feature} open><summary>{feature} · {files.length} {files.length === 1 ? 'file' : 'files'}</summary>{files.map(file => <article key={file.filename}>
        <h3>{file.filename}</h3><p>{file.summary} Confidence: {file.confidence}.</p><p>{file.caveat}</p>
        <details><summary>Changed-line receipts · {file.lines.length}</summary><ul>{file.lines.map((line, index) => <li key={index}><a href={line.url} target="_blank" rel="noopener noreferrer">{line.label} ↗</a></li>)}</ul></details>
      </article>)}</details> : null;
    })}
  </section>;
}
