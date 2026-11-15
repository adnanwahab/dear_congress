import { useState } from 'react';

// Editorial aggregates only: no participant records, browser votes or real samples.
export const TERRAIN_SOURCE = 'synthetic-transit-overlap:v1';
export const TERRAIN_SCOPE = 'adnanwahab/dear_congress:fictional-demo:demo-transit:v1';
export const MIN_TERRAIN_GROUP = 10;
type Counts = { both: number; constrained: number; other: number };
type Group = { id: string; label: string; size: number; cells: readonly Counts[] };
export const TERRAIN_GROUPS: readonly Group[] = [
  { id: 'evening', label: 'Fictional evening riders', size: 20, cells: [
    { both: 10, constrained: 5, other: 5 }, { both: 5, constrained: 10, other: 5 }, { both: 10, constrained: 5, other: 5 },
  ] },
  { id: 'weekend', label: 'Fictional weekend riders', size: 10, cells: [
    { both: 5, constrained: 5, other: 0 }, { both: 0, constrained: 5, other: 5 }, { both: 5, constrained: 0, other: 5 },
  ] },
];
const pairs = [
  { label: 'Evening access ∩ reliable connections', constraint: 'Protect essential connecting routes' },
  { label: 'Evening access ∩ affordable service', constraint: 'Keep operating costs within the pilot budget' },
  { label: 'Reliable connections ∩ affordable service', constraint: 'Retain accessible transfers' },
];

/** Suppress the whole partition, including complements; never send private cells to UI. */
export function releaseTerrainCell(size: number, counts: Counts): Counts | null {
  const values = [counts.both, counts.constrained, counts.other];
  if (!Number.isInteger(size) || size < MIN_TERRAIN_GROUP ||
      values.some(n => !Number.isInteger(n) || n < 0 || (n > 0 && n < 5)) ||
      values.reduce((sum, n) => sum + n, 0) !== size) return null;
  return { ...counts };
}

export function ConsensusTerrain({ scope }: { scope: string }) {
  const [basis, setBasis] = useState('pooled');
  if (scope !== TERRAIN_SCOPE) return <p>Overlap map unavailable for this source revision.</p>;
  return <section className="consensus-terrain" aria-label="Consensus terrain · synthetic preview">
    <h4>Where policy goals overlap</h4>
    <p>Synthetic preview · invented samples, no real participants. No consented real sample is connected. This is not a representative poll, verified civic participation, or merge authority.</p>
    <p>Each tile counts the same fictional responses supporting both named goals. Shared goals do not mean agreement on the proposal. Constraints remain separate; goal pairs overlap and must not be added together.</p>
    <label>Aggregation <select value={basis} onChange={event => setBasis(event.target.value)}>
      <option value="pooled">Pool released samples (response weighted)</option>
      <option value="equal">Give each released subgroup equal weight</option>
    </select></label>
    <p role="status">{basis === 'pooled' ? 'Pooled view: 30 fictional responses across 2 released groups.' : 'Equal-group view: mean of 2 subgroup percentages; each group contributes half.'} Missing responses are not treated as opposition.</p>
    <div className="terrain-grid">{pairs.map((pair, index) => {
      const released = TERRAIN_GROUPS.map(group => ({ group, counts: releaseTerrainCell(group.size, group.cells[index]!) }));
      const safe = released.filter((row): row is typeof row & { counts: Counts } => row.counts !== null);
      if (safe.length !== TERRAIN_GROUPS.length) return <article key={pair.label}><h5>{pair.label}</h5><p>Granular overlap unavailable: privacy threshold or invalid source counts.</p></article>;
      const total = safe.reduce((sum, row) => sum + row.group.size, 0);
      const percent = (key: keyof Counts) => Math.round(basis === 'pooled'
        ? safe.reduce((sum, row) => sum + row.counts[key], 0) / total * 100
        : safe.reduce((sum, row) => sum + row.counts[key] / row.group.size * 100, 0) / safe.length);
      return <article key={pair.label}>
        <h5>{pair.label}</h5>
        <div className="terrain-meter" aria-hidden="true"><span style={{ width: `${percent('both')}%` }} /></div>
        <p><strong>{percent('both')}% support both without the listed constraint</strong></p>
        <p>{percent('constrained')}% support both only with a constraint · {percent('other')}% other or undecided.</p>
        <p><strong>Constraint:</strong> {pair.constraint}. These fictional conditions are unresolved, not evidence that the proposal meets them.</p>
        <details><summary>Inspect subgroup counts: {pair.label}</summary>
          <ul>{safe.map(({ group, counts }) => <li key={group.id}>{group.label} · n={group.size}: {counts.both} support both without listed constraint; {counts.constrained} conditional; {counts.other} other or undecided. Denominator: {group.size} complete pair responses.</li>)}</ul>
          <p>Same responses in either aggregation. Equal weighting describes these groups only; it supplies no population weights or margin of error.</p>
        </details>
      </article>;
    })}</div>
    <details><summary>Source, sample selection and privacy limits</summary>
      <p>Source: {TERRAIN_SOURCE} · scope: {scope} · exact proposal clause 1 above. Editorial fixture, no external empirical source and no participant quotations. Agency background links do not substantiate these counts.</p>
      <p>30 invented complete responses in two disjoint released groups (n=20 and n=10). Another fictional group is below n=10: its size, cells and identifying labels are withheld. It contributes to neither view nor a grand total, preventing subtraction from released totals.</p>
      <p>Groups below 10 and partitions with any nonzero cell below 5 are suppressed in full, including complements. No individual drill-down or intersecting subgroup filters are available. These thresholds are a preview policy, not a privacy guarantee.</p>
      <p>For real samples, explicit consent to this aggregate use, source denominators, nonresponse, withdrawal handling and a reviewed disclosure policy are required before display. No real-sample consent is inferred from a journal or browser vote.</p>
      <p>Bundled read-only fixture: no network request or loading phase. Unknown source revisions show unavailable rather than reusing these counts. No votes or records are changed.</p>
    </details>
  </section>;
}
