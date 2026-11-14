import type { ScoreParts, Weights } from "./types";

/** Version 1 arithmetic, shared by synthesis and offline aggregate replay.
 * Inputs are already-computed components, not individual responses.
 */
export function scoreAggregate(parts: ScoreParts, weights: Weights, lambda: number, changeLevel: number) {
  const round = (value: number) => Math.round(value * 1000) / 1000;
  const weightSum = Object.values(weights).reduce((sum, value) => sum + value, 0) || 1;
  const base = (Object.keys(weights) as (keyof Weights)[])
    .reduce((sum, key) => sum + weights[key] * parts[key], 0) / weightSum;
  const changeCost = round(lambda * changeLevel / 6);
  return { changeCost, score: round(base - changeCost) };
}
