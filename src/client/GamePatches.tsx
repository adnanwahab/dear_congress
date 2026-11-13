import { useEffect, useRef, useState } from 'react';
import type { Choice, Feedback, PublicPull, PullDetail, PullList } from '../shared/hbl-governance';
import './game-patches.css';
import VoteBatch from './VoteBatch';

const BASE = '/vote/happybearlandia';
const FILTERS = [['all', 'All patches'], ['open-for-voting', 'Open for voting'], ['approved', 'Approved'], ['waiting-for-checks', 'Waiting for checks'], ['blocked', 'Blocked'], ['draft', 'Draft']] as const;
const stateName = (state: string) => FILTERS.find(([key]) => key === state)?.[1] ?? state;
function date(value: string | number | null | undefined) {
  if (value == null) return 'Not available';
  const time = new Date(value);
  return Number.isNaN(time.getTime()) ? 'Not available' : `${time.toLocaleString('en-US', { timeZone: 'America/Chicago', dateStyle: 'medium', timeStyle: 'short' })} CT`;
}
function trustedUrl(value: string | null | undefined, kind: 'github' | 'task' = 'github') {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || url.port) return null;
    if (kind === 'task' && url.hostname === 'linear.app') return url.href;
    if (url.hostname === 'github.com' && url.pathname.startsWith('/adnanwahab/happybearlandia/')) return url.href;
  } catch { /* Untrusted source URLs are never made interactive. */ }
  return null;
}
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try { response = await fetch(path, { ...init, credentials: 'same-origin' }); }
  catch { throw new Error('The patch service is unavailable. Your draft is still here; try again.'); }
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const explanation = response.status === 403 ? 'Access denied. Sign in with an approved GitHub membership and refresh.'
      : response.status === 429 ? 'Too many requests. Wait a moment before trying again.'
      : response.status === 409 ? 'This patch has changed. Refresh and review its current version before submitting again.'
      : response.status === 404 ? 'This patch was not found. Return to the patch list.'
      : 'The patch service is unavailable. Try refreshing in a moment.';
    const serverMessage = typeof payload?.error === 'string' ? payload.error : typeof payload?.error?.message === 'string' ? payload.error.message : '';
    throw new Error(`${explanation}${serverMessage ? ` ${serverMessage}` : ''}`);
  }
  return payload as T;
}
function Tally({ pull }: { pull: PublicPull }) {
  return <div className="gp-tally" aria-label="Verified roster ballot totals"><span>Verified roster · </span><span><b>{pull.tally.yes}</b> Yes</span><span><b>{pull.tally.no}</b> No</span><span>{pull.tally.participation} participating</span><span>{pull.tally.feedback} feedback</span></div>;
}
function CommunityBallot({ pull, stale, onSaved }: { pull: PublicPull; stale: boolean; onSaved: (value: NonNullable<PublicPull['community']>) => void }) {
  const [busy, setBusy] = useState(false), [message, setMessage] = useState('');
  async function vote(choice: Choice) {
    if (busy) return;
    setBusy(true); setMessage('');
    try {
      const result = await request<{community: NonNullable<PublicPull['community']>}>(`/api/hbl/pulls/${pull.number}/community-ballot`, {method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify({version:pull.version,choice})});
      onSaved(result.community); setMessage(`Your ${choice.toUpperCase()} vote is saved. You can change it anytime.`);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not save your vote. Try again.'); }
    finally { setBusy(false); }
  }
  return <div className="gp-community"><p><b>Community vote</b> · {pull.community?.yes ?? 0} Yes · {pull.community?.no ?? 0} No</p><div className="gp-community-actions" role="group" aria-label={`Vote on patch #${pull.number}`}><button aria-pressed={pull.community?.choice === 'yes'} disabled={busy || pull.state !== 'open'} onClick={() => void vote('yes')}>Yes</button><button aria-pressed={pull.community?.choice === 'no'} disabled={busy || pull.state !== 'open'} onClick={() => void vote('no')}>No</button>{busy && <span>Saving…</span>}{pull.community?.choice && <span>Your vote: {pull.community.choice.toUpperCase()}</span>}</div><p role="status">{message}</p>{stale && <p className="gp-meta">Voting on the displayed cached revision. GitHub updates are temporarily unavailable.</p>}</div>;
}
function PatchPreview({pull}:{pull:PublicPull}) {
 const preview=pull.preview;
 if(!preview||preview.headSha!==pull.headSha)return <div className="gp-preview gp-preview-empty"><p>Screenshot for this revision is being prepared.</p><button disabled>Explore this version · preview pending</button></div>;
 return <figure className="gp-preview"><a href={preview.screenshotUrl} target="_blank" rel="noopener noreferrer" aria-label={`Open screenshot of patch #${pull.number}`}><img src={preview.screenshotUrl} alt={`Rendered app from PR #${pull.number}: ${pull.title}`} loading="lazy" width="1440" height="1000" /></a><figcaption>Rendered commit <code>{preview.headSha.slice(0,8)}</code> · {date(preview.capturedAt)}{preview.note&&<p>{preview.note}</p>}</figcaption>{preview.exploreUrl?<a className="gp-explore" href={preview.exploreUrl} target="_blank" rel="noopener noreferrer">Explore this version on Fly ↗</a>:<><button disabled>Explore this version · deployment pending</button><p className="gp-meta">A matching Fly preview has not yet been verified.</p></>}</figure>;
}
function Facts({ pull }: { pull: PublicPull }) {
  return <><div className="gp-meta"><span>#{pull.number} · {pull.author}</span><span>Updated {date(pull.updatedAt)}</span><span>{pull.draft ? 'Draft' : 'Ready for review'} · {pull.state}</span></div><div className="gp-meta"><span>Base <code>{pull.base}</code></span><span>Head <code>{pull.headSha}</code></span></div><p className="gp-reason"><span className={`gp-badge gp-${pull.eligibility.state}`}>{stateName(pull.eligibility.state)}</span> {pull.eligibility.reason}</p></>;
}
function FeedbackItem({ entry }: { entry: Feedback }) {
  const comment = trustedUrl(entry.commentUrl), task = trustedUrl(entry.taskUrl, 'task');
  return <article className="gp-feedback-item"><div className="gp-meta"><b>{entry.alias}</b><span>{date(entry.createdAt)}</span><span>{entry.choice ? `Ballot when submitted: ${entry.choice}` : 'No ballot attached'}</span></div><p className="gp-raw">{entry.text}</p><div className="gp-meta"><span>GitHub comment: {entry.commentStatus}</span><span>Task intake: {entry.intakeStatus}</span></div><div className="gp-links">{comment && <a href={comment} target="_blank" rel="noopener noreferrer">Official GitHub comment ↗</a>}{task && <a href={task} target="_blank" rel="noopener noreferrer">Official follow-up task ↗</a>}</div>{entry.error && <p className="gp-notice">Delivery update: {entry.error}. Saved feedback remains recorded; refresh to check progress.</p>}</article>;
}
export default function GamePatches() {
  const [path, setPath] = useState(window.location.pathname);
  const [list, setList] = useState<PullList | null>(null);
  const [detail, setDetail] = useState<PullDetail | null>(null);
  const [loading, setLoading] = useState(true), [error, setError] = useState('');
  const [filter, setFilter] = useState('all'), [search, setSearch] = useState('');
  const [choice, setChoice] = useState<Choice | null>(null), [text, setText] = useState(''), [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false), [message, setMessage] = useState('');
  const feedbackKey = useRef<string | null>(null), sequence = useRef(0);
  const number = /^\/vote\/happybearlandia\/pr\/(\d+)\/?$/.exec(path)?.[1];
  useEffect(() => { const update = () => setPath(window.location.pathname); window.addEventListener('popstate', update); return () => window.removeEventListener('popstate', update); }, []);
  async function refresh() {
    const current = ++sequence.current;
    setLoading(true); setError('');
    try {
      const [nextList, nextDetail] = await Promise.all([request<PullList>('/api/hbl/pulls'), number ? request<PullDetail>(`/api/hbl/pulls/${number}`) : Promise.resolve(null)]);
      if (current !== sequence.current) return;
      setList(nextList); setDetail(nextDetail);
      setChoice(previous => detail && nextDetail && detail.pull.number === nextDetail.pull.number && detail.pull.version === nextDetail.pull.version ? previous : nextDetail?.choice ?? null);
    } catch (err) { if (current === sequence.current) setError(err instanceof Error ? err.message : 'Could not load patches.'); }
    finally { if (current === sequence.current) setLoading(false); }
  }
  useEffect(() => { setDetail(null); setText(''); setConsent(false); setMessage(''); feedbackKey.current = null; void refresh(); return () => { sequence.current++; }; }, [number]);
  const viewer = detail?.viewer ?? list?.viewer;
  const pull = detail?.pull;
  const disabledReason = !viewer?.authenticated ? 'Sign in with GitHub to participate.' : !viewer.approved ? 'Your GitHub account is not on the approved voter roster.' : list?.stale || error ? 'Refresh current source data before participating.' : pull?.state !== 'open' ? 'This pull request is closed. Its ballots and feedback remain available to read.' : '';
  async function submit(kind: 'ballot' | 'feedback') {
    if (!pull || !viewer?.csrf || disabledReason || busy) return;
    setBusy(true); setMessage('');
    try {
      if (kind === 'feedback' && !feedbackKey.current) feedbackKey.current = crypto.randomUUID();
      await request(`/api/hbl/pulls/${pull.number}/${kind}`, { method: kind === 'ballot' ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': viewer.csrf }, body: JSON.stringify(kind === 'ballot' ? { version: pull.version, choice } : { version: pull.version, text, consent: true, idempotencyKey: feedbackKey.current }) });
      if (kind === 'feedback') { setText(''); setConsent(false); feedbackKey.current = null; }
      setMessage(kind === 'ballot' ? 'Ballot saved for this version. You can revise it below.' : 'Feedback saved. Delivery to GitHub and task intake may still be pending.');
      await refresh();
    } catch (err) { setMessage(err instanceof Error ? err.message : 'Submission failed. Your draft is still here.'); }
    finally { setBusy(false); }
  }
  function savedCommunity(number: number, value: NonNullable<PublicPull['community']>) {
    setList(current => current ? {...current,pulls:current.pulls.map(p => p.number === number ? {...p,community:value} : p)} : current);
    setDetail(current => current?.pull.number === number ? {...current,pull:{...current.pull,community:value}} : current);
  }
  const rows = (list?.pulls ?? []).filter(p => (filter === 'all' || p.eligibility.state === filter) && `${p.number} ${p.title} ${p.author} ${p.base} ${p.labels.join(' ')}`.toLowerCase().includes(search.toLowerCase()));
  const github = pull ? trustedUrl(pull.url) : null;
  return <main className="game-patches">
    <header className="gp-header"><div><p className="gp-eyebrow">Game governance · adnanwahab/happybearlandia</p><h1>Game patches</h1><p>Review changes to HappyBearLandia and vote Yes or No on each patch.</p></div><a href="/votes">Civic votes ↗</a></header>
    <div className="gp-notice">No sign-in needed to vote. Your choice is saved per browser and patch version. Community votes are advisory and separate from verified ballots used for merge decisions.</div>
    <VoteBatch schedule={list?.voteSummary} />
    <section className="gp-source" aria-label="Source and governance policy"><div><b>{list?.stale ? 'Stale cached source' : list ? `Source: ${list.sourceStatus}` : 'Connecting to GitHub source'}</b><p>Last sync: {date(list?.lastSync)} · Next merge batch: {date(list?.nextBatch)}</p>{list?.warning && <p>{list.warning}</p>}</div><button onClick={() => void refresh()} disabled={loading || busy}>{loading ? 'Refreshing…' : 'Refresh source'}</button>{list && <div className="gp-policy"><span>Approved roster {list.roster.approved}/{list.roster.capacity}</span><span>Quorum {list.policy.quorum}</span><span>Minimum exposure {list.policy.minExposureHours} hours</span><span>{list.policy.requiredApprovals} code review approval(s)</span><span>Bases: {list.policy.allowedBases.join(', ')}</span><span>Batch timezone: {list.policy.timezone}</span><span>{list.policy.dryRun ? 'Dry run: no automatic merge' : 'Scheduled policy processing'}</span><span>{list.policy.enabled ? 'Governance enabled' : 'Governance paused'}</span><span>Required checks: {list.policy.requiredChecks.join(', ') || 'None configured'}</span></div>}</section>
    {error && <div role="alert" className="gp-error">{error}{list && <p>Previously loaded data is shown. Verified participation is paused until refresh succeeds; community votes remain available for displayed revisions.</p>}</div>}
    {!list && loading && <p role="status">Loading game patches…</p>}
    {viewer && <p className="gp-identity">{viewer.authenticated ? <>Signed in as <b>{viewer.alias ?? 'GitHub member'}</b> · {viewer.approved ? 'Approved voter' : 'Membership approval required'}</> : <span>Community voting is open to everyone. GitHub sign-in is only needed to publish feedback.</span>}</p>}
    {number ? <>
      <a href={BASE}>← All game patches</a>
      {loading && !detail && <p role="status">Loading patch #{number}…</p>}
      {pull && detail && <><section className="gp-panel"><h2>#{pull.number} {pull.title}</h2><Facts pull={pull} /><PatchPreview pull={pull} /><Tally pull={pull} />{github && <p><a href={github} target="_blank" rel="noopener noreferrer">Official GitHub pull request ↗</a></p>}<p className="gp-meta">First observed {date(pull.firstSeenAt)} · Earliest eligible batch {date(pull.earliestBatch)}</p><h3>Description</h3><div className="gp-raw gp-description">{pull.body || 'No description provided.'}</div><p className="gp-meta">Contributor text is displayed as plain text. Embedded instructions and preview links are not executed.</p></section>
      <div className="gp-detail-grid"><section className="gp-panel"><h2>Your vote</h2><CommunityBallot key={pull.version} pull={pull} stale={!!list?.stale || !!error} onSaved={v => savedCommunity(pull.number,v)} /><p>No GitHub account required. A new patch version starts a fresh community vote.</p><p className="gp-meta">Verified roster ballots: {pull.tally.yes} Yes · {pull.tally.no} No. These remain separate from community votes.</p></section>
      <section className="gp-panel"><h2>Public feedback</h2><p>Feedback is optional and submitted separately from your ballot. Your public alias and feedback may be posted to GitHub and used for follow-up tasks. Email addresses are not shown.</p><label htmlFor="gp-feedback">What should change or be considered?</label><textarea id="gp-feedback" rows={6} maxLength={10000} value={text} onChange={e => { setText(e.target.value); feedbackKey.current = null; }} disabled={busy} /><label className="gp-consent"><input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} disabled={busy} /> I consent to publishing this feedback under my public alias and using it for follow-up tasks.</label><button disabled={!!disabledReason || busy || loading || !text.trim() || !consent || !viewer?.csrf} onClick={() => void submit('feedback')}>Submit public feedback</button><p className="gp-meta">Submission is stored before delivery. Pending or failed delivery does not erase saved feedback.</p></section></div>
      {message && <p className="gp-notice" role="status">{message}</p>}
      <section className="gp-panel"><h2>Code checks and review evidence</h2>{pull.evidence ? <><p>Mergeability: {pull.evidence.mergeable === null ? 'unknown' : pull.evidence.mergeable ? 'mergeable' : 'not mergeable'} · {pull.evidence.mergeableState}</p><p>Base protections {pull.evidence.protectionsKnown ? 'known' : 'unknown'} · Base {pull.evidence.protectedBase ? 'protected' : 'not protected'} · Sensitive changes {pull.evidence.sensitive ? 'yes' : 'no'} · Maintainer approval {pull.evidence.maintainerApproved ? 'present' : 'missing'}</p><p>Base SHA <code>{pull.evidence.baseSha}</code> · Requested reviewers {pull.evidence.requestedReviewers}</p><h3>CI checks</h3>{pull.evidence.checks.length ? <ul>{pull.evidence.checks.map((c, i) => <li key={i}>{c.name}: {c.status} / {c.conclusion ?? 'pending'} · <code>{c.sha}</code></li>)}</ul> : <p>No checks reported.</p>}<h3>Code reviews</h3>{pull.evidence.reviews.length ? <ul>{pull.evidence.reviews.map((r, i) => <li key={i}>Reviewer {r.userId}: {r.state} · Commit <code>{r.commitId ?? 'unknown'}</code></li>)}</ul> : <p>No code reviews reported.</p>}</> : <p>Review evidence unavailable. Refresh to check the source.</p>}</section>
      <section className="gp-panel"><h2>Changed files</h2>{pull.files?.length ? pull.files.map(f => <details key={f.filename}><summary>{f.filename} · {f.status} · +{f.additions} −{f.deletions}</summary><pre className="gp-diff">{f.patch || 'Diff unavailable or truncated. Review the official GitHub pull request for the complete change.'}</pre></details>) : <p>File diffs unavailable. Review the official GitHub pull request.</p>}</section><section className="gp-panel"><h2>Feedback and follow-up</h2>{detail.feedback.length ? detail.feedback.map(entry => <FeedbackItem key={entry.id} entry={entry} />) : <p>No public feedback yet.</p>}</section></>}
    </> : <section aria-label="Patch list"><div className="gp-filters"><label htmlFor="gp-search">Search patches<input id="gp-search" type="search" placeholder="Title, number, author or label" value={search} onChange={e => setSearch(e.target.value)} /></label><div className="gp-filter-buttons" aria-label="Filter by patch status">{FILTERS.map(([key, label]) => <button key={key} aria-pressed={filter === key} onClick={() => setFilter(key)}>{label}</button>)}</div></div>{list && !rows.length && <div className="gp-panel"><h2>{list.pulls.length ? 'No matching patches' : 'No game patches yet'}</h2><p>{list.pulls.length ? 'Try another search or status filter.' : 'Open pull requests will appear here after source synchronization.'}</p></div>}<div className="gp-list">{rows.map(p => <article className="gp-panel" key={p.number}><h2><a href={`${BASE}/pr/${p.number}`}>#{p.number} {p.title}</a></h2><Facts pull={p} /><PatchPreview pull={p} /><CommunityBallot key={p.version} pull={p} stale={!!list?.stale || !!error} onSaved={v => savedCommunity(p.number,v)} /><p className="gp-meta">Earliest eligible batch: {date(p.earliestBatch)}</p></article>)}</div></section>}
  </main>;
}
