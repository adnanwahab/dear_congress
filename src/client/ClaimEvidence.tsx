import { evidenceText, externalAnchorUrl, quoteId, type EvidenceClaim } from '../shared/claim-provenance';

/** Native links work with keyboard and touch; retained excerpts need no network. */
export function ClaimEvidence({ claims, state = 'ready' }: { claims: readonly EvidenceClaim[]; state?: 'ready' | 'loading' | 'offline' | 'error' }) {
  return <section className="claim-evidence" aria-label="Claim evidence">
    <h3>Claim evidence</h3>
    {state !== 'ready' && <p role="status">{state === 'loading' ? 'Loading source metadata; retained quotes remain available.' : `${state === 'offline' ? 'Offline' : 'Source unavailable'}; retained quotes remain available. External links may not work.`}</p>}
    {claims.map(claim => <div className="claim-evidence-card" key={`${claim.id}/${claim.revision}`}>
      <h4>{claim.text}</h4>
      <p>{claim.kind} · {claim.status} · dated {claim.date} · revision {claim.revision}</p>
      <p>{claim.limitations}</p>
      {!claim.anchors.length && <p>Missing source and quote anchor. This claim is unsupported.</p>}
      <ul>{claim.anchors.map((anchor, index) => <li key={quoteId(claim, anchor, index)}><a href={`#${quoteId(claim, anchor, index)}`}>Read supporting passage {index + 1}: {anchor.section}</a></li>)}</ul>
      {claim.anchors.map((anchor, index) => <section key={quoteId(claim, anchor, index)} id={quoteId(claim, anchor, index)} tabIndex={-1} aria-label={`Source passage ${index + 1}`}>
        <p>{anchor.sourceId} · version {anchor.version} · {anchor.section}{anchor.page ? ` · page ${anchor.page}` : ''}{anchor.line ? ` · line ${anchor.line}` : ''}</p>
        {anchor.retention === 'permitted' && anchor.excerpt ? <blockquote><mark>{anchor.excerpt}</mark></blockquote> : <p>Quote unavailable. Use the section locator in the external document.</p>}
        {anchor.redirectedFrom && <p>Redirect reported from {anchor.redirectedFrom}; destination not verified.</p>}
        {externalAnchorUrl(anchor) ? <a href={externalAnchorUrl(anchor)!} target="_blank" rel="noopener noreferrer">Open external source: {anchor.sourceId} (new tab)</a> : <p>No external link; retained source metadata shown above.</p>}
      </section>)}
      <details open><summary>Provenance and human review</summary><ul>{claim.review.map((r, i) => <li key={i}>{r.revision} · {r.date} · {r.provenance} · Human review: {r.humanReview}</li>)}</ul></details>
    </div>)}
    <details><summary>Plain text export fallback</summary><pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{evidenceText(claims)}</pre></details>
  </section>;
}
