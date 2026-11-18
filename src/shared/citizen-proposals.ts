/** Citizen-submitted advisory proposals. These counts never include simulated residents. */
export const PROPOSAL_JURISDICTIONS = ["city", "county", "state", "federal", "unsure"] as const;
export type ProposalJurisdiction = typeof PROPOSAL_JURISDICTIONS[number];
export const ADVISORY_CHOICES = ["support", "oppose", "unsure"] as const;
export type AdvisoryChoice = typeof ADVISORY_CHOICES[number];

export const CITIZEN_PROPOSAL_LIMITS = {
  title: 160,
  problem: 5000,
  proposedChange: 10000,
  jurisdictionName: 160,
  supportingInfo: 5000,
  sourceEntryId: 128,
} as const;

export interface CitizenProposalInput {
  title: string;
  problem: string;
  proposedChange: string;
  jurisdiction: ProposalJurisdiction;
  jurisdictionName?: string;
  supportingInfo?: string;
  sourceEntryId?: string;
}

export interface PublishCitizenProposalInput extends CitizenProposalInput {
  /** One stable UUID per draft, retained when retrying an uncertain submission. */
  idempotencyKey: string;
  confirmedPublic: true;
}

export interface CitizenProposalView extends CitizenProposalInput {
  provenance?: "synthetic";
  id: string;
  status: "published";
  advisory: true;
  createdAt: string;
  publishedAt: string;
  counts: Record<AdvisoryChoice, number>;
  countTotal: number;
  ownVote: AdvisoryChoice | null;
  comments: CitizenProposalComment[];
  canRespondToObjections: boolean;
  objections: ProposalObjection[];
  credits?: ProposalCreditsView;
}

export interface CitizenProposalComment {
  id: string;
  text: string;
  displayName: string;
  createdAt: string;
}

export interface CitizenProposalCommentRecord extends CitizenProposalComment {
  submitKeyHash: string;
  bodyHash: string;
}

/** Server-only persistence fields. Never return this object directly from an API. */
export interface CitizenProposalRecord extends CitizenProposalInput {
  versionVotes?: Record<string, Record<string, AdvisoryChoice>>;
  versionBallotEvents?: { version: number; voterHash: string; choice: AdvisoryChoice | null; createdAt: string }[];
  legalVersions?: import("./policy-preview").ProposalVersion[];
  policyPreviews?: import("./policy-preview").PolicyPreview[];
  provenance?: "synthetic";
  versionWriteKeys?: Record<string, { bodyHash: string; version: number }>;
  id: string;
  createdAt: string;
  publishedAt: string;
  ownerHash: string;
  publishKeyHash: string;
  bodyHash: string;
  votesByVoterHash: Record<string, AdvisoryChoice>;
  comments: CitizenProposalCommentRecord[];
  objections?: ProposalObjectionRecord[];
  credits?: ProposalCreditRecord[];
}

/** Bound to the existing immutable published proposal; constituency is self-described. */
export interface ProposalObjection {
  id: string;
  text: string;
  severity: "concern" | "major" | "blocking";
  constituency: string;
  createdAt: string;
  responses: { status: "declined" | "unresolved"; reason: string; createdAt: string; actor: "proposer" }[];
}
export interface ProposalObjectionRecord extends ProposalObjection {
  submitKeyHash: string;
  bodyHash: string;
}


export const CONTRIBUTION_ROLES = ["coauthor", "research", "editing", "accessibility"] as const;
export type ContributionRole = typeof CONTRIBUTION_ROLES[number];
export interface CreditEvent {
  version: number;
  action: "opt-in" | "remove";
  role: ContributionRole;
  preference: "pseudonym" | "unnamed";
  createdAt: string;
}
/** Alias is replaceable/removable; the append-only event history never contains names. */
export interface ProposalCreditRecord {
  ownerHash: string;
  alias?: string;
  events: CreditEvent[];
}
export interface ProposalCreditsView {
  revision: string;
  version: number;
  contributors: { alias: string; role: ContributionRole }[];
  history: CreditEvent[];
  ownActive: boolean;
}
export type ProposalCreditInput = { expectedVersion: number; revision: string } & (
  { action: "remove" } |
  { action: "opt-in"; confirmedPublic: true; role: ContributionRole; preference: "pseudonym" | "unnamed"; alias?: string }
);
