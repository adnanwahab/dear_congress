import type { Policy, PublicPull, Viewer } from '../shared/hbl-governance';

export type GateState = 'reported' | 'pending' | 'blocked' | 'unknown';
export interface TrainStop { name: string; state: GateState; detail: string; }
export interface TrainSource {
  repository: string; sourceStatus: string; lastSync: string | null;
  stale: boolean; loading: boolean; error: string; viewer?: Viewer; policy?: Policy;
}
/** Display receipts only. This model is never a merge authority. */
export function trainStops(pull: PublicPull, policy?: Policy): TrainStop[] {
  const e = pull.evidence;
  const hold = pull.labels.filter(label => /(?:^|[\s:_-])(?:hold|do[\s_-]*not[\s_-]*merge|blocked)(?:$|[\s:_-])/i.test(label));
  const checks = e?.checks ?? [];
  const failed = checks.some(c => c.sha === pull.headSha && c.status === 'completed' && c.conclusion !== null && !['success','neutral','skipped'].includes(c.conclusion));
  const pending = !checks.length || checks.some(c => c.sha !== pull.headSha || c.status !== 'completed' || c.conclusion !== 'success') || !policy?.requiredChecks.length || policy.requiredChecks.some(name => !checks.some(c => c.name === name));
  const approvals = e?.reviews.filter(r => r.state === 'APPROVED' && r.commitId === pull.headSha).length ?? 0;
  const reviewBlocked = e?.reviews.some(r => r.state === 'CHANGES_REQUESTED');
  return [
    {name:'Base branch', state: !e ? 'unknown' : !e.protectionsKnown ? 'unknown' : !e.protectedBase || e.mergeable === false || e.mergeableState === 'blocked' || policy && !policy.allowedBases.includes(pull.base) ? 'blocked' : 'reported', detail:`${pull.base} · ${e?.baseSha || 'base SHA unavailable'} · ${e?.protectionsKnown ? e.protectedBase ? 'protection reported' : 'unprotected' : 'protection unknown'} · mergeability ${e?.mergeableState ?? 'unknown'}${policy ? '' : ' · configured policy unavailable'}`},
    {name:'Checks', state: !e ? 'unknown' : failed ? 'blocked' : pending ? 'pending' : 'reported', detail: !e ? 'Not fetched; open PR details.' : checks.map(c => `${c.name}: ${c.conclusion ?? c.status} (${c.sha === pull.headSha ? 'current head' : 'other revision'})`).join('; ') || 'No checks reported.'},
    {name:'Reviews', state: !e ? 'unknown' : reviewBlocked ? 'blocked' : approvals < Math.max(1,policy?.requiredApprovals ?? 1) || e.requestedReviewers > 0 || e.sensitive && !e.maintainerApproved ? 'pending' : 'reported', detail: !e ? 'Not fetched; open PR details.' : `${approvals} current-head approval(s) · ${e.requestedReviewers} requested reviewer(s)${reviewBlocked ? ' · changes requested' : ''}${e.sensitive && !e.maintainerApproved ? ' · sensitive-change maintainer approval missing' : ''}`},
    {name:'Merge queue', state:'unknown', detail:'Queue receipt unavailable. Queue membership and position are unknown.'},
    {name:'Hold / safety gate', state: hold.length || pull.eligibility.state === 'blocked' || pull.state !== 'open' ? 'blocked' : 'pending', detail: `${hold.length ? `Hold labels: ${hold.join(', ')}. ` : 'No explicit hold label reported. '}${pull.draft ? 'Draft PR. ' : ''}${pull.eligibility.reason} Advisory pilot: automatic merging disabled; human merge decision required.`},
  ];
}
export function MergeTrain({pull, source}: {pull: PublicPull; source: TrainSource}) {
  if (pull.kind === 'issue') return null;
  const stops = trainStops(pull, source.policy);
  const stopped = stops.some(s => s.state === 'blocked');
  const url = (() => { try { const u = new URL(pull.url); return u.origin === 'https://github.com' && !u.username && !u.password && u.pathname === `/${source.repository}/pull/${pull.number}` ? u.href : null; } catch { return null; } })();
  return <section className="gp-train" aria-label={`Merge train for PR #${pull.number}`}>
    <h3><span aria-hidden="true">🚂 ━ </span>Merge train · {stopped ? 'Stopped at a safety gate' : 'Awaiting evidence / human decision'}</h3>
    <p>Read-only diorama. Browsing stops does not vote, approve, queue or merge.</p>
    <p role="status">{source.loading ? 'Loading source… ' : ''}{source.error ? `Source error: ${source.error}. ` : ''}{source.stale ? 'Stale cached evidence. ' : ''}Source: {source.sourceStatus} · Last sync: {source.lastSync ?? 'unavailable'}</p>
    <p className="gp-train-identity">{source.repository} · Repository ID {pull.repositoryId} · PR #{pull.number}<br/>Revision <code>{pull.version}</code><br/>Head <code>{pull.headSha}</code> → Base <code>{pull.base}</code></p>
    <p>Permissions: {source.viewer ? source.viewer.authenticated ? source.viewer.approved ? 'approved roster account; ballots remain advisory' : 'roster approval required to vote' : 'sign-in required for verified participation' : 'viewer permissions unavailable'}. No merge or approval control is provided.</p>
    <ol>{stops.map(stop => <li key={stop.name} data-state={stop.state}><details><summary>{stop.name} · {stop.state}</summary><p>{stop.detail}</p></details></li>)}</ol>
    {url && <a href={url} target="_blank" rel="noopener noreferrer">GitHub PR receipt ↗</a>}
  </section>;
}
