/** Server-only HBL transport. Never import this module from src/client. */
import { createHash } from 'node:crypto';
import { POLICY_PREVIEW_SCHEMA, type PolicyPreviewInput, type PolicyPreviewReceipt,
  type PolicyPreviewManifest, type PolicyPreviewResults } from '../shared/policy-impact-preview-contract';

export type PolicyPreviewErrorState = 'invalid_input' | 'unconfigured' | 'unauthorized' | 'conflict' |
  'rate_limited' | 'not_found' | 'upstream' | 'malformed' | 'timeout' | 'network';
export class PolicyPreviewError extends Error {
  constructor(public readonly state: PolicyPreviewErrorState, public readonly status?: number) {
    super(`Policy preview ${state}`); this.name = 'PolicyPreviewError';
  }
}
function reject(): never { throw new PolicyPreviewError('invalid_input'); }
type Obj = Record<string, any>;
function object(value: unknown): value is Obj {
  return value !== null && typeof value === 'object' && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
}
function shape(value: unknown, required: string[], optional: string[] = []): asserts value is Obj {
  if (!object(value) || required.some(key => !Object.hasOwn(value, key)) ||
    Object.keys(value).some(key => !required.includes(key) && !optional.includes(key))) reject();
}
function str(value: unknown, max = 200): asserts value is string {
  if (typeof value !== 'string' || !value.trim() || value.length > max) reject();
}
function integer(value: unknown, min: number, max: number): asserts value is number {
  if (!Number.isInteger(value) || (value as number) < min || (value as number) > max) reject();
}
/** Sort keys in the serialized representation, including integer-like object keys. */
export function canonicalPreviewJson(value: unknown): string {
  if (Array.isArray(value)) return `[${Array.from(value, canonicalPreviewJson).join(',')}]`;
  if (object(value)) return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonicalPreviewJson(value[key])}`).join(',')}}`;
  if (value === null || typeof value === 'string' || typeof value === 'boolean' || typeof value === 'number' && Number.isFinite(value)) return JSON.stringify(value);
  return reject();
}
export function policyPreviewHash(value: unknown): string {
  return createHash('sha256').update(canonicalPreviewJson(value), 'utf8').digest('hex');
}
export function validatePolicyPreview(value: unknown): PolicyPreviewInput {
  shape(value, ['schemaVersion', 'source', 'legal', 'baseline', 'simulation'], ['modelRunId']);
  if (value.schemaVersion !== POLICY_PREVIEW_SCHEMA) reject();
  const {source, legal, baseline, simulation} = value;
  shape(source, ['system', 'proposalId', 'versionId', 'contentHash', 'type', 'title', 'url', 'visibility']);
  for (const key of ['system', 'proposalId', 'versionId', 'title']) str(source[key], key === 'title' ? 500 : 200);
  if (!['bill', 'constitutional-amendment'].includes(source.type) || source.visibility !== 'public') reject();
  if (typeof source.url !== 'string') reject();
  try { const url = new URL(source.url);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || source.url.includes('?') || source.url.includes('#')) reject();
  } catch { reject(); }
  shape(legal, ['baseVersionId', 'clauses']); str(legal.baseVersionId);
  if (!Array.isArray(legal.clauses) || legal.clauses.length < 1 || legal.clauses.length > 32) reject();
  const ids = new Set(), policies = new Set();
  for (const clause of legal.clauses) {
    shape(clause, ['clauseId', 'sourcePolicyId', 'operation', 'beforeText', 'afterText']);
    str(clause.clauseId, 96); str(clause.sourcePolicyId, 96);
    if (!/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(clause.sourcePolicyId) || ids.has(clause.clauseId) || policies.has(clause.sourcePolicyId)) reject();
    ids.add(clause.clauseId); policies.add(clause.sourcePolicyId);
    if (!['add', 'remove', 'modify'].includes(clause.operation)) reject();
    for (const key of ['beforeText', 'afterText']) if (typeof clause[key] !== 'string' || clause[key].length > 20000) reject();
    if (clause.operation === 'add' && (clause.beforeText !== '' || !clause.afterText.trim()) ||
      clause.operation === 'remove' && (clause.afterText !== '' || !clause.beforeText.trim()) ||
      clause.operation === 'modify' && (!clause.beforeText.trim() || !clause.afterText.trim())) reject();
  }
  if (typeof source.contentHash !== 'string' || !/^[a-f0-9]{64}$/.test(source.contentHash) || source.contentHash !== policyPreviewHash(legal)) reject();
  shape(baseline, ['kind', 'versionId', 'label']); str(baseline.versionId); str(baseline.label);
  if (!['current-law', 'prior-proposal-version'].includes(baseline.kind) || baseline.versionId !== legal.baseVersionId) reject();
  shape(simulation, ['seed', 'runs', 'months']);
  integer(simulation.seed, 0, 4294967295); integer(simulation.runs, 1, 100); integer(simulation.months, 1, 24);
  if (Object.hasOwn(value, 'modelRunId')) { str(value.modelRunId, 96); if (!/^[A-Za-z0-9_-]+$/.test(value.modelRunId)) reject(); }
  const copy = structuredClone(value) as PolicyPreviewInput;
  if (Buffer.byteLength(JSON.stringify(copy)) > 700000) reject();
  return copy;
}
function job(value: unknown) {
  shape(value, ['status', 'completed', 'failed', 'total'], ['error']);
  if (!['queued', 'running', 'partial', 'completed', 'failed', 'unavailable'].includes(value.status)) reject();
  integer(value.total, 1, 100); integer(value.completed, 0, value.total); integer(value.failed, 0, value.total - value.completed);
  if (value.status === 'completed' && value.completed !== value.total) reject();
  if (value.error !== undefined && value.error !== null) str(value.error, 2000);
}
const metricKeys = ['population', 'households', 'housingUnits', 'availableUnits', 'meanRent', 'unhoused', 'employed', 'jobs', 'businesses', 'meanTravelMinutes', 'overloadedServices', 'utilityFailures', 'balance', 'debt', 'completedProjects'];
function metrics(value: unknown) {
  shape(value, metricKeys);
  if (Object.values(value).some(number => typeof number !== 'number' || !Number.isFinite(number))) reject();
}
const validId = (id: string) => /^pp_[a-f0-9]{64}$/.test(id);
function receipt(value: unknown, origin: string, expectedId?: string): asserts value is Obj {
  if (!object(value) || !validId(value.id) || expectedId && value.id !== expectedId) reject();
  if (value.url !== `${origin}/world/impact?preview=${value.id}` || !['supported', 'partial', 'unavailable'].includes(value.supportStatus)) reject();
  job(value.job);
}
function recorded(value: Obj) {
  if (!Array.isArray(value.checkpointMonths) || !value.checkpointMonths.length || new Set(value.checkpointMonths).size !== value.checkpointMonths.length) reject();
  for (const month of value.checkpointMonths) integer(month, 0, 24);
  if (!object(value.uncertainty)) reject();
}
export interface PolicyPreviewClientOptions { url?: string; token?: string; timeoutMs?: number; fetch?: typeof fetch }
export function createPolicyPreviewClient(options: PolicyPreviewClientOptions = {}) {
  const raw = options.url ?? process.env.HBL_URL;
  let origin: string;
  try {
    const url = new URL(raw ?? '');
    if ((url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))) || url.username || url.password || url.pathname !== '/' || url.search || url.hash) throw Error();
    origin = url.origin;
  } catch { throw new PolicyPreviewError('unconfigured'); }
  const token = options.token ?? process.env.HBL_POLICY_PREVIEW_TOKEN;
  const timeoutMs = options.timeoutMs ?? 20000;
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) throw new PolicyPreviewError('unconfigured');
  const request = options.fetch ?? fetch;
  async function call(path: string, method: 'GET' | 'POST', body?: string) {
    if (method === 'POST' && (!token || /[\r\n]/.test(token))) throw new PolicyPreviewError('unconfigured');
    const signal = AbortSignal.timeout(timeoutMs);
    try {
      const response = await request(`${origin}${path}`, {method, body, redirect: 'error', signal,
        headers: method === 'POST' ? {'content-type': 'application/json', authorization: `Bearer ${token}`} : {accept: 'application/json'}});
      if (!(method === 'POST' ? [200, 202] : [200]).includes(response.status)) {
        const states: Record<number, PolicyPreviewErrorState> = {401: 'unauthorized', 409: 'conflict', 429: 'rate_limited', 404: 'not_found'};
        throw new PolicyPreviewError(states[response.status] ?? 'upstream', response.status);
      }
      if (!response.headers.get('content-type')?.toLowerCase().includes('application/json')) throw new PolicyPreviewError('malformed');
      // Bound streamed results (the upstream 100-pair fixture is about 25.3 MB).
      const reader = response.body?.getReader(); if (!reader) throw new PolicyPreviewError('malformed');
      let size = 0; const chunks: Uint8Array[] = [];
      while (true) { const {done, value} = await reader.read(); if (done) break;
        size += value.byteLength; if (size > 64 * 1024 * 1024) { await reader.cancel(); throw new PolicyPreviewError('malformed'); } chunks.push(value);
      }
      let data: unknown;
      try { data = JSON.parse(Buffer.concat(chunks).toString('utf8')); canonicalPreviewJson(data); }
      catch { throw new PolicyPreviewError('malformed'); }
      return {data, status: response.status as 200 | 202};
    } catch (error) {
      if (error instanceof PolicyPreviewError) throw error;
      throw new PolicyPreviewError(signal.aborted ? 'timeout' : 'network');
    }
  }
  async function checked<T>(path: string, method: 'GET' | 'POST', validate: (value: unknown) => void, body?: string) {
    const result = await call(path, method, body);
    try { validate(result.data); } catch { throw new PolicyPreviewError('malformed'); }
    return {status: result.status, value: result.data as T};
  }
  function path(id: string) { if (!validId(id)) throw new PolicyPreviewError('invalid_input'); return `/api/policy-previews/${id}`; }
  return {
    async create(input: unknown) {
      const snapshot = validatePolicyPreview(input);
      return checked<PolicyPreviewReceipt>('/api/policy-previews', 'POST', value => {
        shape(value, ['id', 'url', 'supportStatus', 'job']); receipt(value, origin);
        if (value.job.total !== snapshot.simulation.runs) reject();
      }, JSON.stringify(snapshot));
    },
    async manifest(id: string) {
      return (await checked<PolicyPreviewManifest>(path(id), 'GET', value => {
        receipt(value, origin, id); validatePolicyPreview(value.input); recorded(value);
        str(value.modelVersion, 500); str(value.mappingVersion); str(value.createdAt);
        if (!Number.isFinite(Date.parse(value.createdAt)) || !Array.isArray(value.parameterDiff) || !object(value.runtimeManifest) || value.job.total !== value.input.simulation.runs) reject();
      })).value;
    },
    async results(id: string, runIndex?: number) {
      if (runIndex !== undefined) integer(runIndex, 0, 99);
      return (await checked<PolicyPreviewResults>(path(id) + '/results' + (runIndex === undefined ? '' : `?runIndex=${runIndex}`), 'GET', value => {
        shape(value, ['id', 'job', 'runs', 'checkpointMonths', 'uncertainty']);
        if (value.id !== id) reject(); job(value.job); recorded(value);
        if (!Array.isArray(value.runs) || value.runs.length > value.job.total) reject();
        const indices = new Set();
        for (const run of value.runs) {
          if (!object(run)) reject(); integer(run.runIndex, 0, value.job.total - 1); integer(run.seed, 0, 4294967295); integer(run.attempts, 1, 3);
          if (indices.has(run.runIndex) || runIndex !== undefined && run.runIndex !== runIndex) reject(); indices.add(run.runIndex);
          if (run.status === 'failed') { str(run.error, 2000); if (run.baseline !== undefined || run.proposal !== undefined) reject(); }
          else if (run.status === 'completed') {
            for (const arm of [run.baseline, run.proposal]) {
              if (!object(arm) || !Array.isArray(arm.metricsTimeline) || !arm.metricsTimeline.length || !Array.isArray(arm.checkpoints) || !arm.checkpoints.length) reject();
              for (const [month, row] of arm.metricsTimeline.entries()) { if (!object(row) || row.month !== month) reject(); metrics(row.metrics); }
              if (arm.metricsTimeline.length !== Math.max(...value.checkpointMonths) + 1 || arm.checkpoints.length !== value.checkpointMonths.length) reject();
              for (const [index, row] of arm.checkpoints.entries()) { if (!object(row) || !object(row.state) || row.month !== value.checkpointMonths[index]) reject(); integer(row.month, 0, 24); }
            }
          } else reject();
        }
        if (runIndex === undefined && (value.runs.filter((run: Obj) => run.status === 'completed').length !== value.job.completed || value.runs.filter((run: Obj) => run.status === 'failed').length !== value.job.failed)) reject();
      })).value;
    },
  };
}
