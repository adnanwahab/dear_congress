import { expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { Window } from 'happy-dom';
import ProvenanceExplorer from './ProvenanceExplorer';
import { exportMethodology, provenanceClaims, PROVENANCE_AS_OF } from './provenance';

test('provenance preserves pinned fixture identity and blocks missing comparisons', () => {
  const claims = provenanceClaims();
  expect(claims[0]!.layers.map(layer => layer.kind)).toEqual(['Claim', 'Source document', 'Extracted measurement', 'Transformation', 'UI']);
  expect(claims[0]!.layers[1]!.text).toContain('synthetic-fixture-v1/wait-2024');
  expect(claims[0]!.flags).toEqual(['Synthetic', 'Stale']);
  expect(provenanceClaims('2026-06-30')[0]!.flags).toEqual(['Synthetic']);
  expect(claims[1]!.title).toContain('Worsened');
  expect(claims[2]!.flags).toEqual(['Synthetic', 'Missing']);
  expect(claims[2]!.layers[0]!.text).toContain('Cannot yet be measured');
  expect(claims[2]!.layers[1]!.text).toContain('Missing current source');
});

test('readable export matches visible evidence, limits and source links', () => {
  const window = new Window();
  const document = window.document;
  document.body.innerHTML = renderToStaticMarkup(<ProvenanceExplorer />);
  const exported = decodeURIComponent(document.querySelector('a[download]')!.getAttribute('href')!.split(',')[1]!);
  expect(exported).toBe(exportMethodology(provenanceClaims(), PROVENANCE_AS_OF));
  for (const claim of provenanceClaims()) for (const layer of claim.layers) {
    expect(document.body.textContent).toContain(layer.text);
    expect(exported).toContain(layer.text);
    if (layer.href) expect(exported).toContain(layer.href);
  }
  expect(document.querySelectorAll('details').length).toBe(15);
  expect(document.querySelectorAll('details[open]').length).toBe(0);
  expect(document.querySelectorAll('details a[href]').length).toBe(6);
  for (const link of document.querySelectorAll('a')) expect(link.hasAttribute('tabindex')).toBe(false);
  expect(document.body.textContent).toContain('No dispute records');
  expect(exported).toContain('No journal, vote or private input');
  window.happyDOM.abort();
});
