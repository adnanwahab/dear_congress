import { describe, expect, test } from 'bun:test';
import fixture from './fixtures/policy-preview-demo.json';
import schema from './fixtures/policy-preview.schema.json';
import { canonicalPreviewJson, createPolicyPreviewClient, policyPreviewHash, validatePolicyPreview } from './policy-preview-client';

const id = 'pp_' + 'a'.repeat(64), origin = 'https://hbl.example';
const job = {status: 'queued', completed: 0, failed: 0, total: 100};
const receipt = {id, url: `${origin}/world/impact?preview=${id}`, supportStatus: 'supported', job};
const results = {id, job, runs: [], checkpointMonths: [0, 12, 24], uncertainty: {synthetic: true, predictive: false}};
const metrics = Object.fromEntries(['population', 'households', 'housingUnits', 'availableUnits', 'meanRent', 'unhoused', 'employed', 'jobs', 'businesses', 'meanTravelMinutes', 'overloadedServices', 'utilityFailures', 'balance', 'debt', 'completedProjects'].map(key => [key, 0]));
const arm = {metricsTimeline: Array.from({length: 25}, (_, month) => ({month, metrics})), checkpoints: [0, 12, 24].map(month => ({month, state: {month}})), events: [], diagnostics: []};
const pair = {runIndex: 0, seed: 42, attempts: 1, status: 'completed', baseline: arm, proposal: arm};
function client(data: unknown, status = 200) {
  return createPolicyPreviewClient({url: origin, token: 'test-service-credential', fetch: (async () => Response.json(data, {status})) as unknown as typeof fetch});
}
function revised(change: (v: any) => void) {
  const v = structuredClone(fixture); change(v); v.source.contentHash = policyPreviewHash(v.legal); return v;
}
// Independent schema evaluator for the exact vocabulary used by HBL's committed schema.
function conforms(value: any, spec: any): boolean {
  if (spec.const !== undefined && value !== spec.const || spec.enum && !spec.enum.includes(value)) return false;
  if (spec.type === 'object') return value !== null && typeof value === 'object' && !Array.isArray(value) &&
    spec.required.every((k: string) => Object.hasOwn(value, k)) && Object.keys(value).every(k => spec.properties[k] && conforms(value[k], spec.properties[k]));
  if (spec.type === 'array') return Array.isArray(value) && value.length >= spec.minItems && value.length <= spec.maxItems && value.every(v => conforms(v, spec.items));
  if (spec.type === 'integer') return Number.isInteger(value) && value >= spec.minimum && value <= spec.maximum;
  if (spec.type === 'string') return typeof value === 'string' && value.length >= (spec.minLength ?? 0) && value.length <= (spec.maxLength ?? Infinity) && (!spec.pattern || new RegExp(spec.pattern).test(value)) && (spec.format !== 'uri' || URL.canParse(value));
  return true;
}
describe('HBL canonical contract', () => {
  test('actual upstream fixture matches schema and golden SHA-256', () => {
    expect(conforms(fixture, schema)).toBe(true);
    expect(policyPreviewHash(fixture.legal)).toBe('bcb6466a4803cc00cdba7102c4c4d2bc8925d09cb046737a314390af5421be8e');
    expect(validatePolicyPreview(fixture)).toMatchObject(fixture);
    expect(policyPreviewHash({clauses: fixture.legal.clauses, baseVersionId: fixture.legal.baseVersionId})).toBe(fixture.source.contentHash);
    expect(canonicalPreviewJson({'2': 2, '10': 10})).toBe('{"10":10,"2":2}');
    expect(policyPreviewHash({a: [1, 2]})).not.toBe(policyPreviewHash({a: [2, 1]}));
    expect(policyPreviewHash(revised(v => v.legal.clauses[0].afterText += '\n').legal)).not.toBe(fixture.source.contentHash);
  });
  test('valid limits, remove and exact modify semantics', () => {
    for (const simulation of [{seed: 0, runs: 1, months: 1}, {seed: 4294967295, runs: 100, months: 24}]) {
      const v = revised(v => v.simulation = simulation); expect(conforms(v, schema)).toBe(true); expect(validatePolicyPreview(v)).toMatchObject(v);
    }
    for (const operation of ['remove', 'modify']) expect(() => validatePolicyPreview(revised(v => {
      Object.assign(v.legal.clauses[0], {operation, beforeText: ' exact before\n', afterText: operation === 'remove' ? '' : ' exact after\n'});
    }))).not.toThrow();
  });
  test('rejects privacy, hash, identity, schema and operation violations', () => {
    const mutations = [
      (v: any) => v.schemaVersion = 'PolicyScenario.v1', (v: any) => v.source.visibility = 'private',
      (v: any) => v.source.visibility = 'unlisted', (v: any) => v.source.extra = 'private',
      (v: any) => v.source.url += '?secret=x', (v: any) => v.source.url += '#x',
      (v: any) => v.source.url = 'https://user:secret@example.org/',
      (v: any) => v.baseline.versionId = 'other', (v: any) => v.simulation.seed = -1,
      (v: any) => v.simulation.seed = 4294967296, (v: any) => v.simulation.runs = 101,
      (v: any) => v.simulation.months = 25, (v: any) => v.simulation.runs = 0,
      (v: any) => v.simulation.months = NaN, (v: any) => v.simulation.seed = Infinity,
      (v: any) => v.legal.clauses = [], (v: any) => v.legal.clauses[0].beforeText = 'not empty',
      (v: any) => v.legal.clauses[0].operation = 'replace', (v: any) => v.legal.clauses[0].afterText = ' ',
      (v: any) => v.legal.clauses.push({...v.legal.clauses[0], clauseId: 'other'}),
      (v: any) => v.legal.clauses.push({...v.legal.clauses[0], sourcePolicyId: 'other'}),
      (v: any) => v.modelRunId = '../private',
    ];
    for (const mutate of mutations) expect(() => validatePolicyPreview(revised(mutate))).toThrow('invalid_input');
    expect(() => validatePolicyPreview({...fixture, source: {...fixture.source, contentHash: '0'.repeat(64)}})).toThrow('invalid_input');
    expect(() => policyPreviewHash({x: Infinity})).toThrow();
  });
});
describe('server transport', () => {
  test('202 queued and 200 idempotent, exact payload and server-only auth', async () => {
    for (const status of [202, 200]) {
      const c = createPolicyPreviewClient({url: origin, token: 'test-service-credential', fetch: (async (url: RequestInfo | URL, init?: RequestInit) => {
        expect(url).toBe(origin + '/api/policy-previews');
        expect(init?.method).toBe('POST'); expect(init?.redirect).toBe('error');
        expect(new Headers(init?.headers).get('authorization')).toBe('Bearer test-service-credential');
        expect(JSON.parse(init?.body as string)).toMatchObject(fixture);
        expect(init?.signal).toBeInstanceOf(AbortSignal);
        return Response.json(receipt, {status});
      }) as unknown as typeof fetch});
      expect(await c.create(fixture)).toMatchObject({status, value: receipt});
    }
  });
  test('manifest and recorded results follow actual HBL shapes without GET credentials', async () => {
    const manifest = {...receipt, input: fixture, modelVersion: 'city/runtime/mapping', mappingVersion: 'mapping.1',
      parameterDiff: [], runtimeManifest: {}, checkpointMonths: [0, 12, 24], createdAt: '2026-11-18T00:00:00Z', uncertainty: results.uncertainty};
    expect(await client(manifest).manifest(id)).toMatchObject(manifest);
    const c = createPolicyPreviewClient({url: origin, fetch: (async (url: RequestInfo | URL, init?: RequestInit) => {
      expect(url).toBe(`${origin}/api/policy-previews/${id}/results?runIndex=0`);
      expect(new Headers(init?.headers).has('authorization')).toBe(false);
      return Response.json({...results, runs: [pair], job: {...job, completed: 1, status: 'running'}});
    }) as unknown as typeof fetch});
    expect((await c.results(id, 0)).runs).toHaveLength(1);
  });
  test('explicit HTTP errors never return successful URLs or upstream error text', async () => {
    for (const [status, state] of [[401, 'unauthorized'], [409, 'conflict'], [429, 'rate_limited'], [500, 'upstream'], [503, 'upstream'], [404, 'not_found']] as const) {
      await expect(client({error: 'test-service-credential', url: receipt.url}, status).create(fixture)).rejects.toMatchObject({state, status, message: `Policy preview ${state}`});
    }
  });
  test('rejects malformed receipts, result shapes, nonfinite outcomes and versions', async () => {
    for (const bad of [{}, {...receipt, url: 'https://evil.example/'}, {...receipt, job: {...job, status: 'done'}}, {...receipt, job: {...job, total: 1}}]) {
      await expect(client(bad).create(fixture)).rejects.toMatchObject({state: 'malformed'});
    }
    for (const bad of [{...results, runs: [{}]}, {...results, runs: [{...pair, baseline: {}}]},
      {...results, runs: [{...pair, baseline: {...arm, metricsTimeline: [{month: 0, metrics: {...metrics, meanRent: Infinity}}]}}]}, {...results, runs: [pair, pair]}, {...results, id: 'wrong'}, {...results, runs: [{...pair, status: 'failed', error: 'failed'}]}]) {
      await expect(client(bad).results(id)).rejects.toMatchObject({state: 'malformed'});
    }
    const malformed = createPolicyPreviewClient({url: origin, fetch: (async () => new Response('{"x":1e999}', {headers: {'content-type': 'application/json'}})) as unknown as typeof fetch});
    await expect(malformed.results(id)).rejects.toMatchObject({state: 'malformed'});
    await expect(client({...receipt, input: {...fixture, schemaVersion: 'v2'}}).manifest(id)).rejects.toMatchObject({state: 'malformed'});
  });
  test('fails before transport on invalid input or missing configuration', async () => {
    let calls = 0;
    const c = createPolicyPreviewClient({url: origin, token: '', fetch: (async () => {calls++; throw Error('secret');}) as unknown as typeof fetch});
    await expect(c.create(fixture)).rejects.toMatchObject({state: 'unconfigured'});
    await expect(c.create({...fixture, schemaVersion: 'v2'})).rejects.toMatchObject({state: 'invalid_input'});
    await expect(c.results('../other')).rejects.toMatchObject({state: 'invalid_input'});
    expect(calls).toBe(0);
    expect(() => createPolicyPreviewClient({url: 'https://hbl.example/path'})).toThrow('unconfigured');
  });
  test('network and timeouts sanitize error details', async () => {
    const c = createPolicyPreviewClient({url: origin, fetch: (async () => {throw Error('secret');}) as unknown as typeof fetch});
    await expect(c.results(id)).rejects.toMatchObject({state: 'network', message: 'Policy preview network'});
    const timed = createPolicyPreviewClient({url: origin, timeoutMs: 1, fetch: ((_url: RequestInfo | URL, init?: RequestInit) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(Error('secret')));
    })) as unknown as typeof fetch});
    await expect(timed.results(id)).rejects.toMatchObject({state: 'timeout'});
  });
});
