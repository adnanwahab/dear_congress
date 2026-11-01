import { describe, expect, test } from "bun:test";
import {
  buildContext,
  CHURN_ESCALATION_RUNS,
  clusterAnswer,
  DEFAULT_WEIGHTS,
  emptyDB,
  extract,
  hasKeyword,
  JOURNAL_HALF_LIFE_DAYS,
  makePopulation,
  scoreAll,
  STABILITY_BONUS,
  synthesize,
  synthesizePackage,
} from "./engine";
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

  test("seeded Balanced baseline at $40B is the pre-Fix-B 10-item plan", () => {
    const ids = a!.items.map((i) => i.proposal.id);
    expect(ids.length).toBe(10);
    expect(ids).toContain("cc_subsidy");
    expect(ids).toContain("f_drainage");
    expect(ids).not.toContain("f_buyouts");
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

describe("journal recency weighting", () => {
  const FLOOD = "Our street flooded in the storm and the drainage couldn't keep up. I need a practical fix soon.";

  test("an entry JOURNAL_HALF_LIFE_DAYS old counts half as much as a new one", () => {
    const now = Date.parse("2028-01-01T00:00:00.000Z");
    const oldAt = new Date(now - JOURNAL_HALF_LIFE_DAYS * 24 * 60 * 60 * 1000).toISOString();
    const newAt = new Date(now).toISOString();

    const db = emptyDB();
    db.entries = [
      { id: "old", author: "x", text: FLOOD, createdAt: oldAt, extraction: extract(FLOOD), corrected: false },
      { id: "new", author: "x", text: FLOOD, createdAt: newAt, extraction: extract(FLOOD), corrected: false },
    ];

    const demand = buildContext(db, undefined, { now }).demand.flooding!;
    const ex = extract(FLOOD);
    const newContribution = ex.importance * ex.needs.find((n) => n.id === "flooding")!.confidence;
    const oldContribution = demand.journalScore - newContribution;

    expect(oldContribution).toBeGreaterThan(0);
    expect(newContribution).toBeGreaterThan(oldContribution);
    expect(oldContribution / newContribution).toBeGreaterThan(0.45);
    expect(oldContribution / newContribution).toBeLessThan(0.55);
  });

  test("seeded demand and plan are identical with now at seeded time and now + 3 years", () => {
    const db = seeded();
    const t = Date.parse("2028-01-01T00:00:00.000Z");
    const tIso = new Date(t).toISOString();
    db.entries = db.entries.map((e) => ({ ...e, createdAt: tIso }));

    const atTCtx = buildContext(db, undefined, { now: t });
    const atTPlus3Ctx = buildContext(db, undefined, { now: t + 3 * 365 * 24 * 60 * 60 * 1000 });

    expect(atTCtx.demand.flooding!.journalScore).toBe(atTPlus3Ctx.demand.flooding!.journalScore);
    expect(atTCtx.demand.transit!.journalScore).toBe(atTPlus3Ctx.demand.transit!.journalScore);

    const atT = synthesize(atTCtx, DEFAULT_WEIGHTS, 0.25, 40)[0]!.items.map((i) => i.proposal.id);
    const atTPlus3y = synthesize(atTPlus3Ctx, DEFAULT_WEIGHTS, 0.25, 40)[0]!.items.map((i) => i.proposal.id);

    expect(atT).toEqual(atTPlus3y);
    expect(atT.length).toBe(10);
    expect(atT).toContain("cc_subsidy");
    expect(atT).toContain("f_drainage");
    expect(atT).not.toContain("f_buyouts");
  });

  test("what-if extra entries age against request now, not newest stored entry", () => {
    const db = seeded();
    const t = Date.parse("2028-01-01T00:00:00.000Z");
    const tIso = new Date(t).toISOString();
    db.entries = db.entries.map((e) => ({ ...e, createdAt: tIso }));

    const extra = [{
      id: "x1",
      author: "what-if",
      text: FLOOD,
      createdAt: new Date(t).toISOString(),
      extraction: extract(FLOOD),
      corrected: false,
      synthetic: true as const,
      source: "what-if",
    }];

    const near = buildContext(db, undefined, { now: t, extraEntries: extra }).demand.flooding!.journalScore;
    const far = buildContext(db, undefined, { now: t + 3 * 365 * 24 * 60 * 60 * 1000, extraEntries: extra }).demand.flooding!.journalScore;
    expect(far).toBeLessThan(near);
  });
});

describe("outcomes severity weighting", () => {
  test("severity 0.8 keeps demand elevated across rounds and severity 0 falls back to baseline", () => {
    const db = seeded();
    const base = buildContext(db).demand.transit!.demand;

    const elevated: number[] = [];
    for (let round = 1; round <= 5; round++) {
      const d = buildContext(db, undefined, {
        outcomes: { needs: { transit: { severity: 0.8 } } },
      }).demand.transit!.demand;
      elevated.push(d);
    }

    expect(elevated.every((x) => x > base)).toBe(true);

    const zeroSeverity = buildContext(db, undefined, {
      outcomes: { needs: { transit: { severity: 0 } } },
    }).demand.transit!.demand;
    expect(zeroSeverity).toBe(base);
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

  const balancedPkg = (
    db: ReturnType<typeof seeded>,
    previous?: Record<string, string[]>,
    challengerStreak?: Record<string, Record<string, number>>,
    outcomes?: { needs?: Record<string, { severity: number }>; items?: Record<string, { impact: number; maturing?: boolean }> },
  ) => synthesize(buildContext(db, undefined, { outcomes }), DEFAULT_WEIGHTS, 0.25, 40, previous, challengerStreak)[0]!;

  const balancedIds = (
    db: ReturnType<typeof seeded>,
    previous?: Record<string, string[]>,
    challengerStreak?: Record<string, Record<string, number>>,
    outcomes?: { needs?: Record<string, { severity: number }>; items?: Record<string, { impact: number; maturing?: boolean }> },
  ) => balancedPkg(db, previous, challengerStreak, outcomes).items.map((i) => i.proposal.id);

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

  test("mixed rounds are churn-limited (<=3 items, <=$8B) and keep cc_subsidy through round 10", () => {
    const FLOOD_PROMPT = "Our street flooded in the storm and the drainage couldn't keep up. I need a practical fix soon.";
    const TRANSIT_PROMPT = "My commute keeps getting longer and I lose too much time each day. This keeps disrupting my daily life.";
    const GROCERY_PROMPT = "Khan Market had empty shelves when I arrived for groceries. This keeps disrupting my daily life.";

    const t0 = Date.parse("2028-01-01T00:00:00.000Z");
    let previous = { A: balancedIds(seeded()) };
    let challengerStreak: Record<string, Record<string, number>> = { A: {} };

    for (let round = 1; round <= 10; round++) {
      const db = seeded();
      const roundNow = t0 + (round - 1) * 365 * 24 * 60 * 60 * 1000;
      const roundIso = new Date(roundNow).toISOString();

      for (let i = 0; i < 4; i++) db.entries.push({ id: `f${round}-${i}`, author: "flood", text: FLOOD_PROMPT, createdAt: roundIso, extraction: extract(FLOOD_PROMPT), corrected: false });
      for (let i = 0; i < 6; i++) db.entries.push({ id: `t${round}-${i}`, author: "transit", text: TRANSIT_PROMPT, createdAt: roundIso, extraction: extract(TRANSIT_PROMPT), corrected: false });
      for (let i = 0; i < 2; i++) db.entries.push({ id: `g${round}-${i}`, author: "groceries", text: GROCERY_PROMPT, createdAt: roundIso, extraction: extract(GROCERY_PROMPT), corrected: false });

      const pkg = synthesize(buildContext(db, undefined, { now: roundNow }), DEFAULT_WEIGHTS, 0.25, 40, previous, challengerStreak)[0]!;
      const ids = pkg.items.map((i) => i.proposal.id);

      const changedItems = pkg.changesFromPrevious.added.length + pkg.changesFromPrevious.removed.length;
      expect(changedItems).toBeLessThanOrEqual(3);
      expect(pkg.changesFromPrevious.moneyMovedB).toBeLessThanOrEqual(8);
      expect(ids).toContain("cc_subsidy");

      previous = { A: ids };
      challengerStreak = { A: pkg.challengerStreak };
    }
  });

  test("churn escalation: run 3 allows major swap after 2 churn-limited waits", () => {
    const previous = { A: balancedIds(seeded()) };
    const prevSet = new Set(previous.A);

    const pickImpact = (predicate: (delta: number) => boolean) => {
      for (let x = 0; x <= 100; x++) {
        const impact = x / 100;
        const ctx = buildContext(seeded(), undefined, {
          outcomes: {
            needs: { transit: { severity: 1 }, flooding: { severity: 0 }, childcare: { severity: 0.01 } },
            items: { t_bus: { impact }, cc_subsidy: { impact: 0 } },
          },
        });
        const rows = scoreAll(ctx, DEFAULT_WEIGHTS, 0.25);
        const byId = new Map(rows.map((r) => [r.p.id, r.score]));
        const delta = (byId.get("t_bus") ?? 0) - (byId.get("cc_subsidy") ?? 0);
        if (predicate(delta)) return impact;
      }
      return null;
    };

    const impact = pickImpact((delta) => delta >= STABILITY_BONUS);
    expect(impact).not.toBeNull();

    let challengerStreak: Record<string, Record<string, number>> = { A: {} };
    let currentPrevious = { ...previous };

    for (let run = 1; run <= CHURN_ESCALATION_RUNS; run++) {
      const pkg = balancedPkg(
        seeded(),
        currentPrevious,
        challengerStreak,
        {
          needs: { transit: { severity: 1 }, flooding: { severity: 0 }, childcare: { severity: 0.01 } },
          items: { t_bus: { impact: impact! }, cc_subsidy: { impact: 0 } },
        },
      );
      const ids = pkg.items.map((i) => i.proposal.id);

      if (run < CHURN_ESCALATION_RUNS) {
        expect(ids).toContain("cc_subsidy");
        expect(ids).not.toContain("t_bus");
        expect(pkg.churnLimited).toBe(true);
        expect(pkg.waiting.some((w) => w.id === "t_bus" && w.reason === "churn-limited")).toBe(true);
      } else {
        expect(ids).toContain("t_bus");
        expect(ids).not.toContain("cc_subsidy");
        expect(pkg.majorChange).toBeDefined();
      }

      currentPrevious = { A: ids };
      challengerStreak = { A: pkg.challengerStreak };
    }

    expect(prevSet.has("cc_subsidy")).toBe(true);
  });

  test("challenger winning by less than STABILITY_BONUS never escalates", () => {
    const previous = { A: balancedIds(seeded()) };

    const pickImpact = (predicate: (delta: number) => boolean) => {
      for (let x = 0; x <= 100; x++) {
        const impact = x / 100;
        const ctx = buildContext(seeded(), undefined, {
          outcomes: {
            needs: { transit: { severity: 1 }, flooding: { severity: 0 }, childcare: { severity: 0.01 } },
            items: { t_bus: { impact }, cc_subsidy: { impact: 0 } },
          },
        });
        const rows = scoreAll(ctx, DEFAULT_WEIGHTS, 0.25);
        const byId = new Map(rows.map((r) => [r.p.id, r.score]));
        const delta = (byId.get("t_bus") ?? 0) - (byId.get("cc_subsidy") ?? 0);
        if (predicate(delta)) return impact;
      }
      return null;
    };

    const impact = pickImpact((delta) => delta > 0 && delta < STABILITY_BONUS);
    expect(impact).not.toBeNull();

    let challengerStreak: Record<string, Record<string, number>> = { A: {} };
    let currentPrevious = { ...previous };

    for (let run = 1; run <= CHURN_ESCALATION_RUNS + 2; run++) {
      const pkg = balancedPkg(
        seeded(),
        currentPrevious,
        challengerStreak,
        {
          needs: { transit: { severity: 1 }, flooding: { severity: 0 }, childcare: { severity: 0.01 } },
          items: { t_bus: { impact: impact! }, cc_subsidy: { impact: 0 } },
        },
      );
      const ids = pkg.items.map((i) => i.proposal.id);
      expect(ids).toContain("cc_subsidy");
      expect(ids).not.toContain("t_bus");
      expect(pkg.majorChange).toBeUndefined();
      currentPrevious = { A: ids };
      challengerStreak = { A: pkg.challengerStreak };
    }
  });

  test("margin sign matches rank comparison for selected and deferred", () => {
    const pkg = balancedPkg(seeded(), { A: balancedIds(seeded()) });
    const selectedMarginsOk = pkg.items.every((it) => it.margin >= -1e-9);
    const deferredMarginsOk = pkg.deferred.every((d) => d.margin >= -1e-9);
    expect(selectedMarginsOk).toBe(true);
    expect(deferredMarginsOk).toBe(true);
  });

  test("explanation arithmetic equals ranking score", () => {
    const pkg = balancedPkg(seeded(), { A: balancedIds(seeded()) });
    for (const it of pkg.items) {
      const sum = Object.values(it.explanation.parts).reduce((s, p) => s + p.contribution, 0);
      const expected = sum - it.explanation.changePenalty + it.explanation.stabilityBonus;
      expect(Math.abs(expected - it.explanation.total)).toBeLessThanOrEqual(1e-9);
      expect(Math.abs(it.explanation.total - (it.score + it.explanation.stabilityBonus))).toBeLessThanOrEqual(1e-9);
    }
  });

  test("ifDropped matches rerun without the item", () => {
    const db = seeded();
    const previous = { A: balancedIds(seeded()) };
    const ctx = buildContext(db);
    const pkg = synthesizePackage(ctx, {
      id: "A",
      name: "Balanced",
      description: "Your weights and change penalty",
      weights: DEFAULT_WEIGHTS,
      lambda: 0.25,
      budget: 40,
      previous: previous.A,
      challengerStreak: {},
    });

    const item = pkg.items[0]!;
    const alt = synthesizePackage(ctx, {
      id: "A",
      name: "Balanced",
      description: "Your weights and change penalty",
      weights: DEFAULT_WEIGHTS,
      lambda: 0.25,
      budget: 40,
      previous: previous.A,
      challengerStreak: {},
      excludeProposalId: item.proposal.id,
      _noExplain: true,
    });

    const keep = new Set(pkg.items.map((i) => i.proposal.id));
    keep.delete(item.proposal.id);
    const expectedAdd = alt.items.map((i) => i.proposal.id).filter((id) => !keep.has(id)).sort();
    const actualAdd = item.explanation.ifDropped.wouldAdd.map((x) => x.id).sort();

    expect(actualAdd).toEqual(expectedAdd);
    expect(item.explanation.ifDropped.freesB).toBe(item.proposal.costB ?? 0);
  });

  test("budget reasonDetail is readable and replaceIds free enough budget", () => {
    const pkg = balancedPkg(seeded(), { A: balancedIds(seeded()) });
    const d = pkg.deferred.find((x) => x.reason === "Doesn't fit the remaining budget");
    expect(d).toBeDefined();

    expect(d!.reasonDetail.startsWith("Would mean dropping ")).toBe(true);
    expect(d!.reasonDetail.endsWith(".")).toBe(true);
    expect(Array.isArray(d!.replaceIds)).toBe(true);
    expect((d!.replaceIds ?? []).length).toBeGreaterThan(0);

    const selectedCostById = new Map(pkg.items.map((i) => [i.proposal.id, i.proposal.costB ?? 0]));
    const freed = (d!.replaceIds ?? []).reduce((sum, id) => sum + (selectedCostById.get(id) ?? 0), 0);
    const needed = Math.max(0, d!.costB - (pkg.budget - pkg.totalCost));
    expect(freed + 1e-9).toBeGreaterThanOrEqual(needed);
  });

  test("maturing incumbent survives streak-5 challenger; after maturing requires impact >= 0.3", () => {
    const FLOOD_PROMPT = "Our street flooded in the storm and the drainage couldn't keep up. I need a practical fix soon.";
    const previous = { A: balancedIds(seeded()) };
    const challengerStreak: Record<string, Record<string, number>> = { A: { f_buyouts: 4 } };

    let removedIncumbent: string | null = null;
    let chosenDb: ReturnType<typeof seeded> | null = null;

    for (let n = 2; n <= 30; n++) {
      const db = seeded();
      for (let i = 0; i < n; i++) {
        db.entries.push({ id: `mf${n}-${i}`, author: "flood", text: FLOOD_PROMPT, createdAt: "", extraction: extract(FLOOD_PROMPT), corrected: false });
      }
      const pkg = balancedPkg(db, previous, challengerStreak);
      const ids = pkg.items.map((i) => i.proposal.id);
      const removed = previous.A.filter((id) => !ids.includes(id));
      if (ids.includes("f_buyouts") && removed.length) {
        removedIncumbent = removed[0]!;
        chosenDb = db;
        break;
      }
    }

    expect(removedIncumbent).not.toBeNull();
    expect(chosenDb).not.toBeNull();

    const pkgMaturing = balancedPkg(
      chosenDb!,
      previous,
      challengerStreak,
      { items: { [removedIncumbent!]: { impact: 0, maturing: true } } },
    );
    expect(pkgMaturing.items.map((i) => i.proposal.id)).toContain(removedIncumbent!);

    const pkgMatureNoImpact = balancedPkg(
      chosenDb!,
      previous,
      challengerStreak,
      { items: { [removedIncumbent!]: { impact: 0, maturing: false } } },
    );
    expect(pkgMatureNoImpact.items.map((i) => i.proposal.id)).not.toContain(removedIncumbent!);

    const pkgMatureHighImpact = balancedPkg(
      chosenDb!,
      previous,
      challengerStreak,
      { items: { [removedIncumbent!]: { impact: 0.5, maturing: false } } },
    );
    expect(pkgMatureHighImpact.items.map((i) => i.proposal.id)).toContain(removedIncumbent!);
  });

  test("incumbent with impact 0.5 is not displaced by a streak-2 challenger", () => {
    const FLOOD_PROMPT = "Our street flooded in the storm and the drainage couldn't keep up. I need a practical fix soon.";
    const previous = { A: balancedIds(seeded()) };
    const challengerStreak: Record<string, Record<string, number>> = { A: { f_buyouts: 1 } };

    let removedIncumbent: string | null = null;
    let chosenDb: ReturnType<typeof seeded> | null = null;

    for (let n = 2; n <= 20; n++) {
      const db = seeded();
      for (let i = 0; i < n; i++) {
        db.entries.push({ id: `f${n}-${i}`, author: "flood", text: FLOOD_PROMPT, createdAt: "", extraction: extract(FLOOD_PROMPT), corrected: false });
      }
      const pkg = balancedPkg(db, previous, challengerStreak);
      const ids = pkg.items.map((i) => i.proposal.id);
      if (!ids.includes("f_buyouts")) continue;
      const removed = previous.A.filter((id) => !ids.includes(id));
      if (removed.length) {
        removedIncumbent = removed[0]!;
        chosenDb = db;
        break;
      }
    }

    expect(removedIncumbent).not.toBeNull();
    expect(chosenDb).not.toBeNull();

    const pkgWithImpact = balancedPkg(
      chosenDb!,
      previous,
      challengerStreak,
      { items: { [removedIncumbent!]: { impact: 0.5 } } },
    );
    const idsWithImpact = pkgWithImpact.items.map((i) => i.proposal.id);
    expect(idsWithImpact).toContain(removedIncumbent!);
  });

  test("responsiveness: flood journals can pull in f_buyouts within a small N", () => {
    const FLOOD_PROMPT = "Our street flooded in the storm and the drainage couldn't keep up. I need a practical fix soon.";

    let nToFlip: number | null = null;
    for (let n = 1; n <= 10; n++) {
      let previous = { A: balancedIds(seeded()) };
      let challengerStreak: Record<string, Record<string, number>> = { A: {} };
      let flipped = false;

      for (let round = 1; round <= 2; round++) {
        const db = seeded();
        for (let i = 0; i < n; i++) {
          db.entries.push({ id: `f${n}-${round}-${i}`, author: "flood", text: FLOOD_PROMPT, createdAt: "", extraction: extract(FLOOD_PROMPT), corrected: false });
        }
        const pkg = balancedPkg(db, previous, challengerStreak);
        const ids = pkg.items.map((i) => i.proposal.id);
        if (ids.includes("f_buyouts")) {
          flipped = true;
          break;
        }
        previous = { A: ids };
        challengerStreak = { A: pkg.challengerStreak };
      }

      if (flipped) {
        nToFlip = n;
        break;
      }
    }

    console.log("[responsiveness] smallest N to include f_buyouts:", nToFlip);
    expect(nToFlip).not.toBeNull();
    expect(nToFlip!).toBeGreaterThanOrEqual(1);
    expect(nToFlip!).toBeLessThanOrEqual(10);
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
