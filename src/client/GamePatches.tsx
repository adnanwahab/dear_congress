import { createContext, useContext, useEffect, useRef, useState } from 'react';
import type { Choice, Feedback, PublicPull, PullDetail, PullList } from '../shared/hbl-governance';
import './game-patches.css';
import VoteBatch from './VoteBatch';

import { REPOSITORIES, votingRoute } from '../shared/repository-voting';
const VotingContext=createContext({api:'/api/hbl/pulls',verified:false,csrf:'',approved:false});
export default function GamePatches(){
 const [location,setLocation]=useState(()=>({pathname:window.location.pathname,search:window.location.search}));
 useEffect(()=>{const update=()=>setLocation({pathname:window.location.pathname,search:window.location.search});window.addEventListener('popstate',update);return()=>window.removeEventListener('popstate',update);},[]);
 const route=votingRoute(location);
 if(!route)return <main className="game-patches"><h1>Repository not supported</h1><a href="/vote/happybearlandia">Return to voting</a></main>;
 function navigate(path:string){window.history.pushState(null,'',path);window.dispatchEvent(new PopStateEvent('popstate'));}
 return <main className="game-patches"><section className="gp-panel gp-repository-controls" aria-label="Repository and item selection"><label>Application <select value={route.repoKey} onChange={e=>navigate(`/vote/${e.target.value}?view=${route.kind==='issue'?'issues':'prs'}`)}>{Object.entries(REPOSITORIES).map(([key,repo])=><option key={key} value={key}>{repo.name}</option>)}</select></label><div role="group" aria-label="Item type">{(['pr','issue'] as const).map(kind=><button key={kind} aria-pressed={route.kind===kind} onClick={()=>navigate(`${route.base}?view=${kind==='issue'?'issues':'prs'}`)}>{kind==='pr'?'Pull requests':'Issues'}</button>)}</div></section><RepositoryItems key={`${route.repoKey}:${route.kind}:${route.number??''}`} route={route}/></main>;
}
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
    if (url.hostname === 'github.com' && Object.values(REPOSITORIES).some(repo=>url.pathname.startsWith('/'+repo.repository+'/'))) return url.href;
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
  const scope=useContext(VotingContext);
  const [busy, setBusy] = useState(false), [message, setMessage] = useState('');
  const [verifiedChoice,setVerifiedChoice]=useState<Choice|null>(pull.verifiedChoice??null);
  useEffect(()=>setVerifiedChoice(pull.verifiedChoice??null),[pull.verifiedChoice]);
  const totals=scope.verified?pull.tally:pull.community;
  const selected=scope.verified?verifiedChoice:pull.community?.choice;
  async function vote(choice: Choice) {
    if (busy) return;
    setBusy(true); setMessage('');
    try {
      const result = await request<{community?: NonNullable<PublicPull['community']>;choice?:Choice}>(`${scope.api}/${pull.number}/${scope.verified?'ballot':'community-ballot'}`, {method:'PUT', headers:{'Content-Type':'application/json',...(scope.csrf?{'X-CSRF-Token':scope.csrf}:{})}, body:JSON.stringify({version:pull.version,choice})});
      if(result.community)onSaved(result.community);else {setVerifiedChoice(result.choice??choice);window.dispatchEvent(new Event('repository-vote-saved'));} setMessage(`Your ${choice.toUpperCase()} vote is saved. You can change it anytime.`);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not save your vote. Try again.'); }
    finally { setBusy(false); }
  }
  return <div className="gp-community"><p><b>{scope.verified?'Verified priority / revision ballot':'Community vote'}</b> · {totals?.yes ?? 0} Yes · {totals?.no ?? 0} No</p><div className="gp-community-actions" role="group" aria-label={`Vote on patch #${pull.number}`}><button aria-pressed={selected === 'yes'} disabled={busy || (scope.verified&&!scope.approved) || pull.state !== 'open'} onClick={() => void vote('yes')}>Yes</button><button aria-pressed={selected === 'no'} disabled={busy || (scope.verified&&!scope.approved) || pull.state !== 'open'} onClick={() => void vote('no')}>No</button>{busy && <span>Saving…</span>}{selected && <span>Your vote: {selected.toUpperCase()}</span>}</div><p role="status">{message}</p>{scope.verified&&!scope.approved&&<p>Sign in with an approved roster account to vote.</p>}{stale && <p className="gp-meta">Voting on the displayed cached revision. GitHub updates are temporarily unavailable.</p>}</div>;
}
function PatchPreview({pull}:{pull:PublicPull}) {
 const preview=pull.preview;
 if(!preview||preview.headSha!==pull.headSha)return <div className="gp-preview gp-preview-empty"><p>Screenshot for this revision is being prepared.</p><button disabled>Explore this version · preview pending</button></div>;
 return <figure className="gp-preview"><a href={preview.screenshotUrl} target="_blank" rel="noopener noreferrer" aria-label={`Open screenshot of patch #${pull.number}`}><img src={preview.screenshotUrl} alt={`Rendered app from PR #${pull.number}: ${pull.title}`} loading="lazy" width="1440" height="1000" /></a><figcaption>Rendered commit <code>{preview.headSha.slice(0,8)}</code> · {date(preview.capturedAt)}{preview.note&&<p>{preview.note}</p>}</figcaption>{preview.exploreUrl?<a className="gp-explore" href={preview.exploreUrl} target="_blank" rel="noopener noreferrer">Explore this version on Fly ↗</a>:<><button disabled>Explore this version · deployment pending</button><p className="gp-meta">A matching Fly preview has not yet been verified.</p></>}</figure>;
}
export function Facts({ pull }: { pull: PublicPull }) {
  if(pull.kind==='issue')return <><p>Implementation priority · {pull.labels.join(' · ')||'No labels'}</p><p className="gp-meta">Symphony: {pull.workflow?.state??'not configured'} · {pull.workflow?.reason??'No companion evidence is configured.'}</p><div className="gp-links">{pull.links?.map(link=>{const safe=trustedUrl(link,'task');return safe?<a key={link} href={safe} target="_blank" rel="noopener noreferrer">{link}</a>:null;})}</div></>;
  return <><div className="gp-meta"><span>#{pull.number} · {pull.author}</span><span>Updated {date(pull.updatedAt)}</span><span>{pull.eligibility.state === 'blocked' ? 'Blocked' : pull.draft ? 'Draft' : 'Open PR'} · {pull.state}</span></div><div className="gp-meta"><span>Base <code>{pull.base}</code></span><span>Head <code>{pull.headSha}</code></span><span>Labels: {pull.labels.join(', ')||'None'}</span><span>Checks: {pull.evidence?pull.evidence.checks.map(c=>`${c.name}: ${c.conclusion??c.status}`).join(', ')||'None reported':'Not fetched; open details'}</span></div><p className="gp-reason"><span className={`gp-badge gp-${pull.eligibility.state}`}>{stateName(pull.eligibility.state)}</span> {pull.eligibility.reason}</p><div className="gp-links">{pull.links?.map(link=>{const safe=trustedUrl(link,'task');return safe?<a key={link} href={safe} target="_blank" rel="noopener noreferrer">Linked source: {link}</a>:null;})}</div></>;
}
function FeedbackItem({ entry }: { entry: Feedback }) {
  const comment = trustedUrl(entry.commentUrl), task = trustedUrl(entry.taskUrl, 'task');
  return <article className="gp-feedback-item"><div className="gp-meta"><b>{entry.alias}</b><span>{date(entry.createdAt)}</span><span>{entry.choice ? `Ballot when submitted: ${entry.choice}` : 'No ballot attached'}</span></div><p className="gp-raw">{entry.text}</p><div className="gp-meta"><span>GitHub comment: {entry.commentStatus}</span><span>Task intake: {entry.intakeStatus}</span></div><div className="gp-links">{comment && <a href={comment} target="_blank" rel="noopener noreferrer">Official GitHub comment ↗</a>}{task && <a href={task} target="_blank" rel="noopener noreferrer">Official follow-up task ↗</a>}</div>{entry.error && <p className="gp-notice">Delivery update: {entry.error}. Saved feedback remains recorded; refresh to check progress.</p>}</article>;
}
function RepositoryItems({route}:{route:NonNullable<ReturnType<typeof votingRoute>>}) {
  const BASE=route.base, api=route.api, number=route.number, isIssue=route.kind==='issue';
    const [list, setList] = useState<PullList | null>(null);
  const [detail, setDetail] = useState<PullDetail | null>(null);
  const [loading, setLoading] = useState(true), [error, setError] = useState('');
  const [filter, setFilter] = useState('all'), [search, setSearch] = useState('');
  const [choice, setChoice] = useState<Choice | null>(null), [text, setText] = useState(''), [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false), [message, setMessage] = useState('');
  const feedbackKey = useRef<string | null>(null), sequence = useRef(0);

  async function refresh() {
    const current = ++sequence.current;
    setLoading(true); setError('');
    try {
      const [nextList, nextDetail] = await Promise.all([request<PullList>(api), number ? request<PullDetail>(`${api}/${number}`) : Promise.resolve(null)]);
      if (current !== sequence.current) return;
      setList(nextList); setDetail(nextDetail);
      setChoice(previous => detail && nextDetail && detail.pull.number === nextDetail.pull.number && detail.pull.version === nextDetail.pull.version ? previous : nextDetail?.choice ?? null);
    } catch (err) { if (current === sequence.current) setError(err instanceof Error ? err.message : 'Could not load patches.'); }
    finally { if (current === sequence.current) setLoading(false); }
  }
  useEffect(() => { setList(null);setDetail(null); setText(''); setConsent(false); setMessage(''); feedbackKey.current = null; void refresh(); return () => { sequence.current++; }; }, [number]);
  useEffect(()=>{const update=()=>{void refresh();};window.addEventListener('repository-vote-saved',update);return()=>window.removeEventListener('repository-vote-saved',update);},[]);
  const viewer = detail?.viewer ?? list?.viewer;
  const pull = detail?.pull;
  const disabledReason = !viewer?.authenticated ? 'Sign in with GitHub to participate.' : !viewer.approved ? 'Your GitHub account is not on the approved voter roster.' : list?.stale || error ? 'Refresh current source data before participating.' : pull?.state !== 'open' ? 'This pull request is closed. Its ballots and feedback remain available to read.' : '';
  async function submit(kind: 'ballot' | 'feedback') {
    if (!pull || !viewer?.csrf || disabledReason || busy) return;
    setBusy(true); setMessage('');
    try {
      if (kind === 'feedback' && !feedbackKey.current) feedbackKey.current = crypto.randomUUID();
      await request(`${api}/${pull.number}/${kind}`, { method: kind === 'ballot' ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': viewer.csrf }, body: JSON.stringify(kind === 'ballot' ? { version: pull.version, choice } : { version: pull.version, text, consent: true, idempotencyKey: feedbackKey.current }) });
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
  const pageSize=20;const [page,setPage]=useState(0);
  const rows = (list?.pulls ?? []).filter(p => (filter === 'all' || p.eligibility.state === filter) && `${p.number} ${p.title} ${p.author} ${p.base} ${p.labels.join(' ')}`.toLowerCase().includes(search.toLowerCase()));
  const github = pull ? trustedUrl(pull.url) : null;
  return <VotingContext.Provider value={{api,verified:route.repoKey!=='happybearlandia'||isIssue,csrf:viewer?.csrf??'',approved:!!viewer?.approved}}><main className="game-patches">
    <header className="gp-header"><div><p className="gp-eyebrow">Developer preview / not a binding vote · {REPOSITORIES[route.repoKey].repository}</p><h1>{REPOSITORIES[route.repoKey].name} · {isIssue?'Issues':'Pull requests'}</h1><p>{isIssue?'Vote on what should be implemented next. Issue votes never authorize a merge or implementation.':'Community policy proposals express civic priorities. This developer PR preview is a separate advisory pilot. Public responses do not approve or merge code. A verified maintainer must explicitly decide whether to merge.'}</p></div><a href="/vote">Civic votes ↗</a></header>
    <div className="gp-notice">{isIssue?'Priority ballots are advisory; no merge is possible for an issue. ':''}The 100-account approved roster is shared across applications. Legacy HBL community votes remain browser-scoped. All ballots in this launch pilot are non-binding. Browser community votes remain separate from verified ballots; neither authorizes an automatic merge today.</div>
    {route.repoKey==='happybearlandia'&&!isIssue&&<VoteBatch schedule={list?.voteSummary} />}
    <section className="gp-source" aria-label="Source and governance policy"><div><b>{list?.stale ? 'Stale cached source' : list ? `Source: ${list.sourceStatus}` : 'Connecting to GitHub source'}</b><p>Last sync: {date(list?.lastSync)} · Not scheduled — advisory pilot</p>{list?.warning && <p>{list.warning}</p>}</div><button onClick={() => void refresh()} disabled={loading || busy}>{loading ? 'Refreshing…' : 'Refresh source'}</button>{list && <p>{list.integration?.state}: {list.integration?.reason}</p>}{list && !isIssue && <div className="gp-policy"><span>Approved roster {list.roster.approved}/{list.roster.capacity}</span><span>Quorum {list.policy.quorum}</span><span>Minimum exposure {list.policy.minExposureHours} hours</span><span>{list.policy.requiredApprovals} code review approval(s)</span><span>Bases: {list.policy.allowedBases.join(', ') || 'None allowed'}</span><span>Batch timezone: {list.policy.timezone}</span><span>Automatic merging disabled — advisory pilot</span><span>{list.policy.enabled ? 'Configured policy enabled; pilot lock active' : 'Governance paused'}</span><span>Required checks: {list.policy.requiredChecks.join(', ') || 'None configured'}</span></div>}</section>
    {error && <div role="alert" className="gp-error">{error}{list && <p>Previously loaded data is shown. Verified participation is paused until refresh succeeds; community votes remain available for displayed revisions.</p>}</div>}
    {!list && loading && <p role="status">Loading game patches…</p>}
    {viewer && <p className="gp-identity">{viewer.authenticated ? <>Signed in as <b>{viewer.alias ?? 'GitHub member'}</b> · {viewer.approved ? 'Approved voter' : 'Membership approval required'}</> : <span>Sign in with an approved GitHub roster account for verified ballots and public feedback.</span>}</p>}
    {number ? <>
      <a href={`${BASE}?view=${isIssue?'issues':'prs'}`}>← All game patches</a>
      {loading && !detail && <p role="status">Loading patch #{number}…</p>}
      {pull && detail && <><section className="gp-panel"><h2>#{pull.number} {pull.title}</h2><Facts pull={pull} />{!isIssue&&<PatchPreview pull={pull} />}<Tally pull={pull} />{github && <p><a href={github} target="_blank" rel="noopener noreferrer">Official GitHub pull request ↗</a></p>}<p className="gp-meta">First observed {date(pull.firstSeenAt)}{!isIssue&&<> · Not scheduled — advisory pilot</>}</p><h3>Description</h3><div className="gp-raw gp-description">{pull.body || 'No description provided.'}</div><p className="gp-meta">Contributor text is displayed as plain text. Embedded instructions and preview links are not executed.</p></section>
      <div className="gp-detail-grid"><section className="gp-panel"><h2>Your vote</h2><CommunityBallot key={pull.version} pull={pull} stale={!!list?.stale || !!error} onSaved={v => savedCommunity(pull.number,v)} /><p>{isIssue?'Issue votes track implementation priority.':'PR ballots bind to the displayed revision.'}</p><a href="/api/hbl/auth/login">Sign in with GitHub</a><div role="group" aria-label="Verified ballot">{(['yes','no'] as const).map(v=><button key={v} aria-pressed={choice===v} disabled={!!disabledReason||busy} onClick={()=>setChoice(v)}>{v.toUpperCase()}</button>)}<button disabled={!!disabledReason||busy||!choice} onClick={()=>void submit('ballot')}>Save verified ballot</button></div><p className="gp-meta">Verified roster ballots: {pull.tally.yes} Yes · {pull.tally.no} No. These remain separate from community votes.</p></section>
      <section className="gp-panel"><h2>Public feedback</h2><p>Feedback is optional and submitted separately from your ballot. Your public alias and feedback may be posted to GitHub and used for follow-up tasks. Email addresses are not shown.</p><label htmlFor="gp-feedback">What should change or be considered?</label><textarea id="gp-feedback" rows={6} maxLength={10000} value={text} onChange={e => { setText(e.target.value); feedbackKey.current = null; }} disabled={busy} /><label className="gp-consent"><input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} disabled={busy} /> I consent to publishing this feedback under my public alias and using it for follow-up tasks.</label><button disabled={!!disabledReason || busy || loading || !text.trim() || !consent || !viewer?.csrf} onClick={() => void submit('feedback')}>Submit public feedback</button><p className="gp-meta">Submission is stored before delivery. Pending or failed delivery does not erase saved feedback.</p></section></div>
      {message && <p className="gp-notice" role="status">{message}</p>}
      {!isIssue&&<><section className="gp-panel"><h2>Code checks and review evidence</h2>{pull.evidence ? <><p>Mergeability: {pull.evidence.mergeable === null ? 'unknown' : pull.evidence.mergeable ? 'mergeable' : 'not mergeable'} · {pull.evidence.mergeableState}</p><p>Base protections {pull.evidence.protectionsKnown ? 'known' : 'unknown'} · Base {pull.evidence.protectedBase ? 'protected' : 'not protected'} · Sensitive changes {pull.evidence.sensitive ? 'yes' : 'no'} · Maintainer approval {pull.evidence.maintainerApproved ? 'present' : 'missing'}</p><p>Base SHA <code>{pull.evidence.baseSha}</code> · Requested reviewers {pull.evidence.requestedReviewers}</p><h3>CI checks</h3>{pull.evidence.checks.length ? <ul>{pull.evidence.checks.map((c, i) => <li key={i}>{c.name}: {c.status} / {c.conclusion ?? 'pending'} · <code>{c.sha}</code></li>)}</ul> : <p>No checks reported.</p>}<h3>Code reviews</h3>{pull.evidence.reviews.length ? <ul>{pull.evidence.reviews.map((r, i) => <li key={i}>Reviewer {r.userId}: {r.state} · Commit <code>{r.commitId ?? 'unknown'}</code></li>)}</ul> : <p>No code reviews reported.</p>}</> : <p>Review evidence unavailable. Refresh to check the source.</p>}</section>
      <section className="gp-panel"><h2>Changed files</h2>{pull.files?.length ? pull.files.map(f => <details key={f.filename}><summary>{f.filename} · {f.status} · +{f.additions} −{f.deletions}</summary><pre className="gp-diff">{f.patch || 'Diff unavailable or truncated. Review the official GitHub pull request for the complete change.'}</pre></details>) : <p>File diffs unavailable. Review the official GitHub pull request.</p>}</section></>}<section className="gp-panel"><h2>Feedback and follow-up</h2>{detail.feedback.length ? detail.feedback.map(entry => <FeedbackItem key={entry.id} entry={entry} />) : <p>No public feedback yet.</p>}</section></>}
    </> : <section aria-label="Patch list"><p>{rows.length} fetched open {isIssue?'issues':'pull requests'} loaded</p><div className="gp-filters"><label htmlFor="gp-search">Search patches<input id="gp-search" type="search" placeholder="Title, number, author or label" value={search} onChange={e => {setSearch(e.target.value);setPage(0);}} /></label>{!isIssue&&<div className="gp-filter-buttons" aria-label="Filter by patch status">{FILTERS.map(([key, label]) => <button key={key} aria-pressed={filter === key} onClick={() => {setFilter(key);setPage(0);}}>{label}</button>)}</div>}</div>{list && !rows.length && <div className="gp-panel"><h2>{list.pulls.length ? 'No matching patches' : 'No game patches yet'}</h2><p>{list.pulls.length ? 'Try another search or status filter.' : `Open ${isIssue?'issues':'pull requests'} will appear here after source synchronization.`}</p></div>}<div className="gp-list">{rows.slice(page*pageSize,(page+1)*pageSize).map(p => <article className="gp-panel" key={p.number}><h2><a href={`${BASE}/${route.kind}/${p.number}`}>#{p.number} {p.title}</a></h2><Facts pull={p} />{!isIssue&&<PatchPreview pull={p} />}<CommunityBallot key={p.version} pull={p} stale={!!list?.stale || !!error} onSaved={v => savedCommunity(p.number,v)} />{!isIssue&&<p className="gp-meta">Not scheduled — advisory pilot</p>}</article>)}</div><nav aria-label="List pages"><button disabled={page===0} onClick={()=>setPage(p=>p-1)}>Previous</button><span>Page {page+1}</span><button disabled={(page+1)*pageSize>=rows.length} onClick={()=>setPage(p=>p+1)}>Next</button></nav></section>}
  </main></VotingContext.Provider>;
}
