import { describe, expect, it } from 'bun:test';
import { HISTORICAL_DAYS, HISTORICAL_MS, durationRatio, logPosition } from './legal-latency-math';

describe('the historical and illustrative latency comparison', () => {
  it('converts the documented 40-day mail round trip into milliseconds', () => {
    expect(HISTORICAL_DAYS).toBe(40);
    expect(HISTORICAL_MS).toBe(3_456_000_000);
  });

  it('recomputes the ratio when the adjustable network RTT changes', () => {
    expect(durationRatio(250)).toBe(13_824_000);
    expect(durationRatio(200)).toBe(17_280_000);
    expect(durationRatio(500)).toBe(6_912_000);
  });

  it('shows both durations on the same bounded logarithmic axis', () => {
    expect(logPosition(1)).toBe(0);
    expect(logPosition(HISTORICAL_MS)).toBe(100);
    expect(logPosition(250)).toBeGreaterThan(0);
    expect(logPosition(250)).toBeLessThan(logPosition(1_000));
    expect(logPosition(HISTORICAL_MS * 2)).toBe(100);
  });

  it('rejects invalid durations rather than displaying fabricated ratios', () => {
    expect(() => durationRatio(0)).toThrow(RangeError);
    expect(() => durationRatio(NaN)).toThrow(RangeError);
    expect(() => logPosition(-1)).toThrow(RangeError);
  });
});
