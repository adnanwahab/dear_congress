import { memo } from 'react';
import type { PackageResult } from '../engine/types';
import { PlanNumber } from './plan-motion';

const format = (n: number) => `${Number(n.toFixed(3))}`;
const Figure = memo(function Figure({ label, value, changed }: { label: string; value: number; changed: boolean }) {
  return <li data-changed={changed || undefined}><span>{label}: </span><PlanNumber value={value} format={format} />{changed && <small> · changed</small>}</li>;
});

/** Compare only matching side/package identities; never infer impact from an input alone. */
export function AssumptionDiagram({ source, pending, error, previous, current }: {
  source: string | null; pending: boolean; error: string | null;
  previous: { real: PackageResult[]; blended: PackageResult[] };
  current: { real: PackageResult[]; blended: PackageResult[] };
}) {
  if (!source) return null;
  const rows = (['real', 'blended'] as const).flatMap(side => current[side].flatMap(pkg => {
    const before = previous[side].find(p => p.id === pkg.id);
    if (!before) return [];
    return [
      { id: `${side}-${pkg.id}-cost`, label: `${side} package ${pkg.id} spending ($B)`, value: pkg.totalCost, before: before.totalCost },
      { id: `${side}-${pkg.id}-support`, label: `${side} package ${pkg.id} average support`, value: pkg.avgSupport, before: before.avgSupport },
    ].filter(row => Number.isFinite(row.value) && Number.isFinite(row.before));
  }));
  const changed = rows.filter(row => row.value !== row.before);
  const status = pending ? 'Calculating; previous figures retained.' : error ? 'Calculation unavailable; previous figures retained. No impact inferred.' : !rows.length ? 'Comparable calculation unavailable. No impact inferred.' : changed.length ? `Changed fields: ${changed.map(row => row.label).join(', ')}.` : 'No displayed spending or support figures changed.';
  return <section className="assumption-diagram" aria-label="Assumption to calculated figures">
    <p className="assumption-source">{source}</p>
    {!pending && !error && changed.length > 0 && <div className="assumption-link" data-connected="true" aria-hidden="true">↓</div>}
    <p role="status" aria-live="polite" aria-atomic="true">{status}</p>
    {!pending && !error && <ul>{rows.map(row => <Figure key={row.id} label={row.label} value={row.value} changed={row.value !== row.before} />)}</ul>}
    <small>Experimental package calculation, not a real-world impact forecast. Multiple edits are calculated together. No public submission.</small>
  </section>;
}
