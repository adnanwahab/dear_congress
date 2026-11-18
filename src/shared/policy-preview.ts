/** Immutable public legal text. No journals, ballots, ownership or location fields. */
export interface LegalClause { clauseId: string; text: string }
export interface ProposalVersion {
  version: number;
  versionId: string;
  type: 'bill' | 'constitutional-amendment';
  title: string;
  clauses: LegalClause[];
  contentHash: string;
  createdAt: string;
}
export interface PolicyImpactPayload {
  schemaVersion: 'policy-impact-preview.v1';
  source: { system: 'civic-synthesis'; proposalId: string; versionId: string; contentHash: string;
    type: ProposalVersion['type']; title: string; url: string; visibility: 'public' };
  legal: { baseVersionId: string; clauses: { clauseId: string; sourcePolicyId: string | null;
    operation: 'add' | 'remove' | 'modify'; beforeText: string; afterText: string }[] };
  baseline: { kind: 'prior-proposal-version'; versionId: string; label: string };
  simulation: { seed: number; runs: number; months: number };
}
export interface PolicyPreview {
  id: string;
  payload: PolicyImpactPayload;
  createdAt: string;
  status: 'queued' | 'running' | 'completed' | 'unavailable' | 'unsupported';
  attempts: number;
  remoteId?: string;
  url?: string;
  message?: string;
  updatedAt?: string;
  remoteMetadata?: { modelVersion?: string; mappingVersion?: string; parameterDiff?: unknown; job?: unknown };
  results?: { receivedAt: string; data: unknown };
}
export interface ProposalVersionData {
  versions: ProposalVersion[];
  previews: PolicyPreview[];
  canEdit: boolean;
  responses?: Record<string, { counts: Record<"support" | "oppose" | "unsure", number>; ownVote: "support" | "oppose" | "unsure" | null }>;
  provenance: 'citizen' | 'synthetic';
}
export const HOUSING_DEMO_TITLE = "Synthetic housing: smaller lots and parking reform";
export const HOUSING_DEMO_TEXT = [
  'Synthetic draft for discussion: no housing reform is authorized by this proposed text.',
  'Proposed synthetic ordinance: reduce minimum lot sizes and remove parking mandates to allow more homes.',
] as const;
