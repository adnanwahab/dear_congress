export type ErrorTarget = { kind: string; id: string; revision: string };
export type ErrorReport = { id: string; target: ErrorTarget; snapshot: string; reason: string; createdAt: string; status: 'pending' | 'reviewing' | 'corrected' | 'declined'; correctionNote: string; version: number; history: { status: string; note: string; at: string }[] };
export async function reportRevision(snapshot: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(snapshot));
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
}
export function reportUrl(target: ErrorTarget) { return '/report-error?' + new URLSearchParams(target); }
/** Explicit public text only; excludes browser votes, ownership and idempotency keys. */
export function citizenReportSnapshot(p: { id: string; title: string; problem: string; proposedChange: string; jurisdiction: string; jurisdictionName?: string; supportingInfo?: string; sourceEntryId?: string; publishedAt: string }) {
  return JSON.stringify([p.id, p.title, p.problem, p.proposedChange, p.jurisdiction, p.jurisdictionName ?? '', p.supportingInfo ?? '', p.sourceEntryId ?? '', p.publishedAt]);
}
