import { describe, expect, test } from "bun:test";
import { NEEDS } from "../engine/catalog";
import { buildContext, DEFAULT_WEIGHTS, emptyDB, extract, synthesize } from "../engine/engine";
import type { DB, NeedDef } from "../engine/types";
import { findNeedByLabel, mergeDuplicateNeeds, normalizeNeedLabel } from "./need-dedupe";

const need = (id: string, label: string): NeedDef => ({
  id, label, value: "Community wellbeing", goal: "Ensure all residents have reliable access to nutritious food",
  metric: "", level: "To be determined", keywords: [], emergent: true,
});

/** What the live site has: the catalog need plus two emergent copies, each holding its own signal. */
const splitDB = (): DB => {
  const db = emptyDB();
  db.emergentNeeds = [need("emergent_need_food_access_1", "Food access"), need("emergent_need_test_synthetic_2", "Test Synthetic"), need("emergent_need_food_access_3", "food  ACCESS")];
  db.entries = [
    { id: "e1", author: "a", text: "We can't get to a store", createdAt: "", extraction: { needs: [{ id: "emergent_need_food_access_1", confidence: 1 }], importance: 0.5, concerns: [], constraints: [], proposalIds: [] }, corrected: false },
    { id: "e2", author: "b", text: "fridge empty", createdAt: "", extraction: { needs: [{ id: "food_access", confidence: 0.65 }, { id: "emergent_need_food_access_3", confidence: 1 }], importance: 0.5, concerns: [], constraints: [], proposalIds: [] }, corrected: false },
  ];
  db.emergent = [{ id: "emergent_1", needId: "emergent_need_food_access_3", title: "yay", mechanism: "To be determined", authority: "Unassigned", jurisdiction: "Unassigned", costB: null, changeLevel: 3, reversibility: 0.5, evidence: 0.3, effectiveness: 0.5, keywords: [], metrics: [], legalChange: "Needs legal analysis", emergent: true }];
  db.answers = [{ id: "a1", needId: "emergent_need_food_access_3", text: "yay", proposalId: "emergent_1", createdAt: "", voterId: "v1" }];
  db.goalVotesByVoter = { v1: { emergent_need_food_access_3: true }, v2: { food_access: false, emergent_need_food_access_1: true } };
  db.allocationByVoter = { v1: { food_access: 10, emergent_need_food_access_1: 15, emergent_need_food_access_3: 5 } };
  return db;
};

describe("duplicate need labels", () => {
  test("labels match across case, spacing, punctuation and &/and", () => {
    expect(normalizeNeedLabel("  Food   ACCESS! ")).toBe("food access");
    expect(normalizeNeedLabel("Lower taxes & fiscal restraint")).toBe(normalizeNeedLabel("lower taxes and fiscal restraint"));
    expect(findNeedByLabel("food access", NEEDS)?.id).toBe("food_access");
    expect(findNeedByLabel("Food security", NEEDS)).toBeUndefined();
  });

  test("merging folds every copy into the catalog need and keeps unrelated needs", () => {
    const db = splitDB();
    const remap = mergeDuplicateNeeds(db, NEEDS);
    expect(remap).toEqual({ emergent_need_food_access_1: "food_access", emergent_need_food_access_3: "food_access" });
    expect(db.emergentNeeds.map((n) => n.id)).toEqual(["emergent_need_test_synthetic_2"]);
    expect(db.entries[0]!.extraction.needs).toEqual([{ id: "food_access", confidence: 1 }]);
    expect(db.entries[1]!.extraction.needs).toEqual([{ id: "food_access", confidence: 1 }]);
    expect(db.emergent[0]!.needId).toBe("food_access");
    expect(db.answers[0]!.needId).toBe("food_access");
  });

  test("goal votes carry over unless the voter already voted on the catalog goal; points add up", () => {
    const db = splitDB();
    mergeDuplicateNeeds(db, NEEDS);
    expect(db.goalVotesByVoter.v1).toEqual({ food_access: true });
    expect(db.goalVotesByVoter.v2).toEqual({ food_access: false });
    expect(db.allocationByVoter.v1).toEqual({ food_access: 30 });
  });

  test("merging is idempotent", () => {
    const db = splitDB();
    mergeDuplicateNeeds(db, NEEDS);
    const once = JSON.stringify(db);
    expect(mergeDuplicateNeeds(db, NEEDS)).toEqual({});
    expect(JSON.stringify(db)).toBe(once);
  });

  test("after merging, food journals count toward the need that has grocery delivery", () => {
    const db = splitDB();
    const before = buildContext(db).demand.food_access!.journalCount;
    mergeDuplicateNeeds(db, NEEDS);
    expect(buildContext(db).demand.food_access!.journalCount).toBeGreaterThan(before);
    const [pkg] = synthesize(buildContext(db), DEFAULT_WEIGHTS, 0.25, 40);
    const ranked = [...pkg!.items.map((i) => i.proposal.id), ...pkg!.deferred.map((d) => d.id), ...pkg!.waiting.map((w) => w.id)];
    expect(ranked).toContain("g_delivery");
  });

  test("food journals phrased around nutrition reach the catalog need directly", () => {
    expect(extract("Ensure all residents have reliable access to nutritious food").needs.map((n) => n.id)).toContain("food_access");
  });
});
