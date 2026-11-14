import { CIVIC_STAGES } from '../shared/civic-stages';
import { PROVENANCE_AS_OF, PROVENANCE_LIMIT, exportMethodology, provenanceClaims } from './provenance';

export default function ProvenanceExplorer() {
  const claims = provenanceClaims();
  const methodology = exportMethodology(claims, PROVENANCE_AS_OF);
  return <section id="provenance-explorer" aria-labelledby="provenance-title" className="provenance-explorer">
    <h3 id="provenance-title">Peel back the evidence layers</h3>
    <p>{PROVENANCE_LIMIT}</p>
    <p>Follow claim → source document → extracted measurement → transformation → UI. Open each layer with Enter or Space; Tab reaches source links in reading order. This local example needs no network request. Source links may change on main; fixture versions below identify this example, not an immutable archive.</p>
    <nav aria-label="Provenance journey">{CIVIC_STAGES.map(stage => <a key={stage.n} href={stage.route}>{stage.n} · {stage.title}</a>)}</nav>
    <p>Input labels: <strong>Synthetic</strong> = invented; <strong>Stale</strong> = past expected update; <strong>Missing</strong> = no current measurement; <strong>Disputed</strong> = recorded disagreement. No dispute records are available in these examples; this does not mean verified or uncontested.</p>
    <a download="civic-synthesis-methodology.md" href={`data:text/markdown;charset=utf-8,${encodeURIComponent(methodology)}`}>Export human-readable methodology ↓</a>
    {claims.map(claim => <article key={claim.id} aria-labelledby={`claim-${claim.id}`}>
      <h4 id={`claim-${claim.id}`}>{claim.title}</h4>
      <p aria-label="Input status">{claim.flags.map(flag => <strong className="provenance-flag" data-status={flag.toLowerCase()} key={flag}>{flag}</strong>)}</p>
      <ol>{claim.layers.map(layer => <li key={layer.kind}><details><summary>{layer.kind}</summary><p>{layer.text}</p>{layer.href && <a href={layer.href}>Inspect {layer.kind.toLowerCase()} — {claim.title}</a>}</details></li>)}</ol>
    </article>)}
    <p>Unavailable source? Keep the missing evidence visible; do not substitute a new source or treat a failed link as confirmation. Publishing a journal is a separate consent step in <a href="/journal">Journal</a>; inspect the <a href="/privacy">privacy and removal boundaries</a> before sharing.</p>
  </section>;
}
