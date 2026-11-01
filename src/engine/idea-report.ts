import { NEEDS, PROPOSALS } from "./catalog";
import { POPULATION, designedIdea, hash, mulberry32, proposalStats, scoreAll, synthesizePackage, type Context, type PackageOptions } from "./engine";
import {
  IDEA_STAGES,
  type IdeaOption, type IdeaReport, type IdeaStage, type IdeaVariantReport, type PackageResult, type Proposal, type ProposalStats,
  type VariantFit, type VariantId, type WorldsResult,
} from "./types";
import { applyVariant, variantCounts, variantsFor, VARIANT_DEFS } from "./variants";

/*
 * Citizen ideas as an implementation pipeline:
 * idea → clarified → costed → jurisdiction → evidence → designed → simulated → public review → in the plan.
 * Synthesis doesn't just pick between ideas as written: for an idea that can't fit, it tries the
 * nearby versions (targeted, phased, grants, pilot) and reports which ones the plan would take.
 */

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const round = (x: number, d = 3) => Math.round(x * 10 ** d) / 10 ** d;
const money = (b: number) => (b >= 1 ? `$${b.toFixed(1).replace(/\.0$/, "")}B` : b > 0 ? `$${Math.max(1, Math.round(b * 1000))}M` : "$0");
const UNSET = new Set(["Unassigned", "To be determined", "Needs legal analysis", ""]);
const unset = (s: string | undefined) => UNSET.has((s ?? "").trim());

/* ------------------------------------------------------------------ */
/* In which worlds does it work?                                       */
/* ------------------------------------------------------------------ */

export const WORLD_COUNT = 1000;
/** Budget search for the "raise the budget" option, matching the settings slider. */
const BUDGET_STEP = 5;
const MAX_BUDGET = 150;
const MAX_BUDGET_RAISE = 60;
/** Share of the budget treated as a contingency reserve when the plan has nothing unspent. */
export const CONTINGENCY = 0.05;

/** How much cost overruns vary by version: smaller, simpler versions are more predictable. */
const OVERRUN_SD: Record<VariantId, number> = { full: 0.3, targeted: 0.22, phased: 0.18, grant: 0.16, pilot: 0.1 };

function correlation(xs: number[], ys: number[]): number {
  const n = xs.length;
  const mx = xs.reduce((s, v) => s + v, 0) / n;
  const my = ys.reduce((s, v) => s + v, 0) / n;
  let sxy = 0; let sxx = 0; let syy = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i]! - mx; const dy = ys[i]! - my;
    sxy += dx * dy; sxx += dx * dx; syy += dy * dy;
  }
  return sxx && syy ? sxy / Math.sqrt(sxx * syy) : 0;
}

/**
 * An illustrative spread of possible futures for one version of an idea. Each future draws staff
 * and admin capacity, uptake, cost overruns, delays and a swing in public support; "works" means
 * it delivers most of what it promises without its overruns eating the plan's reserve
 * (`reserveB`: unspent budget, or a contingency share of the budget, whichever is larger).
 * Every version of an idea runs in the same futures, so the versions differ only by design.
 * Deterministic. Not a forecast.
 */
export function simulateWorlds(p: Proposal, opts: { support: number; reserveB: number; n?: number }): WorldsResult {
  const n = opts.n ?? WORLD_COUNT;
  const variant = p.variant ?? "full";
  const r = mulberry32(hash(`worlds:${p.id}`));
  const normal = () => Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r());
  const complexity = p.changeLevel / 6;
  const scale = VARIANT_DEFS[variant].cost;
  const cost = p.costB ?? 0;
  const reserve = Math.max(0.01, opts.reserveB);

  const f = { capacity: [] as number[], uptake: [] as number[], overrun: [] as number[], delay: [] as number[], swing: [] as number[] };
  const value: number[] = [];
  let good = 0; let poor = 0; let stress = 0;
  for (let i = 0; i < n; i++) {
    const capacity = r();
    const uptake = 0.6 + r() * 0.7;
    const overrun = Math.exp(normal() * OVERRUN_SD[variant]);
    const delay = r();
    const swing = normal() * 0.1;

    // Bigger rollouts lean harder on staff and admin capacity; a pilot barely strains it.
    const capFactor = 1 - (0.2 + 0.5 * complexity) * (1 - capacity) * (0.35 + 0.65 * scale);
    const delayFactor = 1 - 0.3 * delay * (0.3 + complexity) * (0.5 + 0.5 * scale);
    const supportFactor = Math.max(0.6, Math.min(1.2, 1 + (opts.support - 0.5 + swing) * 0.6));
    const overrunB = cost * (overrun - 1);
    const overBudget = overrunB > reserve;
    const costDrag = overrunB > 0 ? Math.min(0.5, (overrunB / reserve) * 0.25) : 0;
    const v = uptake * capFactor * delayFactor * supportFactor - costDrag;

    if (overBudget && overrunB > 0.001) stress++;
    if (v >= 0.66) good++;
    else if (v < 0.42) poor++;
    f.capacity.push(capacity); f.uptake.push(uptake); f.overrun.push(overrun); f.delay.push(delay); f.swing.push(swing);
    value.push(v);
  }

  const labels: Record<keyof typeof f, string> = {
    capacity: "Staff and admin capacity",
    uptake: "Uptake by the people it's for",
    overrun: "Cost overruns",
    delay: "Implementation delays",
    swing: "Public support holding up",
  };
  const drivers = (Object.keys(f) as (keyof typeof f)[])
    .map((k) => {
      const c = correlation(f[k], value);
      return { label: labels[k], helps: (c >= 0 ? "higher" : "lower") as "higher" | "lower", weight: round(Math.abs(c), 2) };
    })
    .filter((d) => d.weight >= 0.05)
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 4);

  const mixed = n - good - poor;
  return { n, good, mixed, poor, robustness: round((good + mixed / 2) / n, 2), budgetStress: round(stress / n, 2), drivers };
}

/* ------------------------------------------------------------------ */
/* Per-idea report for one package                                     */
/* ------------------------------------------------------------------ */

const DEFERRED_LABELS: Record<string, { key: string; label: string }> = {
  "Doesn't fit the remaining budget": { key: "budget", label: "Annual budget" },
  "Below democratic support floor": { key: "support", label: "Not enough public support yet" },
  "More opposition than support": { key: "opposition", label: "More opposition than support" },
  "Low overall score": { key: "score", label: "Scores below the plan's cutoff" },
  "Need already addressed by higher-scoring items": { key: "covered", label: "Need already covered by stronger options" },
};

const STRENGTHS: { key: keyof Context["stats"][string] | "welfare" | "fairness" | "feasibility" | "reversibility" | "evidence"; label: string; min: number }[] = [
  { key: "support", label: "Public support", min: 0.5 },
  { key: "welfare", label: "Expected welfare gain", min: 0.3 },
  { key: "fairness", label: "Few strongly opposed", min: 0.85 },
  { key: "feasibility", label: "Feasible with existing law", min: 0.6 },
  { key: "reversibility", label: "Easy to reverse", min: 0.75 },
  { key: "evidence", label: "Evidence", min: 0.6 },
];

function feasibilityOf(p: Proposal, st: ProposalStats, timeline: string) {
  const support = st.support;
  const political = clamp01(0.55 * support + 0.45 * (1 - p.changeLevel / 6) - 0.8 * st.strongOppose);
  const administrative = clamp01(1 - 0.5 * (p.changeLevel / 6) - (unset(p.authority) ? 0.25 : 0) - Math.min(0.25, (p.costB ?? 0) / 40));
  const evidence = p.evidence;
  return {
    political: round(political, 2),
    administrative: round(administrative, 2),
    support: round(support, 2),
    evidence: round(evidence, 2),
    overall: round((political + administrative + support + evidence) / 4, 2),
    timeline,
  };
}

/** The context with one idea swapped for another version, its votes re-simulated. */
function contextWithVersion(ctx: Context, version: Proposal): Context {
  return {
    ...ctx,
    proposals: ctx.proposals.map((p) => (p.id === version.id ? version : p)),
    stats: { ...ctx.stats, [version.id]: proposalStats(ctx.db, POPULATION, version) },
  };
}

function fitOf(pkg: PackageResult, id: string): VariantFit {
  if (pkg.items.some((it) => it.proposal.id === id)) return "fits";
  if (pkg.waiting.some((w) => w.id === id) || (pkg.challengerStreak[id] ?? 0) > 0) return "contender";
  return "no";
}

export interface IdeaReportOptions {
  /** Re-run synthesis with each version to see which would make the plan. Off for cheap views. */
  fitTests?: boolean;
}

export function ideaReports(ctx: Context, pkg: PackageResult, opts: PackageOptions, cfg: IdeaReportOptions = {}): IdeaReport[] {
  const ideas = ctx.proposals.filter((p) => p.emergent);
  if (!ideas.length) return [];
  const rows = new Map(scoreAll(ctx, opts.weights, opts.lambda).map((r) => [r.p.id, r]));
  const needs = [...NEEDS, ...ctx.db.emergentNeeds];
  const remaining = Math.max(0, pkg.budget - pkg.totalCost);

  return ideas.map((p): IdeaReport => {
    const stored = ctx.db.emergent.find((x) => x.id === p.id) ?? p;
    const full = designedIdea(stored, ctx.db.answers ?? [], PROPOSALS, ctx.db.votesByVoter ?? {});
    const variant: VariantId = p.variant ?? "full";
    const st = ctx.stats[p.id]!;
    const need = needs.find((n) => n.id === p.needId);
    const interp = stored.interpretation;
    const analog = interp?.analogId ? PROPOSALS.find((c) => c.id === interp.analogId) : undefined;

    const inPlan = pkg.items.some((it) => it.proposal.id === p.id);
    const waiting = pkg.waiting.find((w) => w.id === p.id);
    const deferred = pkg.deferred.find((d) => d.id === p.id);
    const blocked = pkg.blocked.find((b) => b.title === p.title);
    const costed = full.costB !== null;

    let status: IdeaReport["status"];
    let constraint: IdeaReport["constraint"];
    if (inPlan) status = "in_plan";
    else if (blocked) { status = "blocked"; constraint = { key: "rights", label: "Rights constraint", detail: blocked.issue }; }
    else if (!costed) {
      status = "needs_design";
      constraint = { key: "uncosted", label: "Not designed yet", detail: "It has no cost or way to run it yet, so the plan can't weigh it. Make this possible turns it into a concrete, costed proposal with smaller versions to choose from." };
    } else if (waiting) {
      status = "waiting";
      constraint = { key: "pace", label: "Pace of change", detail: `The plan limits how much changes in one run. ${waiting.reasonDetail}` };
    } else {
      status = "not_funded";
      const m = (deferred && DEFERRED_LABELS[deferred.reason]) ?? { key: "score", label: "Scores below the plan's cutoff" };
      let detail = deferred?.reasonDetail ?? "";
      if (m.key === "budget") {
        const over = Math.max(0, (p.costB ?? 0) - remaining);
        detail = `Including it as written would go over the $${pkg.budget}B budget by ${money(over)}. ${deferred?.reasonDetail ?? ""}`.trim();
      } else if (m.key === "support") {
        detail = `${Math.round(st.support * 100)}% support; the plan needs at least ${Math.round((opts.minSupport ?? 0.3) * 100)}%.`;
      }
      constraint = { key: m.key, label: m.label, detail };
    }

    const row = rows.get(p.id);
    const strengths = row && costed ? STRENGTHS.filter((s) => (row.parts as unknown as Record<string, number>)[s.key]! >= s.min).map((s) => s.label) : [];

    // Versions, each with its own simulated futures and (if asked) whether the plan would take it.
    const counts = variantCounts(stored.variantChoices);
    const testFits = cfg.fitTests !== false && costed && !inPlan && !blocked;
    const variants: IdeaVariantReport[] = variantsFor(full).map((spec) => {
      const version = applyVariant(full, spec.id);
      const isCurrent = spec.id === variant;
      const stV = isCurrent ? st : proposalStats(ctx.db, POPULATION, version);
      let fit: VariantFit | undefined;
      if (inPlan && isCurrent) fit = "fits";
      else if (testFits) {
        fit = isCurrent ? fitOf(pkg, p.id) : fitOf(synthesizePackage(contextWithVersion(ctx, version), { ...opts, _noExplain: true }), p.id);
      }
      const reserveB = Math.max(CONTINGENCY * pkg.budget, inPlan && isCurrent ? remaining : remaining - spec.costB);
      return { ...spec, current: isCurrent, fit, recommended: false, votes: counts[spec.id], worlds: simulateWorlds(version, { support: stV.support, reserveB }) };
    });

    // Recommend the version that does the most good among those the plan would take.
    if (!inPlan) {
      const best = variants
        .filter((v) => v.fit === "fits")
        .sort((a, b) => b.effectiveness - a.effectiveness || a.costB - b.costB)[0];
      if (best) best.recommended = true;
    }

    const options: IdeaOption[] = [];
    if (costed && !inPlan && !blocked) {
      const rank = { fits: 0, contender: 1, no: 2 } as const;
      for (const v of variants.filter((x) => !x.current).sort((a, b) => rank[a.fit ?? "no"] - rank[b.fit ?? "no"] || b.effectiveness - a.effectiveness)) {
        options.push({ kind: "variant", variant: v.id, fit: v.fit, recommended: v.recommended, text: `${v.label} · ${money(v.costB)}/yr` });
      }
      if (constraint?.key === "budget" && testFits) {
        // Raising the budget funds higher-ranked waiting items first, so the shortfall alone
        // usually isn't enough. Find the budget (in the $5B steps the settings use) that gets it in.
        const shortfall = Math.max(0, (p.costB ?? 0) - remaining);
        const start = Math.ceil((pkg.budget + shortfall) / BUDGET_STEP) * BUDGET_STEP;
        for (let b = start; b <= Math.min(MAX_BUDGET, pkg.budget + MAX_BUDGET_RAISE); b += BUDGET_STEP) {
          const fit = fitOf(synthesizePackage(ctx, { ...opts, budget: b, _noExplain: true }), p.id);
          if (fit === "no") continue;
          const amountB = round(b - pkg.budget, 2);
          const how = fit === "fits" ? "higher-ranked items get funded first" : "it joins over the next runs, as the plan's limit on change per run allows";
          options.push({ kind: "budget", amountB, budgetB: b, fit, text: `Raise the annual budget to $${b}B (+${money(amountB)}); ${how}` });
          break;
        }
      }
      if (deferred?.replaceIds?.length) {
        const titles = deferred.replaceIds.map((id) => ctx.proposals.find((x) => x.id === id)?.title ?? id);
        const named = titles.slice(0, 2).join(" + ");
        const more = titles.length > 2 ? ` and ${titles.length - 2} more` : "";
        options.push({ kind: "replace", replaceIds: deferred.replaceIds, text: `Replace lower-ranked spending: ${named}${more}` });
      }
    }

    const realVotes = Object.values(ctx.db.votesByVoter ?? {}).filter((m) => m?.[p.id]).length;
    const stages: Record<IdeaStage, boolean> = {
      idea: true,
      clarified: Boolean(interp) || stored.costEstimate === "assessed",
      costed,
      jurisdiction: costed && !unset(full.authority) && !unset(full.jurisdiction),
      evidence: stored.costEstimate === "assessed" || Boolean(analog),
      designed: costed && variants.length > 0,
      simulated: costed,
      review: realVotes > 0 || (stored.variantChoices?.length ?? 0) > 0 || (stored.estimates?.length ?? 0) > 0,
      included: inPlan,
    };
    const stage: IdeaStage = inPlan ? "included" : IDEA_STAGES.find((s) => !stages[s]) ?? "included";

    const costBasis = full.costEstimate === "assessed" ? "Cost reviewed by a person."
      : full.costEstimate === "citizen" ? `Cost is the middle of ${stored.estimates?.length ?? 1} voter estimate${(stored.estimates?.length ?? 1) === 1 ? "" : "s"}.`
      : full.costEstimate === "designed" ? (analog ? `Full cost modeled on ${analog.title} (${money(analog.costB ?? 0)}/yr).` : "Full cost set at the typical cost of this need's programs.")
      : full.costEstimate === "provisional" ? "Cost set at the typical cost of this need's programs, because enough people back it."
      : undefined;

    const current = variants.find((v) => v.current);
    const statusText = status === "in_plan" ? `In the plan${variant !== "full" ? ` as: ${VARIANT_DEFS[variant].label.toLowerCase()}` : ""}`
      : status === "waiting" ? "Waiting: the plan limits how much changes per run"
      : status === "blocked" ? "Blocked by a rights constraint"
      : status === "needs_design" ? "Needs a concrete design"
      : variants.some((v) => v.fit === "fits") ? "Can't fit as written, but a smaller version can"
      : "Can't fit as written";

    return {
      id: p.id,
      needId: p.needId,
      needLabel: need?.label ?? p.needId,
      title: interp?.title || stored.title,
      original: stored.sourceText || stored.title,
      intent: interp?.intent,
      implementation: interp?.implementation || (unset(full.authority) ? "Not designed yet." : `Run by ${full.authority}.`),
      assumptions: [...(costBasis ? [costBasis] : []), ...(interp?.assumptions ?? [])],
      interpretedBy: interp?.provider,
      analog: analog ? { id: analog.id, title: analog.title } : undefined,
      status,
      statusText,
      stages,
      stage,
      costB: p.costB,
      costSource: full.costEstimate,
      variant,
      support: st.support,
      feasibility: costed ? feasibilityOf(p, st, current?.timeline ?? "") : undefined,
      jurisdiction: costed ? { authority: full.authority, jurisdiction: full.jurisdiction, legalChange: full.legalChange, changeLevel: p.changeLevel } : undefined,
      constraint,
      strengths,
      variants,
      options,
      worlds: current?.worlds,
    };
  });
}

/** Attach idea reports to each package, using the same options synthesis used. */
export function attachIdeaReports(ctx: Context, packages: PackageResult[], options: PackageOptions[], cfg: IdeaReportOptions = {}): PackageResult[] {
  for (const pkg of packages) {
    const o = options.find((x) => x.id === pkg.id);
    if (o) pkg.ideas = ideaReports(ctx, pkg, o, cfg);
  }
  return packages;
}
