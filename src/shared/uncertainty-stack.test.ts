import { expect, test } from 'bun:test';
import { UNCERTAINTY_CASES, propagateEstimate, estimateExport, type UncertaintyCase } from './uncertainty-stack';
const base = UNCERTAINTY_CASES[0]!;
test('nonnegative product encloses corners and does not claim probability', () => {
  const result = propagateEstimate(base);
  expect(result.bounds).toEqual([72000, 198000]);
  for (let mask = 0; mask < 16; mask++) {
    const product = base.components.reduce((a, c, i) => a * c.bounds![(mask >> i) & 1]!, 1);
    expect(product).toBeGreaterThanOrEqual(result.bounds![0]);
    expect(product).toBeLessThanOrEqual(result.bounds![1]);
  }
  expect(result.reason).toContain('not a confidence interval');
  expect(result.steps.length).toBe(4);
});
test('conflicts and missing evidence never return partial combined results', () => {
  for (const example of UNCERTAINTY_CASES.slice(1)) {
    expect(propagateEstimate(example).bounds).toBeNull();
    expect(propagateEstimate(example).steps).toEqual([]);
    const exported = JSON.parse(estimateExport(example));
    expect(exported.history[0].review).toBe('pending human review');
    expect(exported.result.bounds).toBeNull();
    expect(exported.components).toEqual(example.components);
  }
});
test('unsupported methods, invalid dates, bounds and duplicate components fail closed', () => {
  const modified = (patch: object): UncertaintyCase => ({ ...base, components: base.components.map((c, i) => i ? c : { ...c, ...patch }) });
  for (const bounds of [null, [-1, 2], [2, 1], [0, Infinity], [NaN, 2], [1e308, 1e308]]) expect(propagateEstimate(modified({ bounds })).bounds).toBeNull();
  for (const date of [null, '2026-02-31', 'nonsense']) expect(propagateEstimate(modified({ claim: { ...base.components[0]!.claim, date } })).bounds).toBeNull();
  expect(propagateEstimate({ ...base, method: 'unsupported' }).bounds).toBeNull();
  expect(propagateEstimate({ ...base, components: [...base.components.slice(1), base.components[1]!] }).bounds).toBeNull();
  expect(propagateEstimate(modified({ bounds: [0, 0] })).bounds).toEqual([0, 0]);
});
