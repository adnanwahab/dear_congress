import { test, expect } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { BillMetadataLane } from './OfficialBills';
test('separate official lane makes incomplete coverage and lack of legal verification explicit', () => {
  const html = renderToStaticMarkup(<BillMetadataLane bills={[]} />);
  expect(html).toContain('Official bill metadata');
  expect(html).toContain('Separate from citizen ideas, drafts and fictional samples');
  expect(html).toContain('No official bill metadata available');
  expect(html).toContain('full text, amendments and complete legal status have not been checked');
});

test('populated lane escapes imported markup and never presents cached metadata as verified legal status', () => {
  const html = renderToStaticMarkup(<BillMetadataLane now={Date.parse('2026-11-13T01:00:00Z')} bills={[{
    id: 'congress-gov:119:hr:123', jurisdiction: 'US', congress: 119, type: 'hr', number: 123,
    title: '<script>unsafe</script>', chamber: 'House', sourceUrl: 'https://www.congress.gov/bill/119th-congress/house-bill/123',
    introducedDate: '2025-01-03', sponsors: [], latestAction: { actionDate: '2026-11-12', text: 'Passed House' },
    upstreamUpdatedAt: null, retrievedAt: '2026-11-13T00:00:00Z', checkedAt: '2026-11-13T00:00:00Z', sourceHash: 'a'.repeat(64), refreshFailed: true,
  }]} />);
  expect(html).not.toContain('<script>');
  expect(html).toContain('&lt;script&gt;');
  expect(html).toContain('Current legal status unverified');
  expect(html).toContain('Refresh failed · cache age 60 minutes');
  expect(html).toContain('Sponsor: Not provided by source');
  expect(html).toContain('SHA-256:');
  expect(html).toContain('rel="noopener noreferrer"');
});

test('first failed fetch displays requested identity without inventing official metadata', () => {
  const html = renderToStaticMarkup(<BillMetadataLane bills={[]} unavailable={[{
    id: 'congress-gov:119:hr:123', jurisdiction: 'US', congress: 119, type: 'hr', number: 123,
    state: 'unavailable', attemptedAt: '2026-11-17T00:00:00Z',
  }]} />);
  expect(html).toContain('HR 123');
  expect(html).toContain('Official metadata unavailable');
  expect(html).toContain('no successful retrieval is archived');
  expect(html).not.toContain('Official metadata record only');
  expect(html).not.toContain('metadata retrieved');
  expect(html).not.toContain('Last reported official action');
});
