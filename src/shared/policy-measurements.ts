/** Synthetic spike only. Never feed these records into synthesis or observed data. */
export interface Measurement {
  revision: string;
  period: string;
  value: number;
  unit: string;
  population: string;
  sourceVersion: string;
}
export interface MetricPromise {
  id: string;
  label: string;
  direction: 'lower' | 'higher';
  target: number;
  targetDate: string;
  owner: string;
  cadence: string;
  nextUpdate: string;
  caveat: string;
  baselineRevision: string;
  latestRevision: string | null;
  history: readonly Measurement[];
}
export function assessMetric(metric: MetricPromise, asOf: string) {
  const baseline = metric.history.find(r => r.revision === metric.baselineRevision);
  const latest = metric.history.find(r => r.revision === metric.latestRevision);
  const valid = (row: Measurement | undefined): row is Measurement => !!row && Number.isFinite(row.value) && !!row.sourceVersion;
  const comparable = valid(baseline) && valid(latest) && baseline.unit === latest.unit && baseline.population === latest.population;
  const freshness = !valid(latest) ? 'Missing measurement' : asOf > metric.nextUpdate ? 'Outdated measurement' : 'Current measurement';
  let movement = 'Cannot yet be measured';
  let target = 'Cannot assess target';
  if (comparable) {
    const delta = (latest.value - baseline.value) * (metric.direction === 'higher' ? 1 : -1);
    movement = delta > 0 ? 'Improved' : delta < 0 ? 'Worsened' : 'No change';
    const met = metric.direction === 'higher' ? latest.value >= metric.target : latest.value <= metric.target;
    target = met ? 'Target met in this observation' : asOf < metric.targetDate ? 'Target not yet due' : 'Target not met in this observation';
  } else if (valid(baseline) && valid(latest)) movement = 'Not comparable';
  return { baseline, latest, freshness, movement, target, attribution: 'Causal attribution not established' };
}
const row = (revision: string, period: string, value: number, unit: string): Measurement => ({ revision, period, value, unit, population: 'Fictional pilot households', sourceVersion: `synthetic-fixture-v1/${revision}` });
const common = {
  owner: 'Fictional pilot data team', cadence: 'Annual', nextUpdate: '2026-06-30', targetDate: '2027-12-31',
  caveat: 'Invented values for testing. No uncertainty estimates or credible comparison design; movement is descriptive only.',
};
export const SYNTHETIC_METRICS: readonly MetricPromise[] = [
  { ...common, id: 'wait', label: 'Typical bus wait', direction: 'lower', target: 12, baselineRevision: 'wait-2024', latestRevision: 'wait-2025', history: [row('wait-2024', '2024', 20, 'minutes'), row('wait-2025', '2025', 15, 'minutes')] },
  { ...common, id: 'fare', label: 'Household fare burden', direction: 'lower', target: 4, baselineRevision: 'fare-2024', latestRevision: 'fare-2025', history: [row('fare-2024', '2024', 4, '% of income'), row('fare-2025', '2025', 6, '% of income')] },
  { ...common, id: 'access', label: 'Step-free trip availability', direction: 'higher', target: 95, baselineRevision: 'access-2024', latestRevision: null, history: [row('access-2024', '2024', 80, '% of trips')] },
];
