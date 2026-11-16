/** Illustrative records only; never used by synthesis, ballots, or measured outcomes. */
export interface LocalPolicyRecord {
  id: string;
  jurisdiction: string;
  policy: string;
  effectiveDate: string;
  period: string;
  source: { label: string; revision: string };
  measure: { definition: string; unit: string; population: string; sampling: string; value: number | null };
  confounders: string[];
  learned: string;
}
export interface LocalPolicyPair {
  id: string;
  label: string;
  records: [LocalPolicyRecord, LocalPolicyRecord];
}
export function comparisonGaps([a, b]: LocalPolicyPair['records']): string[] {
  const gaps: string[] = [];
  for (const key of ['definition', 'unit', 'population', 'sampling'] as const) {
    if (!a.measure[key].trim() || a.measure[key] !== b.measure[key]) gaps.push(`Different or missing ${key}`);
  }
  if (!a.period || a.period !== b.period) gaps.push('Different or missing observation periods');
  if ([a, b].some(r => r.measure.value === null || !Number.isFinite(r.measure.value))) gaps.push('Missing outcome measurements');
  if ([a, b].some(r => !r.source.label || !r.source.revision || !r.policy || !r.effectiveDate)) gaps.push('Missing policy or source provenance');
  return gaps;
}
const record = (id: string, jurisdiction: string, value: number): LocalPolicyRecord => ({
  id, jurisdiction, policy: 'Illustrative bus pilot: service every 15 minutes on two routes, weekdays 07:00–19:00.',
  effectiveDate: '2025-01-01', period: '2025-04-01 to 2025-06-30',
  source: { label: 'Invented comparison fixture; no public observation', revision: 'local-comparison-v1' },
  measure: { definition: 'Mean passenger wait at pilot stops', unit: 'minutes', population: 'Weekday daytime passengers at pilot stops', sampling: 'Synthetic 100 passenger arrivals per place; no residents observed', value },
  confounders: ['Traffic and route geometry differ.', 'Weather, ridership and service reliability are uncontrolled.'],
  learned: 'Illustrative lesson: collect comparable baseline and reliability data before attributing an effect.',
});
export const LOCAL_POLICY_PAIRS: LocalPolicyPair[] = [
  { id: 'matched', label: 'Matched definitions · synthetic', records: [record('example-a', 'Example City A (fictional)', 7), record('example-b', 'Example City B (fictional)', 9)] },
  { id: 'incompatible', label: 'Different sampling · synthetic', records: [record('example-a', 'Example City A (fictional)', 7), { ...record('example-c', 'Example City C (fictional)', 12), measure: { ...record('example-c', '', 12).measure, sampling: 'Synthetic voluntary rider survey; selection bias unknown' } }] },
  { id: 'missing', label: 'Missing measurements · synthetic', records: [record('example-a', 'Example City A (fictional)', 7), { ...record('example-d', 'Example City D (fictional)', 0), measure: { ...record('example-d', '', 0).measure, value: null } }] },
];
