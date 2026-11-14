import { expect, test } from "bun:test";
import { buildContext, DEFAULT_WEIGHTS, emptyDB, scoreAll, synthesize } from "./engine";

for (const zero of [false, true]) test(`all proposal arithmetic reproduces engine scores (zero weights: ${zero})`, () => {
  const db = emptyDB();
  const ctx = buildContext(db, [], { now: 0 });
  const before = JSON.stringify(ctx);
  const weights = zero ? { support: 0, welfare: 0, fairness: 0, feasibility: 0, reversibility: 0, evidence: 0 } : DEFAULT_WEIGHTS;
  const packages = synthesize(ctx, weights, 0.25, 0);
  for (const pkg of packages) {
    expect(pkg.items).toHaveLength(0);
    expect(pkg.scoreAudit.proposals.map(r => r.id)).toEqual(ctx.proposals.map(p => p.id));
    for (const row of pkg.scoreAudit.proposals) {
      const b = row.base;
      for (const term of Object.values(b.parts)) {
        expect(term.contribution).toBe(term.raw * term.weight / b.weightDivisor);
        expect(Number.isFinite(term.contribution)).toBe(true);
      }
      const sum = Object.values(b.parts).reduce((s, t) => s + t.contribution, 0);
      expect(Math.abs(sum - b.changePenalty + b.roundingAdjustment - b.total)).toBeLessThan(1e-9);
      expect(row.evidenceInputs.measuredImpact).toBeNull();
      expect(row.selectedRank).toBeNull();
    }
  }
  expect(JSON.stringify(ctx)).toBe(before);
  expect(synthesize(ctx, weights, 0.25, 0)).toEqual(packages);
  const expected = scoreAll(ctx, weights, 0.25);
  expect(packages[0]!.scoreAudit.proposals.map(r => r.base.total)).toEqual(expected.map(r => r.score));
});

test("selected rank and rights exclusions reflect final package; zero impact differs from missing", () => {
  const ctx = buildContext(emptyDB());
  const id = ctx.proposals[0]!.id;
  ctx.outcomes.items[id] = 0;
  const packages = synthesize(ctx, DEFAULT_WEIGHTS, 0.25, 40);
  expect(packages[0]!.scoreAudit.proposals.find(r => r.id === id)!.evidenceInputs.measuredImpact).toBe(0);
  for (const pkg of packages) {
    for (const it of pkg.items) {
      const row = pkg.scoreAudit.proposals.find(r => r.id === it.proposal.id)!;
      expect(row.status).toBe("selected");
      expect(row.selectedRank).toBe(it.explanation.total);
      expect(Math.abs(row.base.total + it.explanation.stabilityBonus - row.selectedRank!)).toBeLessThan(1e-9);
    }
    for (const p of ctx.proposals.filter(p => p.rightsIssue)) {
      expect(pkg.scoreAudit.proposals.find(r => r.id === p.id)!.reason).toStartWith("Rights exclusion:");
    }
  }
});

test("positive support with infeasible budget stays excluded and uncosted proposals stay distinct", () => {
  const ctx = buildContext(emptyDB());
  const proposal = ctx.proposals.find(p => !p.rightsIssue && p.costB !== null)!;
  ctx.proposals = [{ ...proposal, id: "expensive", costB: 10 }, { ...proposal, id: "uncosted", costB: null }];
  ctx.stats = Object.fromEntries(ctx.proposals.map(p => [p.id, { n: 10, support: 1, oppose: 0, neutral: 0, strongOppose: 0, objections: [] }]));
  const pkg = synthesize(ctx, DEFAULT_WEIGHTS, 0, 1)[0]!;
  expect(pkg.items).toHaveLength(0);
  expect(pkg.scoreAudit.proposals.find(r => r.id === "expensive")!.reason).toBe("Doesn't fit the remaining budget");
  expect(pkg.scoreAudit.proposals.find(r => r.id === "uncosted")!.reason).toContain("Cost unavailable");
});
