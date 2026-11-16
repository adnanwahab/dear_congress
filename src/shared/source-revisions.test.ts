import { expect, test } from 'bun:test';
import { acknowledged, revisionDiff, snapshotHash, type SourceRevision } from './source-revisions';
import { SYNTHETIC_METRICS } from './policy-measurements';
const measurement = SYNTHETIC_METRICS[0]!.history[1]!;
async function snapshot(): Promise<SourceRevision> {
  return { sourceId: 'wait', revision: measurement.revision, detectedAt: '2026-11-13', providerChangedAt: null, kind: 'synthetic estimate', limitations: 'Fictional fixture', measurement, hash: await snapshotHash(measurement) };
}
test('hash is deterministic and every factual field participates', async () => {
  expect(await snapshotHash(measurement)).toMatch(/^sha256:[a-f0-9]{64}$/);
  expect(await snapshotHash({ ...measurement })).toBe(await snapshotHash(measurement));
  for (const patch of [{ value: 16 }, { unit: 'seconds' }, { period: '2026' }, { population: 'Other' }, { sourceVersion: 'v2' }]) {
    expect(await snapshotHash({ ...measurement, ...patch })).not.toBe(await snapshotHash(measurement));
  }
});
test('correction retains published claim and binds review to source and exact transition', async () => {
  const before = await snapshot();
  const nextMeasurement = { ...measurement, value: 16, sourceVersion: 'corrected' };
  const after = { ...before, measurement: nextMeasurement, hash: await snapshotHash(nextMeasurement) };
  expect(revisionDiff(before, after)).toEqual([{ field: 'value', before: 15, after: 16 }, { field: 'sourceVersion', before: measurement.sourceVersion, after: 'corrected' }]);
  expect(before.measurement.value).toBe(15);
  expect(() => revisionDiff(before, { ...after, sourceId: 'fare' })).toThrow();
  const review = { sourceId: 'wait', beforeHash: before.hash, afterHash: after.hash, reviewer: 'Human fixture', acknowledgedAt: '2026-11-14', note: 'Checked correction' };
  expect(acknowledged(before, after, [])).toBe(false);
  expect(acknowledged(before, after, [review])).toBe(true);
  for (const patch of [{ sourceId: 'other' }, { afterHash: 'old' }, { beforeHash: 'old' }, { reviewer: '' }, { note: '' }, { acknowledgedAt: 'invalid' }]) expect(acknowledged(before, after, [{ ...review, ...patch }])).toBe(false);
});
