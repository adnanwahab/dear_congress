import { expect, test } from 'bun:test';
import { healthReport, sourceHealth } from './source-health';
import type { OutcomesFile, OutcomePoint } from '../server/outcomes';
const now = Date.parse('2026-11-14T00:00:00Z');
const row: OutcomePoint = { needId: 'transit', value: 0.2, year: 2024, unit: 'share', severity: 0.5, fetchedAt: '2026-11-13T00:00:00Z', source: { name: 'Test provider', url: 'https://example.org/source', caveat: 'Test fixture only, not real evidence' } };
const file = (series: OutcomePoint[], errors: OutcomesFile['errors'] = []): OutcomesFile => ({ generatedAt: row.fetchedAt, series, errors });
test('complete metadata, conflicting and missing-source cases retain identities and limitations', () => {
  const input = file([row]);
  expect(sourceHealth(input, now)[1]!.status).toBe('Recent recorded fetch');
  expect(sourceHealth(file([row, { ...row, value: 0.4 }]), now)[1]!.status).toBe('Conflicting records');
  expect(sourceHealth(null, now).every(source => source.status === 'Missing source')).toBe(true);
  const report = JSON.parse(healthReport(input, now));
  expect(report.sources[1].latest).toEqual(row);
  expect(report.limitation).toContain('not verified measurements');
  expect(input).toEqual(file([row]));
});
test('failed fetch keeps recorded values, invalid/future/old dates never become recent', () => {
  const failed = sourceHealth(file([row], [{ needId: 'transit', at: row.fetchedAt, message: 'failure' }]), now)[1]!;
  expect(failed.status).toBe('Fetch failed; retained data');
  expect(failed.latest).toEqual(row);
  for (const fetchedAt of ['invalid', '2027-01-01', '2020-01-01']) expect(sourceHealth(file([{ ...row, fetchedAt }]), now)[1]!.stale).toBe(true);
});
test('isolated source health UI handles loading, missing, offline, retry and text export', async () => {
  const child = Bun.spawn([process.execPath, 'scripts/verify-source-health.tsx'], { stdout: 'pipe', stderr: 'pipe' });
  const [code, stderr] = await Promise.all([child.exited, new Response(child.stderr).text()]);
  expect({ code, stderr }).toEqual({ code: 0, stderr: '' });
});
