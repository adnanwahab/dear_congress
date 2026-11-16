import { expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { AssumptionDiagram } from './AssumptionDiagram';
import type { PackageResult } from '../engine/types';

test('diagram isolates package sides and reports only calculated changed fields', () => {
  const pkg = (id: string, totalCost: number) => ({ id, totalCost, avgSupport: .5 }) as PackageResult;
  const previous = { real: [pkg('A', 10)], blended: [pkg('A', 30)] };
  const current = { real: [pkg('A', 15)], blended: [pkg('A', 30)] };
  const props = { source: 'Annual budget = $45B', pending: false, error: null, previous, current };
  const html = renderToStaticMarkup(<AssumptionDiagram {...props} />);
  expect(html).toContain('Changed fields: real package A spending ($B).');
  expect(html.match(/data-changed="true"/g)?.length).toBe(1);
  expect(html).toContain('data-connected="true"');
  for (const state of [{ pending: true }, { error: 'failed' }]) {
    const unavailable = renderToStaticMarkup(<AssumptionDiagram {...props} {...state} />);
    expect(unavailable).not.toContain('data-connected');
    expect(unavailable).not.toContain('data-changed');
    expect(unavailable).toContain('previous figures retained');
  }
  expect(renderToStaticMarkup(<AssumptionDiagram {...props} current={previous} />)).toContain('No displayed spending or support figures changed');
  expect(renderToStaticMarkup(<AssumptionDiagram {...props} previous={{ real: [], blended: [] }} />)).toContain('Comparable calculation unavailable');
});
