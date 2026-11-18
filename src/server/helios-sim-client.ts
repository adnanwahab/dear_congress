/** Server-only outbound HBL preview creation. No routes, storage or automatic retry. */
import { createHash } from 'node:crypto';
import { canonicalLegal, POLICY_PREVIEW_SCHEMA, type PolicyPreviewRequest, type PolicyPreviewSubmission } from '../shared/helios-sim-contract';

function check(ok: unknown): asserts ok { if (!ok) throw new Error('Invalid policy preview'); }
function shape(v: unknown, keys: string[]): asserts v is Record<string, unknown> {
  check(v && typeof v === 'object' && !Array.isArray(v));
  check(Object.keys(v).every(k => keys.includes(k)));
}
function str(v: unknown, max = 200): asserts v is string { check(typeof v === 'string' && v.trim() && v.length <= max); }
function integer(v: unknown, min: number, max: number): asserts v is number { check(typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max); }
function httpUrl(v: unknown): URL {
  str(v, 10000); const u = new URL(v);
  check(['http:', 'https:'].includes(u.protocol) && !u.username && !u.password); return u;
}
export function legalContentHash(legal: PolicyPreviewRequest['legal']): string {
  return createHash('sha256').update(canonicalLegal(legal), 'utf8').digest('hex');
}
/** Mirrors the pinned executable HBL validator, including unknown-field rejection. */
export function validatePolicyPreview(value: unknown): asserts value is PolicyPreviewRequest {
  shape(value, ['schemaVersion', 'source', 'legal', 'baseline', 'simulation', 'modelRunId']);
  check(value.schemaVersion === POLICY_PREVIEW_SCHEMA);
  const { source: s, legal: l, baseline: b, simulation: sim } = value;
  shape(s, ['system', 'proposalId', 'versionId', 'contentHash', 'type', 'title', 'url', 'visibility']);
  for (const key of ['system', 'proposalId', 'versionId']) str(s[key]); str(s.title, 500);
  check(s.visibility === 'public' && ['bill', 'constitutional-amendment'].includes(s.type as string));
  const url = httpUrl(s.url); check(!url.search && !url.hash);
  shape(l, ['baseVersionId', 'clauses']); str(l.baseVersionId);
  check(Array.isArray(l.clauses) && l.clauses.length >= 1 && l.clauses.length <= 32);
  const ids = new Set(), policies = new Set();
  for (const c of l.clauses) {
    shape(c, ['clauseId', 'sourcePolicyId', 'operation', 'beforeText', 'afterText']);
    str(c.clauseId, 96); str(c.sourcePolicyId, 96);
    check(/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(c.sourcePolicyId) && !ids.has(c.clauseId) && !policies.has(c.sourcePolicyId));
    ids.add(c.clauseId); policies.add(c.sourcePolicyId);
    check(typeof c.beforeText === 'string' && c.beforeText.length <= 20000 && typeof c.afterText === 'string' && c.afterText.length <= 20000);
    check(c.operation === 'add' ? c.beforeText === '' && c.afterText.trim()
      : c.operation === 'remove' ? c.afterText === '' && c.beforeText.trim()
      : c.operation === 'modify' && c.beforeText.trim() && c.afterText.trim());
  }
  check(s.contentHash === legalContentHash(l as unknown as PolicyPreviewRequest['legal']));
  shape(b, ['kind', 'versionId', 'label']); str(b.versionId); str(b.label);
  check(['current-law', 'prior-proposal-version'].includes(b.kind as string) && b.versionId === l.baseVersionId);
  shape(sim, ['seed', 'runs', 'months']); integer(sim.seed, 0, 4294967295); integer(sim.runs, 1, 100); integer(sim.months, 1, 24);
  if (value.modelRunId !== undefined) { str(value.modelRunId, 96); check(/^[A-Za-z0-9_-]+$/.test(value.modelRunId)); }
  check(Buffer.byteLength(JSON.stringify(value), 'utf8') <= 700000);
}
export interface PreviewClientOptions {
  /** Trusted server configuration, never an incoming request URL. */
  origin?: string; token?: string; timeoutMs?: number; fetch?: typeof fetch;
}
export type PreviewCreateResult = { status: 'accepted'; preview: PolicyPreviewSubmission }
  | { status: 'invalid' | 'disconnected' | 'timeout' | 'unauthorized' | 'conflict' | 'busy' | 'rejected' };
function submission(v: unknown, origin: string, runs: number): PolicyPreviewSubmission {
  shape(v, ['id', 'url', 'supportStatus', 'job']);
  check(typeof v.id === 'string' && /^pp_[a-f0-9]{64}$/.test(v.id));
  const url = httpUrl(v.url);
  check(url.origin === origin && url.pathname === '/world/impact' && !url.hash && url.search === `?preview=${v.id}`);
  check(['supported', 'partial', 'unavailable'].includes(v.supportStatus as string));
  shape(v.job, ['status', 'completed', 'failed', 'total', 'error']);
  check(['queued', 'running', 'partial', 'completed', 'failed', 'unavailable'].includes(v.job.status as string));
  integer(v.job.total, runs, runs); integer(v.job.completed, 0, runs); integer(v.job.failed, 0, runs);
  check(v.job.completed + v.job.failed <= runs);
  check(v.job.status !== 'completed' || v.job.completed === runs);
  check(v.job.error === undefined || v.job.error === null || typeof v.job.error === 'string');
  return structuredClone(v) as unknown as PolicyPreviewSubmission;
}
export async function createPolicyPreview(input: PolicyPreviewRequest, options: PreviewClientOptions): Promise<PreviewCreateResult> {
  let body: string, origin: URL, runs: number;
  try {
    validatePolicyPreview(input); body = JSON.stringify(input); runs = input.simulation.runs;
    if (!options.origin || !options.token) return { status: 'disconnected' };
    origin = httpUrl(options.origin); check(origin.pathname === '/' && !origin.search && !origin.hash);
    check(!/[\r\n]/.test(options.token));
    integer(options.timeoutMs ?? 10000, 1, 60000);
  } catch { return { status: 'invalid' }; }
  const controller = new AbortController(); let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<PreviewCreateResult>(resolve => {
    timer = setTimeout(() => { controller.abort(); resolve({ status: 'timeout' }); }, options.timeoutMs ?? 10000);
  });
  const request = async (): Promise<PreviewCreateResult> => {
    try {
      const response = await (options.fetch ?? fetch)(`${origin.origin}/api/policy-previews`, {
        method: 'POST', headers: { authorization: `Bearer ${options.token}`, 'content-type': 'application/json' },
        body, signal: controller.signal, redirect: 'error', credentials: 'omit',
      });
      if (response.status === 401 || response.status === 403) return { status: 'unauthorized' };
      if (response.status === 409) return { status: 'conflict' };
      if (response.status === 429) return { status: 'busy' };
      if (response.status >= 500) return { status: 'disconnected' };
      if (response.status !== 200 && response.status !== 202) return { status: 'rejected' };
      try { return { status: 'accepted', preview: submission(await response.json(), origin.origin, runs) }; }
      catch { return { status: 'invalid' }; }
    } catch { return { status: controller.signal.aborted ? 'timeout' : 'disconnected' }; }
  };
  try { return await Promise.race([deadline, request()]); } finally { clearTimeout(timer); }
}
