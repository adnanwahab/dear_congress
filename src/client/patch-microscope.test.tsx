import { expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import type { PublicPull } from '../shared/hbl-governance';
import { classifyFile, microscopeStatus, summarizeChanges } from './patch-microscope';
import { PatchMicroscope } from './PatchMicroscope';
const head = 'a'.repeat(40), base = 'b'.repeat(40);
const pull: PublicPull = {
  number: 7, repositoryId: 42, title: 'Patch', body: '', author: 'author', url: 'https://github.com/adnanwahab/dear_congress/pull/7', updatedAt: '',
  headSha: head, base: 'main', version: `42:7:${head}:main`, draft: false, state: 'open', firstSeenAt: 0, labels: [],
  tally: { yes: 0, no: 0, participation: 0, feedback: 0 }, eligibility: { eligible: false, state: 'blocked', reason: 'Base not allowed' },
  evidence: { checks: [{ name: 'test', status: 'completed', conclusion: 'success', sha: head }], reviews: [], requestedReviewers: 0, mergeable: true, mergeableState: 'clean', baseSha: base, protectionsKnown: true, protectedBase: true, sensitive: false, maintainerApproved: false },
  files: [{ filename: 'src/client/View.tsx', status: 'modified', additions: 1, deletions: 1, patch: '@@ -2,2 +2,2 @@\n context\n-before\n+after' }],
};
test('blocked, checks-pending and review-ready PRs preserve policy distinction', () => {
  for (const [state, expected] of [['blocked', 'blocked'], ['waiting-for-checks', 'checks-pending'], ['open-for-voting', 'review-ready']] as const) {
    const fixture = { ...pull, eligibility: { ...pull.eligibility, state } };
    expect(microscopeStatus(fixture, false, false)).toBe(expected);
    const html = renderToStaticMarkup(<PatchMicroscope pull={fixture} repository="adnanwahab/dear_congress" loading={false} error={false} stale={false} sourceStatus="live" lastSync={null}/>);
    expect(html).toContain('Code change microscope');
    expect(html).toContain('Signed out');
    expect(html).toContain('never casts a vote');
    expect(html).not.toContain('<button');
  }
  const ready = { ...pull, eligibility: { ...pull.eligibility, state: 'open-for-voting' as const } };
  expect(microscopeStatus({ ...ready, evidence: { ...pull.evidence!, checks: [{ name: 'test', sha: base, status: 'completed', conclusion: 'success' }] } }, false, false)).toBe('pending');
  expect(microscopeStatus(pull, true, false)).toBe('loading');
  expect(microscopeStatus(pull, false, true)).toBe('error');
  expect(microscopeStatus(pull, false, false, true)).toBe('stale');
  expect(microscopeStatus({ ...pull, kind: 'issue' }, false, false)).toBe('unavailable');
});
test('ordered documented heuristics and low confidence fallback', () => {
  for (const [path, feature] of [['src/client/View.test.tsx', 'Tests'], ['src/client/View.tsx', 'UI'], ['src/engine/types.ts', 'Model'], ['data/seed.json', 'Data'], ['.github/workflows/ci.yml', 'Operations']] as const) expect(classifyFile(path).feature).toBe(feature);
  expect(classifyFile('notes/readme.md').confidence).toBe('low');
});
test('line receipts bind exact repository and revisions, and missing patches stay uncertain', () => {
  const original = JSON.stringify(pull);
  const changes = summarizeChanges(pull, 'adnanwahab/dear_congress');
  expect(changes[0]?.lines.map(l => l.url)).toEqual([
    `https://github.com/adnanwahab/dear_congress/blob/${head}/src/client/View.tsx#L3`,
  ]);
  expect(summarizeChanges(pull, 'adnanwahab/happybearlandia')).toEqual([]);
  expect(summarizeChanges({ ...pull, kind: 'issue' }, 'adnanwahab/dear_congress')).toEqual([]);
  expect(summarizeChanges({ ...pull, headSha: 'main' }, 'adnanwahab/dear_congress')).toEqual([]);
  const missing = summarizeChanges({ ...pull, files: [{ ...pull.files![0]!, patch: undefined }] }, 'adnanwahab/dear_congress');
  expect(missing[0]?.lines).toEqual([]);
  expect(missing[0]?.caveat).toContain('unavailable');
  expect(JSON.stringify(pull)).toBe(original);
});
