import { describe, expect, test } from "bun:test";
import {
  buildContext,
  DEFAULT_WEIGHTS,
  emptyDB,
  extract,
  LATER_NEED_PRIORITIES,
  ideaBackers,
  makePopulation,
  provisionalCostFor,
  PROVISIONAL_EVIDENCE,
  PROVISIONAL_MIN_BACKERS,
  synthesize,
  utility,
} from "./engine";
import { NEEDS, PROPOSALS, SEED_JOURNALS } from "./catalog";
import type { JournalEntry } from "./types";
import { assessIdea } from "../server/assess-idea";

const seeded = () => {
  const db = emptyDB();
  db.entries = SEED_JOURNALS.map((s, i) => ({ id: String(i), author: s.author, text: s.text, createdAt: "", extraction: extract(s.text), corrected: false, seeded: true }));
  return db;
};

// The journals HappyBearLandia's simulated residents write when their fridge runs out.
const FRIDGE = [
  "Our fridge was empty tonight and it was hard to find groceries nearby. This keeps disrupting my daily life.",
  "We ran out at home and finding groceries nearby was difficult. I need a practical fix soon.",
  "I came home to an empty fridge and struggled to get basic groceries. I'm sharing this because it keeps happening.",
];

const fridgeEntries = (n: number): JournalEntry[] =>
  Array.from({ length: n }, (_, i) => {
    const text = FRIDGE[i % FRIDGE.length]!;
    return { id: `fridge_${i}`, author: `Resident ${i}`, text, createdAt: "", extraction: extract(text), corrected: false, synthetic: true, source: "what-if" };
  });

const balancedIds = (pkg: { items: { proposal: { id: string } }[] }) => pkg.items.map((i) => i.proposal.id);

describe("food access", () => {
  test("empty-fridge journals map to the food access need", () => {
    for (const text of FRIDGE) expect(extract(text).needs.map((n) => n.id)).toContain("food_access");
  });

  test("grocery delivery is a costed proposal for the food access need", () => {
    const p = PROPOSALS.find((x) => x.id === "g_delivery");
    expect(p?.needId).toBe("food_access");
    expect(p?.costB).toBeGreaterThan(0);
    expect(NEEDS.some((n) => n.id === "food_access")).toBe(true);
  });

  test("adding the need doesn't reshuffle existing voters", () => {
    // Rebuild the population as if food_access didn't exist: every original need's
    // priority, and every voter's fiscal/change, must be unchanged.
    const withFood = makePopulation();
    const saved = { ...LATER_NEED_PRIORITIES };
    for (const k of Object.keys(LATER_NEED_PRIORITIES)) delete LATER_NEED_PRIORITIES[k];
    const originalNeeds = NEEDS.filter((n) => !(n.id in saved));
    let without;
    try {
      const all = NEEDS.splice(0, NEEDS.length, ...originalNeeds);
      try { without = makePopulation(); } finally { NEEDS.splice(0, NEEDS.length, ...all); }
    } finally {
      Object.assign(LATER_NEED_PRIORITIES, saved);
    }
    for (let i = 0; i < withFood.length; i++) {
      expect(withFood[i]!.fiscal).toBe(without[i]!.fiscal);
      expect(withFood[i]!.change).toBe(without[i]!.change);
      for (const n of originalNeeds) expect(withFood[i]!.pri[n.id]).toBe(without[i]!.pri[n.id]);
      for (const p of PROPOSALS.filter((x) => x.needId !== "food_access")) {
        expect(utility(withFood[i]!, p)).toBe(utility(without[i]!, p));
      }
    }
  });

  test("without food complaints, Balanced doesn't add grocery delivery", () => {
    const [balanced] = synthesize(buildContext(seeded()), DEFAULT_WEIGHTS, 0.25, 40);
    expect(balancedIds(balanced!)).not.toContain("g_delivery");
  });

  test("a few complaints aren't enough to make it a challenger", () => {
    const db = seeded();
    const [base] = synthesize(buildContext(db), DEFAULT_WEIGHTS, 0.25, 40);
    const ctx = buildContext(db, undefined, { extraEntries: fridgeEntries(4) });
    const [r1] = synthesize(ctx, DEFAULT_WEIGHTS, 0.25, 40, { A: balancedIds(base!) }, {});
    expect(r1!.challengerStreak.g_delivery ?? 0).toBe(0);
  });

  test("sustained complaints: leans toward grocery delivery, then adopts it the next round", () => {
    const db = seeded();
    const [base] = synthesize(buildContext(db), DEFAULT_WEIGHTS, 0.25, 40);
    const previous = { A: balancedIds(base!) };
    const ctx = buildContext(db, undefined, { extraEntries: fridgeEntries(24) });

    // Round 1: a challenger, not yet adopted (CHALLENGER_PERSISTENCE = 2).
    const [r1] = synthesize(ctx, DEFAULT_WEIGHTS, 0.25, 40, previous, {});
    expect(balancedIds(r1!)).not.toContain("g_delivery");
    expect(r1!.challengerStreak.g_delivery).toBe(1);

    // Round 2, carrying the streak: adopted.
    const [r2] = synthesize(ctx, DEFAULT_WEIGHTS, 0.25, 40, previous, { A: r1!.challengerStreak });
    expect(balancedIds(r2!)).toContain("g_delivery");
  });

  test("what-if journals don't touch the stored entries", () => {
    const db = seeded();
    const before = db.entries.length;
    buildContext(db, undefined, { extraEntries: fridgeEntries(24) });
    expect(db.entries.length).toBe(before);
  });
});

describe("food access citizen ideas → plan", () => {
  const IDEA = "emergent_1";
  const withIdea = () => {
    const db = seeded();
    db.emergent.push({
      id: IDEA, needId: "food_access", title: "Community fridges stocked by local restaurants",
      mechanism: "To be determined", authority: "Unassigned", jurisdiction: "Unassigned", costB: null,
      changeLevel: 3, reversibility: 0.5, evidence: 0.3, effectiveness: 0.5, keywords: ["community", "fridges"],
      metrics: [], legalChange: "Needs legal analysis", emergent: true, sourceText: "Community fridges stocked by local restaurants",
    });
    return db;
  };
  const back = (db: ReturnType<typeof seeded>, voters: string[]) => {
    db.answers = voters.map((voterId, i) => ({ id: `a${i}`, needId: "food_access", text: "community fridges", proposalId: IDEA, createdAt: "", voterId }));
  };
  const distinct = (n: number) => Array.from({ length: n }, (_, i) => `v${i}`);
  const idea = (ctx: ReturnType<typeof buildContext>) => ctx.proposals.find((p) => p.id === IDEA)!;
  const competes = (pkg: { items: { proposal: { id: string } }[]; deferred: { id: string }[]; waiting: { id: string }[] }) =>
    [...pkg.items.map((i) => i.proposal.id), ...pkg.deferred.map((d) => d.id), ...pkg.waiting.map((w) => w.id)].includes(IDEA);

  test("an idea with too few backers stays uncosted under Emerging", () => {
    const db = withIdea();
    back(db, distinct(PROVISIONAL_MIN_BACKERS - 1));
    const ctx = buildContext(db, undefined, { extraEntries: fridgeEntries(24) });
    expect(idea(ctx).costB).toBeNull();
    const [r] = synthesize(ctx, DEFAULT_WEIGHTS, 0.25, 40);
    expect(r!.emerging.map((e) => e.title)).toContain("Community fridges stocked by local restaurants");
    expect(competes(r!)).toBe(false);
  });

  test("repeat answers from one person don't count as more backers", () => {
    const db = withIdea();
    back(db, Array(PROVISIONAL_MIN_BACKERS + 3).fill("same-voter"));
    expect(ideaBackers(db.answers, IDEA)).toBe(1);
    expect(idea(buildContext(db)).costB).toBeNull();
  });

  test("enough distinct backers: provisional cost from the need's options, evidence capped, competes in the plan", () => {
    const db = withIdea();
    back(db, distinct(PROVISIONAL_MIN_BACKERS));
    const ctx = buildContext(db, undefined, { extraEntries: fridgeEntries(24) });
    const p = idea(ctx);
    expect(p.costB).toBe(provisionalCostFor("food_access"));
    expect(p.costEstimate).toBe("provisional");
    expect(p.evidence).toBeLessThanOrEqual(PROVISIONAL_EVIDENCE);
    const [r] = synthesize(ctx, DEFAULT_WEIGHTS, 0.25, 40);
    expect(r!.emerging.map((e) => e.title)).not.toContain("Community fridges stocked by local restaurants");
    expect(competes(r!)).toBe(true);
    // The stored idea is untouched: the estimate is recomputed each run.
    expect(db.emergent[0]!.costB).toBeNull();
  });

  test("voter support doesn't jump when an idea crosses the backer threshold", () => {
    const below = withIdea(); back(below, distinct(PROVISIONAL_MIN_BACKERS - 1));
    const at = withIdea(); back(at, distinct(PROVISIONAL_MIN_BACKERS));
    expect(buildContext(at).stats[IDEA]!.support).toBe(buildContext(below).stats[IDEA]!.support);
  });

  test("a reviewed idea competes on its assessed cost, even without backers", () => {
    const db = withIdea();
    const r = assessIdea(db.emergent[0]!, { costB: 0.1, mechanism: "Restaurant partnership grants", authority: "Houston Health Department", jurisdiction: "Houston", evidence: 0.5, changeLevel: 1 });
    expect(r).toEqual({ ok: true });
    expect(db.emergent[0]!.costEstimate).toBe("assessed");
    const ctx = buildContext(db, undefined, { extraEntries: fridgeEntries(24) });
    expect(idea(ctx).costB).toBe(0.1);
    const [pkg] = synthesize(ctx, DEFAULT_WEIGHTS, 0.25, 40);
    expect(competes(pkg!)).toBe(true);
  });

  test("assessment rejects bad input and leaves the idea unchanged", () => {
    const db = withIdea();
    const before = { ...db.emergent[0]! };
    expect("error" in assessIdea(db.emergent[0]!, {})).toBe(true);
    expect("error" in assessIdea(db.emergent[0]!, { costB: -1 })).toBe(true);
    expect("error" in assessIdea(db.emergent[0]!, { costB: 1, evidence: 2 })).toBe(true);
    expect("error" in assessIdea(db.emergent[0]!, { costB: 1, changeLevel: 7 })).toBe(true);
    expect(db.emergent[0]).toEqual(before);
    expect("error" in assessIdea({ ...PROPOSALS.find((p) => p.id === "g_delivery")! }, { costB: 1 })).toBe(true);
  });
});
