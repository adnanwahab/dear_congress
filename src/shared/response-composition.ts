/** Independent teaching fixtures; never read cookies, ballots or production tallies. */
export type ClaimProvenance = {
  kind: 'primary source' | 'editorial inference' | 'user claim' | 'synthetic estimate';
  source: string | null;
  date: string;
  limitation: string;
  review: 'pending human review';
};
export const COMPOSITION_VERSION = 'adnanwahab/dear_congress:response-composition:v1';
export const GROUPS = [
  { name: 'Fictional evening riders', support: 80, oppose: 10, unsure: 10 },
  { name: 'Fictional daytime riders', support: 20, oppose: 60, unsure: 20 },
] as const;
export const CASES = [
  { id: 'sourced', title: 'Fully sourced fictional case', text: 'Both groups have 100 illustrative responses. The complete source record is printed below.', kind: 'synthetic estimate', source: `${COMPOSITION_VERSION}/groups`, limitation: 'Complete fictional input record; no observed people, sampling frame or real poll.' },
  { id: 'conflicting', title: 'Conflicting case', text: 'A fictional participant says everyone supports the pilot. The fixture includes opposing and unsure responses; retain both claims rather than reconcile them silently.', kind: 'user claim', source: `${COMPOSITION_VERSION}/conflicting-claim`, limitation: 'Invented participant statement, unverified and contradicted by the fictional count record.' },
  { id: 'missing', title: 'Missing-source case', text: 'A claim of citywide majority support has no supplied source.', kind: 'user claim', source: null, limitation: 'Date is fixture authorship, not observation. Population support is unknown; do not replace missing evidence with zero.' },
] as const;
export const LIMITS = 'All input counts are illustrative. Reweighting changes the composition of fictional responses, not public opinion. Self-selection and missing groups remain unknown. Browser cookies do not identify unique people or produce a representative real poll. Advisory only; no merge authority.';
export function composition(weights: readonly number[]) {
  if (weights.length !== GROUPS.length || weights.some(w => !Number.isFinite(w) || w < 0 || w > 5)) throw new Error('Weights must be between 0 and 5.');
  const counts = [0, 0, 0];
  GROUPS.forEach((group, i) => [group.support, group.oppose, group.unsure].forEach((n, j) => { counts[j]! += n * weights[i]!; }));
  const total = counts.reduce((a, b) => a + b, 0);
  return { counts, total, percentages: counts.map(n => total ? (100 * n / total).toFixed(1) + '%' : 'Undefined — no responses') };
}
export type CompositionEvent = { at: string; action: string; weights: number[]; caseId: string; provenance: string; review: 'pending human review' };
export function compositionReport(weights: number[], caseId: string, events: CompositionEvent[]) {
  const selected = CASES.find(c => c.id === caseId) ?? CASES[0];
  return JSON.stringify({ version: COMPOSITION_VERSION, authored: '2026-11-14', review: 'pending human review', limitations: LIMITS, case: selected, claims: [{ kind: 'primary source', source: `${COMPOSITION_VERSION}/groups`, date: '2026-11-14', review: 'pending human review', limitation: 'Original fictional record only; all counts synthetic.' }, { kind: 'editorial inference', source: COMPOSITION_VERSION, date: '2026-11-14', review: 'pending human review', limitation: 'Composition arithmetic cannot correct unknown selection bias.' }], groups: GROUPS, weights, result: composition(weights), history: events }, null, 2);
}
