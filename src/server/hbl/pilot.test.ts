import { expect, test } from 'bun:test';
import { createHmac } from 'node:crypto';
import { GovernanceStore } from './store';
import { createGovernanceAPI, policyFromEnv } from './api';
import { evaluateEligibility } from './policy';
import { GitHubSource } from './github';
import type { Pull } from '../../shared/hbl-governance';

const now = Date.parse('2026-11-13T15:01:00Z');
const origin = 'https://civic.example';
const pull: Pull = {
  number: 282, repositoryId: 1364565814, title: 'Synthetic pilot regression', body: '',
  author: 'fixture', url: 'https://github.com/adnanwahab/happybearlandia/pull/282',
  updatedAt: new Date(now).toISOString(), headSha: 'a'.repeat(40), base: 'sprint/test',
  draft: false, state: 'open', version: 'pilot-head:base', firstSeenAt: now - 48 * 3600000,
  labels: [], evidence: {
    checks: [{name: 'test', status: 'completed', conclusion: 'success', sha: 'a'.repeat(40)}],
    reviews: [{userId: 1, state: 'APPROVED', commitId: 'a'.repeat(40)}],
    requestedReviewers: 0, mergeable: true, mergeableState: 'clean', baseSha: 'base',
    protectionsKnown: true, protectedBase: true, sensitive: false, maintainerApproved: true,
  },
};

for (const flag of [undefined, 'false', '0', 'garbage', 'true']) {
  test(`pilot blocks signed live batches despite permissive legacy settings and flag ${flag}`, async () => {
    const env = { PR_AUTO_MERGE_ENABLED: flag, HBL_MERGE_ENABLED: '1', HBL_MERGE_DRY_RUN: '0',
      HBL_KILL_SWITCH: '0', HBL_ALLOWED_BASES: 'sprint/test', HBL_REQUIRED_CHECKS: 'test',
      HBL_WORKER_SECRET: 'test-only-worker-secret' };
    const policy = policyFromEnv(env);
    const store = new GovernanceStore(':memory:');
    let merges = 0;
    const source = {listPulls: async () => [pull], detail: async () => pull,
      merge: async () => { merges++; return {merged: true, sha: 'b'.repeat(40)}; }};
    const api = createGovernanceAPI({store, source, policy, origin, env, now: () => now});
    try {
      store.upsertPull(pull, pull.firstSeenAt);
      for (let i = 1; i <= 10; i++) {
        store.setMembership(i, `member-${i}`, true, pull.firstSeenAt);
        store.vote(i, pull.number, pull.version, 'yes', now - 3600000);
      }
      expect(evaluateEligibility(pull, store.tally(pull.number, pull.version), policy, now).eligible).toBe(true);
      const list = await (await api.handle(new Request(origin + '/api/hbl/pulls'))).json();
      expect(list.policy).toEqual(policy);
      expect(list.integration.state).toBe('disabled');
      expect(list.nextBatch).toBeNull();
      expect(list.pulls[0].earliestBatch).toBeUndefined();
      const text = JSON.stringify({dryRun: false}), ts = String(now / 1000);
      const signature = createHmac('sha256', env.HBL_WORKER_SECRET).update(ts + '.' + text).digest('hex');
      const response = await api.handle(new Request(origin + '/api/internal/hbl/batch', {
        method: 'POST', body: text, headers: {'x-hbl-timestamp': ts, 'x-hbl-signature': signature},
      }));
      expect(response.status).toBe(200);
      expect((await response.json()).run.status).toBe('disabled');
      expect(merges).toBe(0);
      expect(store.tally(pull.number, pull.version).yes).toBe(10);
    } finally { store.db.close(); }
  });
}

test('blocked PR list and detail retain base reason and omit merge schedules', async () => {
  const store = new GovernanceStore(':memory:');
  const policy = policyFromEnv({HBL_MERGE_ENABLED: '1'});
  const source = {listPulls: async () => [pull], detail: async () => pull, merge: async () => {throw Error('forbidden');}};
  const api = createGovernanceAPI({store, source, policy, origin, now: () => now});
  try {
    const list = await (await api.handle(new Request(origin + '/api/hbl/pulls'))).json();
    const detail = await (await api.handle(new Request(origin + '/api/hbl/pulls/282'))).json();
    for (const item of [list.pulls[0], detail.pull]) {
      expect(item.eligibility).toEqual({state: 'blocked', eligible: false, reason: 'Base branch is not allowed'});
      expect(item.earliestBatch).toBeUndefined();
      expect(item.repositoryId).toBe(pull.repositoryId);
      expect(item.version).toBe(pull.version);
    }
    expect(list.nextBatch).toBeNull();
  } finally { store.db.close(); }
});

test('GitHub mutation boundary rejects even a credentialed direct merge with zero network requests', async () => {
  let calls = 0;
  const source = new GitHubSource({token: 'synthetic-token', fetch: (async () => {
    calls++; throw Error('network forbidden');
  }) as unknown as typeof fetch});
  await expect(source.merge(282, pull.headSha)).rejects.toThrow('GitHub source rejected');
  expect(calls).toBe(0);
});
