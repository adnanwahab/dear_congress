import { expect, test } from 'bun:test';
import { sealSessionForecast, type CapsuleDraft } from './time-capsule';
const now = new Date('2026-11-15T12:00:00Z');
const draft: CapsuleDraft = { metricId: 'wait', jurisdiction: 'Fictional transit pilot', horizon: '2027-11-15', target: '12', prediction: 'Wait will be at most twelve minutes.' };
test('pins an immutable synthetic baseline and private session timestamp', () => {
  const receipt = sealSessionForecast(draft, now);
  expect(receipt.baseline.revision).toBe('wait-2024');
  expect(receipt.baseline.sourceVersion).toBe('synthetic-fixture-v1/wait-2024');
  expect(receipt.visibility).toBe('private-session');
  expect(receipt.sealedAt).toBe(now.toISOString());
  expect(Object.isFrozen(receipt)).toBe(true);
  expect(Object.isFrozen(receipt.baseline)).toBe(true);
  const changed = { ...draft, target: '0' };
  expect(sealSessionForecast(changed, now).target).toBe(0);
  expect(receipt.target).toBe(12);
});
test('rejects incomplete, nonfinite, real-jurisdiction and nonfuture forecasts', () => {
  for (const patch of [{ metricId: '' }, { jurisdiction: 'Houston' }, { target: '' }, { target: 'Infinity' }, { prediction: ' ' }, { prediction: 'x'.repeat(1001) }, { horizon: '2026-11-15' }, { horizon: '2027-02-30' }, { horizon: 'bad' }]) {
    expect(() => sealSessionForecast({ ...draft, ...patch }, now)).toThrow();
  }
});
