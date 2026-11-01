import { CHANGE_LEVELS, NEEDS, PROPOSALS, SEED_JOURNALS } from "./catalog";
import { applyVariant, chosenVariant } from "./variants";
import type {
  DB, Extraction, JournalEntry, NeedDef, NeedDemand, Objection, PackageDiffMap, PackageResult, PlanItem,
  Proposal, ProposalStats, ScoreParts, Stance, SynthesisOutcomes, UserVote, Weights,
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

export function mulberry32(a: number) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function hash(s: string) {
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

/**
 * Needs added after the original catalog. makePopulation draws one random number
 * per need, so a new need in that loop would shift the sequence and reshuffle every
 * voter's priorities, quietly changing every existing plan. These get their priority
 * from a separate per-voter hash instead, scaled like the others, so existing voters
 * (and all existing synthesis results) stay identical. Values are archetype weights.
 */
export const LATER_NEED_PRIORITIES: Record<string, Partial<Record<string, number>>> = {
  food_access: { "Working parents": 0.08, "Urban renters": 0.08 },
};

export function makePopulation(n = 600, seed = 42): Voter[] {
  const r = mulberry32(seed);
  const voters: Voter[] = [];
  for (let i = 0; i < n; i++) {
    let x = r();
    const a = ARCHETYPES.find((a) => (x -= a.share) < 0) ?? ARCHETYPES[0];
    const raw: Record<string, number> = {};
    for (const need of NEEDS) {
      if (need.id in LATER_NEED_PRIORITIES) continue;
      raw[need.id] = ((a.pri as Record<string, number>)[need.id] ?? 0.03) * (0.5 + r());
    }
    const sum = Object.values(raw).reduce((s, v) => s + v, 0);
    for (const k in raw) raw[k] = raw[k]! / sum;
    for (const [needId, byArchetype] of Object.entries(LATER_NEED_PRIORITIES)) {
      const draw = mulberry32(hash(`pri:${needId}:${seed}:${i}`))();
      raw[needId] = ((byArchetype[a.name] ?? 0.03) * (0.5 + draw)) / sum;
    }
    voters.push({ id: i, archetype: a.name, pri: raw, fiscal: clamp(a.fiscal + (r() - 0.5) * 0.4), change: clamp(a.change + (r() - 0.5) * 0.4) });
  }
  return voters;
}

export const POPULATION = makePopulation();

/** Cost voters weigh: the real cost, else the provisional estimate an idea would get, else a $3B guess. */
export function voterCostB(p: Proposal): number {
  return p.costB ?? provisionalCostFor(p.needId) ?? 3;
}

export function utility(v: Voter, p: Proposal): number {
  const cost = voterCostB(p);
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
  if (voterCostB(p) >= 5) o.push({ key: "cost", text: "Spending is too high — who pays for it?", mitigation: "Income-targeted eligibility, annual cost review, and a 5-year sunset unless renewed" });
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
  outcomes: { needs: Record<string, number>; items: Record<string, number>; maturing: Record<string, boolean> };
  db: DB;
}

const BLEND_K = 20;

function seededJournalReference() {
  const byNeed = new Map(NEEDS.map((n) => [n.id, 0]));
  for (const s of SEED_JOURNALS) {
    const ex = extract(s.text);
    for (const hit of ex.needs) {
      byNeed.set(hit.id, (byNeed.get(hit.id) ?? 0) + ex.importance * hit.confidence);
    }
  }
  const maxScore = Math.max(...byNeed.values(), 0);
  return maxScore > 0 ? round(maxScore) : 1;
}

/**
 * Fixed journal normalizer based only on seeded journals. This keeps needs independent
 * from later journal volume while preserving seeded baseline plan behavior.
 */
export const JOURNAL_REFERENCE = seededJournalReference();
export const JOURNAL_HALF_LIFE_DAYS = 365;

export const STABILITY_BONUS = 0.04;
export const CHALLENGER_PERSISTENCE = 2;
export const MAX_SWAPS_PER_RUN = 3;
export const MAX_MONEY_MOVED_B = 8;
export const CHURN_ESCALATION_RUNS = 3;


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
  /**
   * Optional time anchor. It does not age journals by wall-clock drift; it only caps
   * future-dated entries so age never goes negative.
   */
  now?: number | Date | string;
  outcomes?: SynthesisOutcomes;
}

/** The journal entries that should count toward needs, demand and quotes. */
export function countedEntries(db: DB, opts: ContextOptions = {}): JournalEntry[] {
  const base = opts.includeSynthetic ? db.entries : db.entries.filter((e) => !e.synthetic);
  if (!opts.extraEntries?.length) return base;
  return [...base, ...opts.extraEntries];
}

function normalizeOutcomes(outcomes: SynthesisOutcomes | undefined): { needs: Record<string, number>; items: Record<string, number>; maturing: Record<string, boolean> } {
  const normalized = {
    needs: {} as Record<string, number>,
    items: {} as Record<string, number>,
    maturing: {} as Record<string, boolean>,
  };
  if (!outcomes || typeof outcomes !== "object") return normalized;

  const clamp01 = (n: unknown) => Math.max(0, Math.min(1, Number(n)));
  for (const [needId, row] of Object.entries(outcomes.needs ?? {})) {
    if (!row || typeof row !== "object") continue;
    const severity = clamp01((row as { severity?: unknown }).severity);
    if (Number.isFinite(severity)) normalized.needs[needId] = severity;
  }
  for (const [proposalId, row] of Object.entries(outcomes.items ?? {})) {
    if (!row || typeof row !== "object") continue;
    const impact = clamp01((row as { impact?: unknown }).impact);
    if (Number.isFinite(impact)) normalized.items[proposalId] = impact;
    normalized.maturing[proposalId] = Boolean((row as { maturing?: unknown }).maturing);
  }
  return normalized;
}

/* ------------------------------------------------------------------ */
/* Citizen ideas → plan options                                        */
/* An idea starts uncosted (costB: null) and can only appear under     */
/* "Emerging". It enters the plan's ranking once it has a cost: either */
/* a reviewer assesses it, or enough distinct people back it and it    */
/* gets a provisional cost from the same need's catalog options.       */
/* ------------------------------------------------------------------ */

/** Distinct people who must back an idea before it gets a provisional cost. */
export const PROVISIONAL_MIN_BACKERS = 5;
/** Provisional ideas are untested: cap their evidence so tested programs keep the edge. */
export const PROVISIONAL_EVIDENCE = 0.3;

/**
 * Distinct people behind an idea: everyone who wrote an answer grouped into it, plus everyone
 * who voted Support or Strongly support on it. Answers without a voterId each count once.
 */
export function ideaBackers(answers: DB["answers"], proposalId: string, votesByVoter: DB["votesByVoter"] = {}): number {
  const people = new Set(answers.filter((a) => a.proposalId === proposalId).map((a) => a.voterId ?? `answer:${a.id}`));
  for (const [voterId, votes] of Object.entries(votesByVoter)) if ((votes[proposalId]?.stance ?? 0) >= 1) people.add(voterId);
  return people.size;
}

function median(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
}

/** The median cost of a need's catalog options, used as a stand-in for an uncosted idea. */
export function provisionalCostFor(needId: string, catalog: Proposal[] = PROPOSALS): number | null {
  const m = median(catalog.filter((p) => p.needId === needId && !p.emergent && !p.rightsIssue && p.costB !== null).map((p) => p.costB!));
  return m === null ? null : round(m, 2);
}

/** Cost for a designed idea when its need has no catalog programs to compare with. */
export const DEFAULT_DESIGN_COST_B = (() => {
  const m = median(PROPOSALS.filter((p) => !p.rightsIssue && p.costB !== null && p.changeLevel <= 2).map((p) => p.costB!));
  return m === null ? 1 : round(m, 2);
})();

const UNSET = new Set(["Unassigned", "To be determined", "Needs legal analysis", ""]);
const unset = (s: string | undefined) => UNSET.has((s ?? "").trim());

/**
 * The full-scale version of an idea, as the synthesizer should see it. Precedence: a reviewer's
 * assessment (stored costB), then voters' own estimates (median), then a design from
 * "Make this possible" (costed from its closest catalog program), then a provisional cost once
 * enough people back it. Unreviewed costs cap evidence, so tested programs keep the edge.
 */
export function designedIdea(p: Proposal, answers: DB["answers"], catalog: Proposal[] = PROPOSALS, votesByVoter: DB["votesByVoter"] = {}): Proposal {
  if (!p.emergent || p.costB !== null) return p;
  const evidence = Math.min(p.evidence, PROVISIONAL_EVIDENCE);
  const est = p.estimates ?? [];
  if (est.length) {
    const costB = round(median(est.map((e) => e.costB))!, 3);
    const changeLevel = Math.round(median(est.map((e) => e.changeLevel))!);
    const latestAuthority = [...est].reverse().find((e) => e.authority?.trim())?.authority?.trim();
    return { ...p, costB, changeLevel, evidence, ...(latestAuthority ? { authority: latestAuthority } : {}), costEstimate: "citizen" };
  }
  if (p.interpretation) {
    const analog = p.interpretation.analogId ? catalog.find((c) => c.id === p.interpretation!.analogId && c.costB !== null && !c.rightsIssue) : undefined;
    const costB = analog?.costB ?? provisionalCostFor(p.needId, catalog) ?? DEFAULT_DESIGN_COST_B;
    return {
      ...p,
      costB,
      evidence,
      ...(analog ? {
        changeLevel: analog.changeLevel,
        reversibility: analog.reversibility,
        ...(unset(p.mechanism) ? { mechanism: `Modeled on: ${analog.mechanism}` } : {}),
        ...(unset(p.authority) ? { authority: analog.authority } : {}),
        ...(unset(p.jurisdiction) ? { jurisdiction: analog.jurisdiction } : {}),
        ...(unset(p.legalChange) ? { legalChange: analog.legalChange } : {}),
        ...(p.metrics.length ? {} : { metrics: analog.metrics }),
      } : {}),
      costEstimate: "designed",
    };
  }
  if (ideaBackers(answers, p.id, votesByVoter) < PROVISIONAL_MIN_BACKERS) return p;
  const costB = provisionalCostFor(p.needId, catalog);
  if (costB === null) return p;
  return { ...p, costB, evidence, costEstimate: "provisional" };
}

/** An idea as the plan weighs it: the full version sized down to the version most voters chose. */
export function withProvisionalCost(p: Proposal, answers: DB["answers"], catalog: Proposal[] = PROPOSALS, votesByVoter: DB["votesByVoter"] = {}): Proposal {
  if (!p.emergent) return p;
  const full = designedIdea(p, answers, catalog, votesByVoter);
  if (full.costB === null) return full;
  return applyVariant(full, chosenVariant(p.variantChoices));
}

/** How the population and real voters split on one proposal. */
export function proposalStats(db: DB, voters: Voter[], p: Proposal): ProposalStats {
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

  return {
    n: voters.length + r.n,
    support: round(wReal * supportReal + (1 - wReal) * supportSim),
    neutral: round(wReal * neutralReal + (1 - wReal) * neutralSim),
    oppose: round(wReal * opposeReal + (1 - wReal) * opposeSim),
    strongOppose: round(wReal * strongOpposeReal + (1 - wReal) * strongOpposeSim),
    objections: objs.map((o) => ({ ...o, share: round((objCount[o.key] ?? 0) / Math.max(1, oppSim)) })).sort((a, b) => b.share - a.share),
  };
}

export function buildContext(db: DB, voters: Voter[] = POPULATION, opts: ContextOptions = {}): Context {
  const baseEntries = opts.includeSynthetic ? db.entries : db.entries.filter((e) => !e.synthetic);
  const whatIfEntries = opts.extraEntries ?? [];
  const entries = whatIfEntries.length ? [...baseEntries, ...whatIfEntries] : baseEntries;
  const needs = [...NEEDS, ...db.emergentNeeds];
  const proposals = [...PROPOSALS, ...db.emergent.map((p) => withProvisionalCost(p, db.answers ?? [], PROPOSALS, db.votesByVoter ?? {}))];
  const outcomes = normalizeOutcomes(opts.outcomes);

  const stats: Record<string, ProposalStats> = {};
  for (const p of proposals) stats[p.id] = proposalStats(db, voters, p);

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

  return {
    needs,
    proposals,
    stats,
    demand: computeDemand(db, voters, needs, entries, opts.now, whatIfEntries, outcomes.needs),
    mechanismShare,
    goalSupport,
    entries,
    outcomes,
    db,
  };
}

function normalizeNow(now: ContextOptions["now"]): number {
  if (typeof now === "number" && Number.isFinite(now)) return now;
  if (now instanceof Date) return now.getTime();
  if (typeof now === "string") {
    const t = Date.parse(now);
    if (Number.isFinite(t)) return t;
  }
  return Date.now();
}

function parseCreatedAtMs(createdAt: string | undefined): number | null {
  const t = Date.parse(String(createdAt || ""));
  return Number.isFinite(t) ? t : null;
}

function clampToCap(t: number, capMs: number) {
  return Math.min(t, capMs);
}

function newestClampedMs(entries: JournalEntry[], capMs: number): number {
  const times = entries
    .map((e) => parseCreatedAtMs(e.createdAt))
    .filter((t): t is number => t !== null)
    .map((t) => clampToCap(t, capMs));
  return times.length ? Math.max(...times) : capMs;
}

function ageDaysFromBase(baseMs: number, createdAt: string | undefined, capMs: number): number {
  const t = parseCreatedAtMs(createdAt);
  if (t === null) return 0;
  const ageMs = baseMs - clampToCap(t, capMs);
  return Math.max(0, ageMs / (24 * 60 * 60 * 1000));
}

export function computeDemand(
  db: DB,
  voters: Voter[],
  needs: NeedDef[],
  entries: JournalEntry[] = countedEntries(db),
  now: ContextOptions["now"] = undefined,
  extraEntries: JournalEntry[] = [],
  needSeverities: Record<string, number> = {},
): Record<string, NeedDemand> {
  const out: Record<string, NeedDemand> = {};
  const allAllocs = Object.values(db.allocationByVoter ?? {});
  const allocVoterCount = allAllocs.filter((a) => Object.values(a ?? {}).reduce((s, v) => s + v, 0) > 0).length;
  const wReal = blendWeight(allocVoterCount);
  const capMs = normalizeNow(now);

  const extraIds = new Set(extraEntries.map((e) => e.id));
  const storedEntries = entries.filter((e) => !extraIds.has(e.id));
  const requestExtras = entries.filter((e) => extraIds.has(e.id));

  // Stored entries age relative to the newest stored entry (never wall-clock drift).
  const storedBaseMs = newestClampedMs(storedEntries, capMs);
  // Request-scoped what-if entries age relative to request now (capped), if present.
  const extrasBaseMs = extraEntries.length ? capMs : storedBaseMs;

  for (const need of needs) {
    let js = 0;
    let jc = 0;
    let realJc = 0;
    let simJc = 0;

    for (const e of storedEntries) {
      const hit = e.extraction.needs.find((n) => n.id === need.id);
      if (!hit) continue;
      const ageDays = ageDaysFromBase(storedBaseMs, e.createdAt, capMs);
      const recencyWeight = 0.5 ** (ageDays / JOURNAL_HALF_LIFE_DAYS);
      js += e.extraction.importance * hit.confidence * recencyWeight;
      jc++;
      if (e.synthetic) simJc++;
      else realJc++;
    }

    for (const e of requestExtras) {
      const hit = e.extraction.needs.find((n) => n.id === need.id);
      if (!hit) continue;
      const ageDays = ageDaysFromBase(extrasBaseMs, e.createdAt, capMs);
      const recencyWeight = 0.5 ** (ageDays / JOURNAL_HALF_LIFE_DAYS);
      js += e.extraction.importance * hit.confidence * recencyWeight;
      jc++;
      if (e.synthetic) simJc++;
      else realJc++;
    }

    const simAvgPoints = voters.reduce((s, v) => s + (v.pri[need.id] ?? 0.03) * 100, 0) / Math.max(1, voters.length);
    const allocTotals = allAllocs
      .map((a) => a?.[need.id] ?? 0)
      .reduce((s, v) => s + v, 0);
    const realAvgPoints = allocVoterCount ? allocTotals / allocVoterCount : simAvgPoints;

    out[need.id] = {
      journalScore: round(js),
      journalCount: jc,
      realJournalCount: realJc,
      simulatedJournalCount: simJc,
      avgPoints: round(wReal * realAvgPoints + (1 - wReal) * simAvgPoints, 1),
      demand: 0,
    };
  }

  const maxP = Math.max(...Object.values(out).map((d) => d.avgPoints), 1e-9);
  for (const [needId, d] of Object.entries(out)) {
    const journalPart = Math.min(1, d.journalScore / JOURNAL_REFERENCE);
    const votesPart = d.avgPoints / maxP;
    if (Number.isFinite(needSeverities[needId]) && needSeverities[needId]! > 0) {
      const severity = Math.max(0, Math.min(1, needSeverities[needId]!));
      d.demand = round(0.4 * journalPart + 0.3 * votesPart + 0.3 * severity);
    } else {
      d.demand = round(0.5 * journalPart + 0.5 * votesPart);
    }
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

interface ChurnWaiting {
  id: string;
  type: "add" | "remove";
  moneyMovedB: number;
  changeCount: number;
  toRemoveIds: string[];
}

interface ChurnLimitResult {
  selectedIds: string[];
  churnLimited: boolean;
  waiting: ChurnWaiting[];
  majorChange?: PackageResult["majorChange"];
  escalationNext: Record<string, number>;
  churnChallengers: string[];
}

function scoreExplanation(row: Row, weights: Weights, stabilityBonus: number) {
  const keys = Object.keys(weights) as (keyof Weights)[];
  const wsum = keys.reduce((s, k) => s + weights[k], 0) || 1;
  const parts = {} as { [K in keyof Weights]: { raw: number; weight: number; contribution: number } };

  let sumContrib = 0;
  for (const k of keys) {
    const raw = row.parts[k];
    const weight = weights[k];
    const contribution = (raw * weight) / wsum;
    parts[k] = { raw, weight, contribution };
    sumContrib += contribution;
  }

  const target = row.score + row.changeCost;
  const correction = target - sumContrib;
  parts.evidence.contribution += correction;
  const total = row.score + stabilityBonus;

  return {
    parts,
    changePenalty: row.changeCost,
    stabilityBonus,
    total,
  };
}

function cheapestIncumbentsToFree(incumbents: RankedRow[], needed: number): RankedRow[] {
  if (needed <= 0) return [];
  const sorted = incumbents
    .filter((r) => (r.p.costB ?? 0) > 0)
    .sort((a, b) => (a.p.costB ?? 0) - (b.p.costB ?? 0) || a.rankScore - b.rankScore || a.p.id.localeCompare(b.p.id));
  const out: RankedRow[] = [];
  let freed = 0;
  for (const r of sorted) {
    out.push(r);
    freed += r.p.costB ?? 0;
    if (freed >= needed) break;
  }
  return out;
}

export function scoreAll(ctx: Context, w: Weights, lambda: number): Row[] {
  const wsum = Object.values(w).reduce((s, v) => s + v, 0) || 1;
  return ctx.proposals.map((p) => {
    const st = ctx.stats[p.id]!;
    const measuredImpact = Number(ctx.outcomes.items[p.id] ?? 0);
    const parts: ScoreParts = {
      support: st.support,
      welfare: round(ctx.demand[p.needId]!.demand * p.effectiveness),
      fairness: round(clamp(1 - 2.5 * st.strongOppose)),
      feasibility: round(1 - p.changeLevel / 6),
      reversibility: p.reversibility,
      evidence: round(clamp(Math.max(p.evidence, measuredImpact))),
    };
    const base = (Object.keys(w) as (keyof Weights)[]).reduce((s, k) => s + w[k] * parts[k], 0) / wsum;
    const changeCost = round((lambda * p.changeLevel) / 6);
    return { p, parts, changeCost, score: round(base - changeCost) };
  });
}

function runSelection(
  ctx: Context,
  rows: Row[],
  opts: {
    budget: number;
    perNeed: number;
    minScore: number;
    minSupport: number;
    incumbentIds: Set<string>;
    applyStabilityBonus: boolean;
    bonusBlockedIds?: Set<string>;
    forceKeepIds?: Set<string>;
  },
): SelectionResult {
  const ranked: RankedRow[] = rows
    .map((r) => {
      const st = ctx.stats[r.p.id]!;
      const bonusEligible = opts.incumbentIds.has(r.p.id)
        && !r.p.rightsIssue
        && r.p.costB !== null
        && st.support > st.oppose
        && st.support >= opts.minSupport;
      const getsBonus = opts.applyStabilityBonus && bonusEligible && !opts.bonusBlockedIds?.has(r.p.id);
      return { ...r, getsBonus, rankScore: round(r.score + (getsBonus ? STABILITY_BONUS : 0)) };
    })
    .sort((a, b) => b.rankScore - a.rankScore || b.score - a.score || a.p.id.localeCompare(b.p.id));

  const selected: RankedRow[] = [];
  const deferred: Array<{ row: RankedRow; reason: string }> = [];
  const blocked: PackageResult["blocked"] = [];
  const emerging: PackageResult["emerging"] = [];
  const perNeedCount: Record<string, number> = {};
  let spent = 0;

  const maybeSelect = (r: RankedRow, forced = false) => {
    const st = ctx.stats[r.p.id]!;
    if (r.p.rightsIssue) { blocked.push({ title: r.p.title, support: st.support, issue: r.p.rightsIssue }); return false; }
    if (r.p.costB === null) { emerging.push({ title: r.p.title, answers: ctx.db.answers.filter((a) => a.proposalId === r.p.id).length }); return false; }
    if (st.support <= st.oppose) { if (!forced) deferred.push({ row: r, reason: "More opposition than support" }); return false; }
    if (st.support < opts.minSupport) { if (!forced) deferred.push({ row: r, reason: "Below democratic support floor" }); return false; }
    if (!forced && r.rankScore < opts.minScore) { deferred.push({ row: r, reason: "Low overall score" }); return false; }
    if (!forced && (perNeedCount[r.p.needId] ?? 0) >= opts.perNeed) { deferred.push({ row: r, reason: "Need already addressed by higher-scoring items" }); return false; }
    if (spent + r.p.costB > opts.budget) {
      if (!forced) deferred.push({ row: r, reason: "Doesn't fit the remaining budget" });
      return false;
    }
    spent += r.p.costB;
    perNeedCount[r.p.needId] = (perNeedCount[r.p.needId] ?? 0) + 1;
    selected.push(r);
    return true;
  };

  if (opts.forceKeepIds?.size) {
    for (const fid of opts.forceKeepIds) {
      const r = ranked.find((x) => x.p.id === fid);
      if (!r) continue;
      maybeSelect(r, true);
    }
  }

  for (const r of ranked) {
    if (selected.some((s) => s.p.id === r.p.id)) continue;
    maybeSelect(r, false);
  }

  return { selected, deferred, blocked, emerging, spent };
}

function applyChurnLimit(
  rows: Row[],
  previous: string[],
  proposedSelected: RankedRow[],
  budget: number,
  prevEscalationStreak: Record<string, number>,
): ChurnLimitResult {
  if (!previous.length) {
    return { selectedIds: proposedSelected.map((r) => r.p.id), churnLimited: false, waiting: [], escalationNext: {}, churnChallengers: [] };
  }

  const rowById = new Map(rows.map((r) => [r.p.id, r]));
  const previousIds = previous.filter((id) => rowById.has(id));
  const previousSet = new Set(previousIds);
  const proposedIds = proposedSelected.map((r) => r.p.id);
  const proposedSet = new Set(proposedIds);
  const proposedRowById = new Map(proposedSelected.map((r) => [r.p.id, r]));

  const scoreById = new Map(rows.map((r) => [r.p.id, r.score]));
  const costById = new Map(rows.map((r) => [r.p.id, r.p.costB ?? 0]));

  const finalSet = new Set(previousIds);
  let finalCost = previousIds.reduce((s, id) => s + (costById.get(id) ?? 0), 0);

  const addedIds = new Set<string>();
  const removedIds = new Set<string>();
  const waiting: ChurnWaiting[] = [];

  const removableOrder = previousIds
    .filter((id) => !proposedSet.has(id))
    .sort((a, b) => (scoreById.get(a) ?? 0) - (scoreById.get(b) ?? 0) || a.localeCompare(b));

  const addCandidates = proposedIds
    .filter((id) => !previousSet.has(id))
    .sort((a, b) => (proposedRowById.get(b)?.rankScore ?? 0) - (proposedRowById.get(a)?.rankScore ?? 0) || a.localeCompare(b));

  const totalMoved = (adds: Set<string>, removes: Set<string>) => round(
    [...adds, ...removes].reduce((sum, id) => sum + (costById.get(id) ?? 0), 0),
    2,
  );

  let majorChange: PackageResult["majorChange"] | undefined;
  const escalationNext: Record<string, number> = {};
  const churnChallengers = new Set<string>();

  for (const addId of addCandidates) {
    const addCost = costById.get(addId) ?? 0;

    const toRemove: string[] = [];
    let freed = 0;
    for (const rid of removableOrder) {
      if (finalCost + addCost - freed <= budget) break;
      if (!finalSet.has(rid)) continue;
      toRemove.push(rid);
      freed += costById.get(rid) ?? 0;
    }

    if (finalCost + addCost - freed > budget) {
      waiting.push({ id: addId, type: "add", moneyMovedB: totalMoved(new Set([...addedIds, addId]), removedIds), changeCount: addedIds.size + removedIds.size + 1, toRemoveIds: [] });
      continue;
    }

    const nextAdded = new Set(addedIds);
    const nextRemoved = new Set(removedIds);
    nextAdded.add(addId);
    for (const rid of toRemove) nextRemoved.add(rid);

    const nextChanges = nextAdded.size + nextRemoved.size;
    const nextMoneyMoved = totalMoved(nextAdded, nextRemoved);

    const overLimit = nextChanges > MAX_SWAPS_PER_RUN || nextMoneyMoved > MAX_MONEY_MOVED_B;
    const displaced = toRemove[0];
    const displacedScore = displaced ? (scoreById.get(displaced) ?? Number.POSITIVE_INFINITY) : Number.POSITIVE_INFINITY;
    const addScore = scoreById.get(addId) ?? Number.NEGATIVE_INFINITY;
    const qualifiesEsc = Number.isFinite(displacedScore) && addScore >= displacedScore + STABILITY_BONUS;
    const prevEsc = prevEscalationStreak[addId] ?? 0;
    const escNext = qualifiesEsc ? prevEsc + 1 : 0;
    escalationNext[addId] = escNext;
    const escalationReady = escNext >= CHURN_ESCALATION_RUNS;

    if (overLimit && !escalationReady) {
      churnChallengers.add(addId);
      waiting.push({ id: addId, type: "add", moneyMovedB: nextMoneyMoved, changeCount: nextChanges, toRemoveIds: [...toRemove] });
      continue;
    }

    if (overLimit && escalationReady) {
      majorChange = {
        added: [addId],
        removed: [...toRemove],
        moneyMovedB: nextMoneyMoved,
        reason: `Escalated after ${CHURN_ESCALATION_RUNS} runs: ${addId} sustained a >= ${STABILITY_BONUS.toFixed(2)} rank advantage`,
      };
    }

    finalSet.add(addId);
    finalCost += addCost;
    addedIds.add(addId);
    for (const rid of toRemove) {
      finalSet.delete(rid);
      finalCost -= costById.get(rid) ?? 0;
      removedIds.add(rid);
    }
  }

  // Allow pure removals (no add) toward the target plan when limits permit.
  for (const rid of removableOrder) {
    if (!finalSet.has(rid)) continue;
    const nextAdded = new Set(addedIds);
    const nextRemoved = new Set(removedIds);
    nextRemoved.add(rid);
    const nextChanges = nextAdded.size + nextRemoved.size;
    const nextMoneyMoved = totalMoved(nextAdded, nextRemoved);
    if (nextChanges > MAX_SWAPS_PER_RUN || nextMoneyMoved > MAX_MONEY_MOVED_B) {
      waiting.push({ id: rid, type: "remove", moneyMovedB: nextMoneyMoved, changeCount: nextChanges, toRemoveIds: [rid] });
      continue;
    }
    finalSet.delete(rid);
    finalCost -= costById.get(rid) ?? 0;
    removedIds.add(rid);
  }

  const churnLimited = waiting.length > 0;
  if (!churnLimited) {
    return { selectedIds: proposedIds, churnLimited: false, waiting: [], majorChange, escalationNext, churnChallengers: [...churnChallengers] };
  }

  const selectedIds = Array.from(finalSet).sort((a, b) => {
    const ra = proposedRowById.get(a)?.rankScore ?? (scoreById.get(a) ?? 0);
    const rb = proposedRowById.get(b)?.rankScore ?? (scoreById.get(b) ?? 0);
    return rb - ra || a.localeCompare(b);
  });

  return { selectedIds, churnLimited: true, waiting, majorChange, escalationNext, churnChallengers: [...churnChallengers] };
}

export function synthesizePackage(
  ctx: Context,
  opts: {
    id: string;
    name: string;
    description: string;
    weights: Weights;
    lambda: number;
    budget: number;
    perNeed?: number;
    minScore?: number;
    minSupport?: number;
    previous?: string[];
    challengerStreak?: Record<string, number>;
    excludeProposalId?: string;
    _noExplain?: boolean;
  },
): PackageResult {
  const {
    budget,
    perNeed = 2,
    minScore = 0.3,
    minSupport = 0.3,
    previous = [],
    challengerStreak = {},
    excludeProposalId,
    _noExplain = false,
  } = opts;
  const rows = scoreAll(ctx, opts.weights, opts.lambda).filter((r) => r.p.id !== excludeProposalId);
  const incumbentIds = new Set(previous);

  const withoutStability = runSelection(ctx, rows, {
    budget,
    perNeed,
    minScore,
    minSupport,
    incumbentIds,
    applyStabilityBonus: false,
  });

  const withStabilityBase = runSelection(ctx, rows, {
    budget,
    perNeed,
    minScore,
    minSupport,
    incumbentIds,
    applyStabilityBonus: true,
  });

  const withBaseIds = new Set(withStabilityBase.selected.map((r) => r.p.id));
  const selectedWithout = new Set(withoutStability.selected.map((r) => r.p.id));

  const displacedIncumbentsBase = previous.filter((id) => withBaseIds.has(id) && !selectedWithout.has(id));
  const baseScoreById = new Map(rows.map((r) => [r.p.id, r.score]));
  const lowestDisplacedScore = displacedIncumbentsBase.length
    ? Math.min(...displacedIncumbentsBase.map((id) => baseScoreById.get(id) ?? Number.POSITIVE_INFINITY))
    : Number.POSITIVE_INFINITY;

  const challengers = withoutStability.selected
    .filter((r) => !withBaseIds.has(r.p.id))
    .filter((r) => r.score >= lowestDisplacedScore)
    .map((r) => r.p.id);

  const challengerSet = new Set(challengers);
  const previousStreakKeys = new Set(Object.keys(challengerStreak));
  const nextChallengerStreak: Record<string, number> = {};

  // Base challenger streak used by persistence logic.
  for (const id of new Set([...previousStreakKeys, ...challengers])) {
    if (id.startsWith("__escalate__:")) continue;
    if (challengerSet.has(id)) nextChallengerStreak[id] = (challengerStreak[id] ?? 0) + 1;
    else nextChallengerStreak[id] = 0;
  }

  const prevEscalationStreak: Record<string, number> = {};
  for (const key of previousStreakKeys) {
    if (!key.startsWith("__escalate__:")) continue;
    const cid = key.slice("__escalate__:".length);
    prevEscalationStreak[cid] = challengerStreak[key] ?? 0;
    nextChallengerStreak[key] = 0;
  }

  const persistentChallengers = challengers.filter((id) => (nextChallengerStreak[id] ?? 0) >= CHALLENGER_PERSISTENCE);

  const displacedIncumbents = new Set(
    displacedIncumbentsBase.filter((id) => {
      const impactProtected = Number(ctx.outcomes.items[id] ?? 0) >= 0.3;
      const maturingProtected = Boolean(ctx.outcomes.maturing[id]);
      return !(impactProtected || maturingProtected);
    }),
  );

  const forceKeepMaturingIds = new Set(
    previous.filter((id) => Boolean(ctx.outcomes.maturing[id])),
  );

  const withStability = persistentChallengers.length
    ? runSelection(ctx, rows, {
      budget,
      perNeed,
      minScore,
      minSupport,
      incumbentIds,
      applyStabilityBonus: true,
      bonusBlockedIds: displacedIncumbents,
      forceKeepIds: forceKeepMaturingIds,
    })
    : withStabilityBase;

  const churn = applyChurnLimit(rows, previous, withStability.selected, budget, prevEscalationStreak);

  for (const cid of churn.churnChallengers) {
    nextChallengerStreak[cid] = Math.max(nextChallengerStreak[cid] ?? 0, (challengerStreak[cid] ?? 0) + 1);
  }
  for (const [cid, n] of Object.entries(churn.escalationNext)) {
    nextChallengerStreak[`__escalate__:${cid}`] = n;
  }
  const limitedIds = new Set(churn.selectedIds);
  const rowById = new Map(rows.map((r) => [r.p.id, r]));
  const selectedWithStabilityById = new Map(withStability.selected.map((r) => [r.p.id, r]));

  const limitedSelected: RankedRow[] = churn.selectedIds
    .map((id) => {
      const sel = selectedWithStabilityById.get(id);
      if (sel) return sel;
      const base = rowById.get(id);
      if (!base) return null;
      const st = ctx.stats[base.p.id]!;
      const bonusEligible = incumbentIds.has(base.p.id)
        && !base.p.rightsIssue
        && base.p.costB !== null
        && st.support > st.oppose
        && st.support >= minSupport;
      const getsBonus = bonusEligible;
      return { ...base, getsBonus, rankScore: round(base.score + (getsBonus ? STABILITY_BONUS : 0)) };
    })
    .filter((x): x is RankedRow => Boolean(x))
    .sort((a, b) => b.rankScore - a.rankScore || b.score - a.score || a.p.id.localeCompare(b.p.id));

  const selectedIncumbents = limitedSelected
    .filter((r) => incumbentIds.has(r.p.id))
    .sort((a, b) => a.rankScore - b.rankScore || a.p.id.localeCompare(b.p.id));

  const totalCost = round(limitedSelected.reduce((sum, r) => sum + (r.p.costB ?? 0), 0), 2);
  const remainingBudget = Math.max(0, budget - totalCost);

  const fmtB = (n: number) => n.toFixed(1).replace(/\.0$/, "");

  const displacedIncumbentFor = (candidate: RankedRow): RankedRow | null => {
    const need = Math.max(0, (candidate.p.costB ?? 0) - remainingBudget);
    if (need <= 0) return selectedIncumbents[0] ?? null;
    let freed = 0;
    for (const inc of selectedIncumbents) {
      freed += inc.p.costB ?? 0;
      if (freed >= need) return inc;
    }
    return selectedIncumbents[0] ?? null;
  };

  const deferredRows = withStability.deferred.filter((d) => !limitedIds.has(d.row.p.id));
  const challengerNeed = CHALLENGER_PERSISTENCE;
  const churnChallengerSet = new Set(churn.churnChallengers);

  const deferred: PackageResult["deferred"] = deferredRows.map((d) => {
    const inc = displacedIncumbentFor(d.row);
    const incRank = inc?.rankScore ?? d.row.rankScore;
    const margin = round(incRank - d.row.rankScore, 3);

    let reasonDetail = d.reason;
    let replaceIds: string[] | undefined;
    if (d.reason === "Below democratic support floor") {
      const support = ctx.stats[d.row.p.id]!.support;
      reasonDetail = `support ${support.toFixed(2)} < floor ${minSupport.toFixed(2)}`;
    } else if (d.reason === "Doesn't fit the remaining budget") {
      const needed = Math.max(0, (d.row.p.costB ?? 0) - Math.max(0, remainingBudget));
      const lowerRanked = limitedSelected.filter((r) => r.rankScore < d.row.rankScore);
      let swapSet = cheapestIncumbentsToFree(lowerRanked, needed);
      let freed = swapSet.reduce((s, r) => s + (r.p.costB ?? 0), 0);
      if (freed < needed) {
        swapSet = cheapestIncumbentsToFree(limitedSelected, needed);
        freed = swapSet.reduce((s, r) => s + (r.p.costB ?? 0), 0);
      }
      replaceIds = swapSet.map((r) => r.p.id);

      const byCostDesc = [...swapSet].sort((a, b) => (b.p.costB ?? 0) - (a.p.costB ?? 0));
      const named = byCostDesc.slice(0, 2);
      const namedPhrase = named.map((r) => `${r.p.title} ($${fmtB(r.p.costB ?? 0)}B)`).join(" + ");
      const rest = byCostDesc.slice(2);
      const restCost = rest.reduce((s, r) => s + (r.p.costB ?? 0), 0);
      const restPhrase = rest.length ? ` plus ${rest.length} smaller item${rest.length === 1 ? "" : "s"} ($${fmtB(restCost)}B)` : "";
      const main = namedPhrase ? `Would mean dropping ${namedPhrase}${restPhrase}` : `Would need about $${fmtB(needed)}B more`;
      const alt = inc && !swapSet.some((x) => x.p.id === inc.p.id)
        ? `, or ${inc.p.title} ($${fmtB(inc.p.costB ?? 0)}B)`
        : "";
      reasonDetail = `${main}${alt}.`;
    }

    const cid = d.row.p.id;
    const streak = nextChallengerStreak[cid] ?? 0;
    if ((challengerSet.has(cid) || churnChallengerSet.has(cid)) && streak < challengerNeed) {
      const chall = `challenger: ${streak} of ${challengerNeed} required runs`;
      reasonDetail = reasonDetail === d.reason ? chall : `${reasonDetail}; ${chall}`;
    }

    return {
      id: d.row.p.id,
      title: d.row.p.title,
      costB: d.row.p.costB ?? 0,
      support: ctx.stats[d.row.p.id]!.support,
      reason: d.reason,
      reasonDetail,
      replaceIds,
      margin,
    };
  });

  const bestDeferredByIncumbent = new Map<string, RankedRow>();
  for (const d of deferredRows) {
    const inc = displacedIncumbentFor(d.row);
    if (!inc) continue;
    const prevBest = bestDeferredByIncumbent.get(inc.p.id);
    if (!prevBest || d.row.rankScore > prevBest.rankScore) bestDeferredByIncumbent.set(inc.p.id, d.row);
  }
  const cutoffDeferredRank = deferredRows.length
    ? Math.max(...deferredRows.map((d) => d.row.rankScore))
    : (limitedSelected.length ? Math.min(...limitedSelected.map((r) => r.rankScore)) : 0);

  const currentIdsForIfDropped = new Set(limitedSelected.map((x) => x.p.id));
  const items: PlanItem[] = limitedSelected.map((r) => {
    const keptForStability = r.getsBonus && !selectedWithout.has(r.p.id);
    const bestDeferred = bestDeferredByIncumbent.get(r.p.id);
    const challengerRank = bestDeferred?.rankScore ?? cutoffDeferredRank;
    const margin = round(r.rankScore - challengerRank, 3);
    const stabilityBonus = round(r.rankScore - r.score, 9);

    const baseExplanation = scoreExplanation(r, opts.weights, stabilityBonus);
    const impact = Number(ctx.outcomes.items[r.p.id] ?? 0);
    const maturing = Boolean(ctx.outcomes.maturing[r.p.id]);
    const protection: PlanItem["explanation"]["protection"] = maturing
      ? "maturing"
      : (impact >= 0.3 ? "impact" : (keptForStability ? "stability" : undefined));

    const protectedFrom = protection && bestDeferred
      ? {
        id: bestDeferred.p.id,
        title: bestDeferred.p.title,
        streak: nextChallengerStreak[bestDeferred.p.id] ?? 0,
        needed: CHALLENGER_PERSISTENCE,
      }
      : undefined;

    const ifDropped = (() => {
      if (_noExplain) return { freesB: r.p.costB ?? 0, wouldAdd: [] as { id: string; title: string; costB: number }[] };
      const alt = synthesizePackage(ctx, {
        ...opts,
        previous,
        challengerStreak,
        excludeProposalId: r.p.id,
        _noExplain: true,
      });
      const keepSet = new Set(currentIdsForIfDropped);
      keepSet.delete(r.p.id);
      const wouldAdd = alt.items
        .filter((x) => !keepSet.has(x.proposal.id))
        .map((x) => ({ id: x.proposal.id, title: x.proposal.title, costB: x.proposal.costB ?? 0 }));
      return { freesB: r.p.costB ?? 0, wouldAdd };
    })();

    return buildItem(ctx, r, keptForStability, margin, {
      ...baseExplanation,
      protection,
      protectedFrom,
      ifDropped,
    });
  });

  const waiting: PackageResult["waiting"] = churn.waiting
    .map((w) => {
      const row = rowById.get(w.id);
      if (!row) return null;
      const streak = nextChallengerStreak[w.id] ?? 0;
      const challengerDetail = churnChallengerSet.has(w.id) && streak < challengerNeed
        ? `; challenger: ${streak} of ${challengerNeed} required runs`
        : "";
      return {
        id: w.id,
        title: row.p.title,
        costB: row.p.costB ?? 0,
        margin: round(row.score, 3),
        reason: "churn-limited",
        reasonDetail: `churn-limited: would move $${w.moneyMovedB}B (limit $${MAX_MONEY_MOVED_B}B)${challengerDetail}`,
      };
    })
    .filter((x): x is PackageResult["waiting"][number] => Boolean(x));

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
    items, totalCost, budget,
    avgSupport: round(items.reduce((s, i) => s + i.stats.support, 0) / Math.max(1, items.length)),
    avgChange: round(items.reduce((s, i) => s + i.proposal.changeLevel, 0) / Math.max(1, items.length), 2),
    deferred, blocked: withStability.blocked, emerging: withStability.emerging, unfundedPopularCost: round(unfundedPopularCost, 2),
    changesFromPrevious: { added, removed, moneyMovedB },
    challengerStreak: nextChallengerStreak,
    churnLimited: churn.churnLimited,
    waiting,
    majorChange: churn.majorChange,
  };
}

function buildItem(
  ctx: Context,
  r: Row,
  keptForStability: boolean,
  margin: number,
  explanation: PlanItem["explanation"],
): PlanItem {
  const p = r.p;
  const st = ctx.stats[p.id]!;
  const need = ctx.needs.find((n) => n.id === p.needId) ?? NEEDS.find((n) => n.id === p.needId)!;
  const quotes = ctx.entries
    .filter((e) => !e.synthetic && e.extraction.needs.some((n) => n.id === p.needId))
    .sort((a, b) => Number(!!a.seeded) - Number(!!b.seeded) || b.extraction.importance - a.extraction.importance)
    .slice(0, 3)
    .map((e) => ({ author: e.author, text: e.text }));
  const mitigations = st.objections.filter((o) => o.share >= 0.15).map((o) => o.mitigation);
  const rollout = p.changeLevel >= 3 || p.reversibility < 0.5
    ? "Pilot in 5 jurisdictions for 24 months, then review against metrics"
    : "Roll out through the existing mechanism, with a 24-month review";
  const measuredImpact = Number.isFinite(ctx.outcomes.items[p.id]) ? Number(ctx.outcomes.items[p.id]) : undefined;
  const maturing = Boolean(ctx.outcomes.maturing[p.id]);
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
    explanation,
    measuredImpact,
    maturing,
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

export type PackageOptions = Parameters<typeof synthesizePackage>[1];

/** The three packages synthesis produces, as options for synthesizePackage. */
export function packageOptions(
  weights: Weights,
  lambda: number,
  budget: number,
  previous: Record<string, string[]> = {},
  challengerStreak: Record<string, Record<string, number>> = {},
): PackageOptions[] {
  return [
    {
      id: "A",
      name: "Balanced",
      description: "Your weights and change penalty",
      weights,
      lambda,
      budget,
      previous: previous.A ?? [],
      challengerStreak: challengerStreak.A ?? {},
    },
    {
      id: "B",
      name: "Minimal change",
      description: "Same weights, strong penalty on institutional disruption",
      weights,
      lambda: lambda * 3 + 0.3,
      budget,
      previous: previous.B ?? [],
      challengerStreak: challengerStreak.B ?? {},
    },
    {
      id: "C",
      name: "Most popular",
      description: "Ranks purely by citizen support (rights constraints still apply)",
      weights: { support: 1, welfare: 0, fairness: 0, feasibility: 0, reversibility: 0, evidence: 0 },
      lambda: 0,
      budget,
      previous: previous.C ?? [],
      challengerStreak: challengerStreak.C ?? {},
    },
  ];
}

export function synthesize(
  ctx: Context,
  weights: Weights,
  lambda: number,
  budget: number,
  previous: Record<string, string[]> = {},
  challengerStreak: Record<string, Record<string, number>> = {},
): PackageResult[] {
  return packageOptions(weights, lambda, budget, previous, challengerStreak).map((o) => synthesizePackage(ctx, o));
}

export function diffPackages(real: PackageResult[], blended: PackageResult[]): PackageDiffMap {
  const byId = new Map(blended.map((p) => [p.id, p]));
  const out: PackageDiffMap = {};

  const marginFor = (pkg: PackageResult, id: string): number => {
    const d = pkg.deferred.find((x) => x.id === id);
    if (d) return d.margin;
    const w = pkg.waiting.find((x) => x.id === id);
    if (w) return w.margin;
    return 0;
  };

  const titleFor = (pkg: PackageResult, id: string): string => {
    const item = pkg.items.find((x) => x.proposal.id === id);
    if (item) return item.proposal.title;
    const d = pkg.deferred.find((x) => x.id === id);
    if (d) return d.title;
    const w = pkg.waiting.find((x) => x.id === id);
    if (w) return w.title;
    return id;
  };

  for (const r of real) {
    const b = byId.get(r.id);
    if (!b) continue;
    const realIds = new Set(r.items.map((x) => x.proposal.id));
    const blendIds = new Set(b.items.map((x) => x.proposal.id));
    const addedBySimulated = [...blendIds].filter((id) => !realIds.has(id));
    const removedBySimulated = [...realIds].filter((id) => !blendIds.has(id));

    const cost = new Map<string, number>();
    for (const it of r.items) cost.set(it.proposal.id, it.proposal.costB ?? 0);
    for (const it of b.items) cost.set(it.proposal.id, it.proposal.costB ?? 0);
    const moneyMovedB = round([...addedBySimulated, ...removedBySimulated].reduce((s, id) => s + (cost.get(id) ?? 0), 0), 2);

    const pending = Object.entries(b.challengerStreak ?? {})
      .filter(([id, streak]) => (streak ?? 0) > 0 && (r.challengerStreak?.[id] ?? 0) === 0)
      .filter(([id]) => !blendIds.has(id))
      .map(([id, streak]) => ({
        id,
        title: titleFor(b, id),
        streak: streak ?? 0,
        needed: CHALLENGER_PERSISTENCE,
        marginReal: round(marginFor(r, id), 3),
        marginBlended: round(marginFor(b, id), 3),
      }))
      .sort((a, c) => c.streak - a.streak || a.id.localeCompare(c.id));

    const realDeferred = new Map(r.deferred.map((d) => [d.id, d]));
    const shifted = b.deferred
      .map((d) => {
        const rd = realDeferred.get(d.id);
        if (!rd) return null;
        const delta = Math.abs((d.margin ?? 0) - (rd.margin ?? 0));
        if (delta < 0.01) return null;
        return {
          id: d.id,
          title: d.title,
          marginReal: round(rd.margin ?? 0, 3),
          marginBlended: round(d.margin ?? 0, 3),
          delta,
        };
      })
      .filter((x): x is { id: string; title: string; marginReal: number; marginBlended: number; delta: number } => Boolean(x))
      .sort((a, c) => c.delta - a.delta || a.id.localeCompare(c.id))
      .slice(0, 5)
      .map(({ delta: _delta, ...rest }) => rest);

    out[r.id] = { addedBySimulated, removedBySimulated, moneyMovedB, pending, shifted };
  }

  return out;
}

export function emptyDB(): DB {
  return {
    schemaVersion: 0,
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
    challengerStreak: {},
  };
}
