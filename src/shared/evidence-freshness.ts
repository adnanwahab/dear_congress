import { DEMO_ITEMS, type DemoItem } from '../engine/demo';

export type EvidenceKind = 'Primary source' | 'Editorial inference' | 'User claim' | 'Synthetic estimate';
/** Additive editorial metadata; never used as vote authority or a validity score. */
export interface ClaimProvenance {
  id: string;
  claim: string;
  kind: EvidenceKind;
  sourceId: string;
  sourceUrl: string | null;
  published: string | null;
  observed: string | null;
  retrieved: string | null;
  reviewFrom: string | null;
  reviewDays: number;
  limitations: string;
  review: { revision: string; recordedAt: string; actor: string; state: 'Pending human review' | 'Human reviewed'; change: string }[];
}
export function dateValue(value: string | null): number | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const time = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value ? time : null;
}
export function safeEvidenceUrl(value: string | null): string | null {
  try { const url = new URL(value ?? ''); return url.protocol === 'https:' && !url.username && !url.password ? url.href : null; } catch { return null; }
}
export function reviewDue(row: ClaimProvenance): string | null {
  const start = dateValue(row.reviewFrom);
  if (start === null || !Number.isInteger(row.reviewDays) || row.reviewDays < 1 || row.reviewDays > 36500) return null;
  return new Date(start + row.reviewDays * 86400000).toISOString().slice(0, 10);
}
export function reviewWarning(row: ClaimProvenance, asOf: string): string {
  const due = reviewDue(row), today = dateValue(asOf);
  if (!due || today === null || dateValue(row.reviewFrom)! > today) return 'Review date unknown';
  const days = (dateValue(due)! - today) / 86400000;
  return days < 0 ? 'Review overdue' : days <= 7 ? 'Review due within 7 days' : 'Review scheduled';
}
export function scenarioEvidence(item: DemoItem): ClaimProvenance {
  return { id: item.id, claim: item.title, kind: 'Editorial inference', sourceId: item.id,
    sourceUrl: item.sourceUrl, published: null, observed: null, retrieved: item.background?.checkedAt ?? null,
    reviewFrom: item.background?.checkedAt ?? null, reviewDays: 30,
    limitations: `${item.background?.scope ?? 'Background scope unknown'}. Background only; does not verify the sample scenario. Publication and observation dates are unknown.`, review: [] };
}
const audit = { revision: 'SHE-678-v1', recordedAt: '2026-11-14', actor: 'Repository implementation', state: 'Pending human review' as const, change: 'Added dated evidence examples and review reminder metadata; no existing evidence or votes replaced.' };
export const EVIDENCE_CASES: readonly ClaimProvenance[] = [
  { id: 'repository-case', claim: 'Fully sourced repository case: the measurement fixture is explicitly synthetic', kind: 'Primary source', sourceId: 'adnanwahab/dear_congress:1305bc091550425a7c6b6038ce8afd3f6acf4d4f:src/shared/policy-measurements.ts', sourceUrl: 'https://github.com/adnanwahab/dear_congress/blob/1305bc091550425a7c6b6038ce8afd3f6acf4d4f/src/shared/policy-measurements.ts', published: null, observed: '2026-11-14', retrieved: '2026-11-14', reviewFrom: '2026-11-14', reviewDays: 30, limitations: 'Primary evidence of repository contents only, not a measured policy effect. Publication date unknown; observed and retrieved in the local source audit.', review: [audit] },
  { id: 'conflicting-case', claim: 'Conflicting synthetic case: bus wait improves while fare burden worsens', kind: 'Synthetic estimate', sourceId: 'synthetic-fixture-v1/wait-2025+fare-2025', sourceUrl: 'https://github.com/adnanwahab/dear_congress/blob/1305bc091550425a7c6b6038ce8afd3f6acf4d4f/src/shared/policy-measurements.ts', published: null, observed: null, retrieved: '2026-11-14', reviewFrom: '2026-10-01', reviewDays: 30, limitations: 'Existing invented 2024/2025 annual measurements; exact observation dates unknown. Different metrics show mixed results, not contradictory measurements of the same quantity. No causal attribution or real policy benefit established. Review interval is illustrative.', review: [audit] },
  { id: 'missing-case', claim: 'Missing-source example: a participant says service improved', kind: 'User claim', sourceId: 'SHE-678:fictional-user-claim', sourceUrl: null, published: null, observed: null, retrieved: null, reviewFrom: null, reviewDays: 30, limitations: 'Fictional user statement for demonstrating missing evidence; no real participant record, source, date or verification. Outcome unknown.', review: [audit] },
];
export const CALENDAR_EVIDENCE = [...EVIDENCE_CASES, ...DEMO_ITEMS.map(scenarioEvidence)];
export function evidenceExport(rows: readonly ClaimProvenance[], asOf: string): string {
  return JSON.stringify({ schema: 'evidence-freshness.v1', asOf, notice: 'Age and review reminders do not determine validity. Unknown dates are not inferred.', evidence: rows.map(row => ({ ...row, sourceUrl: safeEvidenceUrl(row.sourceUrl), reviewDue: reviewDue(row), warning: reviewWarning(row, asOf) })) }, null, 2);
}
