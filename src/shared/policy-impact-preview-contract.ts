/** HBL #558 wire types. No service credentials or Node dependencies here. */
export const POLICY_PREVIEW_SCHEMA = 'policy-impact-preview.v1' as const;
export interface PolicyPreviewClause {
  clauseId: string;
  sourcePolicyId: string;
  operation: 'add' | 'remove' | 'modify';
  beforeText: string;
  afterText: string;
}
export interface PolicyPreviewInput {
  schemaVersion: typeof POLICY_PREVIEW_SCHEMA;
  source: { system: string; proposalId: string; versionId: string; contentHash: string;
    type: 'bill' | 'constitutional-amendment'; title: string; url: string; visibility: 'public' };
  legal: { baseVersionId: string; clauses: PolicyPreviewClause[] };
  baseline: { kind: 'current-law' | 'prior-proposal-version'; versionId: string; label: string };
  simulation: { seed: number; runs: number; months: number };
  modelRunId?: string;
}
export interface PolicyPreviewJob {
  status: 'queued' | 'running' | 'partial' | 'completed' | 'failed' | 'unavailable';
  completed: number; failed: number; total: number; error?: string | null;
}
export interface PolicyPreviewReceipt {
  id: string; url: string; supportStatus: 'supported' | 'partial' | 'unavailable'; job: PolicyPreviewJob;
}
/** Opaque recorded model payloads remain JSON, never coerced into successful outcomes. */
export type PreviewJson = null | boolean | number | string | PreviewJson[] | { [key: string]: PreviewJson };
export interface PolicyPreviewManifest extends PolicyPreviewReceipt {
  input: PolicyPreviewInput; modelVersion: string; mappingVersion: string;
  parameterDiff: PreviewJson[]; runtimeManifest: { [key: string]: PreviewJson };
  checkpointMonths: number[]; createdAt: string; uncertainty: { [key: string]: PreviewJson };
}
export interface PolicyPreviewResults {
  id: string; job: PolicyPreviewJob; runs: { [key: string]: PreviewJson }[];
  checkpointMonths: number[]; uncertainty: { [key: string]: PreviewJson };
}
