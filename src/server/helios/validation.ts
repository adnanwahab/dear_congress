import { createHash } from 'node:crypto';
import { HELIOS_SCHEMA, HELIOS_NO_CHANGE, HELIOS_ABSTENTION, type HeliosModelOutput, type HeliosRequest, type HeliosSource, type HeliosErrorCode } from '../../shared/helios-contract';
export class HeliosError extends Error {
  constructor(public readonly code: HeliosErrorCode) { super(code); }
}
export const hash = (value: unknown) => 'sha256:' + createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value, (_key, row) => row && typeof row === 'object' && !Array.isArray(row) ? Object.fromEntries(Object.entries(row).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)) : row)).digest('hex');
const fail = (code: HeliosErrorCode): never => { throw new HeliosError(code); };
export function object(value: unknown, keys: string[], code: HeliosErrorCode): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return fail(code);
  const row = value as Record<string, unknown>;
  if (Object.keys(row).some(key => !keys.includes(key))) return fail(code);
  return row;
}
export function str(value: unknown, max = 4000, code: HeliosErrorCode = 'INVALID_OUTPUT'): string {
  if (typeof value !== 'string' || !value.trim() || value.length > max || /[\u0000-\u0008]/.test(value)) return fail(code);
  return value;
}
function array(value: unknown, max: number, code: HeliosErrorCode): unknown[] {
  if (!Array.isArray(value) || value.length > max) return fail(code);
  return value;
}
export function validateRequest(input: unknown, external: boolean): HeliosRequest {
  const code = 'INVALID_INPUT';
  const r = object(input, ['schema', 'invokedByHuman', 'optedIn', 'scope', 'sources'], code);
  if (r.schema !== HELIOS_SCHEMA || r.invokedByHuman !== true || r.optedIn !== true) return fail('CONSENT_REQUIRED');
  const scope = object(r.scope, ['repository', 'itemKind', 'itemId', 'revision', 'head', 'base'], code);
  for (const k of ['repository', 'itemId', 'revision']) str(scope[k], 200, code);
  if (scope.repository !== 'adnanwahab/dear_congress') return fail(code);
  if (scope.itemKind === 'pull-request') {
    str(scope.head, 200, code); str(scope.base, 200, code);
    if (scope.revision !== scope.head) return fail(code);
  } else if (!['citizen-proposal', 'hfl'].includes(String(scope.itemKind)) || scope.head !== undefined || scope.base !== undefined) return fail(code);
  if (scope.itemKind === 'hfl' && !/^HFL-\d{3}$/.test(String(scope.itemId))) return fail(code);
  const sources = array(r.sources, 40, code);
  if (!sources.length) return fail(code);
  const ids = new Set<string>();
  for (const raw of sources) {
    const s = object(raw, ['id', 'kind', 'text', 'revisionHash', 'consent', 'objection'], code);
    const id = str(s.id, 128, code);
    if (!/^[a-zA-Z0-9_.:-]+$/.test(id) || ids.has(id)) return fail(code);
    ids.add(id);
    str(s.text, 8000, code);
    if (!['proposal', 'clause', 'objection', 'evidence', 'private-journal'].includes(String(s.kind)) || s.revisionHash !== hash(s.text)) return fail(code);
    const c = object(s.consent, ['receipt', 'revisionHash', 'generation', 'externalProcessing', 'publicOutput'], 'CONSENT_REQUIRED');
    str(c.receipt, 200, 'CONSENT_REQUIRED');
    if (c.revisionHash !== s.revisionHash || c.generation !== true || c.publicOutput !== true || typeof c.externalProcessing !== 'boolean' || (external && c.externalProcessing !== true)) return fail('CONSENT_REQUIRED');
    if (s.kind === 'objection') {
      const o = object(s.objection, ['id', 'text', 'severity', 'constituency', 'createdAt', 'responses'], code);
      if (o.id !== id || o.text !== s.text || !['concern', 'major', 'blocking'].includes(String(o.severity))) return fail(code);
      str(o.constituency, 400, code); str(o.createdAt, 100, code);
      for (const rawResponse of array(o.responses, 100, code)) {
        const response = object(rawResponse, ['status', 'reason', 'createdAt', 'actor'], code);
        if (!['declined', 'unresolved'].includes(String(response.status)) || response.actor !== 'proposer') return fail(code);
        str(response.reason, 4000, code); str(response.createdAt, 100, code);
      }
    } else if (s.objection !== undefined) return fail(code);
  }
  if (!sources.some(s => (s as HeliosSource).kind === 'proposal')) return fail(code);
  if (JSON.stringify(input).length > 48000) return fail(code);
  return structuredClone(input) as HeliosRequest;
}
export function validateOutput(input: unknown, sources: HeliosSource[]): HeliosModelOutput {
  const code = 'INVALID_OUTPUT';
  const r = object(input, ['schema', 'sharedGoals', 'objections', 'alternatives', 'noChange', 'abstention', 'amendments', 'uncertainty', 'missingEvidence'], code);
  if (r.schema !== HELIOS_SCHEMA || /https?:\/\//i.test(JSON.stringify(r))) return fail(code);
  const ids = new Set(sources.map(s => s.id));
  const refs = (value: unknown) => {
    const list = array(value, 40, code);
    if (!list.length || new Set(list).size !== list.length || list.some(id => typeof id !== 'string' || !ids.has(id))) return fail(code);
  };
  const claim = (value: unknown) => {
    const c = object(value, ['text', 'citations'], code); str(c.text); refs(c.citations);
    // Citations are IDs only. Provider-created URLs cannot masquerade as source provenance.
    if (/https?:\/\//i.test(String(c.text))) return fail(code);
  };
  const claims = (value: unknown) => array(value, 40, code).forEach(claim);
  claims(r.sharedGoals);
  const goals = r.sharedGoals as { text: string }[];
  if (new Set(goals.map(g => g.text.trim().toLowerCase())).size !== goals.length) return fail(code);
  const objections = array(r.objections, 40, code);
  const expected = sources.filter(s => s.kind === 'objection').map(s => s.id);
  const seen = new Set<string>();
  for (const value of objections) {
    const o = object(value, ['sourceId', 'strongestCase'], code);
    if (typeof o.sourceId !== 'string' || !expected.includes(o.sourceId) || seen.has(o.sourceId)) return fail(code);
    seen.add(o.sourceId); claim(o.strongestCase);
    if (!(o.strongestCase as { citations: string[] }).citations.includes(o.sourceId)) return fail(code);
  }
  if (seen.size !== expected.length) return fail(code);
  const alternatives = array(r.alternatives, 3, code);
  if (alternatives.length !== 3) return fail(code);
  const alternativesSeen = new Set();
  for (const value of alternatives) {
    const a = object(value, ['id', 'text', 'citations', 'tradeoffs'], code);
    if (!['alternative-a', 'alternative-b', 'alternative-c'].includes(String(a.id)) || alternativesSeen.has(a.id)) return fail(code);
    alternativesSeen.add(a.id); claim({ text: a.text, citations: a.citations });
    claims(a.tradeoffs); if (!(a.tradeoffs as unknown[]).length) return fail(code);
  }
  if (new Set(alternatives.map(a => (a as { text: string }).text.trim().toLowerCase())).size !== 3) return fail(code);
  for (const [key, fixed] of [['noChange', HELIOS_NO_CHANGE], ['abstention', HELIOS_ABSTENTION]] as const) {
    const option = object(r[key], ['id', 'text'], code);
    if (option.id !== fixed.id || option.text !== fixed.text) return fail(code);
  }
  const amendments = array(r.amendments, 40, code);
  for (const clause of sources.filter(s => s.kind === 'clause')) {
    if (!amendments.some(a => a && typeof a === 'object' && (a as { clauseId?: unknown }).clauseId === clause.id)) return fail(code);
  }
  for (const value of amendments) {
    const a = object(value, ['clauseId', 'alternativeId', 'replacement', 'tradeoffs', 'citations'], code);
    if (!sources.some(s => s.id === a.clauseId && s.kind === 'clause') || !alternativesSeen.has(a.alternativeId)) return fail(code);
    str(a.replacement); refs(a.citations); claims(a.tradeoffs);
    if (!(a.citations as string[]).includes(String(a.clauseId)) || !(a.tradeoffs as unknown[]).length) return fail(code);
  }
  for (const key of ['uncertainty', 'missingEvidence']) {
    const list = array(r[key], 40, code); if (!list.length) return fail(code); list.forEach(v => str(v));
  }
  return structuredClone(input) as HeliosModelOutput;
}
