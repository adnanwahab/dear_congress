import { describe, expect, test } from 'bun:test';
import { rehearse, rehearsalStatus } from './merge-rehearsal';
import type { PublicPull } from '../shared/hbl-governance';
function pull(number = 1): PublicPull {
  return { number, repositoryId: 42, title: 'Patch', body: '', author: 'maintainer', url: '', updatedAt: '', headSha: `head${number}`, base: 'main', draft: false, state: 'open', version: `42:${number}:head${number}:main`, firstSeenAt: 0, labels: [], tally: { yes: 0, no: 0, participation: 0, feedback: 0 }, eligibility: { eligible: false, state: 'open-for-voting', reason: 'Advisory' }, files: [{ filename: 'shared.ts', status: 'modified', additions: 1, deletions: 1 }], commitShas: [`head${number}`], evidence: { checks: [{ name: 'test', status: 'completed', conclusion: 'success', sha: `head${number}` }], reviews: [{ userId: 2, state: 'APPROVED', commitId: `head${number}` }], requestedReviewers: 0, mergeable: true, mergeableState: 'clean', baseSha: 'base', protectionsKnown: true, protectedBase: true, sensitive: false, maintainerApproved: true } };
}
describe('metadata merge rehearsal', () => {
  test('blocked, pending and review-ready states stay separate from merge authority', () => {
    const p = pull();
    expect(rehearsalStatus(p)).toBe('review-ready');
    p.evidence!.checks[0]!.status = 'in_progress';
    expect(rehearsalStatus(p)).toBe('checks-pending');
    p.eligibility.state = 'blocked';
    expect(rehearsalStatus(p)).toBe('blocked');
  });
  test('missing evidence and old-head reviews cannot report readiness', () => {
    const p = pull(); p.evidence!.reviews[0]!.commitId = 'old';
    expect(rehearsalStatus(p)).toBe('blocked');
    p.evidence = undefined;
    expect(rehearsalStatus(p)).toBe('unknown');
  });
  test('order detects commit dependencies and shared paths without mutation', () => {
    const first = pull(1), second = pull(2);
    second.commitShas!.push(first.headSha);
    const before = JSON.stringify([first, second]);
    expect(rehearse([second, first])[0]!.missingEarlier).toEqual([1]);
    expect(rehearse([first, second])[1]!.missingEarlier).toEqual([]);
    expect(rehearse([first, second])[1]!.overlaps).toEqual([{ number: 1, files: ['shared.ts'] }]);
    expect(JSON.stringify([first, second])).toBe(before);
  });
  test('repositories, issues and different bases do not create false conflict edges', () => {
    const a = pull(1), b = pull(2); b.commitShas!.push(a.headSha);
    b.repositoryId = 99;
    expect(rehearse([a, b])[1]!.dependencies).toEqual([]);
    expect(rehearse([a, b])[1]!.overlaps).toEqual([]);
    b.repositoryId = a.repositoryId; b.base = 'other';
    expect(rehearse([a, b])[1]!.overlaps).toEqual([]);
    a.kind = 'issue';
    expect(rehearse([a, b])[1]!.dependencies).toEqual([]);
  });
});
