export type Stance = -2 | -1 | 0 | 1 | 2;

export interface NeedDef {
  id: string;
  label: string;
  value: string;
  goal: string;
  metric: string;
  level: string;
  keywords: string[];
  emergent?: boolean;
  sourceText?: string;
}

export interface Proposal {
  id: string;
  needId: string;
  title: string;
  mechanism: string;
  authority: string;
  jurisdiction: string;
  /** Annual cost in $B (illustrative). null = not yet costed (emergent idea). */
  costB: number | null;
  /** 0 = administrative … 6 = constitutional amendment */
  changeLevel: number;
  reversibility: number; // 0..1
  evidence: number; // 0..1
  effectiveness: number; // 0..1, how much it moves the need's goal
  keywords: string[];
  metrics: string[];
  legalChange: string;
  benefitsFiscal?: boolean;
  /** If set, the proposal violates a hard rights constraint and can never be selected. */
  rightsIssue?: string;
  emergent?: boolean;
  sourceText?: string;
  /**
   * How a citizen idea's cost was set. Absent on catalog proposals.
   * "provisional": auto-estimated from the need's other options once enough people backed it.
   * "assessed": filled in by a reviewer via /api/admin/emergent/:id/assess.
   * "citizen": the median of voters' own estimates (POST /api/emergent/:id/estimate).
   */
  costEstimate?: "provisional" | "assessed" | "citizen";
  /** Voters' own estimates for an uncosted citizen idea, one per voter (latest wins). */
  estimates?: CitizenEstimate[];
}

export interface CitizenEstimate {
  /** sha256 of the voter id, never the id itself: proposals are sent to every client. */
  voterKey: string;
  /** Annual cost in $B. */
  costB: number;
  /** 0 = administrative … 6 = constitutional amendment */
  changeLevel: number;
  authority?: string;
  createdAt: string;
}

export interface Extraction {
  needs: { id: string; confidence: number }[];
  importance: number;
  concerns: string[];
  constraints: string[];
  proposalIds: string[];
}

export interface JournalEntry {
  id: string;
  author: string;
  text: string;
  createdAt: string;
  extraction: Extraction;
  corrected: boolean;
  seeded?: boolean;
  /** Written by a simulated resident (e.g. happybearlandia /world), not a real person. */
  synthetic?: boolean;
  /** Which client posted it, e.g. "happybearlandia-world". */
  source?: string;
  /** Privacy-clamped server-side (real=0.01° cell; synthetic=0.001° floored). */
  location?: { lat: number; lng: number };
  tileId?: string;
}

export interface UserVote {
  proposalId: string;
  stance: Stance;
  importance: number; // 0..1
  acceptCompromise: boolean;
  concern: string;
  changeMind: string;
}

export interface OpenAnswer {
  id: string;
  needId: string;
  text: string;
  proposalId: string;
  createdAt: string;
  voterId?: string;
}

/**
 * A frozen plan handed to HappyBearLandia to simulate. Immutable once created.
 * Deliberately has no journal text: HBL only needs the needs and the plan.
 */
export interface SimulationSnapshot {
  id: string;
  schemaVersion: 1;
  createdAt: string;
  /** Journal entry the person simulated from, if any (id only, never the text). */
  entryId: string | null;
  /** Privacy-clamped location stored with that entry, if it had one. */
  location: { lat: number; lng: number } | null;
  /** Needs the entry was linked to, weights summing to 1. Empty when not from an entry. */
  needs: { id: string; label: string; weight: number }[];
  plan: {
    id: string;
    label: string;
    proposalIds: string[];
    items: { id: string; title: string; needId: string; costB: number | null }[];
    totalCostB: number;
    budgetB: number;
  };
}

export interface DB {
  /** Incremented when one-time data migrations are applied. */
  schemaVersion?: number;
  entries: JournalEntry[];
  // Legacy single-user fields (kept for migration/backward compatibility)
  votes: Record<string, UserVote>;
  allocation: Record<string, number>;
  goalVotes: Record<string, boolean>;

  // Multi-voter storage
  votesByVoter: Record<string, Record<string, UserVote>>;
  allocationByVoter: Record<string, Record<string, number>>;
  goalVotesByVoter: Record<string, Record<string, boolean>>;

  answers: OpenAnswer[];
  emergent: Proposal[];
  emergentNeeds: NeedDef[];
  /** Last synthesized plan proposal IDs by package id (A/B/C). */
  lastPlan: Record<string, string[]>;
  /** Consecutive runs each challenger has persisted for, by package and proposal id. */
  challengerStreak: Record<string, Record<string, number>>;
  /** Frozen plans sent to HappyBearLandia ("Simulate realities"). Newest last. */
  simulationSnapshots?: SimulationSnapshot[];
}

export interface Weights {
  support: number;
  welfare: number;
  fairness: number;
  feasibility: number;
  reversibility: number;
  evidence: number;
}

export interface Objection {
  key: string;
  text: string;
  mitigation: string;
  share: number; // share of opposed voters citing it
}

export interface ProposalStats {
  n: number;
  support: number;
  neutral: number;
  oppose: number;
  strongOppose: number;
  objections: Objection[];
}

export interface NeedDemand {
  journalScore: number;
  journalCount: number;
  realJournalCount: number;
  simulatedJournalCount: number;
  avgPoints: number;
  demand: number; // 0..1 blended
}

export interface ScoreParts {
  support: number;
  welfare: number;
  fairness: number;
  feasibility: number;
  reversibility: number;
  evidence: number;
}

export interface PlanItemExplanation {
  parts: { [K in keyof Weights]: { raw: number; weight: number; contribution: number } };
  changePenalty: number;
  stabilityBonus: number;
  total: number;
  protection?: "maturing" | "impact" | "stability";
  protectedFrom?: { id: string; title: string; streak: number; needed: number };
  ifDropped: { freesB: number; wouldAdd: { id: string; title: string; costB: number }[] };
}

export interface PlanItem {
  proposal: Proposal;
  needLabel: string;
  score: number;
  parts: ScoreParts;
  changeCost: number;
  stats: ProposalStats;
  demand: NeedDemand;
  mechanismShare: number;
  quotes: { author: string; text: string }[];
  yourAnswers: string[];
  mitigations: string[];
  rollout: string;
  newAgency: boolean;
  handoff: Record<string, unknown>;
  keptForStability: boolean;
  margin: number;
  explanation: PlanItemExplanation;
  measuredImpact?: number;
  maturing?: boolean;
}

export interface SynthesisOutcomes {
  needs?: Record<string, { severity: number }>;
  items?: Record<string, { impact: number; maturing?: boolean }>;
}

export interface MajorChange {
  added: string[];
  removed: string[];
  moneyMovedB: number;
  reason: string;
}

export interface PackageResult {
  id: string;
  name: string;
  description: string;
  items: PlanItem[];
  totalCost: number;
  budget: number;
  avgSupport: number;
  avgChange: number;
  deferred: { id: string; title: string; costB: number; support: number; reason: string; reasonDetail: string; replaceIds?: string[]; margin: number }[];
  blocked: { title: string; support: number; issue: string }[];
  emerging: { title: string; answers: number }[];
  unfundedPopularCost: number;
  changesFromPrevious: { added: string[]; removed: string[]; moneyMovedB: number };
  challengerStreak: Record<string, number>;
  churnLimited: boolean;
  waiting: { id: string; title: string; costB: number; margin: number; reason: string; reasonDetail: string }[];
  majorChange?: MajorChange;
  measuredPreview?: { items: string[]; diff: { added: string[]; removed: string[]; moneyMovedB: number } };
}

export interface PackageSimulatedDiff {
  addedBySimulated: string[];
  removedBySimulated: string[];
  moneyMovedB: number;
  pending: { id: string; title: string; streak: number; needed: number; marginReal: number; marginBlended: number }[];
  shifted: { id: string; title: string; marginReal: number; marginBlended: number }[];
}

export type PackageDiffMap = Record<string, PackageSimulatedDiff>;
