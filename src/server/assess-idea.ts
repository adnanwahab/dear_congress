import type { Proposal } from "../engine/types";

const STRINGS = ["mechanism", "authority", "jurisdiction", "legalChange"] as const;
const UNIT = ["reversibility", "evidence", "effectiveness"] as const;

/**
 * Turn a citizen idea into a costed plan option, in place.
 * `costB` is required; every other field is optional and keeps its current value when omitted.
 * Returns an error message instead of changing anything when the body is invalid.
 */
export function assessIdea(idea: Proposal, body: Record<string, unknown>): { ok: true } | { error: string } {
  if (!idea.emergent) return { error: "only citizen ideas can be assessed" };

  const costB = body.costB;
  if (typeof costB !== "number" || !Number.isFinite(costB) || costB < 0) return { error: "costB must be a number >= 0 ($B per year)" };

  const next: Partial<Proposal> = { costB };
  for (const k of STRINGS) {
    if (body[k] === undefined) continue;
    if (typeof body[k] !== "string" || !(body[k] as string).trim()) return { error: `${k} must be a non-empty string` };
    next[k] = (body[k] as string).trim();
  }
  for (const k of UNIT) {
    if (body[k] === undefined) continue;
    const v = body[k];
    if (typeof v !== "number" || !(v >= 0 && v <= 1)) return { error: `${k} must be a number between 0 and 1` };
    next[k] = v;
  }
  if (body.changeLevel !== undefined) {
    const v = body.changeLevel;
    if (typeof v !== "number" || !Number.isInteger(v) || v < 0 || v > 6) return { error: "changeLevel must be an integer 0–6" };
    next.changeLevel = v;
  }
  if (body.metrics !== undefined) {
    if (!Array.isArray(body.metrics) || !body.metrics.every((m) => typeof m === "string")) return { error: "metrics must be an array of strings" };
    next.metrics = body.metrics as string[];
  }

  Object.assign(idea, next, { costEstimate: "assessed" as const });
  return { ok: true };
}
