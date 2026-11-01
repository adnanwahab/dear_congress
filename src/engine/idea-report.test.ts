import { describe, expect, test } from "bun:test";
import { NEEDS, PROPOSALS, SEED_JOURNALS } from "./catalog";
import { buildContext, DEFAULT_WEIGHTS, designedIdea, emptyDB, extract, packageOptions, PROVISIONAL_EVIDENCE, synthesize, withProvisionalCost } from "./engine";
import { attachIdeaReports, simulateWorlds } from "./idea-report";
import type { DB, Proposal, VariantId } from "./types";
import { applyVariant, chosenVariant, variantsFor } from "./variants";
import { heuristicInterpretation } from "../server/make-possible";

const idea = (id: string, needId: string, text: string): Proposal => ({
  id, needId, title: text, mechanism: "To be determined", authority: "Unassigned", jurisdiction: "Unassigned", costB: null,
  changeLevel: 3, reversibility: 0.5, evidence: 0.3, effectiveness: 0.5, keywords: [], metrics: [],
  legalChange: "Needs legal analysis", emergent: true, sourceText: text,
});
const designed = (p: Proposal) => ({ ...p, interpretation: heuristicInterpretation(p, NEEDS.find((n) => n.id === p.needId), PROPOSALS, new Date(0)) });
const choices = (...vs: VariantId[]) => vs.map((variant, i) => ({ voterKey: `k${i}`, variant, createdAt: "" }));

function seeded(...ideas: Proposal[]): DB {
  const db = emptyDB();
  db.entries = SEED_JOURNALS.map((s, i) => ({ id: String(i), author: s.author, text: s.text, createdAt: "", extraction: extract(s.text), corrected: false, seeded: true }));
  db.emergent.push(...ideas);
  return db;
}
function reports(db: DB, budget = 40) {
  const ctx = buildContext(db);
  const pkgs = synthesize(ctx, DEFAULT_WEIGHTS, 0.25, budget);
  attachIdeaReports(ctx, pkgs, packageOptions(DEFAULT_WEIGHTS, 0.25, budget));
  return pkgs;
}

describe("idea versions", () => {
  const full: Proposal = { ...idea("x", "childcare", "free daycare"), costB: 10, changeLevel: 4, effectiveness: 0.8, reversibility: 0.3 };

  test("smaller versions cost and do less; pilots and grants run through existing programs", () => {
    const pilot = applyVariant(full, "pilot");
    expect(pilot).toMatchObject({ costB: 1, changeLevel: 2, variant: "pilot" });
    expect(pilot.effectiveness).toBeLessThan(full.effectiveness);
    expect(pilot.reversibility).toBeGreaterThan(full.reversibility);
    expect(applyVariant(full, "targeted").changeLevel).toBe(4);
    expect(applyVariant(full, "full")).toMatchObject({ costB: 10, variant: "full" });
    const costs = variantsFor(full).map((v) => v.costB);
    expect(costs[0]).toBe(10);
    expect(Math.max(...costs.slice(1))).toBeLessThan(10);
  });

  test("a free idea has one version and an uncosted one has none", () => {
    expect(variantsFor({ ...full, costB: 0 }).map((v) => v.id)).toEqual(["full"]);
    expect(variantsFor({ ...full, costB: null })).toEqual([]);
  });

  test("the plan weighs the most-chosen version; ties go to the cheaper one", () => {
    expect(chosenVariant([])).toBe("full");
    expect(chosenVariant(choices("full", "pilot", "pilot"))).toBe("pilot");
    expect(chosenVariant(choices("full", "targeted"))).toBe("targeted");
  });
});

describe("Make this possible: designed cost", () => {
  test("a designed idea is costed from its closest program and enters the running", () => {
    const p = designed(idea("emergent_1", "transit", "more buses that come every 10 minutes"));
    expect(p.interpretation.analogId).toBe("t_bus");
    const d = designedIdea(p, []);
    const bus = PROPOSALS.find((x) => x.id === "t_bus")!;
    expect(d).toMatchObject({ costB: bus.costB, changeLevel: bus.changeLevel, authority: bus.authority, jurisdiction: bus.jurisdiction, costEstimate: "designed" });
    expect(d.evidence).toBeLessThanOrEqual(PROVISIONAL_EVIDENCE);
    expect(p.costB).toBeNull();
  });

  test("voter estimates beat a design, and a reviewer beats both", () => {
    const p = { ...designed(idea("emergent_1", "transit", "more buses")), estimates: [{ voterKey: "a", costB: 0.2, changeLevel: 1, createdAt: "" }] };
    expect(designedIdea(p, [])).toMatchObject({ costB: 0.2, costEstimate: "citizen" });
    expect(designedIdea({ ...p, costB: 0.9, costEstimate: "assessed" }, [])).toMatchObject({ costB: 0.9, costEstimate: "assessed" });
  });

  test("an idea under a need with no catalog programs still gets a cost", () => {
    const p = designed(idea("emergent_1", "emergent_need_parks_1", "more parks"));
    expect(designedIdea(p, []).costB).toBeGreaterThan(0);
  });

  test("the chosen version is applied on top of the full cost; the stored idea is untouched", () => {
    const p = { ...designed(idea("emergent_1", "transit", "more buses that come every 10 minutes")), variantChoices: choices("pilot") };
    const bus = PROPOSALS.find((x) => x.id === "t_bus")!;
    expect(withProvisionalCost(p, [])).toMatchObject({ variant: "pilot", costB: Math.round(bus.costB! * 0.1 * 1000) / 1000 });
    expect(p.costB).toBeNull();
  });
});

describe("citizen idea reports", () => {
  const fridges = () => designed(idea("emergent_1", "food_access", "community fridges stocked by local restaurants"));

  // At $42B the catalog plan leaves ~$200M unspent: too little for the full idea, enough for a smaller version.
  test("an idea that can't fit as written is offered a version that does, and choosing it puts it in the plan", () => {
    const db = seeded(fridges());
    const r = reports(db, 42)[0]!.ideas!.find((x) => x.id === "emergent_1")!;
    expect(r.status).toBe("not_funded");
    expect(r.constraint?.key).toBe("budget");
    const rec = r.variants.find((v) => v.recommended);
    expect(rec).toBeDefined();
    expect(rec!.fit).toBe("fits");
    expect(r.options.find((o) => o.recommended)?.variant).toBe(rec!.id);
    expect(r.options.some((o) => o.kind === "budget" && (o.amountB ?? 0) > 0)).toBe(true);

    // The fit test must agree with what synthesis actually does once voters pick that version.
    db.emergent[0]!.variantChoices = choices(rec!.id);
    const after = reports(db, 42)[0]!;
    expect(after.items.map((i) => i.proposal.id)).toContain("emergent_1");
    const r2 = after.ideas!.find((x) => x.id === "emergent_1")!;
    expect(r2).toMatchObject({ status: "in_plan", variant: rec!.id, stage: "included" });
    expect(r2.options).toEqual([]);
  });

  test("an uncosted idea asks to be made possible and has no versions yet", () => {
    const r = reports(seeded(idea("emergent_1", "food_access", "yay")))[0]!.ideas![0]!;
    expect(r).toMatchObject({ status: "needs_design", stage: "clarified", costB: null, options: [], variants: [] });
    expect(r.constraint?.key).toBe("uncosted");
  });

  test("when nothing fits, it says so and offers no recommendation", () => {
    const r = reports(seeded(fridges()), 40)[0]!.ideas![0]!;
    expect(r.statusText).toBe("Can't fit as written");
    expect(r.variants.some((v) => v.recommended)).toBe(false);
    // "Raise the budget" names a budget at which the plan really does include it.
    const raise = r.options.find((o) => o.kind === "budget")!;
    expect(raise.budgetB).toBeGreaterThan(40);
    expect(reports(seeded(fridges()), raise.budgetB!)[0]!.items.map((i) => i.proposal.id)).toContain("emergent_1");
    expect(reports(seeded(fridges()), raise.budgetB! - 5)[0]!.items.map((i) => i.proposal.id)).not.toContain("emergent_1");
  });

  test("lifecycle stages fill in as the idea moves along", () => {
    const r = reports(seeded(fridges()))[0]!.ideas![0]!;
    expect(r.stages).toMatchObject({ idea: true, clarified: true, costed: true, jurisdiction: true, evidence: true, designed: true, simulated: true, review: false });
    expect(r.stage).toBe("review");
  });

  test("ideas don't change the catalog-only plan", () => {
    const plain = synthesize(buildContext(seeded()), DEFAULT_WEIGHTS, 0.25, 40).map((p) => p.items.map((i) => i.proposal.id));
    const withUncosted = synthesize(buildContext(seeded(idea("emergent_1", "food_access", "yay"))), DEFAULT_WEIGHTS, 0.25, 40).map((p) => p.items.map((i) => i.proposal.id));
    expect(withUncosted).toEqual(plain);
  });
});

describe("in which worlds does it work", () => {
  const big: Proposal = { ...idea("emergent_9", "healthcare", "public insurance"), costB: 80, changeLevel: 4 };

  test("deterministic, counts add up, drivers named", () => {
    const a = simulateWorlds(applyVariant(big, "full"), { support: 0.4, reserveB: 2 });
    const b = simulateWorlds(applyVariant(big, "full"), { support: 0.4, reserveB: 2 });
    expect(a).toEqual(b);
    expect(a.good + a.mixed + a.poor).toBe(a.n);
    expect(a.drivers.length).toBeGreaterThan(0);
    expect(a.robustness).toBeGreaterThanOrEqual(0);
    expect(a.robustness).toBeLessThanOrEqual(1);
  });

  test("a pilot is more robust and strains the budget less than the full rollout", () => {
    const full = simulateWorlds(applyVariant(big, "full"), { support: 0.4, reserveB: 2 });
    const pilot = simulateWorlds(applyVariant(big, "pilot"), { support: 0.5, reserveB: 2 });
    expect(pilot.robustness).toBeGreaterThan(full.robustness);
    expect(pilot.budgetStress).toBeLessThan(full.budgetStress);
  });
});
