import { expect, test } from 'bun:test';
import { canonicalLegal, type PolicyPreviewRequest, type PolicyPreviewSubmission } from '../shared/helios-sim-contract';
import { createPolicyPreview, legalContentHash, validatePolicyPreview, type PreviewClientOptions } from './helios-sim-client';
// Exact HBL #558 world/policy-preview-demo.json (runs reduced only in transport tests).
function fixture(): PolicyPreviewRequest {
  return {
    schemaVersion: 'policy-impact-preview.v1',
    source: { system: 'civic-synthesis-demo', proposalId: 'synthetic-housing-policy', versionId: 'housing-demo-v2',
      contentHash: 'bcb6466a4803cc00cdba7102c4c4d2bc8925d09cb046737a314390af5421be8e', type: 'bill',
      title: 'Synthetic housing policy: additional parcel entitlements', url: 'https://example.org/synthetic-housing-policy/v2', visibility: 'public' },
    legal: { baseVersionId: 'housing-demo-v1', clauses: [{ clauseId: 'housing-section-2', sourcePolicyId: 'h_lots', operation: 'add', beforeText: '',
      afterText: 'Section 2. Permit additional homes on eligible residential parcels through the reviewed housing and zoning mechanism.' }] },
    baseline: { kind: 'prior-proposal-version', versionId: 'housing-demo-v1', label: 'Synthetic prior proposal without additional parcel entitlements' },
    simulation: { seed: 42, runs: 100, months: 24 },
  };
}
const id = `pp_${'a'.repeat(64)}`;
function reply(runs = 10): PolicyPreviewSubmission { return { id, url: `https://hbl.example/world/impact?preview=${id}`, supportStatus: 'supported',
  job: { status: 'queued', completed: 0, failed: 0, total: runs } }; }
function options(body: unknown = reply(), status = 202): PreviewClientOptions {
  return { origin: 'https://hbl.example', token: 'synthetic-test-token',
    fetch: (async () => Response.json(body, { status })) as unknown as typeof fetch };
}
function ten() { const f = fixture(); f.simulation.runs = 10; return f; }

test('pinned HBL housing fixture matches published canonical SHA256; exact text and array order matter', () => {
  const f = fixture(); validatePolicyPreview(f);
  expect(legalContentHash(f.legal)).toBe(f.source.contentHash);
  const reordered = { clauses: f.legal.clauses, baseVersionId: f.legal.baseVersionId };
  expect(canonicalLegal(reordered)).toBe(canonicalLegal(f.legal));
  f.legal.clauses[0]!.afterText += '\n';
  expect(legalContentHash(f.legal)).not.toBe(f.source.contentHash);
  expect(() => validatePolicyPreview(f)).toThrow();
});

test('transport preserves legitimate 100-pair requests and rejects mismatched remote totals', async () => {
  const input = fixture();
  const config = options(reply(100));
  let sent: unknown;
  config.fetch = (async (_url, init) => {
    sent = JSON.parse(init!.body as string);
    return Response.json(reply(100), {status:202});
  }) as typeof fetch;
  expect(await createPolicyPreview(input, config)).toEqual({status:'accepted',preview:reply(100)});
  expect(sent).toEqual(input);
  expect(input.simulation.runs).toBe(100);
  expect((await createPolicyPreview(input, options(reply(10)))).status).toBe('invalid');
});

test('POST sends exact ten-pair payload server-to-server, accepts queued and idempotent responses', async () => {
  const f = ten(); const o = options(); let calls = 0;
  o.fetch = (async (url: RequestInfo | URL, init?: RequestInit) => {
    calls++; expect(url).toBe('https://hbl.example/api/policy-previews');
    expect(JSON.parse(init!.body as string)).toEqual(f);
    expect(init!.headers).toEqual({ authorization: 'Bearer synthetic-test-token', 'content-type': 'application/json' });
    expect(init!.redirect).toBe('error'); expect(init!.credentials).toBe('omit');
    return Response.json(reply(), { status: calls === 1 ? 202 : 200 });
  }) as unknown as typeof fetch;
  expect(await createPolicyPreview(f, o)).toEqual({ status: 'accepted', preview: reply() });
  expect((await createPolicyPreview(f, o)).status).toBe('accepted'); expect(calls).toBe(2);
});

test('unsupported clauses and model unavailable remain explicit, without fabricated metrics', async () => {
  const f = ten(); f.source.type = 'constitutional-amendment'; f.legal.clauses[0]!.sourcePolicyId = 'unmodeled_amendment';
  f.source.contentHash = legalContentHash(f.legal);
  const r = reply(); r.supportStatus = 'unavailable'; r.job.status = 'unavailable';
  const result = await createPolicyPreview(f, options(r));
  expect(result).toEqual({ status: 'accepted', preview: r });
  expect(JSON.stringify(result)).not.toContain('outcomes');
});

test('add/remove/modify preserve legal text; no guessed parameter changes', () => {
  for (const operation of ['add', 'remove', 'modify'] as const) {
    const f = ten(), c = f.legal.clauses[0]!; c.operation = operation;
    c.beforeText = operation === 'add' ? '' : 'Original exact text';
    c.afterText = operation === 'remove' ? '' : 'Revised exact text';
    f.source.contentHash = legalContentHash(f.legal); validatePolicyPreview(f);
  }
});

test('stale hash, private content, wrong baseline, unknown fields and invalid bounds fail before transport', async () => {
  const mutations: ((f: any) => void)[] = [
    f => f.legal.clauses[0].afterText += ' edited', f => f.source.visibility = 'private',
    f => f.baseline.versionId = 'stale', f => f.schemaVersion = 'PolicyScenario.v1',
    f => f.modelVersion = 'invented', f => f.source.accountId = 'private',
    f => f.source.url += '?secret=x', f => f.source.url = 'https://user:password@example.org',
    f => f.simulation.runs = 101, f => f.simulation.months = 25, f => f.simulation.seed = NaN,
    f => f.legal.clauses.push(f.legal.clauses[0]), f => f.legal.clauses[0].beforeText = 'invalid add',
  ];
  for (const mutate of mutations) {
    const f = ten(); mutate(f); const o = options();
    o.fetch = (() => { throw new Error('must not send'); }) as unknown as unknown as typeof fetch;
    expect((await createPolicyPreview(f, o)).status).toBe('invalid');
  }
});

test('malformed replies, non-finite progress, wrong totals and foreign viewer links fail closed', async () => {
  const bad = [ {}, { ...reply(), url: 'https://other.example/world/impact' },
    { ...reply(), job: { ...reply().job, completed: Infinity } },
    { ...reply(), job: { ...reply().job, total: 100 } },
    { ...reply(), job: { ...reply().job, status: 'completed' } },
    { ...reply(), outcomes: { invented: 123 } }, { ...reply(), supportStatus: 'perfect' } ];
  for (const r of bad) expect((await createPolicyPreview(ten(), options(r))).status).toBe('invalid');
});

test('missing configuration, authentication, immutable conflicts, backpressure and service failures are explicit', async () => {
  expect((await createPolicyPreview(ten(), {})).status).toBe('disconnected');
  for (const [code, status] of [[401, 'unauthorized'], [403, 'unauthorized'], [409, 'conflict'], [429, 'busy'], [503, 'disconnected'], [400, 'rejected']] as const) {
    expect((await createPolicyPreview(ten(), options({}, code))).status).toBe(status);
  }
});

test('deadline covers transport and body parsing, including fetch implementations ignoring abort', async () => {
  for (const bodyHangs of [false, true]) {
    const o = options(); let signal: AbortSignal | null | undefined;
    o.timeoutMs = 5;
    o.fetch = ((_url: RequestInfo | URL, init?: RequestInit) => {
      signal = init?.signal;
      return bodyHangs ? Promise.resolve({ status: 202, json: () => new Promise(() => {}) }) : new Promise(() => {});
    }) as unknown as typeof fetch;
    expect((await createPolicyPreview(ten(), o)).status).toBe('timeout'); expect(signal?.aborted).toBe(true);
  }
});
