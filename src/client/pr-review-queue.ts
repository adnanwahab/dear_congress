import type { PublicPull } from '../shared/hbl-governance';

export interface ReviewStatus {
  checks: 'unknown' | 'pending' | 'failed' | 'passed';
  review: 'unknown' | 'changes-requested' | 'requested' | 'needed' | 'review-ready';
}
/** Discovery only. Never supplies merge eligibility or vote authority. */
export function reviewStatus(p: PublicPull): ReviewStatus {
  const e = p.evidence;
  if (!e || !e.protectionsKnown) return { checks: 'unknown', review: 'unknown' };
  const checks = !e.checks.length || e.checks.some(c => c.sha !== p.headSha || c.status === 'unknown' || (c.status === 'completed' && c.conclusion === null)) ? 'unknown'
    : e.checks.some(c => c.status === 'completed' && c.conclusion !== 'success') ? 'failed'
    : e.checks.some(c => c.status !== 'completed') ? 'pending' : 'passed';
  const review = e.reviews.some(r => r.state === 'CHANGES_REQUESTED') ? 'changes-requested'
    : e.requestedReviewers > 0 ? 'requested'
    : e.reviews.some(r => r.state === 'APPROVED' && r.commitId === p.headSha) ? 'review-ready' : 'needed';
  return { checks, review };
}
export interface QueueFilters { checks: string; review: string; reason: string; feature: string; age: string; }
export const EMPTY_QUEUE_FILTERS: QueueFilters = { checks: 'all', review: 'all', reason: 'all', feature: 'all', age: 'all' };
export function matchesQueue(p: PublicPull, f: QueueFilters, now = Date.now()): boolean {
  const status = reviewStatus(p), updated = Date.parse(p.updatedAt);
  const days = Number.isFinite(updated) && updated <= now ? (now - updated) / 86400000 : null;
  return (f.checks === 'all' || f.checks === status.checks)
    && (f.review === 'all' || f.review === status.review)
    && (f.reason === 'all' || (p.eligibility.state === 'blocked' && p.eligibility.reason === f.reason))
    && (f.feature === 'all' || (f.feature === 'unknown' ? !p.labels.length : p.labels.some(label => `label:${label}` === f.feature)))
    && (f.age === 'all' || (f.age === 'unknown' ? days === null : days !== null && (f.age === 'recent' ? days < 7 : days >= 7)));
}
