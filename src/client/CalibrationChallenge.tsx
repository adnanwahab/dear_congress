import type { LawBehaviorReceipt } from './LawBehaviorExplorer';

/** No public series is allowlisted until its definition and provenance are reviewed.
 * Similar labels, fractions, or calendar durations do not establish comparability. */
export function calibrationReceipt(receipt: LawBehaviorReceipt, metric: string, unit: string) {
  return {
    schemaVersion: 'civic-calibration-gap.v1',
    sourceRepository: 'adnanwahab/dear_congress',
    sourceDataMode: 'synthetic-model; no matched public observation',
    seed: receipt.manifest?.seed ?? null,
    modelVersion: receipt.manifest?.modelVersion ?? null,
    horizon: { start: receipt.manifest?.start ?? null, end: receipt.manifest?.end ?? null, clock: receipt.unit ?? null },
    inputs: { lawId: receipt.law.number, implementationStrength: receipt.manifest?.implementationStrength ?? null, population: receipt.manifest?.population ?? null },
    observable: { metric, unit, scope: receipt.manifest?.scope ?? 'unavailable' },
    status: 'data-gap',
    observation: null,
    fit: null,
    uncertainty: 'Synthetic scope and clock have no reviewed mapping to a real population and calendar period; model discrepancy and sampling uncertainty are unquantified.',
    modelReceipt: receipt,
  } as const;
}

export function CalibrationChallenge({ receipt, metric, unit }: { receipt: LawBehaviorReceipt; metric: string; unit: string }) {
  const audit = calibrationReceipt(receipt, metric, unit);
  return <section aria-label="Model versus observation calibration">
    <h4>Model versus observation</h4>
    <p>Source data mode: {audit.sourceDataMode}. Seed {audit.seed ?? 'unavailable'}; model version {audit.modelVersion ?? 'unavailable'}; horizon {audit.horizon.start ?? 'unavailable'}–{audit.horizon.end ?? 'unavailable'} {audit.horizon.clock ?? 'clock unavailable'}.</p>
    <p>Selected observable: {metric || 'unavailable'} ({unit}). Scope: {audit.observable.scope}.</p>
    <p role="status">Data gap: no reviewed public measurement matches this observable’s definition, unit, population scope and calendar time frame. Fit score and residual: unavailable. Missing evidence does not mean zero discrepancy.</p>
    <table>
      <caption>Why the repository’s starter measurements cannot be paired</caption>
      <thead><tr><th scope="col">Candidate source</th><th scope="col">Mismatch</th></tr></thead>
      <tbody>
        <tr><th scope="row">Census ACS B08303</th><td>Annual Harris County share of workers commuting 60+ minutes; not synthetic minutes per trip, trips, or a housing observable.</td></tr>
        <tr><th scope="row">OpenFEMA NFIP claims</th><td>Harris County insurance claims per year (three-year average); no matching claims observable in these models.</td></tr>
        <tr><th scope="row">Houston 311</th><td>Annual median days to close street requests; not modeled housing permits or synthetic travel time.</td></tr>
      </tbody>
    </table>
    <p>These are source descriptions from the local starter fixture, not independently verified measurements loaded into this comparison. No public values are used to tune the model.</p>
    <p>Major uncertainty: {audit.uncertainty} A close fit to one matched measurement would not validate other predictions or establish a causal policy effect. Modeled effects are illustrative, not forecasts.</p>
    <details><summary>Reproducible calibration gap receipt (JSON)</summary>
      <p>Contains the exact recorded synthetic checkpoints and allowlisted run inputs. Replaying the recorded display requires no new model run; a fresh provider run can differ if the model version changes.</p>
      <pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{JSON.stringify(audit, null, 2)}</pre>
    </details>
  </section>;
}
