import { createHash } from 'node:crypto';
import type { CitizenProposalRecord } from '../shared/citizen-proposals';
import { contactReasons } from './moderation';
import { exactClauseDiff, legalHash, validatePreviewClauses, type PreviewClause } from './policy-preview-diff';

/** Structural subset of PR #450 ProposalVersion; never a second persistence model. */
export interface PublicLegalVersion {
  version: number; versionId: string; type: 'bill' | 'constitutional-amendment';
  title: string; clauses: PreviewClause[]; contentHash: string; createdAt: string;
}
type VersionedProposal = CitizenProposalRecord & { legalVersions?: PublicLegalVersion[]; provenance?: 'synthetic' };
export class PreviewSourceError extends Error {
  constructor(message: string, readonly status = 400) { super(message); }
}
const digest = (text: string) => createHash('sha256').update(text, 'utf8').digest('hex');
/** Saved-version identity uses PR #450's existing algorithm, distinct from HBL legalHash. */
export function savedVersionHash(version: Pick<PublicLegalVersion, 'type' | 'title' | 'clauses'>) {
  return digest(JSON.stringify({ type: version.type, title: version.title, clauses: version.clauses.map(c => ({ clauseId: c.clauseId, text: c.text })) }));
}
export function sanitizePreviewSourceUrl(value: string) {
  let url: URL;
  try { url = new URL(value); } catch { throw new PreviewSourceError('Invalid public source URL'); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new PreviewSourceError('Credential-free HTTP(S) source URL required');
  url.search = ''; url.hash = '';
  return url.href;
}
/** Server-owned review evidence. Never deserialize this argument from a request body.
 * Binding both saved hashes prevents a prior review authorizing new legal text. */
export interface ReviewedPreviewMapping {
  repository: 'adnanwahab/dear_congress'; proposalId: string;
  baseVersionId: string; versionId: string; baseHash: string; versionHash: string;
  clauseId: string; sourcePolicyId: 'h_lots' | 'f_drainage' | 't_brt';
  reviewUrl: string;
}
export interface PreviewSourceSelection {
  proposalId: string; versionId: string; baseVersionId: string;
  expectedHash: string; expectedBaseHash: string; confirmedPublicTransfer: boolean;
}
function readVersion(p: VersionedProposal, id: string): PublicLegalVersion {
  let history = p.legalVersions;
  if (!history) {
    const initial = { version: 1, versionId: `${p.id}:v1`, type: 'bill' as const, title: p.title,
      clauses: [{ clauseId: p.provenance === 'synthetic' ? 'section-0' : 'section-1', text: p.proposedChange }], createdAt: p.publishedAt };
    history = [{ ...initial, contentHash: savedVersionHash(initial) }];
  }
  const matches = history.filter(v => v.versionId === id);
  if (!matches.length) throw new PreviewSourceError('Saved public version not found', 404);
  if (matches.length !== 1) throw new PreviewSourceError('Ambiguous saved version', 409);
  const v = matches[0]!;
  if (!Number.isInteger(v.version) || v.version < 1 || v.versionId !== `${p.id}:v${v.version}` || !['bill', 'constitutional-amendment'].includes(v.type)
    || typeof v.title !== 'string' || !v.title.trim() || v.title.length > 500) throw new PreviewSourceError('Invalid saved public version', 409);
  validatePreviewClauses(v.clauses);
  if (savedVersionHash(v) !== v.contentHash) throw new PreviewSourceError('Saved version hash mismatch', 409);
  return { version: v.version, versionId: v.versionId, type: v.type, title: v.title,
    clauses: v.clauses.map(c => ({ clauseId: c.clauseId, text: c.text })), contentHash: v.contentHash, createdAt: v.createdAt };
}
/** Read only from the canonical server citizenProposals collection, never browser drafts.
 * Returns detached source/legal/baseline for A/C to assemble; no network or writes.
 * Unsupported/null mappings remain local and are never a valid outbound payload. */
export function exportPolicyPreviewSource(
  store: { citizenProposals?: VersionedProposal[] }, voter: string,
  selection: PreviewSourceSelection, siteUrl: string, reviews: readonly ReviewedPreviewMapping[] = [],
) {
  const matches = store.citizenProposals?.filter(p => p.id === selection.proposalId) ?? [];
  if (matches.length !== 1) throw new PreviewSourceError('Public proposal not found', 404);
  const p = matches[0]!;
  if (!p.publishedAt || !Number.isFinite(Date.parse(p.publishedAt))) throw new PreviewSourceError('Public publication required', 403);
  if (!voter || p.ownerHash !== digest(`citizen-voter:${voter}`)) throw new PreviewSourceError('Only the publishing browser may transfer public legal text', 403);
  if (selection.confirmedPublicTransfer !== true) throw new PreviewSourceError('Confirm public transfer after reviewing exact text', 403);
  const next = readVersion(p, selection.versionId), base = readVersion(p, selection.baseVersionId);
  if (next.contentHash !== selection.expectedHash || base.contentHash !== selection.expectedBaseHash) throw new PreviewSourceError('Stale selected version hash', 409);
  if (base.version >= next.version) throw new PreviewSourceError('Select an existing prior proposal version');
  const clauses = exactClauseDiff(base.clauses, next.clauses);
  if (clauses.length > 32) throw new PreviewSourceError('Diff exceeds HBL 32-clause limit');
  const text = [next.title, ...clauses.flatMap(c => [c.beforeText, c.afterText])].join('\n');
  if (contactReasons(text).length || /\b-?\d{1,3}\.\d{4,}\s*,\s*-?\d{1,3}\.\d{4,}\b/.test(text)) throw new PreviewSourceError('Personal details or precise coordinates require removal and review', 403);
  const policies = new Set<string>();
  for (const clause of clauses) {
    const mappings = reviews.filter(r => r.repository === 'adnanwahab/dear_congress' && r.proposalId === p.id
      && r.baseVersionId === base.versionId && r.versionId === next.versionId && r.baseHash === base.contentHash && r.versionHash === next.contentHash && r.clauseId === clause.clauseId);
    if (mappings.length > 1) throw new PreviewSourceError('Conflicting mapping reviews', 409);
    const mapping = mappings[0];
    // Rights and institutional amendments have no reviewed City mechanism here.
    if (mapping && base.type === 'bill' && next.type === 'bill') {
      if (!['h_lots', 'f_drainage', 't_brt'].includes(mapping.sourcePolicyId) || !mapping.reviewUrl || sanitizePreviewSourceUrl(mapping.reviewUrl) !== mapping.reviewUrl) throw new PreviewSourceError('Invalid mapping review');
      if (policies.has(mapping.sourcePolicyId)) throw new PreviewSourceError('Duplicate reviewed mechanism', 409);
      policies.add(mapping.sourcePolicyId); clause.sourcePolicyId = mapping.sourcePolicyId;
    }
  }
  const legal = { baseVersionId: base.versionId, clauses };
  const origin = new URL(sanitizePreviewSourceUrl(siteUrl));
  if (origin.pathname !== '/') throw new PreviewSourceError('Canonical site origin required');
  const source = { system: 'civic-synthesis' as const, proposalId: p.id, versionId: next.versionId,
    contentHash: legalHash(legal), type: next.type, title: next.title,
    url: `${origin.origin}/proposals/${encodeURIComponent(p.id)}/versions/${next.version}`, visibility: 'public' as const };
  return { source, legal,
    baseline: { kind: 'prior-proposal-version' as const, versionId: base.versionId, label: `Proposed version ${base.version} (not enacted law)` },
    metadata: { repository: 'adnanwahab/dear_congress', jurisdiction: p.jurisdiction, status: 'published proposal; not enacted law',
      baseHash: base.contentHash, versionHash: next.contentHash },
    status: clauses.length === 0 ? 'no-change' as const : clauses.some(c => c.sourcePolicyId === null) ? 'not-modeled' as const : 'ready' as const };
}
