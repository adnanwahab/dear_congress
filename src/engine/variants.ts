import type { Proposal, VariantChoice, VariantId, VariantSpec } from "./types";

/*
 * "Make this possible": a citizen idea doesn't have to enter the plan as written.
 * Each costed idea gets nearby versions — targeted, phased, opt-in grants, a pilot —
 * so a popular idea that can't fit as written can still find a version that does.
 * Multipliers are illustrative, like every cost in this prototype.
 */

interface VariantDef {
  id: VariantId;
  label: string;
  /** Share of the full annual cost. */
  cost: number;
  /** Share of the full version's effect on the need's goal. */
  effect: number;
  /** Cap on the size of change (pilots and grants run through existing programs). */
  maxChangeLevel?: number;
  reversibility: (r: number) => number;
  summary: (p: Proposal) => string;
  timeline: (changeLevel: number) => string;
}

const where = (p: Proposal) => (p.jurisdiction && p.jurisdiction !== "Unassigned" ? p.jurisdiction : "the jurisdiction");

export function baseTimeline(changeLevel: number): string {
  if (changeLevel <= 1) return "3–6 months";
  if (changeLevel === 2) return "6–12 months";
  if (changeLevel === 3) return "12–24 months";
  if (changeLevel === 4) return "18–36 months";
  return "3–5 years";
}

export const VARIANT_DEFS: Record<VariantId, VariantDef> = {
  full: {
    id: "full", label: "As proposed", cost: 1, effect: 1,
    reversibility: (r) => r,
    summary: (p) => `Everywhere in ${where(p)}, at full scale.`,
    timeline: baseTimeline,
  },
  targeted: {
    id: "targeted", label: "Highest-need areas first", cost: 0.45, effect: 0.75,
    reversibility: (r) => Math.min(1, r + 0.05),
    summary: () => "Only where the need is worst, ranked by journals and measured conditions.",
    timeline: baseTimeline,
  },
  phased: {
    id: "phased", label: "Phase in over 3 years", cost: 0.35, effect: 0.6,
    reversibility: (r) => Math.min(1, r + 0.1),
    summary: () => "A third of the rollout each year; this is the first year's cost.",
    timeline: () => "3 years, phased",
  },
  grant: {
    id: "grant", label: "Opt-in grants", cost: 0.3, effect: 0.45, maxChangeLevel: 2,
    reversibility: (r) => Math.max(r, 0.8),
    summary: () => "Grants to cities and counties that choose to run it, through an existing grant program.",
    timeline: () => "12–24 months",
  },
  pilot: {
    id: "pilot", label: "Pilot, then expand if it works", cost: 0.1, effect: 0.2, maxChangeLevel: 2,
    reversibility: () => 0.95,
    summary: () => "A few sites for 18 months, measured against the need's goal; expands automatically if it beats the target.",
    timeline: () => "18-month pilot",
  },
};

/** Cheapest first: ties in voter choices go to the cheaper version. */
export const VARIANT_ORDER: VariantId[] = ["pilot", "grant", "phased", "targeted", "full"];

export const isVariantId = (v: unknown): v is VariantId => typeof v === "string" && v in VARIANT_DEFS;

const r3 = (x: number) => Math.round(x * 1000) / 1000;

/** Size one version of an idea whose full cost is known. */
export function variantSpec(p: Proposal, id: VariantId): VariantSpec {
  const d = VARIANT_DEFS[id];
  const changeLevel = d.maxChangeLevel === undefined ? p.changeLevel : Math.min(p.changeLevel, d.maxChangeLevel);
  return {
    id,
    label: d.label,
    summary: d.summary(p),
    costB: r3((p.costB ?? 0) * d.cost),
    changeLevel,
    effectiveness: r3(p.effectiveness * d.effect),
    reversibility: r3(d.reversibility(p.reversibility)),
    timeline: d.timeline(changeLevel),
  };
}

/** The versions worth offering. A free idea has only one: there is nothing to shrink. */
export function variantsFor(p: Proposal): VariantSpec[] {
  if (p.costB === null) return [];
  if (p.costB <= 0) return [variantSpec(p, "full")];
  return (["full", "targeted", "phased", "grant", "pilot"] as VariantId[]).map((id) => variantSpec(p, id));
}

/** The idea as the plan should weigh it in this version. `p` must be the full version. */
export function applyVariant(p: Proposal, id: VariantId): Proposal {
  if (p.costB === null || id === "full" || p.costB <= 0) return { ...p, variant: "full" };
  const s = variantSpec(p, id);
  return { ...p, costB: s.costB, changeLevel: s.changeLevel, effectiveness: s.effectiveness, reversibility: s.reversibility, variant: id };
}

export function variantCounts(choices: VariantChoice[] = []): Record<VariantId, number> {
  const out: Record<VariantId, number> = { full: 0, targeted: 0, phased: 0, grant: 0, pilot: 0 };
  for (const c of choices) if (isVariantId(c.variant)) out[c.variant]++;
  return out;
}

/** The version most voters picked (ties → cheaper). With no picks, the idea as written. */
export function chosenVariant(choices: VariantChoice[] = []): VariantId {
  if (!choices.length) return "full";
  const counts = variantCounts(choices);
  let best: VariantId = "full";
  let n = 0;
  for (const id of VARIANT_ORDER) if (counts[id] > n) { best = id; n = counts[id]; }
  return best;
}
