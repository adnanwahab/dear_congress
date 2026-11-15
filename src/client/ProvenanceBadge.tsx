import { provenanceLines, validProvenance, type NumericClaim, type Provenance } from '../shared/provenance';

/** Static text and native links work with keyboard, touch and reduced motion. */
export function ProvenanceBadge({ provenance }: { provenance: Provenance }) {
  if (!validProvenance(provenance)) return <p role="alert">Claim unavailable: missing or invalid provenance.</p>;
  const [origin, ...lines] = provenanceLines(provenance);
  return <section className="claim-provenance" aria-label="Claim provenance" data-origin={provenance.origin}>
    <strong>{origin}</strong>
    {lines.slice(0, -1).map(line => <div key={line}>{line}</div>)}
    <div>{provenance.link ? <a href={provenance.link} target="_blank" rel="noopener noreferrer">Source / context link</a> : 'Link: Unavailable'}</div>
  </section>;
}
export function PublicNumericClaim({ claim }: { claim: NumericClaim }) {
  if (!claim || !Number.isFinite(claim.value) || !claim.label?.trim() || !validProvenance(claim.provenance)) return <p role="alert">Claim unavailable: missing or invalid provenance.</p>;
  return <div><p>{claim.label}: {claim.value.toLocaleString()}</p><ProvenanceBadge provenance={claim.provenance} /></div>;
}
