import type { PublicPull } from '../shared/hbl-governance';
export type PlaytestStatus = 'blocked' | 'checks-pending' | 'review-ready' | 'review-pending';
export function playtestStatus(pull: PublicPull): PlaytestStatus {
 if (pull.state !== 'open' || pull.draft || pull.eligibility.state === 'blocked') return 'blocked';
 if (pull.eligibility.state === 'waiting-for-checks') return 'checks-pending';
 return pull.eligibility.state === 'approved' ? 'review-ready' : 'review-pending';
}
/** Defense in depth for the existing operator registry; never accept body links. */
export function approvedPlaytestUrl(pull: PublicPull, repository: string): string | null {
 const p = pull.preview;
 if (repository !== 'adnanwahab/happybearlandia' || pull.kind === 'issue' || !p || p.headSha !== pull.headSha || !/^[a-f0-9]{40}$/.test(pull.headSha) || !p.deploymentVerifiedAt || !p.exploreUrl) return null;
 try {
  const url = new URL(p.exploreUrl);
  return url.origin === `https://hbl-pr-${pull.number}-${pull.headSha.slice(0,8)}.fly.dev` && !url.username && !url.password && !url.hash && url.pathname + url.search === p.route ? url.href : null;
 } catch { return null; }
}
export const PLAYTEST_CHECKS = ['Desktop: read the changed screen and try its main flow', 'Mobile: check layout, text and touch targets', 'Keyboard: Tab through controls and check visible focus', 'Reduced motion: enable the OS preference and repeat the flow'] as const;
export function playtestReport(pull: PublicPull, repository: string, environment: string, checks: string[], steps: string, expected: string, actual: string) {
 return ['Civic patch playtest · advisory bug report', `Source: ${repository} #${pull.number} (repository ID ${pull.repositoryId})`, `Revision: ${pull.version}`, `Head: ${pull.headSha}`, `Base: ${pull.base}`, `Preview: ${approvedPlaytestUrl(pull, repository) ?? 'Unavailable'}`, `Environment (participant supplied): ${environment}`, `Explored: ${checks.join('; ') || 'None recorded'}`, `Steps: ${steps}`, `Expected: ${expected}`, `Actual: ${actual}`].join('\n');
}
