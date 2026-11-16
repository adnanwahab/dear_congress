import { expect, test } from 'bun:test';
import { comparisonGaps, LOCAL_POLICY_PAIRS } from '../shared/jurisdiction-comparison';
test('comparison gates incompatible definitions, provenance, sampling, periods and missing values', () => {
  const [a, b] = LOCAL_POLICY_PAIRS[0]!.records;
  expect(comparisonGaps([a, b])).toEqual([]);
  for (const key of ['definition', 'unit', 'population', 'sampling'] as const) expect(comparisonGaps([a, { ...b, measure: { ...b.measure, [key]: 'different' } }]).length).toBeGreaterThan(0);
  for (const value of [null, NaN, Infinity]) expect(comparisonGaps([a, { ...b, measure: { ...b.measure, value } }])).toContain('Missing outcome measurements');
  expect(comparisonGaps([a, { ...b, source: { ...b.source, revision: '' } }])).toContain('Missing policy or source provenance');
  expect(comparisonGaps([a, { ...b, period: 'different' }])).toContain('Different or missing observation periods');
  expect(comparisonGaps([a, { ...b, measure: { ...b.measure, value: 0 } }])).toEqual([]);
});
test('comparison UI handles loading, failure, retry, incompatible and missing pairs', async () => {
  const child = Bun.spawn([process.execPath, 'scripts/verify-jurisdiction-comparison.tsx'], { stdout: 'pipe', stderr: 'pipe' });
  const [code, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()]);
  expect({ code, stderr }).toEqual({ code: 0, stderr: '' });
  expect(stdout).toContain('PASS comparison');
});

test('public guide discloses fictional comparisons, missing data and consent boundary', async () => {
  const { PUBLIC_GUIDE } = await import('./public-guide');
  for (const text of ['No verified jurisdiction pairs', 'No comparable data', 'cannot prove policy causation', 'do not access your journal or infer your location']) expect(PUBLIC_GUIDE).toContain(text);
});
