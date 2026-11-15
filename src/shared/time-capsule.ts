import { SYNTHETIC_METRICS } from './policy-measurements';

export interface CapsuleDraft { metricId: string; jurisdiction: string; horizon: string; target: string; prediction: string }
export interface CapsuleReceipt {
  readonly kind: 'synthetic-session-forecast.v1';
  readonly sealedAt: string;
  readonly visibility: 'private-session';
  readonly metricId: string;
  readonly metric: string;
  readonly jurisdiction: string;
  readonly horizon: string;
  readonly target: number;
  readonly direction: 'lower' | 'higher';
  readonly prediction: string;
  readonly baseline: Readonly<{ revision: string; period: string; value: number; unit: string; population: string; sourceVersion: string }>;
}
export function sealSessionForecast(draft: CapsuleDraft, now = new Date()): CapsuleReceipt {
  const metric = SYNTHETIC_METRICS.find(row => row.id === draft.metricId);
  const baseline = metric?.history.find(row => row.revision === metric.baselineRevision);
  const horizon = new Date(`${draft.horizon}T00:00:00.000Z`);
  if (!metric || !baseline || draft.jurisdiction !== 'Fictional transit pilot' ||
      !/^\d{4}-\d{2}-\d{2}$/.test(draft.horizon) || !Number.isFinite(horizon.getTime()) ||
      horizon.toISOString().slice(0, 10) !== draft.horizon || horizon <= now ||
      !draft.target.trim() || !Number.isFinite(Number(draft.target)) ||
      !draft.prediction.trim() || draft.prediction.trim().length > 1000) {
    throw new Error('Select a metric and fictional jurisdiction, a valid future UTC date, a finite target and a prediction of at most 1000 characters.');
  }
  return Object.freeze({ kind: 'synthetic-session-forecast.v1', sealedAt: now.toISOString(),
    visibility: 'private-session', metricId: metric.id, metric: metric.label,
    jurisdiction: draft.jurisdiction, horizon: draft.horizon, target: Number(draft.target),
    direction: metric.direction, prediction: draft.prediction.trim(), baseline: Object.freeze({ ...baseline }) });
}
