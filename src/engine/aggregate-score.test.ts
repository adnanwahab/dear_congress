import { expect, test } from "bun:test";
import { scoreAggregate } from "./aggregate-score";
import { buildContext, DEFAULT_WEIGHTS, emptyDB, scoreAll } from "./engine";
import type { Weights } from "./types";

test("shared aggregate arithmetic preserves catalog scoring with normalized, custom and zero weights", () => {
  const context = buildContext(emptyDB(), undefined, { now: "2026-11-13T00:00:00.000Z" });
  const round = (value: number) => Math.round(value * 1000) / 1000;
  for (const weights of [DEFAULT_WEIGHTS, { support: 1, welfare: 0, fairness: 0, feasibility: 0, reversibility: 0, evidence: 0 }, { support: 0, welfare: 0, fairness: 0, feasibility: 0, reversibility: 0, evidence: 0 }]) {
    for (const lambda of [0, 0.25, 0.333]) {
      for (const row of scoreAll(context, weights, lambda)) {
        const sum = Object.values(weights).reduce((sum, value) => sum + value, 0) || 1;
        const base = (Object.keys(weights) as (keyof Weights)[]).reduce((sum, key) => sum + weights[key] * row.parts[key], 0) / sum;
        const penalty = round(lambda * row.p.changeLevel / 6);
        expect(row.changeCost).toBe(penalty);
        expect(row.score).toBe(round(base - penalty));
      }
    }
  }
});

test("round change penalty before subtracting and round result to three decimals", () => {
  const parts = { support: 1, welfare: 1, fairness: 1, feasibility: 1, reversibility: 1, evidence: 1 };
  const weights = { support: 1, welfare: 0, fairness: 0, feasibility: 0, reversibility: 0, evidence: 0 };
  expect(scoreAggregate(parts, weights, 0.0005, 6)).toEqual({ changeCost: 0.001, score: 0.999 });
  expect(scoreAggregate({ ...parts, support: 0.1235 }, weights, 0, 0).score).toBe(0.124);
});
