import type { PublicPull } from '../shared/hbl-governance';

export type RehearsalStatus = 'blocked' | 'checks-pending' | 'review-ready' | 'unknown';
export function rehearsalStatus(p: PublicPull): RehearsalStatus {
  if (p.kind === 'issue' || p.state !== 'open' || p.draft || p.eligibility.state === 'blocked' || p.evidence?.mergeable === false) return 'blocked';
  if (p.eligibility.state === 'waiting-for-checks') return 'checks-pending';
  const e = p.evidence;
  if (!e || !e.protectionsKnown || !e.protectedBase || e.mergeable !== true) return 'unknown';
  if (e.checks.some(c => c.sha === p.headSha && c.status === 'completed' && c.conclusion !== 'success' && c.conclusion !== 'neutral' && c.conclusion !== 'skipped')) return 'blocked';
  if (!e.checks.length || e.checks.some(c => c.sha !== p.headSha || c.status !== 'completed')) return 'checks-pending';
  if (e.mergeableState !== 'clean' || e.requestedReviewers || e.reviews.some(r => r.state === 'CHANGES_REQUESTED')) return 'blocked';
  return e.reviews.some(r => r.state === 'APPROVED' && r.commitId === p.headSha) && (!e.sensitive || e.maintainerApproved) ? 'review-ready' : 'blocked';
}

/** Metadata approximation only: no git merge, persistence or vote mutations. */
export function rehearse(pulls: PublicPull[]) {
  return pulls.map((pull, index) => {
    const peers = pulls.filter(p => p !== pull && p.repositoryId === pull.repositoryId && p.kind !== 'issue');
    const dependencies = peers.filter(p => p.headSha !== pull.headSha && !!p.headSha && pull.commitShas?.includes(p.headSha));
    const missingEarlier = dependencies.filter(p => pulls.indexOf(p) >= index).map(p => p.number);
    const overlaps = peers.filter(p => pulls.indexOf(p) < index && p.base === pull.base).flatMap(p => {
      const files = pull.files?.filter(f => p.files?.some(other => other.filename === f.filename)).map(f => f.filename) ?? [];
      return files.length ? [{ number: p.number, files }] : [];
    });
    return { pull, status: rehearsalStatus(pull), dependencies: dependencies.map(p => p.number), missingEarlier, overlaps, metadataComplete: !!pull.commitShas && !!pull.files };
  });
}
