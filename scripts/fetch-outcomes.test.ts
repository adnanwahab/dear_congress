import { describe, expect, test } from "bun:test";
import { buildOutcomesFile } from "./fetch-outcomes";

describe("fetch-outcomes", () => {
  test("on fetch failure, keeps last good value and records error", async () => {
    const previous = {
      generatedAt: "2026-01-01T00:00:00.000Z",
      series: [
        {
          needId: "flooding",
          value: 123,
          unit: "claims/year (3-year avg)",
          year: 2024,
          severity: 0.8,
          source: { name: "prev", url: "https://example.test" },
          fetchedAt: "2026-01-01T00:00:00.000Z",
        },
      ],
      errors: [],
    };

    const badFetch = async () => new Response("fail", { status: 500 });
    const { file } = await buildOutcomesFile(previous as any, badFetch as any);

    const flood = file.series.find((r) => r.needId === "flooding");
    expect(flood?.value).toBe(123);
    expect((file.errors ?? []).length).toBeGreaterThan(0);
  });
});
