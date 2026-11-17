import { expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { Window } from 'happy-dom';
import SourceRegistry, { REGISTRY_SOURCES } from './SourceRegistry';
import { DEMO_ITEMS } from '../engine/demo';

test('registry preserves every sample background identity and recorded check without inventing retrieval', () => {
  expect(new Set(REGISTRY_SOURCES.map(source => source.id)).size).toBe(REGISTRY_SOURCES.length);
  for (const item of DEMO_ITEMS) {
    const source = REGISTRY_SOURCES.find(source => source.id === `sample-background:${item.id}`)!;
    expect(source.url).toBe(item.sourceUrl);
    expect(source.publisher).toBe(item.background?.publisher ?? 'Unknown');
    expect(source.lastReview).toBe(item.background?.checkedAt ?? null);
    expect(source.retrieved).toBeNull();
  }
});

test('registry visibly discloses license gaps, synthetic fixtures and partial coverage', () => {
  const window = new Window();
  window.document.body.innerHTML = renderToStaticMarkup(<SourceRegistry />);
  const section = window.document.querySelector('section')!;
  expect(section.textContent).toContain('Coverage is incomplete');
  expect(section.textContent).toContain('Internal synthetic fixture');
  expect(section.textContent).toContain('not observations');
  expect(section.textContent).toContain('No source here has verified public reuse approval');
  const entries = Array.from(section.querySelectorAll('details')).slice(0, -1);
  expect(entries.length).toBe(REGISTRY_SOURCES.length);
  for (const entry of entries) for (const label of ['Publisher', 'Original URL', 'Retrieval date', 'Licensing note', 'Scope and uncertainty', 'Last review']) expect(entry.textContent).toContain(label);
  for (const link of Array.from(section.querySelectorAll('a'))) expect(link.getAttribute('href')).toStartWith('https://');
  window.happyDOM.abort();
});
