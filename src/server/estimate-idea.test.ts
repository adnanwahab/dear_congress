import { describe, expect, test } from "bun:test";
import { SEED_JOURNALS } from "../engine/catalog";
import { buildContext, DEFAULT_WEIGHTS, emptyDB, extract, PROVISIONAL_EVIDENCE, PROVISIONAL_MIN_BACKERS, ideaBackers, synthesize } from "../engine/engine";
import type { DB, Proposal } from "../engine/types";
import { assessIdea } from "./assess-idea";
import { MAX_ESTIMATE_B, recordEstimate, voterKey } from "./estimate-idea";

const idea = (): Proposal => ({
  id: "emergent_1", needId: "food_access", title: "Community fridges stocked by local restaurants",
  mechanism: "To be determined", authority: "Unassigned", jurisdiction: "Unassigned", costB: null,
  changeLevel: 3, reversibility: 0.5, evidence: 0.3, effectiveness: 0.5, keywords: [], metrics: [],
  legalChange: "Needs legal analysis", emergent: true,
});

const seededWithIdea = (): DB => {
  const db = emptyDB();
  db.entries = SEED_JOURNALS.map((s, i) => ({ id: String(i), author: s.author, text: s.text, createdAt: "", extraction: extract(s.text), corrected: false, seeded: true }));
  db.emergent.push(idea());
  return db;
};
const inCtx = (db: DB) => buildContext(db).proposals.find((p) => p.id === "emergent_1")!;
const ranked = (db: DB) => {
  const [pkg] = synthesize(buildContext(db), DEFAULT_WEIGHTS, 0.25, 40);
  return { pkg: pkg!, ids: [...pkg!.items.map((i) => i.proposal.id), ...pkg!.deferred.map((d) => d.id), ...pkg!.waiting.map((w) => w.id)] };
};

describe("voter cost estimates for citizen ideas", () => {
  test("validates input and leaves the idea unchanged on error", () => {
    const p = idea();
    for (const body of [{}, { costB: -1, changeLevel: 1 }, { costB: MAX_ESTIMATE_B + 1, changeLevel: 1 }, { costB: 1 }, { costB: 1, changeLevel: 7 }, { costB: 1, changeLevel: 1.5 }, { costB: 1, changeLevel: 1, authority: 5 }]) {
      expect("error" in recordEstimate(p, "v1", body)).toBe(true);
    }
    expect(p.estimates).toBeUndefined();
    expect("error" in recordEstimate({ ...idea(), emergent: undefined }, "v1", { costB: 1, changeLevel: 1 })).toBe(true);
  });

  test("one estimate per voter, stored under a hash of the voter id", () => {
    const p = idea();
    recordEstimate(p, "voter-secret", { costB: 0.5, changeLevel: 2 });
    recordEstimate(p, "voter-secret", { costB: 0.2, changeLevel: 1, authority: "  Houston Health Department  " });
    expect(p.estimates).toHaveLength(1);
    expect(p.estimates![0]).toMatchObject({ voterKey: voterKey("voter-secret"), costB: 0.2, changeLevel: 1, authority: "Houston Health Department" });
    expect(JSON.stringify(p)).not.toContain("voter-secret");
  });

  test("a reviewed idea doesn't take estimates", () => {
    const p = idea();
    assessIdea(p, { costB: 0.1 });
    expect("error" in recordEstimate(p, "v1", { costB: 5, changeLevel: 1 })).toBe(true);
  });

  test("one estimate is enough to put an idea in the running", () => {
    const db = seededWithIdea();
    expect(ranked(db).ids).not.toContain("emergent_1");
    recordEstimate(db.emergent[0]!, "v1", { costB: 0.05, changeLevel: 1, authority: "Houston Health Department" });
    const p = inCtx(db);
    expect(p).toMatchObject({ costB: 0.05, changeLevel: 1, authority: "Houston Health Department", costEstimate: "citizen" });
    expect(p.evidence).toBeLessThanOrEqual(PROVISIONAL_EVIDENCE);
    const { pkg, ids } = ranked(db);
    expect(ids).toContain("emergent_1");
    expect(pkg.emerging.map((e) => e.title)).not.toContain("Community fridges stocked by local restaurants");
    // The stored idea keeps its null cost: the estimate is applied each run.
    expect(db.emergent[0]!.costB).toBeNull();
  });

  test("the plan uses the median estimate, so one outlier can't set the cost", () => {
    const db = seededWithIdea();
    recordEstimate(db.emergent[0]!, "v1", { costB: 0.1, changeLevel: 1 });
    recordEstimate(db.emergent[0]!, "v2", { costB: 0.2, changeLevel: 2 });
    recordEstimate(db.emergent[0]!, "v3", { costB: 0, changeLevel: 2 });
    expect(inCtx(db)).toMatchObject({ costB: 0.1, changeLevel: 2 });
  });

  test("a reviewer's assessment wins over voter estimates", () => {
    const db = seededWithIdea();
    recordEstimate(db.emergent[0]!, "v1", { costB: 0.05, changeLevel: 1 });
    assessIdea(db.emergent[0]!, { costB: 0.4 });
    expect(inCtx(db)).toMatchObject({ costB: 0.4, costEstimate: "assessed" });
  });
});

describe("support votes count as backers", () => {
  const vote = (stance: -2 | -1 | 0 | 1 | 2) => ({ emergent_1: { proposalId: "emergent_1", stance, importance: 0.5, acceptCompromise: true, concern: "", changeMind: "" } });

  test("Support and Strongly support count; neutral and opposition don't; answer + vote by one person counts once", () => {
    const votes = { a: vote(2), b: vote(1), c: vote(0), d: vote(-1) };
    const answers = [{ id: "x", needId: "food_access", text: "fridges", proposalId: "emergent_1", createdAt: "", voterId: "a" }];
    expect(ideaBackers(answers, "emergent_1", votes)).toBe(2);
  });

  test("enough supporters give an idea a provisional cost without anyone writing an answer", () => {
    const db = seededWithIdea();
    db.votesByVoter = Object.fromEntries(Array.from({ length: PROVISIONAL_MIN_BACKERS }, (_, i) => [`v${i}`, vote(2)]));
    expect(inCtx(db).costEstimate).toBe("provisional");
    expect(ranked(db).ids).toContain("emergent_1");
  });
});
