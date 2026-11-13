import { expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { assessMetric, SYNTHETIC_METRICS } from '../shared/policy-measurements';
import { PolicyMeasurements } from './PolicyMeasurements';

const wait = SYNTHETIC_METRICS[0]!;
const at = '2026-11-13';
test('mixed results and missing observations remain independent, descriptive assessments', () => {
  const results = SYNTHETIC_METRICS.map(metric => assessMetric(metric, at));
  expect(results.map(r => r.movement)).toEqual(['Improved', 'Worsened', 'Cannot yet be measured']);
  expect(results.map(r => r.freshness)).toEqual(['Outdated measurement', 'Outdated measurement', 'Missing measurement']);
  expect(results[0]!.target).toBe('Target not yet due');
  for (const result of results) expect(result.attribution).toBe('Causal attribution not established');
});
test('freshness boundary and target deadline do not turn favorable movement into success', () => {
  expect(assessMetric(wait, '2026-06-30').freshness).toBe('Current measurement');
  expect(assessMetric(wait, '2026-07-01').freshness).toBe('Outdated measurement');
  expect(assessMetric(wait, '2027-12-31').target).toBe('Target not met in this observation');
  expect(assessMetric({ ...wait, target: 15 }, at).target).toBe('Target met in this observation');
  expect(assessMetric({ ...wait, direction: 'higher' }, at).movement).toBe('Worsened');
  expect(assessMetric({ ...wait, latestRevision: wait.baselineRevision }, at).movement).toBe('No change');
});
test('pinned baseline survives appended corrections; incompatible or unversioned observations block comparison', () => {
  const correction = { ...wait.history[1]!, revision: 'correction', value: 10 };
  const corrected = { ...wait, history: [...wait.history, correction], latestRevision: 'correction' };
  expect(assessMetric(corrected, at).baseline?.value).toBe(20);
  expect(assessMetric(wait, at).latest?.value).toBe(15);
  for (const patch of [{ unit: 'seconds' }, { population: 'Different households' }]) {
    expect(assessMetric({ ...corrected, history: [...wait.history, { ...correction, ...patch }] }, at).movement).toBe('Not comparable');
  }
  for (const patch of [{ sourceVersion: '' }, { value: NaN }]) {
    expect(assessMetric({ ...corrected, history: [...wait.history, { ...correction, ...patch }] }, at).movement).toBe('Cannot yet be measured');
  }
  expect(assessMetric({ ...wait, baselineRevision: 'absent' }, at).movement).toBe('Cannot yet be measured');
  expect(assessMetric({ ...wait, history: wait.history.map(r => ({ ...r, value: 0 })) }, at).movement).toBe('No change');
});
test('visible cards retain missing and stale values, source history, and synthetic/causality labels', () => {
  const html = renderToStaticMarkup(<PolicyMeasurements asOf={at} />);
  for (const text of ['No verified implemented policy', 'activity, not evidence', 'synthetic data only', 'Improved', 'Worsened', 'Missing: no observation', 'Outdated measurement', 'wait-2024', 'synthetic-fixture-v1/wait-2025', 'Causal attribution not established', 'No uncertainty estimates']) expect(html).toContain(text);
  expect(html.match(/<article/g)).toHaveLength(3);
  expect(html).toContain('aria-labelledby="policy-measurements-title"');
  expect(html).toContain('<summary>Baseline and source version history');
});

test('outcomes integrates measurements independently of offline proposals and saved replies', async () => {
  const child = Bun.spawn([process.execPath, 'scripts/verify-policy-measurements.tsx'], { stdout: 'pipe', stderr: 'pipe' });
  const [code, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()]);
  expect({ code, stderr }).toEqual({ code: 0, stderr: '' });
  expect(stdout).toContain('PASS isolated activity');
});
