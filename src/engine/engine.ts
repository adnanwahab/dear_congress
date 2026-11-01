import { CHANGE_LEVELS, NEEDS, PROPOSALS } from "./catalog";
import type {
  DB, Extraction, JournalEntry, NeedDef, NeedDemand, Objection, PackageResult, PlanItem,
  Proposal, ProposalStats, ScoreParts, Stance, UserVote, Weights,
} from "./types";

/* ------------------------------------------------------------------ */
/* Extraction: journal text → needs, concerns, constraints, proposals  */
/* Rule-based so the prototype runs offline. Swap `extract` for an LLM */
/* call; everything downstream only depends on the Extraction shape.   */
/* ------------------------------------------------------------------ */

const STOP = new Set(["that", "this", "with", "have", "from", "they", "will", "would", "should", "there", "their", "about", "more", "make", "into", "than", "then", "them", "what", "when", "which", "just", "like", "because", "been", "were", "also", "only", "some", "your", "does", "for", "and", "the", "our", "but", "not", "are", "can", "all"]);
export const tokens = (s: string) => (s.toLowerCase().match(/[a-z0-9]{3,}/g) ?? []).filter((w) => !STOP.has(w));

const INTENSIFIERS = ["awful", "terrible", "can't", "cannot", "impossible", "eating", "desperate", "scared", "every month", "every time", "struggling", "two jobs", "exhausted", "please", "worst", "again", "barely", "half my income", "worse"];

// Keywords match at the start of a word, so "lease" doesn't fire on "please",
// "rent" on "parents", or "bus" on "business". Longer keywords stay prefix
// stems ("subsid" → "subsidies", "evict" → "eviction"); 1–3 letter keywords
// must be the whole word plus a simple ending ("bus" → "buses", not "busy").
const KEYWORD_RE = new Map<string, RegExp>();
export function hasKeyword(lowerText: string, keyword: string): boolean {
  const k = keyword.toLowerCase().trim();
  if (!k) return false;
  let re = KEYWORD_RE.get(k);
  if (!re) {
    const esc = k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    re = new RegExp(k.length <= 3 ? `\\b${esc}(?:s|es|ed|ing)?\\b` : `\\b${esc}`);
    KEYWORD_RE.set(k, re);
  }
  return re.test(lowerText);
}

export function extract(text: string, proposals: Proposal[] = PROPOSALS, needsCatalog: NeedDef[] = NEEDS): Extraction {
  const t = text.toLowerCase();
  const needs = needsCatalog.map((n) => {
    const hits = n.keywords.filter((k) => hasKeyword(t, k)).length;
    return { id: n.id, confidence: hits ? Math.min(1, 0.45 + hits * 0.2) : 0 };
  })
    .filter((n) => n.confidence > 0)
    .sort((a, b) => b.confidence - a.confidence);

  const intens = INTENSIFIERS.filter((w) => hasKeyword(t, w)).length;
  const importance = Math.min(0.98, 0.45 + intens * 0.1 + (/\$\s?\d/.test(text) ? 0.1 : 0) + (text.includes("!") ? 0.05 : 0));

  const sentences = text.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean);
  const concerns = sentences.filter((s) => /\b(don't|do not|worried|worry|afraid|concern|shouldn't|too high|too much|not just)\b/i.test(s));

  const constraints: string[] = [];
  for (const m of text.matchAll(/(?:don't|do not) want to ([^.,!?]+)/gi)) constraints.push(`wants to avoid: ${m[1]!.trim()}`);
  for (const m of text.matchAll(/(?:want|wants) to (choose|keep|stay) ([^.,!?]+)/gi)) constraints.push(`wants to ${m[1]} ${m[2]!.trim()}`);

  const proposalIds = proposals.filter((p) => p.keywords.some((k) => hasKeyword(t, k)) && needs.some((n) => n.id === p.needId)).map((p) => p.id);

  return { needs, importance: round(importance), concerns, constraints, proposalIds };
}

/** Map an open-ended "how should we fix it?" answer to an existing proposal cluster, or null if it's new. */
export function clusterAnswer(text: string, needId: string, proposals: Proposal[]): string | null {
  const t = text.toLowerCase();
  const tk = new Set(tokens(text));
  let best: string | null = null;
  let bestScore = 0;
  for (const p of proposals.filter((p) => p.needId === needId)) {
    const kw = p.keywords.filter((k) => hasKeyword(t, k)).length;
    const pt = new Set(tokens(p.title + " " + (p.sourceText ?? "")));
    const inter = [...tk].filter((w) => pt.has(w)).length;
    const jac = inter / Math.max(1, new Set([...tk, ...pt]).size);
    const score = kw + jac * 3;
    if (score > bestScore) { bestScore = score; best = p.id; }
  }
  return bestScore >= 0.75 ? best : null;
}

/* ------------------------------------------------------------------ */
/* Simulated population — stands in for millions of participants.     */
/* Deterministic so results are reproducible.                          */
/* ------------------------------------------------------------------ */

function mulberry32(a: number) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
const noise = (voter: number, key: string) => mulberry32(hash(`${key}:${voter}`))() - 0.5;
const clamp = (x: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, x));
const round = (x: number, d = 3) => Math.round(x * 10 ** d) / 10 ** d;

export const ARCHETYPES = [
  { name: "Working parents", share: 0.24, fiscal: 0.35, change: 0.3, pri: { childcare: 0.32, housing: 0.18, healthcare: 0.14, transit: 0.1, fiscal: 0.06 } },
  { name: "Urban renters", share: 0.2, fiscal: 0.2, change: 0.2, pri: { housing: 0.34, transit: 0.28, mental_health: 0.1, healthcare: 0.08, streets: 0.06 } },
  { name: "Small-business owners", share: 0.14, fiscal: 0.8, change: 0.6, pri: { small_business: 0.36, fiscal: 0.24, insurance: 0.1, streets: 0.08, healthcare: 0.08 } },
  { name: "Flood-zone homeowners", share: 0.22, fiscal: 0.6, change: 0.5, pri: { flooding: 0.34, insurance: 0.28, streets: 0.1, fiscal: 0.12 } },
  { name: "Health & caregiving", share: 0.2, fiscal: 0.35, change: 0.35, pri: { healthcare: 0.32, mental_health: 0.28, childcare: 0.08, housing: 0.08 } },
] as const;

export interface Voter { id: number; archetype: string; pri: Record<string, number>; fiscal: number; change: number }

export function makePopulation(n = 600, seed = 42): Voter[] {
  const r = mulberry32(seed);
  const voters: Voter[] = [];
  for (let i = 0; i < n; i++) {
    let x = r();
    const a = ARCHETYPES.find((a) => (x -= a.share) < 0) ?? ARCHETYPES[0];
    const raw: Record<string, number> = {};
    for (const need of NEEDS) raw[need.id] = ((a.pri as Record<string, number>)[need.id] ?? 0.03) * (0.5 + r());
    const sum = Object.values(raw).reduce((s, v) => s + v, 0);
    for (const k in raw) raw[k] = raw[k]! / sum;
    voters.push({ id: i, archetype: a.name, pri: raw, fiscal: clamp(a.fiscal + (r() - 0.5) * 0.4), change: clamp(a.change + (r() - 0.5) * 0.4) });
  }
  return voters;
}

export const POPULATION = makePopulation();

export function utility(v: Voter, p: Proposal): number {
  const cost = p.costB ?? 3;
  let u = 4 * (v.pri[p.needId] ?? 0) * p.effectiveness + 0.35;
  u -= (v.fiscal * Math.min(cost, 80)) / 40;
  u -= (v.change * p.changeLevel) / 5;
  if (p.benefitsFiscal) u += v.fiscal * 1.6 - (1 - v.fiscal) * 0.6;
  if (p.rightsIssue) u += 0.5; // deliberately popular: shows the hard constraint working
  return u + noise(v.id, p.id);
}

export function stanceOf(u: number): Stance {
  if (u > 1.0) return 2;
  if (u > 0.4) return 1;
  if (u > -0.15) return 0;
  if (u > -0.7) return -1;
  return -2;
}

export function objectionsFor(p: Proposal): Omit<Objection, "share">[] {
  const o: Omit<Objection, "share">[] = [];
  if ((p.costB ?? 3) >= 5) o.push({ key: "cost", text: "Spending is too high — who pays for it?", mitigation: "Income-targeted eligibility, annual cost review, and a 5-year sunset unless renewed" });
  if (p.changeLevel >= 3) o.push({ key: "change", text: "Too big a change to existing law", mitigation: "Start as a 24-month pilot in 5 jurisdictions before full rollout" });
  if (p.benefitsFiscal && (p.costB ?? 0) > 1) o.push({ key: "services", text: "Cuts revenue for services people rely on", mitigation: "Phase in only when revenue targets are met" });
  if (["childcare", "housing"].includes(p.needId) && (p.costB ?? 0) > 1) o.push({ key: "prices", text: "Subsidies may just push prices up", mitigation: "Provider price monitoring, paired with supply-side measures in the same package" });
  if (p.needId === "childcare" && p.id !== "cc_licensing") o.push({ key: "choice", text: "May disadvantage stay-at-home parents or limit choice", mitigation: "Benefit usable at any licensed provider, including home-based care" });
  o.push({ key: "reach", text: "Benefits may not reach the people who need them", mitigation: "Publish outcome metrics quarterly and auto-adjust eligibility" });
  return o;
}

function pickObjection(v: Voter, objs: Omit<Objection, "share">[], pid: string) {
  const has = (k: string) => objs.find((o) => o.key === k);
  if (v.fiscal > 0.55 && has("cost")) return "cost";
  if (v.change > 0.5 && has("change")) return "change";
  if (v.fiscal < 0.4 && has("services")) return "services";
  const n = noise(v.id, pid + ":obj");
  if (n > 0.1 && has("prices")) return "prices";
  if (n < -0.1 && has("choice")) return "choice";
  return "reach";
}

/* ------------------------------------------------------------------ */
/* Aggregation                                                         */
/* ------------------------------------------------------------------ */

export interface Context {
  needs: NeedDef[];
  proposals: Proposal[];
  stats: Record<string, ProposalStats>;
  demand: Record<string, NeedDemand>;
  mechanismShare: Record<string, number>;
  goalSupport: Record<string, number>;
  entries: JournalEntry[];
  db: DB;
}

const BLEND_K = 20;
export const JOURNAL_SATURATION_K = 3;
export const STABILITY_BONUS = 0.04;

function blendWeight(realVoices: number) {
  return realVoices / (realVoices + BLEND_K);
}

function classifyRealVotes(votes: UserVote[]) {
  let sup = 0, neu = 0, opp = 0, strong = 0;
  for (const uv of votes) {
    if (uv.stance > 0) sup++;
    else if (uv.stance === 0) neu++;
    else {
      opp++;
      if (uv.stance === -2) strong++;
    }
  }
  return { sup, neu, opp, strong, n: votes.length };
}

export interface ContextOptions {
  /** Count journals from simulated residents. Off by default so they never outweigh real people. */
  includeSynthetic?: boolean;
  /** Request-scoped, non-persistent what-if entries. Always counted for that request. */
  extraEntries?: JournalEntry[];
}

/** The journal entries that should count toward needs, demand and quotes. */
export function countedEntries(db: DB, opts: ContextOptions = {}): JournalEntry[] {
  const base = opts.includeSynthetic ? db.entries : db.entries.filter((e) => !e.synthetic);
  if (!opts.extraEntries?.length) return base;
  return [...base, ...opts.extraEntries];
}

export function buildContext(db: DB, voters: Voter[] = POPULATION, opts: ContextOptions = {}): Context {
  const entries = countedEntries(db, opts);
  const needs = [...NEEDS, ...db.emergentNeeds];
  const proposals = [...PROPOSALS, ...db.emergent];

  const stats: Record<string, ProposalStats> = {};
  for (const p of proposals) {
    const objs = objectionsFor(p);
    const objCount: Record<string, number> = {};
    let supSim = 0; let neuSim = 0; let oppSim = 0; let strongSim = 0;
    for (const v of voters) {
      const s = stanceOf(utility(v, p));
      if (s > 0) supSim++;
      else if (s === 0) neuSim++;
      else {
        oppSim++;
        if (s === -2) strongSim++;
        const k = pickObjection(v, objs, p.id);
        objCount[k] = (objCount[k] ?? 0) + 1;
      }
    }

    const realVotes = Object.values(db.votesByVoter ?? {})
      .map((m) => m?.[p.id])
      .filter((v): v is UserVote => Boolean(v));
    const r = classifyRealVotes(realVotes);

    const simN = Math.max(1, voters.length);
    const supportSim = supSim / simN;
    const neutralSim = neuSim / simN;
    const opposeSim = oppSim / simN;
    const strongOpposeSim = strongSim / simN;

    const supportReal = r.n ? r.sup / r.n : supportSim;
    const neutralReal = r.n ? r.neu / r.n : neutralSim;
    const opposeReal = r.n ? r.opp / r.n : opposeSim;
    const strongOpposeReal = r.n ? r.strong / r.n : strongOpposeSim;

    const wReal = blendWeight(r.n);

    stats[p.id] = {
      n: voters.length + r.n,
      support: round(wReal * supportReal + (1 - wReal) * supportSim),
      neutral: round(wReal * neutralReal + (1 - wReal) * neutralSim),
      oppose: round(wReal * opposeReal + (1 - wReal) * opposeSim),
      strongOppose: round(wReal * strongOpposeReal + (1 - wReal) * strongOpposeSim),
      objections: objs.map((o) => ({ ...o, share: round((objCount[o.key] ?? 0) / Math.max(1, oppSim)) })).sort((a, b) => b.share - a.share),
    };
  }

  const mechCount: Record<string, number> = {};
  const goalYesSim: Record<string, number> = {};
  for (const v of voters) {
    for (const need of needs) {
      let best: Proposal | null = null;
      let bu = -Infinity;
      for (const p of proposals) if (p.needId === need.id) {
        const u = utility(v, p);
        if (u > bu) { bu = u; best = p; }
      }
      if (best) mechCount[best.id] = (mechCount[best.id] ?? 0) + 1;
      if (4 * (v.pri[need.id] ?? 0.03) + 0.55 - v.fiscal * 0.25 + noise(v.id, `goal:${need.id}`) > 0.3) {
        goalYesSim[need.id] = (goalYesSim[need.id] ?? 0) + 1;
      }
    }
  }

  const mechanismShare: Record<string, number> = {};
  for (const need of needs) {
    const needProposals = proposals.filter((p) => p.needId === need.id);
    const needAnswers = db.answers.filter((a) => a.needId === need.id);
    const realAnswerCount = needAnswers.length;
    const wReal = blendWeight(realAnswerCount);

    for (const p of needProposals) {
      const simShare = (mechCount[p.id] ?? 0) / Math.max(1, voters.length);
      const realCount = needAnswers.filter((a) => a.proposalId === p.id).length;
      const realShare = realAnswerCount ? realCount / realAnswerCount : simShare;
      mechanismShare[p.id] = round(wReal * realShare + (1 - wReal) * simShare);
    }
  }

  const goalSupport: Record<string, number> = {};
  for (const need of needs) {
    const sim = (goalYesSim[need.id] ?? 0) / Math.max(1, voters.length);
    const realVotes = Object.values(db.goalVotesByVoter ?? {})
      .map((m) => m?.[need.id])
      .filter((v): v is boolean => v !== undefined);
    const wReal = blendWeight(realVotes.length);
    const real = realVotes.length ? realVotes.filter(Boolean).length / realVotes.length : sim;
    goalSupport[need.id] = round(wReal * real + (1 - wReal) * sim);
  }

  return { needs, proposals, stats, demand: computeDemand(db, voters, needs, entries), mechanismShare, goalSupport, entries, db };
}

export function computeDemand(db: DB, voters: Voter[], needs: NeedDef[], entries: JournalEntry[] = countedEntries(db)): Record<string, NeedDemand> {
  const out: Record<string, NeedDemand> = {};
  const allAllocs = Object.values(db.allocationByVoter ?? {});
  const allocVoterCount = allAllocs.filter((a) => Object.values(a ?? {}).reduce((s, v) => s + v, 0) > 0).length;
  const wReal = blendWeight(allocVoterCount);

  for (const need of needs) {
    let js = 0;
    let jc = 0;
    for (const e of entries) {
      const hit = e.extraction.needs.find((n) => n.id === need.id);
      if (hit) {
        js += e.extraction.importance * hit.confidence;
        jc++;
      }
    }

    const simAvgPoints = voters.reduce((s, v) => s + (v.pri[need.id] ?? 0.03) * 100, 0) / Math.max(1, voters.length);
    const allocTotals = allAllocs
      .map((a) => a?.[need.id] ?? 0)
      .reduce((s, v) => s + v, 0);
    const realAvgPoints = allocVoterCount ? allocTotals / allocVoterCount : simAvgPoints;

    out[need.id] = {
      journalScore: round(js),
      journalCount: jc,
      avgPoints: round(wReal * realAvgPoints + (1 - wReal) * simAvgPoints, 1),
      demand: 0,
    };
  }

  const maxP = Math.max(...Object.values(out).map((d) => d.avgPoints), 1e-9);
  for (const d of Object.values(out)) {
    const journalPart = 1 - Math.exp(-d.journalScore / JOURNAL_SATURATION_K);
    d.demand = round(0.5 * journalPart + 0.5 * (d.avgPoints / maxP));
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Synthesis: score → minimal-change, budget-constrained package       */
/* ------------------------------------------------------------------ */

export const DEFAULT_WEIGHTS: Weights = { support: 0.3, welfare: 0.25, fairness: 0.15, feasibility: 0.1, reversibility: 0.1, evidence: 0.1 };

interface Row { p: Proposal; parts: ScoreParts; changeCost: number; score: number }
interface RankedRow extends Row { rankScore: number; getsBonus: boolean }
interface SelectionResult {
  selected: RankedRow[];
  deferred: Array<{ row: RankedRow; reason: string }>;
  blocked: PackageResult["blocked"];
  emerging: PackageResult["emerging"];
  spent: number;
}

export function scoreAll(ctx: Context, w: Weights, lambda: number): Row[] {
  const wsum = Object.values(w).reduce((s, v) => s + v, 0) || 1;
  return ctx.proposals.map((p) => {
    const st = ctx.stats[p.id]!;
    const parts: ScoreParts = {
      support: st.support,
      welfare: round(ctx.demand[p.needId]!.demand * p.effectiveness),
      fairness: round(clamp(1 - 2.5 * st.strongOppose)),
      feasibility: round(1 - p.changeLevel / 6),
      reversibility: p.reversibility,
      evidence: p.evidence,
    };
    const base = (Object.keys(w) as (keyof Weights)[]).reduce((s, k) => s + w[k] * parts[k], 0) / wsum;
    const changeCost = round((lambda * p.changeLevel) / 6);
    return { p, parts, changeCost, score: round(base - changeCost) };
  });
}

function runSelection(
  ctx: Context,
  rows: Row[],
  opts: { budget: number; perNeed: number; minScore: number; minSupport: number; incumbentIds: Set<string>; applyStabilityBonus: boolean },
): SelectionResult {
  const ranked: RankedRow[] = rows
    .map((r) => {
      const st = ctx.stats[r.p.id]!;
      const bonusEligible = opts.incumbentIds.has(r.p.id)
        && !r.p.rightsIssue
        && r.p.costB !== null
        && st.support > st.oppose
        && st.support >= opts.minSupport;
      const getsBonus = opts.applyStabilityBonus && bonusEligible;
      return { ...r, getsBonus, rankScore: round(r.score + (getsBonus ? STABILITY_BONUS : 0)) };
    })
    .sort((a, b) => b.rankScore - a.rankScore || b.score - a.score || a.p.id.localeCompare(b.p.id));

  const selected: RankedRow[] = [];
  const deferred: Array<{ row: RankedRow; reason: string }> = [];
  const blocked: PackageResult["blocked"] = [];
  const emerging: PackageResult["emerging"] = [];
  const perNeedCount: Record<string, number> = {};
  let spent = 0;

  for (const r of ranked) {
    const st = ctx.stats[r.p.id]!;
    if (r.p.rightsIssue) { blocked.push({ title: r.p.title, support: st.support, issue: r.p.rightsIssue }); continue; }
    if (r.p.costB === null) { emerging.push({ title: r.p.title, answers: ctx.db.answers.filter((a) => a.proposalId === r.p.id).length }); continue; }
    if (st.support <= st.oppose) { deferred.push({ row: r, reason: "More opposition than support" }); continue; }
    if (st.support < opts.minSupport) { deferred.push({ row: r, reason: "Below democratic support floor" }); continue; }
    if (r.rankScore < opts.minScore) { deferred.push({ row: r, reason: "Low overall score" }); continue; }
    if ((perNeedCount[r.p.needId] ?? 0) >= opts.perNeed) { deferred.push({ row: r, reason: "Need already addressed by higher-scoring items" }); continue; }
    if (spent + r.p.costB > opts.budget) { deferred.push({ row: r, reason: "Doesn't fit the remaining budget" }); continue; }
    spent += r.p.costB;
    perNeedCount[r.p.needId] = (perNeedCount[r.p.needId] ?? 0) + 1;
    selected.push(r);
  }

  return { selected, deferred, blocked, emerging, spent };
}

export function synthesizePackage(
  ctx: Context,
  opts: { id: string; name: string; description: string; weights: Weights; lambda: number; budget: number; perNeed?: number; minScore?: number; minSupport?: number; previous?: string[] },
): PackageResult {
  const { budget, perNeed = 2, minScore = 0.3, minSupport = 0.3, previous = [] } = opts;
  const rows = scoreAll(ctx, opts.weights, opts.lambda);
  const incumbentIds = new Set(previous);

  const withStability = runSelection(ctx, rows, { budget, perNeed, minScore, minSupport, incumbentIds, applyStabilityBonus: true });
  const withoutStability = runSelection(ctx, rows, { budget, perNeed, minScore, minSupport, incumbentIds, applyStabilityBonus: false });

  const selectedWithout = new Set(withoutStability.selected.map((r) => r.p.id));

  const maxDeferredScore = withStability.deferred.reduce((m, d) => Math.max(m, d.row.rankScore), minScore);
  const cutoffScore = withStability.selected.reduce((m, s) => Math.min(m, s.rankScore), Number.POSITIVE_INFINITY);
  const effectiveCutoff = Number.isFinite(cutoffScore) ? cutoffScore : minScore;

  const items: PlanItem[] = withStability.selected.map((r) => {
    const keptForStability = r.getsBonus && !selectedWithout.has(r.p.id);
    const margin = round(r.rankScore - Math.max(minScore, maxDeferredScore));
    return buildItem(ctx, r, keptForStability, margin);
  });

  const deferred: PackageResult["deferred"] = withStability.deferred.map((d) => ({
    title: d.row.p.title,
    costB: d.row.p.costB ?? 0,
    support: ctx.stats[d.row.p.id]!.support,
    reason: d.reason,
    margin: round(Math.max(minScore, effectiveCutoff) - d.row.rankScore),
  }));

  const prevSet = new Set(previous);
  const currentIds = items.map((i) => i.proposal.id);
  const currentSet = new Set(currentIds);
  const added = currentIds.filter((id) => !prevSet.has(id));
  const removed = previous.filter((id) => !currentSet.has(id));
  const costById = new Map(ctx.proposals.map((p) => [p.id, p.costB ?? 0]));
  const moneyMovedB = round([...added, ...removed].reduce((sum, id) => sum + (costById.get(id) ?? 0), 0), 2);

  const unfundedPopularCost = deferred.filter((d) => d.reason.startsWith("Doesn't fit")).reduce((s, d) => s + d.costB, 0);
  return {
    id: opts.id, name: opts.name, description: opts.description,
    items, totalCost: round(withStability.spent, 2), budget,
    avgSupport: round(items.reduce((s, i) => s + i.stats.support, 0) / Math.max(1, items.length)),
    avgChange: round(items.reduce((s, i) => s + i.proposal.changeLevel, 0) / Math.max(1, items.length), 2),
    deferred, blocked: withStability.blocked, emerging: withStability.emerging, unfundedPopularCost: round(unfundedPopularCost, 2),
    changesFromPrevious: { added, removed, moneyMovedB },
  };
}

function buildItem(ctx: Context, r: Row, keptForStability: boolean, margin: number): PlanItem {
  const p = r.p;
  const st = ctx.stats[p.id]!;
  const need = ctx.needs.find((n) => n.id === p.needId) ?? NEEDS.find((n) => n.id === p.needId)!;
  const quotes = ctx.entries
    .filter((e) => e.extraction.needs.some((n) => n.id === p.needId))
    .sort((a, b) => Number(!!a.seeded) - Number(!!b.seeded) || b.extraction.importance - a.extraction.importance)
    .slice(0, 3)
    .map((e) => ({ author: e.author, text: e.text }));
  const mitigations = st.objections.filter((o) => o.share >= 0.15).map((o) => o.mitigation);
  const rollout = p.changeLevel >= 3 || p.reversibility < 0.5
    ? "Pilot in 5 jurisdictions for 24 months, then review against metrics"
    : "Roll out through the existing mechanism, with a 24-month review";
  return {
    proposal: p,
    needLabel: need.label,
    score: r.score, parts: r.parts, changeCost: r.changeCost,
    stats: st,
    demand: ctx.demand[p.needId]!,
    mechanismShare: ctx.mechanismShare[p.id] ?? 0,
    quotes,
    yourAnswers: ctx.db.answers.filter((a) => a.proposalId === p.id).map((a) => a.text),
    mitigations,
    rollout,
    newAgency: p.changeLevel >= 5,
    keptForStability,
    margin,
    handoff: {
      proposal: p.title,
      citizen_support: st.support,
      citizen_opposition: st.oppose,
      need_addressed: need.label,
      cost_usd: Math.round((p.costB ?? 0) * 1e9),
      implementation: { authority: p.authority, mechanism: p.mechanism, jurisdiction: p.jurisdiction, new_agency_required: p.changeLevel >= 5 },
      legal_change: { type: CHANGE_LEVELS[p.changeLevel], detail: p.legalChange },
      amendments_from_dissent: mitigations,
      metrics: p.metrics,
      review_period: "24 months",
    },
  };
}

export function synthesize(
  ctx: Context,
  weights: Weights,
  lambda: number,
  budget: number,
  previous: Record<string, string[]> = {},
): PackageResult[] {
  return [
    synthesizePackage(ctx, { id: "A", name: "Balanced", description: "Your weights and change penalty", weights, lambda, budget, previous: previous.A ?? [] }),
    synthesizePackage(ctx, { id: "B", name: "Minimal change", description: "Same weights, strong penalty on institutional disruption", weights, lambda: lambda * 3 + 0.3, budget, previous: previous.B ?? [] }),
    synthesizePackage(ctx, { id: "C", name: "Most popular", description: "Ranks purely by citizen support (rights constraints still apply)", weights: { support: 1, welfare: 0, fairness: 0, feasibility: 0, reversibility: 0, evidence: 0 }, lambda: 0, budget, previous: previous.C ?? [] }),
  ];
}

export function emptyDB(): DB {
  return {
    entries: [],
    votes: {},
    allocation: {},
    goalVotes: {},
    votesByVoter: {},
    allocationByVoter: {},
    goalVotesByVoter: {},
    answers: [],
    emergent: [],
    emergentNeeds: [],
    lastPlan: {},
  };
}
