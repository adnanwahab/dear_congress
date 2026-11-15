import { expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { MissionControl } from './MissionControl';
import type { BillObservation } from '../shared/legislation';

const bill: BillObservation = {
  id: 'congress:119:hr:42', congress: 119, type: 'hr', number: 42, title: 'Synthetic test record',
  chamber: 'House', sourceUrl: 'https://www.congress.gov/bill/119th-congress/house-bill/42',
  introducedDate: '2026-01-01', sponsors: ['Fixture sponsor'], latestAction: { actionDate: '2026-01-02', text: 'Referred (fixture)' },
  upstreamUpdatedAt: null, checkedAt: '2026-11-13T00:00:00Z', sourceHash: 'a'.repeat(64), refreshFailed: true,
};
test('observatory retains provenance and failed-refresh age without inferring delivery', () => {
  const html = renderToStaticMarkup(<MissionControl bills={[bill]} now={Date.parse('2026-11-15T00:00:00Z')} />);
  for (const text of [bill.id, bill.sourceUrl, bill.sourceHash, bill.checkedAt, 'Refresh failed', 'cache age 2880 minutes', 'Current legal status: Unknown', 'Public meeting deadline', 'Sponsor reply', 'No model receipt is bound', 'synthetic data only', 'No governmental authorization']) expect(html).toContain(text);
  expect(html).not.toContain('onclick');
});
test('empty observatory keeps measurement limits and evidence gaps available', () => {
  const html = renderToStaticMarkup(<MissionControl bills={[]} />);
  expect(html).toContain('No official metadata available');
  expect(html).toContain('No verified implemented policy');
  expect(html).toContain('No status has been inferred');
  expect(html).not.toContain('Open Congress.gov record');
});
test('read-only selection, failed refresh, retry and record removal preserve identity', async () => {
  const child = Bun.spawn([process.execPath, 'scripts/verify-mission-control.tsx'], { stdout: 'pipe', stderr: 'pipe' });
  const [code, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()]);
  expect({ code, stderr }).toEqual({ code: 0, stderr: '' });
  expect(stdout).toContain('PASS mission control');
});
