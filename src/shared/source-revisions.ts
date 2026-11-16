import type { Measurement } from './policy-measurements';

/** A snapshot is a retained measurement record, not proof that a provider was checked. */
export interface SourceRevision {
  sourceId: string;
  revision: string;
  detectedAt: string;
  providerChangedAt: string | null;
  kind: 'primary source' | 'editorial inference' | 'user claim' | 'synthetic estimate';
  limitations: string;
  measurement: Measurement;
  hash: string;
}
const fields = ['period', 'value', 'unit', 'population', 'sourceVersion'] as const;
export function snapshotContent(row: Measurement): string {
  return JSON.stringify(fields.map(field => [field, row[field]]));
}
export async function snapshotHash(row: Measurement): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(snapshotContent(row)));
  return 'sha256:' + Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
}
export function revisionDiff(before: SourceRevision, after: SourceRevision) {
  if (before.sourceId !== after.sourceId) throw new Error('Cannot compare different source identities');
  return fields.filter(field => before.measurement[field] !== after.measurement[field])
    .map(field => ({ field, before: before.measurement[field], after: after.measurement[field] }));
}
export interface ReviewAcknowledgment {
  sourceId: string;
  beforeHash: string;
  afterHash: string;
  reviewer: string;
  acknowledgedAt: string;
  note: string;
}
/** Exact transition binding prevents an old acknowledgment approving a new correction. */
export function acknowledged(before: SourceRevision, after: SourceRevision, log: readonly ReviewAcknowledgment[]): boolean {
  return before.sourceId === after.sourceId && log.some(row => row.sourceId === after.sourceId && row.beforeHash === before.hash && row.afterHash === after.hash &&
    !!row.reviewer.trim() && !!row.note.trim() && Number.isFinite(Date.parse(row.acknowledgedAt)));
}
