import { expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { NeedsGeoMap } from './App';
import { PUBLIC_GUIDE } from './public-guide';
import { needEvidence, type GeoCell } from './need-geography';

const cells: GeoCell[] = [{ lat: 29.75, lng: -95.37,
  real: { count: 8, perNeed: [{ needId: 'housing', count: 3, demand: .5 }, { needId: 'transit', count: 5, demand: .8 }] },
  simulated: { count: 12, perNeed: [{ needId: 'housing', count: 12, demand: 1 }] },
}];
test('selected need includes non-dominant evidence and never combines sources', () => {
  expect(needEvidence(cells, 'both', 'housing').map(row => [row.label, row.count])).toEqual([
    ['Submitted accounts', 3], ['Simulated estimates', 12],
  ]);
  expect(needEvidence(cells, 'real', 'housing')).toHaveLength(1);
  expect(needEvidence(cells, 'simulated', 'housing')[0]!.count).toBe(12);
  expect(needEvidence(cells, 'both', 'unknown')).toEqual([]);
});
test('missing tiles expose equivalent evidence and loading/empty states without inventing measurements', () => {
  const props = { cells, needs: [], mode: 'both' as const, needFilter: 'housing' };
  const html = renderToStaticMarkup(<NeedsGeoMap {...props} />);
  expect(html).toContain('Search geographic evidence');
  expect(html).toContain('Submitted accounts · 3');
  expect(html).toContain('Simulated estimates · 12');
  expect(html).toContain('Measured conditions appear separately');
  expect(html).toContain('records no vote or publication');
  expect(renderToStaticMarkup(<NeedsGeoMap {...props} cells={[]} loading />)).toContain('Geographic evidence loading');
  expect(renderToStaticMarkup(<NeedsGeoMap {...props} cells={[]} />)).toContain('No geographic evidence available for this need');
});

test('public guide explains fallback and source boundaries', () => {
  expect(PUBLIC_GUIDE).toContain('Submitted accounts and simulated estimates stay separate');
  expect(PUBLIC_GUIDE).toContain('same selected need');
  expect(PUBLIC_GUIDE).toContain('Exploring evidence publishes nothing and casts no vote');
});
