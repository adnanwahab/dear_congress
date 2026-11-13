import type { Weights } from '../engine/types';

export const WEIGHT_KEYS = ['support', 'welfare', 'fairness', 'feasibility', 'reversibility', 'evidence'] as const;

/** Exact finite nonnegative vector; reject a zero or overflowing denominator. */
export function normalizeWeights(value: unknown): { raw: Weights; total: number; normalized: Weights } {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      Object.keys(value).length !== WEIGHT_KEYS.length ||
      WEIGHT_KEYS.some(key => !Object.hasOwn(value, key))) throw new Error('Provide exactly the six scoring weights.');
  const raw = {} as Weights;
  for (const key of WEIGHT_KEYS) {
    const weight = (value as Weights)[key];
    if (typeof weight !== 'number' || !Number.isFinite(weight) || weight < 0) throw new Error('Weights must be finite nonnegative numbers.');
    raw[key] = weight;
  }
  const total = Object.values(raw).reduce((sum, weight) => sum + weight, 0);
  if (!Number.isFinite(total) || total <= 0) throw new Error('Weight total must be finite and greater than zero.');
  const normalized = Object.fromEntries(WEIGHT_KEYS.map(key => [key, raw[key] / total])) as unknown as Weights;
  return { raw, total, normalized };
}
