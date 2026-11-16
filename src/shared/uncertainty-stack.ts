/** Read-only educational scenarios, never observed outcomes or synthesis inputs. */
export type ClaimKind = 'primary source' | 'editorial inference' | 'user claim' | 'synthetic estimate';
export interface EstimateClaim {
  id: string;
  kind: ClaimKind;
  date: string | null;
  source: string | null;
  limitations: string;
}
export interface UncertaintyComponent {
  kind: 'measurement' | 'model' | 'cost' | 'implementation';
  bounds: readonly [number, number] | null;
  claim: EstimateClaim;
  conflict?: string;
}
export interface UncertaintyCase {
  id: string;
  title: string;
  revision: string;
  method: 'bounded-product' | 'unsupported';
  components: readonly UncertaintyComponent[];
  history: readonly { revision: string; date: string; change: string; review: 'pending human review'; claimIds: readonly string[] }[];
}
export const METHOD_NOTE: EstimateClaim = {
  id: 'method-v1', kind: 'editorial inference', date: '2026-11-14',
  source: 'docs/uncertainty-stack.md#method',
  limitations: 'Multiplication of nonnegative bounded factors gives a scenario envelope, not a confidence interval. Bounds are assumptions, not probabilities; no independence assumption is needed. Omitted mechanisms remain outside the envelope.',
};
const component = (kind: UncertaintyComponent['kind'], bounds: readonly [number, number]): UncertaintyComponent => ({
  kind, bounds, claim: { id: `${kind}-v1`, kind: 'synthetic estimate', date: '2026-11-14', source: `docs/uncertainty-stack.md#${kind}`, limitations: 'Invented fixture bounds for a fictional shade installation budget. No real procurement, measured effect or population claim.' },
});
const components = [component('measurement', [90, 110]), component('model', [1, 1.2]), component('cost', [800, 1200]), component('implementation', [1, 1.25])];
function scenario(id: string, title: string, parts: readonly UncertaintyComponent[]): UncertaintyCase {
  return { id, title, revision: `${id}-v1`, method: 'bounded-product', components: parts, history: [{ revision: `${id}-v1`, date: '2026-11-14', change: 'Initial synthetic scenario; source identities and bounds recorded. Not approved for a real policy estimate.', review: 'pending human review', claimIds: parts.map(p => p.claim.id) }] };
}
export const UNCERTAINTY_CASES: readonly UncertaintyCase[] = [
  scenario('traceable', 'Traceable synthetic case', components),
  scenario('conflicting', 'Conflicting case', components.map(p => p.kind === 'cost' ? { ...p, conflict: 'A fictional user reports $500–700 per unit, conflicting with the fixture’s $800–1,200. Neither is verified; do not average them.', claim: { ...p.claim, id: 'cost-conflict-v1', kind: 'user claim', limitations: 'Invented user report for conflict testing. Not an actual resident submission.' } } : p)),
  scenario('missing', 'Missing-source case', components.map(p => p.kind === 'implementation' ? { ...p, bounds: null, claim: { ...p.claim, id: 'implementation-missing-v1', source: null, date: null, limitations: 'No source, date or defensible bound supplied. Missing does not mean zero.' } } : p)),
];
export function propagateEstimate(value: UncertaintyCase): { bounds: [number, number] | null; reason: string; steps: [number, number][] } {
  const blocked = (reason: string) => ({ bounds: null, reason, steps: [] });
  if (value.method !== 'bounded-product') return blocked('Unsupported propagation method.');
  const required = ['measurement', 'model', 'cost', 'implementation'];
  if (value.components.length !== 4 || required.some(k => value.components.filter(c => c.kind === k).length !== 1)) return blocked('Exactly one of each uncertainty component is required.');
  let lo = 1, hi = 1;
  const steps: [number, number][] = [];
  for (const part of value.components) {
    if (part.conflict) return blocked('Unresolved conflicting evidence.');
    if (!part.claim.source || !validDate(part.claim.date) || !part.claim.limitations.trim()) return blocked('Missing source, date or limitations.');
    if (!part.bounds || part.bounds.some(n => !Number.isFinite(n) || n < 0) || part.bounds[0] > part.bounds[1]) return blocked('Missing or invalid nonnegative bounds.');
    lo *= part.bounds[0]; hi *= part.bounds[1];
    if (!Number.isFinite(lo) || !Number.isFinite(hi)) return blocked('Numeric overflow.');
    steps.push([lo, hi]);
  }
  return { bounds: [lo, hi], reason: METHOD_NOTE.limitations, steps };
}
function validDate(date: string | null) {
  return !!date && /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(Date.parse(date)) && new Date(date).toISOString().slice(0, 10) === date;
}
export function estimateExport(value: UncertaintyCase): string {
  const result = propagateEstimate(value);
  return JSON.stringify({ scope: 'Synthetic demonstration only; not a real policy estimate', ...value, methodNote: METHOD_NOTE, result }, null, 2);
}
