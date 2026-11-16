import { expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { ClaimEvidence } from './ClaimEvidence';
import { EVIDENCE_EXAMPLES, evidenceText, externalAnchorUrl, quoteId } from '../shared/claim-provenance';
import { readFileSync } from 'node:fs';

test('sources resolve to retained passages; all evidence classes, dates and limitations survive export', () => {
  const html = renderToStaticMarkup(<ClaimEvidence claims={EVIDENCE_EXAMPLES} />);
  const text = evidenceText(EVIDENCE_EXAMPLES);
  for (const c of EVIDENCE_EXAMPLES) {
    expect(html).toContain(c.kind);
    expect(text).toContain(c.date);
    expect(text).toContain(c.limitations);
    expect(text).toContain('Human review: Pending');
    c.anchors.forEach((a, i) => {
      const id = quoteId(c, a, i);
      expect(html).toContain(`href="#${id}"`);
      expect(html).toContain(`id="${id}" tabindex="-1"`);
      expect(text).toContain(a.version);
    });
  }
  expect(html).toContain('Missing source and quote anchor');
  expect(html).toContain('Conflicting');
  expect(readFileSync('src/shared/policy-measurements.ts', 'utf8')).toContain(EVIDENCE_EXAMPLES[0]!.anchors[0]!.excerpt!);
});

test('external-only sources never retain excerpts; redirects, unsafe links and unavailable anchors stay visible', () => {
  const anchor = { sourceId: 'external', version: 'v2', section: 'Findings', page: 3, line: 12, retention: 'external-only' as const, excerpt: 'DO NOT RETAIN', url: 'https://example.org/report.pdf#page=3', redirectedFrom: 'https://example.org/old' };
  const claims = [{ ...EVIDENCE_EXAMPLES[0]!, anchors: [anchor] }];
  const html = renderToStaticMarkup(<ClaimEvidence claims={claims} />);
  expect(html).not.toContain('DO NOT RETAIN');
  expect(evidenceText(claims)).not.toContain('DO NOT RETAIN');
  expect(html).toContain('Redirect reported');
  expect(html).toContain('page 3 · line 12');
  expect(html).toContain('rel="noopener noreferrer"');
  expect(html).toContain('Quote unavailable');
  for (const url of ['javascript:alert(1)', 'https://user:secret@example.org', 'http://example.org', 'invalid']) expect(externalAnchorUrl({ ...anchor, url })).toBeNull();
});

test('loading, offline and error preserve passages; print rules expose closed disclosures', () => {
  for (const state of ['loading', 'offline', 'error'] as const) {
    const html = renderToStaticMarkup(<ClaimEvidence claims={EVIDENCE_EXAMPLES} state={state} />);
    expect(html).toContain('role="status"');
    expect(html).toContain('Causal attribution not established');
    expect(html).toContain('Plain text export fallback');
  }
  const css = readFileSync('src/client/styles.css', 'utf8');
  expect(css).toContain('.claim-evidence section:target');
  expect(css).toContain('.claim-evidence a:focus-visible');
  expect(css).toContain('.policy-measurements details > :not(summary)');
});
