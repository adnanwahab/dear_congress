import { expect, test } from 'bun:test';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DEFAULT_WEIGHTS, emptyDB } from '../engine/engine';
import { normalizeWeights, WEIGHT_KEYS } from '../shared/synthesis-rule';
import { handleRulePreview, previewSynthesisRule } from './synthesis-rule-preview';

const defaults = { weights: DEFAULT_WEIGHTS, lambda: .25, budget: 40 };
test('rejects invalid vectors and bounded parameters before calculation', async () => {
  for (const weights of [null, [], {}, { ...DEFAULT_WEIGHTS, extra: 1 }, { ...DEFAULT_WEIGHTS, support: undefined }, ...[-1, Infinity, NaN, '1', null].map(support => ({ ...DEFAULT_WEIGHTS, support })), Object.fromEntries(WEIGHT_KEYS.map(key => [key, 0])), Object.fromEntries(WEIGHT_KEYS.map(key => [key, Number.MAX_VALUE]))]) {
    expect(() => normalizeWeights(weights)).toThrow();
  }
  for (const body of [{ ...defaults, budget: -1 }, { ...defaults, budget: 151 }, { ...defaults, lambda: '1' }, { ...defaults, lambda: Infinity }, { ...defaults, activate: true }]) expect(() => previewSynthesisRule(body)).toThrow();
  for (const body of ['null', '[]', '{broken', JSON.stringify({ ...defaults, budget: '40' }), JSON.stringify({ padding: 'x'.repeat(5000) })]) {
    const response = await handleRulePreview(new Request('http://localhost/api/synthesis-rule-preview', { method: 'POST', body }));
    expect(response.status).toBe(body.length > 4096 ? 413 : 400);
  }
});

test('request handler returns a deterministic, non-cacheable fixture comparison', async () => {
  const request = () => new Request('http://localhost/api/synthesis-rule-preview', { method: 'POST', body: JSON.stringify(defaults) });
  const first = await handleRulePreview(request()), second = await handleRulePreview(request());
  expect(first.status).toBe(200);
  expect(first.headers.get('cache-control')).toBe('no-store');
  expect(await first.json()).toEqual(await second.json());
});

test('proportional weights preserve scores/selections, disclose derivations, and cannot select rights-blocked options', () => {
  const before = previewSynthesisRule(defaults);
  const after = previewSynthesisRule({ ...defaults, weights: Object.fromEntries(WEIGHT_KEYS.map(key => [key, DEFAULT_WEIGHTS[key] * 10])) });
  expect(after.candidate.weights.total).toBeCloseTo(10);
  expect(Object.values(after.candidate.weights.normalized).reduce((a,b) => a+b,0)).toBeCloseTo(1);
  for (let i = 0; i < 3; i++) {
    expect(after.packages[i]!.options).toEqual(before.packages[i]!.options);
    expect(after.packages[i]!.options.every(o => o.delta === 0)).toBe(true);
    const blocked = after.packages[i]!.options.filter(o => o.rightsBlocked);
    expect(blocked.length).toBeGreaterThan(0);
    expect(blocked.every(o => !o.baselineSelected && !o.candidateSelected)).toBe(true);
  }
  expect(after.packages[1]!.candidate.lambda).toBeCloseTo(1.05);
  expect(after.packages[2]!.candidate.weights.normalized.support).toBe(1);
  expect(after.packages[2]!.candidate.lambda).toBe(0);
  expect(previewSynthesisRule(defaults)).toEqual(before);
});

test('changed rule produces modeled score effects and zero budget removes paid selections', () => {
  const result = previewSynthesisRule({ weights: { support: 0, welfare: 0, fairness: 0, feasibility: 0, reversibility: 0, evidence: 1 }, lambda: 1, budget: 0 });
  expect(result.packages[0]!.options.some(o => o.delta !== 0)).toBe(true);
  expect(result.packages[0]!.options.some(o => o.baselineSelected && !o.candidateSelected)).toBe(true);
  for (const pkg of result.packages) expect(pkg.candidate.spend).toBe(0);
});

test('HTTP preview succeeds anonymously without touching persisted journals, ballots, incumbents or snapshots', async () => {
  const db = emptyDB(); db.schemaVersion = 2;
  db.lastPlan = { A: ['PRIVATE_PLAN'] }; db.challengerStreak = { A: { PRIVATE_STREAK: 2 } };
  db.votesByVoter.PRIVATE_VOTER = {}; db.simulationSnapshots = [];
  const path = join(tmpdir(), `dc-rule-preview-${crypto.randomUUID()}.json`);
  await Bun.write(path, JSON.stringify(db));
  const saved = { DB_PATH: process.env.DB_PATH, PORT: process.env.PORT, DEBUG_REQUEST_LOGS: process.env.DEBUG_REQUEST_LOGS };
  let server: { url: URL; stop: (force?: boolean) => void } | undefined;
  try {
    process.env.DB_PATH = path; process.env.PORT = '0'; process.env.DEBUG_REQUEST_LOGS = '0';
    server = (await import(`../../server.ts?rule-preview=${crypto.randomUUID()}`)).server;
    const before = await Bun.file(path).text();
    for (const body of [defaults, { ...defaults, activate: true }, defaults]) {
      const response = await fetch(new URL('/api/synthesis-rule-preview', server!.url), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
      expect(response.status).toBe('activate' in body ? 400 : 200);
      const json = await response.text();
      for (const secret of ['PRIVATE_PLAN', 'PRIVATE_STREAK', 'PRIVATE_VOTER', 'sourceText', 'quotes', 'yourAnswers']) expect(json).not.toContain(secret);
    }
    expect(await Bun.file(path).text()).toBe(before);
    expect((await fetch(new URL('/api/synthesis-rule-activate', server!.url), { method: 'POST' })).status).toBe(404);
  } finally {
    server?.stop(true); await Bun.file(path).delete();
    for (const [key, value] of Object.entries(saved)) if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
});
