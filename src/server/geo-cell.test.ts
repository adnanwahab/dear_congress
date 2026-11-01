import { describe, expect, test } from "bun:test";
import { cellCoord } from "./geo-cell";

describe("cellCoord", () => {
  test("is idempotent for all 2-decimal values from -180.00 to 180.00", () => {
    for (let i = -18000; i <= 18000; i++) {
      const v = i / 100;
      const once = cellCoord(v);
      const twice = cellCoord(once);
      expect(twice).toBe(once);
    }
  });
});
