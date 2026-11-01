import { describe, expect, test } from "bun:test";
import { addSeriesSeverity, mergeOutcomes, percentileRank } from "./outcomes";

describe("outcomes helpers", () => {
  test("percentile severity ranks higher values as worse", () => {
    const rows = addSeriesSeverity([
      { year: 2020, value: 10 },
      { year: 2021, value: 20 },
      { year: 2022, value: 30 },
      { year: 2023, value: 40 },
    ]);
    expect(rows.find((r) => r.year === 2020)?.severity).toBe(0);
    expect(rows.find((r) => r.year === 2023)?.severity).toBe(1);
    expect(percentileRank([10, 20, 30, 40], 30)).toBeGreaterThan(0.6);
  });

  test("mergeOutcomes lets request outcomes override measured", () => {
    const measured = { needs: { flooding: { severity: 0.2 }, transit: { severity: 0.1 } } };
    const request = { needs: { flooding: { severity: 0.9 } }, items: { t_bus: { impact: 0.5 } } };
    const merged = mergeOutcomes(measured, request)!;
    expect(merged.needs?.flooding?.severity).toBe(0.9);
    expect(merged.needs?.transit?.severity).toBe(0.1);
    expect(merged.items?.t_bus?.impact).toBe(0.5);
  });
});
