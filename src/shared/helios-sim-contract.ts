/** HBL #558, merge 6156a3c: wire types only; no legal-text inference. */
export const POLICY_PREVIEW_SCHEMA = 'policy-impact-preview.v1' as const;
export interface PolicyPreviewRequest {
  schemaVersion: typeof POLICY_PREVIEW_SCHEMA;
  source: { system: string; proposalId: string; versionId: string; contentHash: string;
    type: 'bill' | 'constitutional-amendment'; title: string; url: string; visibility: 'public' };
  legal: { baseVersionId: string; clauses: PolicyPreviewClause[] };
  baseline: { kind: 'current-law' | 'prior-proposal-version'; versionId: string; label: string };
  simulation: { seed: number; runs: number; months: number };
  modelRunId?: string;
}
export interface PolicyPreviewClause {
  clauseId: string; sourcePolicyId: string; operation: 'add' | 'remove' | 'modify';
  beforeText: string; afterText: string;
}
export type PreviewJobStatus = 'queued' | 'running' | 'partial' | 'completed' | 'failed' | 'unavailable';
export interface PolicyPreviewSubmission {
  id: string; url: string; supportStatus: 'supported' | 'partial' | 'unavailable';
  job: { status: PreviewJobStatus; completed: number; failed: number; total: number; error?: string | null };
}
/** Do not stringify arbitrary application records: only validated wire data. */
export function canonicalLegal(value: PolicyPreviewRequest['legal']): string {
  const canonical = (v: unknown): string => Array.isArray(v) ? `[${v.map(canonical).join(',')}]`
    : v !== null && typeof v === 'object'
      ? `{${Object.keys(v).sort().map(k => `${JSON.stringify(k)}:${canonical((v as Record<string, unknown>)[k])}`).join(',')}}`
      : JSON.stringify(v);
  return canonical(value);
}
