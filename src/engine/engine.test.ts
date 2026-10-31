import { describe, expect, test } from "bun:test";
import { buildContext, clusterAnswer, DEFAULT_WEIGHTS, emptyDB, extract, makePopulation, synthesize } from "./engine";
import { NEEDS, PROPOSALS, SEED_JOURNALS } from "./catalog";

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

describe("real-vote blending", () => {
  test("single real proposal vote does not dominate support", () => {
    const db = seeded();
    const proposalId = "fx_taxcut";
    const voters = makePopulation(32, 7);

    const before = buildContext(db, voters).stats[proposalId]!.support;
    db.votesByVoter = {
      voter1: {
        [proposalId]: {
          proposalId,
          stance: 2,
          importance: 1,
          acceptCompromise: true,
          concern: "",
          changeMind: "",
        },
      },
    };

    const after = buildContext(db, voters).stats[proposalId]!.support;
    expect(after - before).toBeLessThan(0.15);
  });

  test("mechanism shares remain normalized within each need with real answers", () => {
    const db = seeded();
    db.answers = [
      { id: "a1", needId: "housing", proposalId: "h_vouchers", text: "vouchers", createdAt: "", voterId: "v1" },
      { id: "a2", needId: "housing", proposalId: "h_vouchers", text: "rent help", createdAt: "", voterId: "v2" },
      { id: "a3", needId: "housing", proposalId: "h_lots", text: "zoning", createdAt: "", voterId: "v3" },
      { id: "a4", needId: "transit", proposalId: "t_bus", text: "bus", createdAt: "", voterId: "v4" },
    ];

    const ctx = buildContext(db, makePopulation(64, 9));
    const housingIds = ctx.proposals.filter((p) => p.needId === "housing").map((p) => p.id);
    const sum = housingIds.reduce((s, id) => s + (ctx.mechanismShare[id] ?? 0), 0);

    expect(sum).toBeGreaterThan(0.98);
    expect(sum).toBeLessThan(1.02);
  });

  test("goal blending uses per-need real vote count", () => {
    const db = seeded();
    const voters = makePopulation(32, 5);
    const needId = NEEDS[0]!.id;

    const before = buildContext(db, voters).goalSupport[needId]!;
    db.goalVotesByVoter = { v1: { [needId]: true } };
    const after = buildContext(db, voters).goalSupport[needId]!;

    expect(Math.abs(after - before)).toBeLessThan(0.2);
  });
});
