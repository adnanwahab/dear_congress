import { describe, expect, test } from "bun:test";
import { buildContext, clusterAnswer, DEFAULT_WEIGHTS, emptyDB, extract, hasKeyword, makePopulation, synthesize } from "./engine";
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
  test("keywords don't fire inside other words", () => {
    const ids = (t: string) => extract(t).needs.map((n) => n.id);
    expect(ids("Please fix the pothole on our street.")).toEqual(["streets"]); // not housing via p-LEASE
    expect(ids("My parents are getting older.")).toEqual([]);                   // not housing via pa-RENT-s
    expect(ids("Running a business is hard.")).toEqual([]);                     // not transit via BUS-iness
    expect(ids("We had a brainstorm at work.")).toEqual([]);                    // not flooding via brain-STORM
    expect(ids("The current situation is different now.")).toEqual([]);
  });
  test("keywords still match their real word forms", () => {
    expect(hasKeyword("we got an eviction notice", "evict")).toBe(true);
    expect(hasKeyword("childcare subsidies please", "subsid")).toBe(true);
    expect(hasKeyword("the rent went up", "rent")).toBe(true);
    expect(hasKeyword("we rented a place", "rent")).toBe(true);
    expect(hasKeyword("more buses please", "bus")).toBe(true);
    expect(hasKeyword("i'm busy", "bus")).toBe(false);
    expect(hasKeyword("an adult", "adu")).toBe(false);
    expect(hasKeyword("i called 311 again", "311")).toBe(true);
    expect(hasKeyword("pre-k costs a lot", "pre-k")).toBe(true);
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

describe("synthetic journals", () => {
  const FLOOD = "The bayou flooded our street again during the storm. Water came into the house for the third time since Harvey. We're scared every time it rains and can't afford to keep rebuilding!";
  const withSimulated = (n: number) => {
    const db = seeded();
    for (let i = 0; i < n; i++) {
      db.entries.push({ id: `sim${i}`, author: "Simulated resident", text: FLOOD, createdAt: "", extraction: extract(FLOOD), corrected: false, synthetic: true, source: "happybearlandia-world" });
    }
    return db;
  };
  const balanced = (db: ReturnType<typeof seeded>, includeSynthetic?: boolean) =>
    synthesize(buildContext(db, undefined, { includeSynthetic }), DEFAULT_WEIGHTS, 0.25, 40)[0]!.items.map((i) => i.proposal.id);

  test("don't count toward needs by default", () => {
    expect(balanced(withSimulated(5))).toEqual(balanced(seeded()));
    const ctx = buildContext(withSimulated(5));
    expect(ctx.demand.flooding!.journalCount).toBe(buildContext(seeded()).demand.flooding!.journalCount);
    expect(ctx.entries.some((e) => e.synthetic)).toBe(false);
  });

  test("do count when includeSynthetic is on", () => {
    const baseCtx = buildContext(seeded());
    const ctx = buildContext(withSimulated(1), undefined, { includeSynthetic: true });
    expect(ctx.demand.flooding!.journalCount).toBe(baseCtx.demand.flooding!.journalCount + 1);
    expect(ctx.demand.flooding!.demand).toBeGreaterThanOrEqual(baseCtx.demand.flooding!.demand);
    expect(balanced(withSimulated(1), true).length).toBeGreaterThan(0);
  });
});

describe("stabilized synthesis", () => {
  const FLOOD = "The bayou flooded our street again during the storm. Water came into the house for the third time since Harvey. We're scared every time it rains and can't afford to keep rebuilding!";
  const BUS = "The bus to work takes over an hour and only comes every 40 minutes. I'm exhausted. Give us more buses and a dedicated bus lane!";
  const RENT = "Rent went up again, it's half my income. Let them build more townhomes and get rid of the parking minimum and lot size rules!";
  const POTHOLE = "The pothole on our street has been there for months and the streetlight is out again. I reported it to 311 three times.";

  const withEntry = (text: string) => {
    const db = seeded();
    db.entries.push({ id: crypto.randomUUID(), author: "test", text, createdAt: "", extraction: extract(text), corrected: false });
    return db;
  };

  const balancedIds = (db: ReturnType<typeof seeded>, previous?: Record<string, string[]>) =>
    synthesize(buildContext(db), DEFAULT_WEIGHTS, 0.25, 40, previous)[0]!.items.map((i) => i.proposal.id);

  test("stability: one journal causes at most small churn with previous plan", () => {
    const base = seeded();
    const previous = { A: balancedIds(base) };

    for (const text of [FLOOD, BUS, RENT, POTHOLE]) {
      const pkg = synthesize(buildContext(withEntry(text)), DEFAULT_WEIGHTS, 0.25, 40, previous)[0]!;
      expect(pkg.changesFromPrevious.added.length + pkg.changesFromPrevious.removed.length).toBeLessThanOrEqual(2);
      expect(pkg.changesFromPrevious.moneyMovedB).toBeLessThan(10);
    }
  });

  test("independence: one bus journal does not reduce unrelated need demand", () => {
    const base = buildContext(seeded()).demand;
    const next = buildContext(withEntry(BUS)).demand;

    expect(next.childcare!.demand).toBeGreaterThanOrEqual(base.childcare!.demand);
    expect(next.flooding!.demand).toBeGreaterThanOrEqual(base.flooding!.demand);
    expect(next.housing!.demand).toBeGreaterThanOrEqual(base.housing!.demand);
  });

  test("responsiveness: several flood journals pull in flood mitigation", () => {
    const db = seeded();
    for (let i = 0; i < 5; i++) db.entries.push({ id: `f${i}`, author: "flood", text: FLOOD, createdAt: "", extraction: extract(FLOOD), corrected: false });
    const previous = { A: balancedIds(seeded()) };
    const ids = balancedIds(db, previous);
    expect(ids.some((id) => id === "f_buyouts" || id === "f_drainage")).toBe(true);
  });

  test("hysteresis is bounded: incumbents below support floor are still dropped", () => {
    const db = seeded();
    const previous = { A: balancedIds(db) };
    const target = previous.A[0]!;

    for (let i = 0; i < 500; i++) {
      db.votesByVoter[`v${i}`] = {
        [target]: { proposalId: target, stance: -2, importance: 1, acceptCompromise: false, concern: "", changeMind: "" },
      };
    }

    const ctx = buildContext(db);
    expect(ctx.stats[target]!.support).toBeLessThan(0.3);

    const ids = balancedIds(db, previous);
    expect(ids).not.toContain(target);
  });

  test("determinism: same input yields same package", () => {
    const db = seeded();
    db.entries.push({ id: "bus", author: "x", text: BUS, createdAt: "", extraction: extract(BUS), corrected: false });
    const previous = { A: balancedIds(seeded()) };
    const first = synthesize(buildContext(db), DEFAULT_WEIGHTS, 0.25, 40, previous)[0]!;
    const second = synthesize(buildContext(db), DEFAULT_WEIGHTS, 0.25, 40, previous)[0]!;
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
  });
});

describe("what-if extra entries", () => {
  const FLOOD = "The bayou flooded our street again during the storm. Water came into the house for the third time since Harvey. We're scared every time it rains and can't afford to keep rebuilding!";

  test("flood extraEntries can pull f_buyouts into Balanced and do not mutate db.entries", () => {
    const db = seeded();
    const beforeLen = db.entries.length;

    const baseCtx = buildContext(db);
    const baseIds = synthesize(baseCtx, DEFAULT_WEIGHTS, 0.25, 20)[0]!.items.map((i) => i.proposal.id);

    const extraEntries = Array.from({ length: 8 }, (_, i) => ({
      id: `extra_${i}`,
      author: "What-if resident",
      text: FLOOD,
      createdAt: "",
      extraction: extract(FLOOD),
      corrected: false,
      synthetic: true as const,
      source: "what-if",
    }));

    const withExtraCtx = buildContext(db, undefined, { includeSynthetic: false, extraEntries });
    const withExtraIds = synthesize(withExtraCtx, DEFAULT_WEIGHTS, 0.25, 20)[0]!.items.map((i) => i.proposal.id);

    expect(withExtraCtx.demand.flooding!.journalCount).toBe(baseCtx.demand.flooding!.journalCount + 8);
    expect(baseIds).not.toContain("f_buyouts");
    expect(withExtraIds).toContain("f_buyouts");
    expect(db.entries.length).toBe(beforeLen);
  });
});
