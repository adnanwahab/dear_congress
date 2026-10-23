import { describe, expect, test } from "bun:test";
import { buildContext, clusterAnswer, DEFAULT_WEIGHTS, emptyDB, extract, synthesize } from "./engine";
import { PROPOSALS, SEED_JOURNALS } from "./catalog";

const seeded = () => {
  const db = emptyDB();
  db.entries = SEED_JOURNALS.map((s, i) => ({ id: String(i), author: s.author, text: s.text, createdAt: "", extraction: extract(s.text), corrected: false, seeded: true }));
  return db;
};

describe("extract", () => {
  test("finds childcare need and constraint", () => {
    const e = extract(SEED_JOURNALS[0]!.text);
    expect(e.needs[0]!.id).toBe("childcare");
    expect(e.constraints.join()).toContain("stop working");
    expect(e.importance).toBeGreaterThan(0.6);
  });
  test("every seed journal maps to at least one need", () => {
    for (const s of SEED_JOURNALS) expect(extract(s.text).needs.length).toBeGreaterThan(0);
  });
});

describe("clusterAnswer", () => {
  test("groups a tax-credit idea", () => {
    expect(clusterAnswer("Increase the child tax credit", "childcare", PROPOSALS)).toBe("cc_credit");
  });
  test("unrelated idea becomes new", () => {
    expect(clusterAnswer("Employers should offer on-site nap pods", "childcare", PROPOSALS)).toBeNull();
  });
});

describe("synthesize", () => {
  const ctx = buildContext(seeded());
  const [a, b, c] = synthesize(ctx, DEFAULT_WEIGHTS, 0.25, 40);
  test("respects budget", () => {
    for (const p of [a!, b!, c!]) expect(p.totalCost).toBeLessThanOrEqual(40);
  });
  test("never selects rights-violating proposals", () => {
    for (const p of [a!, b!, c!]) {
      expect(p.items.some((i) => i.proposal.rightsIssue)).toBe(false);
      expect(p.blocked.length).toBe(1);
    }
  });
  test("minimal-change package is less disruptive", () => {
    expect(b!.avgChange).toBeLessThanOrEqual(a!.avgChange);
  });
});
