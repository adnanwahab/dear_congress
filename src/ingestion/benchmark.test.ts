import { expect, test } from "bun:test";
import { benchmark } from "./benchmark";

test("benchmark reconciles synthetic pipeline and labels modeled curves separately", () => {
  const report = benchmark(40);
  expect(report).toMatchObject({ events: 40, duplicates: 2, reconciled: true });
  expect(report.completedPerSecond).toBeGreaterThan(0);
  expect(report.modeledOnly[2]).toMatchObject({ daily: 300000000, payloadGBPerDay: 614.4, monthlySensitivityUSD: [9300, 90300, 900300] });
  expect(report.limitation).toContain("Not a 24-hour soak");
  for (const n of [0, -1, NaN, 1.5, 1000001]) expect(() => benchmark(n)).toThrow();
});
