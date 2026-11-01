import { createHash } from "node:crypto";
import type { Proposal } from "../engine/types";

/** What an estimate stores instead of the voter id (the id is the voter's only credential). */
export const voterKey = (voterId: string) => createHash("sha256").update(`estimate:${voterId}`).digest("hex").slice(0, 32);

/** Largest annual cost a voter can enter, in $B. Keeps one typo from swallowing the budget. */
export const MAX_ESTIMATE_B = 100;

/**
 * Record one voter's estimate for an uncosted citizen idea, in place (their earlier estimate is replaced).
 * Body: { costB: number ($B/yr), changeLevel: 0–6, authority?: string }.
 */
export function recordEstimate(idea: Proposal, voterId: string, body: Record<string, unknown>, now = new Date()): { ok: true } | { error: string } {
  if (!idea.emergent) return { error: "only citizen ideas take estimates" };
  if (idea.costEstimate === "assessed") return { error: "this idea has already been reviewed" };

  const costB = body.costB;
  if (typeof costB !== "number" || !Number.isFinite(costB) || costB < 0 || costB > MAX_ESTIMATE_B) {
    return { error: `costB must be a number from 0 to ${MAX_ESTIMATE_B} ($B per year)` };
  }
  const changeLevel = body.changeLevel;
  if (typeof changeLevel !== "number" || !Number.isInteger(changeLevel) || changeLevel < 0 || changeLevel > 6) {
    return { error: "changeLevel must be an integer 0–6" };
  }
  let authority: string | undefined;
  if (body.authority !== undefined && body.authority !== null && body.authority !== "") {
    if (typeof body.authority !== "string") return { error: "authority must be a string" };
    authority = body.authority.trim().slice(0, 120) || undefined;
  }

  const key = voterKey(voterId);
  const estimates = (idea.estimates ?? []).filter((e) => e.voterKey !== key);
  estimates.push({ voterKey: key, costB, changeLevel, ...(authority ? { authority } : {}), createdAt: now.toISOString() });
  idea.estimates = estimates;
  return { ok: true };
}
