import { createHash } from 'node:crypto';
import type { CitizenProposalRecord } from '../shared/citizen-proposals';
import { HOUSING_DEMO_TITLE, HOUSING_DEMO_TEXT, type ProposalVersion, type PolicyPreview, type ProposalVersionData, type PolicyImpactPayload } from '../shared/policy-preview';
import { CitizenProposalError } from './citizen-proposals';
import { contactReasons } from './moderation';
export const canonical = (value: unknown): string => Array.isArray(value) ? `[${value.map(canonical).join(',')}]` : value && typeof value === 'object' ? `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical((value as Record<string, unknown>)[key])}`).join(',')}}` : JSON.stringify(value);
export const digest = (value: string) => createHash('sha256').update(value).digest('hex');
export const ownsProposal = (p: CitizenProposalRecord, voter: string) => p.ownerHash === digest(`citizen-voter:${voter}`);
export function makeVersion(p: CitizenProposalRecord, version: number, title: string, type: ProposalVersion['type'], clauses: ProposalVersion['clauses']): ProposalVersion {
  const contentHash = digest(JSON.stringify({ type, title, clauses }));
  return { version, versionId: `${p.id}:v${version}`, title, type, clauses: structuredClone(clauses), contentHash, createdAt: version === 1 ? p.publishedAt : new Date().toISOString() };
}
export function versions(p: CitizenProposalRecord): ProposalVersion[] {
  return p.legalVersions ?? [makeVersion(p, 1, p.title, 'bill', [{ clauseId: p.provenance === 'synthetic' ? 'section-0' : 'section-1', text: p.proposedChange }])];
}
export function versionData(p: CitizenProposalRecord, voter: string): ProposalVersionData {
  const responses = Object.fromEntries(versions(p).map(v => {
    const votes = v.version === 1 ? p.votesByVoterHash : p.versionVotes?.[String(v.version)] ?? {};
    const counts = { support: 0, oppose: 0, unsure: 0 };
    for (const vote of Object.values(votes)) counts[vote]++;
    return [String(v.version), { counts, ownVote: votes[digest(`citizen-voter:${voter}`)] ?? null }];
  }));
  return { responses, versions: versions(p), previews: p.policyPreviews ?? [], canEdit: ownsProposal(p, voter), provenance: p.provenance ?? 'citizen' };
}
export function saveVersion(p: CitizenProposalRecord, voter: string, body: Record<string, unknown>) {
  if (!ownsProposal(p, voter)) throw new CitizenProposalError('Only the publishing browser may create public versions.', 403);
  if (body.confirmedPublic !== true) throw new CitizenProposalError('Confirm public publication of this legal text. Private drafts are never imported.');
  if (typeof body.idempotencyKey !== 'string' || !/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(body.idempotencyKey)) throw new CitizenProposalError('A UUID idempotencyKey is required.');
  if (typeof body.title !== 'string' || !body.title.trim() || body.title.length > 160 || !['bill', 'constitutional-amendment'].includes(String(body.type))) throw new CitizenProposalError('A title and proposed document type are required.');
  if (!Array.isArray(body.clauses) || !body.clauses.length || body.clauses.length > 32) throw new CitizenProposalError('Supply 1–32 clauses.');
  const ids = new Set<string>(); let length = 0;
  const clauses = body.clauses.map(c => {
    if (!c || typeof c.clauseId !== 'string' || !/^[a-zA-Z0-9_-]{1,64}$/.test(c.clauseId) || ids.has(c.clauseId) || typeof c.text !== 'string' || !c.text.trim()) throw new CitizenProposalError('Each clause needs a unique stable ID and nonempty text.');
    ids.add(c.clauseId); length += c.text.length;
    return { clauseId: c.clauseId, text: c.text };
  });
  if (length > 10000) throw new CitizenProposalError('Legal text must be 10,000 characters or fewer.');
  if (contactReasons(body.title + '\n' + clauses.map(c => c.text).join('\n')).length) throw new CitizenProposalError('Remove contact details before public publication; review is required.');
  const bodyHash = digest(JSON.stringify([body.expectedVersion, body.title, body.type, clauses]));
  const key = digest(body.idempotencyKey);
  const existing = p.versionWriteKeys?.[key];
  if (existing) {
    if (existing.bodyHash !== bodyHash) throw new CitizenProposalError('Retry key already used for different text.', 409);
    return versions(p).find(v => v.version === existing.version)!;
  }
  const history = versions(p);
  if (body.expectedVersion !== history.at(-1)!.version) throw new CitizenProposalError('Revision changed. Reload before saving.', 409);
  if (history.length >= 100) throw new CitizenProposalError('Version storage is full; prior versions retained.', 409);
  const result = makeVersion(p, history.length + 1, body.title.trim(), body.type as ProposalVersion['type'], clauses);
  if (history.at(-1)!.contentHash === result.contentHash) throw new CitizenProposalError('Change the legal text before saving a revision.');
  p.legalVersions = [...history, result];
  (p.versionWriteKeys ??= {})[key] = { bodyHash, version: result.version };
  return result;
}
/** Only the server-created synthetic example has an explicit catalog mapping.
 * Citizen prose and constitutional drafts must await a reviewed model mapping. */
export function legalDiff(p: CitizenProposalRecord, base: ProposalVersion, next: ProposalVersion) {
  const before = new Map(base.clauses.map(c => [c.clauseId, c.text]));
  const after = new Map(next.clauses.map(c => [c.clauseId, c.text]));
  const demoMapping = next.title === HOUSING_DEMO_TITLE && p.provenance === 'synthetic' && base.type === 'bill' && next.type === 'bill' &&
    base.clauses.length === 1 && next.clauses.length === 2 && base.clauses[0]?.clauseId === 'section-0' && base.clauses[0]?.text === HOUSING_DEMO_TEXT[0] && next.clauses[0]?.text === HOUSING_DEMO_TEXT[0] && next.clauses[1]?.clauseId === 'section-1' && next.clauses[1]?.text === HOUSING_DEMO_TEXT[1];
  return [...new Set([...before.keys(), ...after.keys()])].flatMap(clauseId => {
    const beforeText = before.get(clauseId) ?? '', afterText = after.get(clauseId) ?? '';
    if (beforeText === afterText) return [];
    return [{ clauseId, sourcePolicyId: demoMapping && clauseId === 'section-1' ? 'h_lots' : null,
      operation: !before.has(clauseId) ? 'add' as const : !after.has(clauseId) ? 'remove' as const : 'modify' as const, beforeText, afterText }];
  });
}
export function createPreview(p: CitizenProposalRecord, voter: string, version: number, body: Record<string, unknown>, siteUrl: string): PolicyPreview {
  if (!ownsProposal(p, voter)) throw new CitizenProposalError('Only the publishing browser may transfer public legal text.', 403);
  if (body.confirmedPublicTransfer !== true) throw new CitizenProposalError('Review the exact legal text and confirm it contains no personal information before transfer.');
  const history = versions(p), next = history.find(v => v.version === version), base = history.find(v => v.version === body.baseVersion);
  if (!next || !base) throw new CitizenProposalError('Saved version not found.', 404);
  if (base.version === next.version) throw new CitizenProposalError('Choose two different saved versions.');
  const clauses = legalDiff(p, base, next);
  const transferredText = [next.title, ...clauses.flatMap(c => [c.beforeText, c.afterText])].join('\n');
  if (contactReasons(transferredText).length || /\b-?\d{1,3}\.\d{4,}\s*,\s*-?\d{1,3}\.\d{4,}\b/.test(transferredText)) throw new CitizenProposalError('Transfer blocked: remove personal details or precise coordinates and seek review.');
  const payload: PolicyImpactPayload = {
    schemaVersion: 'policy-impact-preview.v1',
    source: { system: 'civic-synthesis', proposalId: p.id, versionId: next.versionId, contentHash: digest(canonical({ baseVersionId: base.versionId, clauses })),
      type: next.type, title: next.title, url: `${siteUrl}/proposals/${encodeURIComponent(p.id)}/versions/${version}`, visibility: 'public' },
    legal: { baseVersionId: base.versionId, clauses },
    baseline: { kind: 'prior-proposal-version', versionId: base.versionId, label: `Proposed version ${base.version} (not enacted law)` },
    simulation: { seed: 42, runs: 100, months: 24 },
  };
  const id = `impact_${digest(JSON.stringify(payload))}`;
  const existing = p.policyPreviews?.find(item => item.id === id);
  if (existing) return existing;
  if ((p.policyPreviews?.length ?? 0) >= 200) throw new CitizenProposalError('Preview storage is full; previous previews retained.', 409);
  const supported = clauses.length > 0 && clauses.every(c => c.sourcePolicyId !== null);
  const preview: PolicyPreview = { id, payload, createdAt: new Date().toISOString(), attempts: 0,
    status: supported ? 'queued' : 'unsupported', message: supported ? undefined : 'No supported outcome model for this legal change. The legal diff remains available.' };
  (p.policyPreviews ??= []).push(preview);
  return preview;
}
export interface HblConfig { url: string; token?: string }
export function hblOrigin(config: HblConfig) {
  const url = new URL(config.url);
  if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash) throw new Error('HBL_URL must be an HTTPS origin');
  return url.origin;
}
/** Bounded, authenticated, no redirects, deterministic remote idempotency. */
export async function submitPreview(preview: PolicyPreview, config: HblConfig, fetcher: typeof fetch = fetch): Promise<Partial<PolicyPreview>> {
  if (!config.token) return { status: 'unavailable', message: 'Simulator unavailable: integration credentials are not configured.' };
  let attempts = 0;
  try {
    const origin = hblOrigin(config);
    for (let n = 0; n < 3; n++) {
      attempts++;
      const retry = preview.remoteId && preview.status === 'unavailable';
      const path = preview.remoteId ? `/api/policy-previews/${encodeURIComponent(preview.remoteId)}${retry ? '/retry' : ''}` : '/api/policy-previews';
      let response: Response;
      try { response = await fetcher(origin + path, { method: preview.remoteId && !retry ? 'GET' : 'POST', redirect: 'error', signal: AbortSignal.timeout(8000),
        headers: { authorization: `Bearer ${config.token}`, 'content-type': 'application/json', 'idempotency-key': preview.id },
        ...(retry ? { body: '{}' } : preview.remoteId ? {} : { body: JSON.stringify(preview.payload) }) }); }
      catch { if (n < 2) { await new Promise(resolve => setTimeout(resolve, 250 * 2 ** n)); continue; } throw new Error('Unavailable'); }
      if (!response.ok) {
        if ((response.status === 429 || response.status >= 500) && n < 2) { await new Promise(resolve => setTimeout(resolve, 250 * 2 ** n)); continue; }
        throw new Error('Unavailable');
      }
      const text = await limitedResponse(response, 2_000_000);
      if (text.includes(config.token)) throw new Error('Unsafe metadata');
      const data = JSON.parse(text);
      const status = data.job?.status;
      if (typeof data.id !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(data.id) || (preview.remoteId && data.id !== preview.remoteId)) throw new Error('Invalid preview');
      const url = new URL(data.url);
      if (url.origin !== origin || url.pathname !== '/world/impact' || url.searchParams.get('preview') !== data.id || url.username || url.password || url.hash || [...url.searchParams.keys()].some(k => k !== 'preview')) throw new Error('Invalid canonical URL');
      if (!['queued','running','partial','completed','failed','unavailable'].includes(status)) throw new Error('Invalid status');
      let results = preview.results;
      if (status === 'completed' && !results) {
        try {
        const resultResponse = await fetcher(`${origin}/api/policy-previews/${encodeURIComponent(data.id)}/results?runIndex=0`, {
          redirect: 'error', signal: AbortSignal.timeout(8000), headers: { authorization: `Bearer ${config.token}` },
        });
        if (resultResponse.ok) {
          const raw = await limitedResponse(resultResponse, 2_000_000);
          if (raw.includes(config.token)) throw new Error('Unsafe result');
          const value = JSON.parse(raw);
          if (!value || typeof value !== 'object') throw new Error('Invalid results');
          results = { receivedAt: new Date().toISOString(), data: value };
        }
        } catch { /* Viewer remains usable when the optional recorded result sample is too large. */ }
      }
      const remoteMetadata = { ...preview.remoteMetadata, ...(typeof data.modelVersion === 'string' ? {modelVersion:data.modelVersion} : {}), ...(typeof data.mappingVersion === 'string' ? {mappingVersion:data.mappingVersion} : {}), ...(Array.isArray(data.parameterDiff) ? {parameterDiff:data.parameterDiff} : {}), job:data.job };
      return { results, remoteMetadata, remoteId: data.id, url: url.href, status: ['failed', 'partial', 'unavailable'].includes(status) ? 'unavailable' : status,
        attempts: preview.attempts + attempts, updatedAt: new Date().toISOString(), message: ['failed', 'partial', 'unavailable'].includes(status) ? 'Simulator reports incomplete or unavailable results. Open HBL for retained results and retry details.' : undefined };
    }
  } catch { /* Never return remote error bodies, credentials or invented outcomes. */ }
  return { status: 'unavailable', attempts: preview.attempts + attempts, message: 'Simulator unavailable or incompatible. Your legal diff is saved; retry later.' };
}
async function limitedResponse(response: Response, maxBytes = 65536) {
  const reader = response.body?.getReader(); if (!reader) throw new Error('Missing response');
  let size = 0; const chunks: Uint8Array[] = [];
  try { while (true) { const { value, done } = await reader.read(); if (done) break; size += value.length; if (size > maxBytes) throw new Error('Oversized response'); chunks.push(value); } }
  finally { await reader.cancel(); }
  return Buffer.concat(chunks).toString('utf8');
}
