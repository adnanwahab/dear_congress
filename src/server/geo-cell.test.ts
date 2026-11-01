import { describe, expect, test } from "bun:test";
import { cellCoord, storeRealCoord, storeSimulatedCoord } from "./geo-cell";

describe("cellCoord", () => {
  test("is idempotent for all 2-decimal values from -180.00 to 180.00", () => {
    for (let i = -18000; i <= 18000; i++) {
      const v = i / 100;
      const once = cellCoord(v);
      const twice = cellCoord(once);
      expect(twice).toBe(once);
    }
  });

  test("for 10,000 random points, real/simulated storage preserves 0.01° cell", () => {
    for (let i = 0; i < 10_000; i++) {
      const lat = -90 + Math.random() * 180;
      const lng = -180 + Math.random() * 360;
      expect(cellCoord(storeSimulatedCoord(lat))).toBe(cellCoord(lat));
      expect(cellCoord(storeSimulatedCoord(lng))).toBe(cellCoord(lng));
      expect(cellCoord(storeRealCoord(lat))).toBe(cellCoord(lat));
      expect(cellCoord(storeRealCoord(lng))).toBe(cellCoord(lng));
    }
  });
});
