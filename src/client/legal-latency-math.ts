/** A historical correspondence benchmark, not legislative enactment latency. */
export const HISTORICAL_DAYS = 40;
export const HISTORICAL_MS = HISTORICAL_DAYS * 24 * 60 * 60 * 1000;

/** Mathematical comparison of the duration of two communication round trips. */
export function durationRatio(networkRttMs: number): number {
  if (!Number.isFinite(networkRttMs) || networkRttMs <= 0) {
    throw new RangeError('A round-trip duration must be finite and positive');
  }
  return Math.round(HISTORICAL_MS / networkRttMs);
}

/** Time position on a log axis from 1 millisecond to the historical benchmark. */
export function logPosition(durationMs: number): number {
  if (!Number.isFinite(durationMs) || durationMs <= 0) {
    throw new RangeError('A duration must be finite and positive');
  }
  const fraction = Math.log10(Math.max(durationMs, 1)) / Math.log10(HISTORICAL_MS);
  return Math.max(0, Math.min(100, fraction * 100));
}
