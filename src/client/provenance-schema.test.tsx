import { expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { ORIGIN_LABELS, provenanceLines, validProvenance, type NumericClaim, type Provenance } from '../shared/provenance';
import { PublicNumericClaim, ProvenanceBadge } from './ProvenanceBadge';
import { DEMO_ITEMS } from '../engine/demo';
import { provenanceText, scenarioProvenance } from './ProposalProvenance';
const metadata: Provenance = { origin: 'observed-measurement', date: '2026-11-14', jurisdiction: 'Houston', confidence: 'Limited sample', limitations: 'Not representative', link: 'https://example.org/measurement' };
// Typecheck must reject provenance-free numeric claims.
// @ts-expect-error public numeric claims require provenance
const missing: NumericClaim = { value: 42, label: 'Residents' };

test('all five origins share the same UI and export fields', () => {
  for (const origin of Object.keys(ORIGIN_LABELS) as Provenance['origin'][]) {
    const p = { ...metadata, origin };
    const html = renderToStaticMarkup(<ProvenanceBadge provenance={p} />);
    for (const line of provenanceLines(p).slice(0, -1)) expect(html).toContain(line);
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).toContain(p.link!);
  }
});
test('invalid metadata suppresses the numeric value rather than implying credibility', () => {
  for (const provenance of [undefined, {}, { ...metadata, origin: 'trusted' }, { ...metadata, date: '2026-02-31' }, { ...metadata, limitations: '' }, { ...metadata, link: 'javascript:alert(1)' }]) {
    expect(validProvenance(provenance)).toBe(false);
    const html = renderToStaticMarkup(<PublicNumericClaim claim={{ value: 987654, label: 'Residents', provenance } as NumericClaim} />);
    expect(html).toContain('role="alert"');
    expect(html).not.toContain('987');
  }
  expect(renderToStaticMarkup(<PublicNumericClaim claim={missing} />)).toContain('Claim unavailable');
});
test('demo cards and draft exports retain unknown date and fiction classification', () => {
  for (const item of DEMO_ITEMS) {
    const p = scenarioProvenance(item);
    expect(p.origin).toBe('demo-fiction');
    expect(p.date).toBeNull();
    for (const line of provenanceLines(p)) expect(provenanceText(item)).toContain(line);
  }
});
