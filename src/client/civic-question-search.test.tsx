import { expect, test } from 'bun:test';
import { civicIndex, searchCivic } from './CivicQuestionSearch';
import type { BillObservation } from '../shared/legislation';
test('question matching retains identities, source links and hypothetical boundaries', () => {
  const index = civicIndex([]);
  expect(searchCivic(index, 'How can childcare cost less?', 'All types').length).toBeGreaterThan(0);
  expect(searchCivic(index, 'HFL-051', 'Bills')[0]?.href).toBe('/bills/HFL-051');
  expect(searchCivic(index, 'HFL-051', 'Drafts')).toEqual([]);
  expect(searchCivic([], 'housing', 'All types')).toEqual([]);
  expect(searchCivic(index, 'how can we?', 'All types')).toEqual([]);
  expect(searchCivic(index, 'unanswerable-xyz', 'All types')).toEqual([]);
  expect(new Set(index.map(r => r.key)).size).toBe(index.length);
  for (const r of index) { expect(r.href).toMatch(/^(\/|https:\/\/)/); expect(r.status.length).toBeGreaterThan(20); }
  for (const r of index.filter(r => r.type === 'Outcomes')) expect(r.status).toContain('no verified');
});
test('stale or failed metadata retains citation revision without claiming current status', () => {
  const b = { id: '119-hr-1', type: 'hr', number: 1, congress: 119, title: 'Housing', latestAction: { text: 'Reported' }, sourceUrl: 'https://www.congress.gov/bill/119th-congress/house-bill/1', checkedAt: '2026-01-01T00:00:00Z', sourceHash: 'abc', refreshFailed: false } as BillObservation;
  const result = civicIndex([b], Date.parse('2026-11-15')).find(r => r.key === 'congress:119-hr-1:abc')!;
  expect(result.status).toContain('Stale'); expect(result.status).toContain('legal status unverified');
  expect(result.href).toBe(b.sourceUrl);
  expect(civicIndex([{ ...b, refreshFailed: true }], Date.parse('2026-11-15')).at(-1)?.status).toContain('Refresh failed');
});
test('native low-power search restores history, filters, focus and navigation', async () => {
  const child = Bun.spawn([process.execPath, 'scripts/verify-civic-search.tsx'], { stdout: 'pipe', stderr: 'pipe' });
  const [code, stderr] = await Promise.all([child.exited, new Response(child.stderr).text()]);
  expect({ code, stderr }).toEqual({ code: 0, stderr: '' });
});
