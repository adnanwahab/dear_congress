import { describe, expect, test } from "bun:test";
import type { SimulationSnapshot } from "../engine/types";
import { livingCityUrl } from "./living-city-link";

const snapshot = {
  id: "sim_public123", location: { lat: 29.72, lng: -95.47 },
  entryId: "private-entry", needs: [{ label: "Private journal content" }],
  plan: { label: "Private proposal title" },
} as unknown as SimulationSnapshot;

describe("Living City handoff", () => {
  test("keeps only location, seed and opaque snapshot provenance without legacy autorun", () => {
    const url = new URL(livingCityUrl("https://hbl.test/", snapshot, 0));
    expect(url.pathname).toBe("/world");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      living: "1", seed: "0", source: "dear-congress", sourceSnapshot: "sim_public123", lat: "29.72", lng: "-95.47",
    });
    expect(url.href).not.toContain("private");
    expect(url.searchParams.has("simulation")).toBe(false);
  });

  test("uses the default district when location is absent or invalid", () => {
    for (const location of [null, { lat: NaN, lng: 0 }, { lat: 91, lng: 0 }]) {
      const url = new URL(livingCityUrl("https://hbl.test", { ...snapshot, location }, 4294967295));
      expect(url.searchParams.has("lat")).toBe(false);
      expect(url.searchParams.has("lng")).toBe(false);
      expect(url.searchParams.get("seed")).toBe("4294967295");
    }
    for (const seed of [-1, NaN, Infinity, 0.5, 4294967296]) {
      expect(() => livingCityUrl("https://hbl.test", snapshot, seed)).toThrow();
    }
  });
});
