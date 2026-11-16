import { expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { SourceStatusLegend } from './SourceStatus';
import { ProposalProvenance } from './ProposalProvenance';
import { DEMO_ITEMS } from '../engine/demo';
import { BillMetadataLane } from './OfficialBills';
import { LawBehaviorExplorer } from './LawBehaviorExplorer';

test('status guide discloses all four kinds and independent limits', () => {
  const html = renderToStaticMarkup(<SourceStatusLegend />);
  for (const label of ['Fictional sample', 'Unreviewed draft', 'Source-backed metadata', 'Modeled scenario']) expect(html).toContain(label);
  expect(html).toContain('Source links do not imply agency endorsement');
});
test('background citations never upgrade fictional samples to source-backed metadata', () => {
  for (const item of DEMO_ITEMS) for (const compact of [true, false]) {
    const html = renderToStaticMarkup(<ProposalProvenance item={item} compact={compact} />);
    expect(html).toContain('data-source-status="sample"');
    expect(html).not.toContain('data-source-status="metadata"');
    // Compact status precedes the hidden details body; no activation required.
    if (compact) expect(html.indexOf('Fictional sample')).toBeLessThan(html.indexOf('workflow-provenance-body'));
    expect(html).toContain('Background only; does not establish');
  }
});
test('metadata lane labels records only, retains legal-status uncertainty', () => {
  expect(renderToStaticMarkup(<BillMetadataLane bills={[]} />)).not.toContain('data-source-status');
  const html = renderToStaticMarkup(<BillMetadataLane bills={[{
    id: 'congress-gov:119:hr:123', congress: 119, type: 'hr', number: 123,
    title: 'Example metadata', chamber: 'House', sourceUrl: 'https://www.congress.gov/bill/119th-congress/house-bill/123',
    introducedDate: '2025-01-03', sponsors: [], latestAction: { actionDate: '2026-11-12', text: 'Passed House' },
    upstreamUpdatedAt: null, checkedAt: '2026-11-13T00:00:00Z', sourceHash: 'a'.repeat(64), refreshFailed: false,
  }]} />);
  expect(html).toContain('data-source-status="metadata"');
  expect(html).toContain('Current legal status unverified');
});
test('simulation is labeled before any model request or receipt', () => {
  const html = renderToStaticMarkup(<LawBehaviorExplorer seed={42} hblOrigin="https://happybearlandia.fly.dev" />);
  expect(html).toContain('data-source-status="model"');
  expect(html).toContain('Modeled scenario');
});
