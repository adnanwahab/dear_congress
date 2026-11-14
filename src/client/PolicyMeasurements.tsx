import { assessMetric, SYNTHETIC_METRICS } from '../shared/policy-measurements';

export function PolicyMeasurements({ asOf = new Date().toISOString().slice(0, 10) }: { asOf?: string }) {
  return <section className="panel policy-measurements" aria-labelledby="policy-measurements-title" id="policy-measurements">
    <h2 id="policy-measurements-title">Policy measurements</h2>
    <p>No verified implemented policy or measured policy effects are registered. Replies and committee milestones are activity, not evidence of policy benefit.</p>
    <details><summary>Explore synthetic measurement prototype</summary>
      <p>Fictional transit pilot · synthetic data only · assessed as of {asOf}. These values do not describe a real policy or enter synthesis.</p>
      {SYNTHETIC_METRICS.map(metric => {
        const result = assessMetric(metric, asOf);
        return <article key={metric.id} className="card">
          <h3>{metric.label} · synthetic</h3>
          <p><strong>{result.movement}</strong> · {result.freshness} · {result.target}</p>
          <dl>
            <dt>Promise</dt><dd>{metric.direction === 'lower' ? 'At most' : 'At least'} {metric.target} {result.baseline?.unit} by {metric.targetDate}</dd>
            <dt>Pinned baseline</dt><dd>{result.baseline?.value} {result.baseline?.unit} ({result.baseline?.period})</dd>
            <dt>Latest observation</dt><dd>{result.latest ? `${result.latest.value} ${result.latest.unit} (${result.latest.period})` : 'Missing: no observation supplied for this metric'}</dd>
            <dt>Data owner and cadence</dt><dd>{metric.owner} · {metric.cadence} · next release expected {metric.nextUpdate}</dd>
          </dl>
          <p>{result.attribution}. {metric.caveat}</p>
          <details><summary>Baseline and source version history for {metric.label}</summary>
            <ul>{metric.history.map(row => <li key={row.revision}>{row.period}: {row.value} {row.unit} · {row.population} · revision {row.revision} · source version {row.sourceVersion} · synthetic, no external source</li>)}</ul>
          </details>
        </article>;
      })}
    </details>
  </section>;
}
