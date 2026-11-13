import { describe, expect, test } from "bun:test";
import { emptyDB, extract } from "../engine/engine";
import { SEED_JOURNALS } from "../engine/catalog";
import { createPolicyComparison, storePolicyComparison } from "./policy-comparison";

function fixture() {
  const db = emptyDB();
  db.entries = SEED_JOURNALS.map((entry, i) => ({ ...entry, id: `private-${i}`, createdAt: "2026-01-01T00:00:00.000Z", extraction: extract(entry.text), corrected: false, location: { lat: 29.72, lng: -95.47 } }));
  db.lastPlan = { A: ["sentinel"] };
  return db;
}
describe("frozen A/B input pilot", () => {
  test("repeat capture hashes identically, shares 100 explicit seeds including wraparound, and preserves all state", () => {
    const db = fixture();
    const before = structuredClone(db);
    const a = createPolicyComparison(db, { a: "A", b: "B", seed: 0xffffffff });
    const b = createPolicyComparison(db, { seed: 0xffffffff, b: "B", a: "A" });
    expect(a).toEqual(b);
    expect(db).toEqual(before);
    expect(a.content.runSeeds).toHaveLength(100);
    expect(new Set(a.content.runSeeds).size).toBe(100);
    expect(a.content.runSeeds.slice(0, 3)).toEqual([0xffffffff, 0, 1]);
    expect(a.content.horizons).toEqual([1, 5, 10]);
    expect(a.content.modelVersion).toBeNull();
    const json = JSON.stringify(a);
    for (const entry of db.entries) expect(json).not.toContain(entry.text);
    expect(json).not.toContain("private-0");
    expect(json).not.toContain("29.72");
    expect(json).not.toContain("votesByVoter");
    expect(createPolicyComparison(db, { a: "A", b: "B", seed: 0 }).inputHash).not.toBe(a.inputHash);
    expect(createPolicyComparison(db, { a: "B", b: "A", seed: 0xffffffff }).inputHash).not.toBe(a.inputHash);
  });
  test("identical packages and persisted replay remain exact after live input changes", () => {
    const db = fixture();
    const result = createPolicyComparison(db, { a: "A", b: "A" });
    expect(result.content.worlds[0]).toEqual(result.content.worlds[1]);
    storePolicyComparison(db, result);
    storePolicyComparison(db, result);
    expect(db.policyComparisons).toHaveLength(1);
    db.entries = [];
    db.lastPlan = {};
    const restarted = JSON.parse(JSON.stringify(db));
    expect(restarted.policyComparisons[0]).toEqual(result);
  });
  test("rejects unsupported settings and invalid input before any storage", () => {
    const db = fixture();
    for (const body of [null, [], {}, { a: "A", b: "B", seed: null }, { a: "A", b: "B", seed: -1 }, { a: "A", b: "B", seed: 2 ** 32 }, { a: "A", b: "B", seed: 1.5 }, { a: "A", b: "B", seed: "42" }, { a: "A", b: "wrong" }, { a: "A", b: "B", budget: 12 }]) {
      expect(() => createPolicyComparison(db, body)).toThrow();
    }
    expect(db.policyComparisons).toBeUndefined();
  });
  test("capacity rejects new records while retaining every existing replay", () => {
    const db = fixture();
    const item = createPolicyComparison(db, { a: "A", b: "B" });
    db.policyComparisons = Array.from({ length: 500 }, (_, i) => ({ ...item, id: `old-${i}` }));
    const before = structuredClone(db.policyComparisons);
    expect(() => storePolicyComparison(db, item)).toThrow("storage is full");
    expect(db.policyComparisons).toEqual(before);
  });
});
