import { ProposalCompare } from './ProposalCompare';
import { TopicChip } from './TopicChip';
import { Skeleton, WorkflowSkeleton } from './LoadingSkeleton';
import { topicForProposal } from '../shared/topics';
import { proposalTitleName, readProposalSnapshot, saveProposalSnapshot } from './proposal-motion';
import { AdvisoryVoteBars } from './AdvisoryVoteBars';
import { SponsorBoard, OutcomeTotal } from './SponsorBoard';
import { PatchChange, transitionProposal } from './PatchChange';
import { CivicHeader } from "./CivicHeader";
import { filterProposals, proposalCardStyle, ProposalSearch } from './ProposalSearch';
import { advisoryMutation, type VoteRequest } from './advisory-mutation';
import { MutationStatus, type MutationState } from './mutation-status';
import { DailyQuestion } from './DailyQuestion';
import { useEffect, useState } from 'react';
import type { DemoItem, DemoPayload } from '../engine/demo';
import './workflow.css';
import AmendmentEditor from './AmendmentEditor';
import { PolicyMeasurements } from './PolicyMeasurements';
import { OfficialBills } from './OfficialBills';
import { JurisdictionPicker, useJurisdiction, sampleMatchesJurisdiction } from './JurisdictionPicker';
import { ArgumentMap } from './ArgumentMap';
import { ParticipationNotice } from './ParticipationNotice';
import { ProposalProvenance, provenanceText } from './ProposalProvenance';
import { OutreachDraft } from './OutreachDraft';

import { STAGES, stageRoute as route, type Stage } from '../shared/civic-stages';
type Request = VoteRequest;
interface Tracked { id: string; title: string; office: string; stage: number; updatedAt: string; }
const SELECTION_KEY = 'civic_demo_selection_v1';
function initialSelection() {
  const explicit = new URLSearchParams(window.location.search).get('proposal');
  if (explicit) return explicit;
  if ((new URLSearchParams(window.location.search).get('demo') === '1')) return null;
  try { return sessionStorage.getItem(SELECTION_KEY); } catch { return null; }
}
const TRACKER_KEY = 'civic_demo_tracker_v1';
const LANES = ['Drafted', 'Ready to send', 'Replied', 'Introduced or offered', 'Stalled'];

function readTracker(): Tracked[] {
  try {
    const value = JSON.parse(localStorage.getItem(TRACKER_KEY) ?? 'null');
    if (Array.isArray(value) && value.every(v => v && typeof v.id === 'string' && typeof v.title === 'string' && typeof v.office === 'string' && typeof v.updatedAt === 'string' && Number.isInteger(v.stage) && v.stage >= 0 && v.stage <= 4)) return value;
  } catch {}
  return [
    { id: 'sample-drainage', title: 'Neighborhood drainage priorities', office: 'County infrastructure office', stage: 2, updatedAt: 'Sample reply received' },
    { id: 'sample-crossings', title: 'Safer school crossings', office: 'City transportation committee', stage: 3, updatedAt: 'Sample committee referral' },
    { id: 'sample-food', title: 'Weekly mobile grocery stops', office: 'County community services', stage: 4, updatedAt: 'Next: revise the pilot budget' },
  ];
}
const date = (value: string) => new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' });
const count = (item: DemoItem) => item.support + item.oppose + item.unsure;


export default function WorkflowScreen({ stage, request }: { stage: Stage; request: Request }) {
  const jurisdiction = useJurisdiction();
  const [data, setData] = useState<DemoPayload | null>(readProposalSnapshot);
  const [selected, setSelected] = useState(initialSelection);
  const [topic, setTopic] = useState('All topics');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [mutationState, setMutationState] = useState<MutationState>({ phase: 'idle', message: '' });
  const [mutation] = useState(() => advisoryMutation(request, { getItem: key => sessionStorage.getItem(key), setItem: (key, value) => sessionStorage.setItem(key, value) }, setMutationState));
  const busy = mutationState.phase === 'submitting';
  useEffect(() => { setMutationState(mutation.state); }, [mutation]);
  const [confirmation, setConfirmation] = useState(0);
  const [startingRound, setStartingRound] = useState(false);
  const [office, setOffice] = useState('');
  const [tracker, setTracker] = useState<Tracked[]>(readTracker);
  const [outcomeFilter, setOutcomeFilter] = useState('All outcomes');
  const meta = STAGES[stage];
  const load = () => request<DemoPayload>('/api/demo').then(value => { saveProposalSnapshot(value); setData(value); });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true); setLoadError('');
    request<DemoPayload>('/api/demo').then(value => { if (active) { saveProposalSnapshot(value); setData(value); } })
      .catch(() => { if (active) setLoadError('Could not load sample proposals. Retry to choose a proposal and continue.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [request, attempt]);
  useEffect(() => {
    const update = () => { setSelected(initialSelection()); setOffice(''); setStatus(''); };
    window.addEventListener('popstate', update);
    return () => window.removeEventListener('popstate', update);
  }, []);
  useEffect(() => { const update = () => setTracker(readTracker()); window.addEventListener('storage', update); return () => window.removeEventListener('storage', update); }, []);
  const items = data?.items ?? [];
  const scoped = items.filter(i => sampleMatchesJurisdiction(i.id, jurisdiction.value));
  const filtered = filterProposals(scoped, query, topic);
  const explicit = new URLSearchParams(window.location.search).get('proposal');
  const item = filtered.find(i => i.id === selected) ?? (explicit && !items.some(i => i.id === explicit) ? undefined : filtered[0]);
  const deepStage = stage === 'draft' || stage === 'sponsors' || stage === 'outcomes';
  useEffect(() => {
    if (!item) return;
    setSelected(item.id);
    if (!(new URLSearchParams(window.location.search).get('demo') === '1')) { try { sessionStorage.setItem(SELECTION_KEY, item.id); } catch {} }
    if (deepStage) {
      const url = new URL(window.location.href);
      url.searchParams.set('proposal', item.id);
      window.history.replaceState(null, '', url);
    }
  }, [item?.id, stage]);
  useEffect(() => { setOffice(''); setStatus(''); }, [item?.id, jurisdiction.value]);
  const choice = item ? data?.votes[item.id] : undefined;
  const selectedOffice = office || item?.sponsors[0] || '';
  function choose(id: string) { if (id === item?.id) return; transitionProposal(() => { setSelected(id); setOffice(''); setStatus(''); window.history.replaceState(null, '', route(stage,id)); }); }
  function saveTracker(next: Tracked[]) { try { localStorage.setItem(TRACKER_KEY, JSON.stringify(next)); setTracker(next); return true; } catch { setError('Could not save the walkthrough in this browser. Enable local storage and try again.'); return false; } }
  async function submitVote(stance?: number) {
    if (mutation.pending || (stance !== undefined && !item)) return;
    const confirmed = await mutation.submit(stance === undefined ? undefined : { proposalId: item!.id, title: item!.title, stance });
    if (confirmed) {
      try { await load(); setError(''); window.dispatchEvent(new Event('advisory-vote:saved')); }
      catch { setError('Your advisory choice was confirmed by the server. Updated proposal counts could not be loaded.'); }
      setConfirmation(n => n + 1);
    }
  }
  function prepare() {
    if (!item) return;
    const existing = tracker.find(t => t.id === item.id);
    if (existing) { setStatus('This proposal already has a card in your sponsor tracker.'); return; }
    if (saveTracker([...tracker, { id: item.id, title: item.title, office: selectedOffice, stage: 0, updatedAt: `Prepared ${date(new Date().toISOString())}` }])) setStatus('Sample draft prepared in this browser. No message was sent.');
  }
  function download() {
    if (!item) return;
    const text = `CIVIC SYNTHESIS — SAMPLE DRAFT\nFictional demo. Not submitted to a public office. Not legal advice.\n\n${item.title}\n\nILLUSTRATIVE CURRENT APPROACH (not quoted law)\n${item.currentText}\n\nPROPOSED TEXT\n${item.proposedText}\n\nPLAIN-ENGLISH SUMMARY\n${item.summary}\n\nPOSSIBLE OFFICE\n${selectedOffice}\n\nBACKGROUND REFERENCE\n${provenanceText(item)}\n\nILLUSTRATIVE RESPONSES\n${count(item).toLocaleString()}\n`;
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' })); const a = document.createElement('a'); a.href = url; a.download = `${item.id}-draft.txt`; a.click(); window.setTimeout(() => URL.revokeObjectURL(url),1000); setStatus('Sample draft downloaded. Review it before contacting an office.');
  }
  const filterControls = <ProposalSearch items={scoped} query={query} topic={topic} setQuery={setQuery} setTopic={setTopic} loaded={!!data} failed={!!loadError} />;
  const selectControl = <label className="workflow-select">Proposal<select value={item?.id ?? ''} onChange={e => choose(e.target.value)} disabled={!filtered.length}>{!item && <option value="">Choose a sample proposal</option>}{filtered.map(i => <option key={i.id} value={i.id}>{i.title}</option>)}</select></label>;
  const draftDetail = item && <><ProposalProvenance item={item} /><PatchChange key={item.id} item={item} /></>;
  const visibleOutcomes = tracker.filter(t => t.stage >= 2 && (outcomeFilter === 'All outcomes' || LANES[t.stage] === outcomeFilter));
  return <div className="civic-shell workflow-shell"><CivicHeader stage={meta.title} /><main className="civic-main workflow-main">
    {stage === 'votes' && <DailyQuestion request={request} />}<section className="workflow-heading"><div><p className="workflow-eyebrow" style={{ viewTransitionName: `journey-stage-${meta.n}` }}>Stage {meta.n} of 6 · {meta.time}</p><h1>{meta.title}</h1><p><strong>{meta.heading}</strong></p><p>{meta.description}</p></div>{meta.next && <a className="workflow-next" href={route(meta.next,item?.id ?? selected)}>Next: {STAGES[meta.next].title} →</a>}</section>
    <div className="demo-context"><span><strong>A repeatable sample journey.</strong> Fictional proposals, illustrative tallies, and browser-local sponsor progress.</span><span>{data ? `Demo activity date ${date(data.updatedAt)} · not a source check` : loading ? <Skeleton kind="line" /> : 'Sample proposals unavailable'}</span></div>
    {stage === 'votes' && <ParticipationNotice />}
    <JurisdictionPicker preference={jurisdiction} count={loading || loadError ? null : filtered.length} />
    {loadError && <div className="dashboard-alert" role="alert">{loadError} <button disabled={loading} onClick={() => setAttempt(n => n + 1)}>Retry loading proposals</button></div>}
    {deepStage && <section className="panel" aria-label="Proposal context" aria-busy={loading}>
      {loading ? <Skeleton /> : loadError ? <p>Proposal details are unavailable. Use Retry loading proposals above.</p> : !items.length ? <><h2>No sample proposals available</h2><p>When proposals are available, choose one here to review its draft, prepare a sponsor card and follow its simulated outcomes.</p><button onClick={() => setAttempt(n => n + 1)}>Check again</button><a className="workflow-reference" href="/feed">Explore the proposal feed →</a></> : <>{item && <TopicChip topic={item.topic} />}<h2>{item ? item.title : 'Choose a sample proposal'}</h2><p>{item ? 'Continue with this fictional sample, or choose another proposal below.' : 'This proposal link is unavailable. Select a sample below to enter this stage.'}</p>{stage === 'outcomes' || !item ? selectControl : null}{!item && filtered.length > 0 && <button onClick={() => choose(filtered[0]!.id)}>Open first sample proposal</button>}{item && <a className="workflow-reference" href={route('feed',item.id)}>Back to proposal →</a>}</>}
    </section>}
    {error && <div className="dashboard-alert" role="alert">{error} <button onClick={() => load().then(() => setError('')).catch(() => setError('Still unable to load. Please try again shortly.'))}>Refresh proposal data</button></div>}
    <p className="workflow-status" role="status" aria-live="polite">{status}</p>
    {loading && !data && <WorkflowSkeleton stage={stage} />}
    {['feed', 'votes', 'draft'].includes(stage) && data && !loading && !loadError && <ProposalCompare key={window.location.search} items={items} current={item} search={window.location.search} />}
    {['published', 'feed', 'outcomes'].includes(stage) && <OfficialBills request={request} />}
    {stage === 'published' && (!loading || !!data) && <section className="panel"><div className="panel-head"><h2>Source desk</h2></div>{filterControls}<div className="workflow-source-grid">{filtered.map(i => <article className="workflow-source" key={i.id} style={proposalCardStyle("workflow", i.id)}><div className="entry-source">{i.source}</div><TopicChip topic={i.topic} /><span className="workflow-topic">{i.jurisdiction}</span><h3>{i.title}</h3><p>{i.summary}</p><div className="workflow-source-note">Background reference only. This scenario is not an enacted or published rule.</div><ArgumentMap item={i} /><div className="workflow-card-actions"><ProposalProvenance item={i} compact /><a href={route('feed',i.id)}>Read in feed →</a><a href={route('votes',i.id)}>Compare arguments and vote →</a></div></article>)}</div></section>}
    {stage === 'feed' && (!loading || !!data) && <div className="workflow-feed-layout"><section className="panel"><div className="panel-head"><h2>Changes to explore</h2></div>{filterControls}<div className="workflow-feed-list">{filtered.map(i => <article className={`workflow-feed-item ${item?.id === i.id ? 'selected' : ''}`} key={i.id} style={proposalCardStyle("workflow", i.id)}><div className="entry-source"><TopicChip topic={i.topic} /> · {i.jurisdiction}</div><h3 style={{ viewTransitionName: item?.id === i.id ? proposalTitleName(i.id) : undefined }}>{i.title}</h3><p>{i.summary}</p><ProposalProvenance item={i} compact /><div className="workflow-feed-bottom"><span>{count(i).toLocaleString()} sample responses</span><button className="outline" onClick={() => choose(i.id)}>View proposal</button></div></article>)}</div></section><aside className="panel workflow-sticky" style={{ viewTransitionName: 'proposal-detail' }}>{item ? <><span className="pill info">Viewing proposal</span><h2 className="workflow-detail-title">{item.title}</h2><p>{item.summary}</p><ProposalProvenance item={item} /><div className="workflow-detail-meta"><TopicChip topic={item.topic} /><span>{item.jurisdiction}</span></div><a className="dashboard-button" href={route('votes',item.id)}>View voting options →</a><a className="workflow-reference" href={route('published',item.id)}>Explore background sources</a></> : <p>{loading ? 'Loading proposal…' : 'No proposal matches these filters. Change or clear your filters to continue.'}</p>}</aside></div>}
    {stage === 'votes' && <MutationStatus state={mutationState} retry={() => { void submitVote(); }} disabled={busy} />}
    {stage === 'votes' && (!loading || !!data) && <div className="workflow-two"><section id="advisory-choice" className="panel vote-panel" style={{ viewTransitionName: 'proposal-detail' }}><div className="panel-head"><h2>Cast advisory vote</h2><button disabled={busy || startingRound || !item} onClick={async () => { setStartingRound(true); setError(''); try { const round = await request<{code:string}>('/api/live', {proposalId:item!.id}); window.location.assign('/votes?live='+round.code); } catch(e) { setError(String(e)); setStartingRound(false); } }}>Start live round</button><span className="pill info">Non-binding</span></div>{selectControl}{!loading && !loadError && !item && <p>No proposal matches these filters. Change or clear your jurisdiction preference to continue.</p>}{item && <><TopicChip topic={item.topic} /><h3 className="workflow-detail-title" style={{ viewTransitionName: item ? proposalTitleName(item.id) : undefined }}>Should we {item.title.charAt(0).toLowerCase()+item.title.slice(1)}?</h3><p className="vote-summary">{item.summary}</p><ProposalProvenance item={item} /><ArgumentMap item={item} /><p>Viewing a proposal does not cast a vote. Choose Support, Oppose, or Not sure below to save a non-binding advisory vote.</p><section aria-label="Unverified browser votes — advisory"><h3>Unverified browser votes — advisory</h3><p>{data?.browserCounts?.[item.id] ? `Support: ${data.browserCounts[item.id]!.support} · Oppose: ${data.browserCounts[item.id]!.oppose} · Not sure: ${data.browserCounts[item.id]!.unsure}` : 'Browser counts unavailable'}</p><p>Cookie-based choices for this sample proposal, not unique people or verified eligibility. Separate from synthetic responses below.</p></section><h3>Synthetic demo data — illustrative</h3><AdvisoryVoteBars key={item.id} item={item} choice={choice} busy={busy} confirmation={confirmation} onVote={submitVote} /><div className="vote-foot"><p>{count(item).toLocaleString()} illustrative responses<br/>Demo voting window ends {data ? date(data.closesAt) : '—'}</p><p>One saved choice per browser cookie per proposal; clearing cookies can create another identity. Sample counts are not verified residents or a representative public poll.</p></div><a className="workflow-reference" href={route('draft',item.id)}>Review the sample draft →</a></>}</section><section className="panel"><h2>Understand the change</h2>{draftDetail}</section></div>}
    {stage === 'draft' && !loadError && item && <div className="workflow-two"><section className="panel" style={{ viewTransitionName: 'proposal-detail' }}><div className="panel-head"><h2>This week’s patch</h2><span className="pill info">Sample draft</span></div>{selectControl}<h3 className="workflow-detail-title" style={{ viewTransitionName: proposalTitleName(item.id) }}>{item.title}</h3>{draftDetail}</section><aside className="panel workflow-sticky"><h2>Prepare for a sponsor</h2><p className="workflow-body-muted">Choose the kind of office that could review this proposal. These are sample office categories, not confirmed sponsors.</p><label className="workflow-select">Possible office<select value={selectedOffice} onChange={e => setOffice(e.target.value)}>{item?.sponsors.map(s => <option key={s}>{s}</option>)}</select></label><div className="workflow-action-stack"><button disabled={!item} onClick={prepare}>{tracker.some(t => t.id === item?.id) ? 'Already in sponsor tracker ✓' : 'Prepare sponsor draft'}</button><button className="outline" disabled={!item} onClick={download}>Download sample draft</button><a href={route('sponsors',item?.id)}>Open sponsor tracker →</a></div><div className="workflow-source-note">Nothing is sent. Downloaded language is illustrative and needs review before outreach.</div></aside></div>}
    {(stage === 'draft' || stage === 'votes') && item && <AmendmentEditor key={`sample:${item.id}`} source={{ kind: 'sample', id: item.id, title: item.title, text: item.proposedText, jurisdiction: item.jurisdiction, origin: provenanceText(item) }} />}
    {stage === 'sponsors' && !loading && !loadError && item && <><section className="panel workflow-prepare"><div><h2>Prepare a sample outreach card</h2><p className="workflow-body-muted">Cards are saved in this browser and shared with the dashboard walkthrough.</p></div><div>{selectControl}<label className="workflow-select">Possible office<select value={selectedOffice} onChange={e => setOffice(e.target.value)}>{item?.sponsors.map(s => <option key={s}>{s}</option>)}</select></label><button disabled={!item} onClick={prepare}>Add to tracker</button></div></section><OutreachDraft key={JSON.stringify([item, selectedOffice])} item={item} office={selectedOffice} /><section className="panel workflow-tracker"><div className="panel-head"><h2>Sponsor tracker</h2><span>Local demo · no real outreach</span></div><SponsorBoard items={items} cards={tracker} save={saveTracker} className="workflow-board" /></section></>}
    {stage === 'outcomes' && (!loading || !!data) && <><PolicyMeasurements /><h2>Outreach activity · simulated</h2><div className="workflow-outcome-stats">{[2,3,4].map(n => <section className="panel" key={n}><OutcomeTotal value={tracker.filter(t => t.stage === n).length} /><span>{LANES[n]}</span><small>Simulated outcomes</small></section>)}</div><section className="panel"><div className="panel-head"><h2>Follow-through log</h2><p>Draft downloads do not create outreach evidence. All milestones below are manually selected simulations, not verified contact, replies or sponsorship.</p><label><span className="sr">Filter outcomes</span><select value={outcomeFilter} onChange={e => setOutcomeFilter(e.target.value)}>{['All outcomes',...LANES.slice(2)].map(s => <option key={s}>{s}</option>)}</select></label></div><div className="workflow-outcome-list">{visibleOutcomes.map(t => <article key={t.id}><span className={`workflow-outcome-badge outcome-${t.stage}`}>{LANES[t.stage]} · demo</span><TopicChip topic={topicForProposal(t.id, items)} /><h3>{t.title}</h3><p>{t.office}</p><small>{t.updatedAt}</small><p className="workflow-next-step">{t.stage === 2 ? 'Next: review the sample reply and prepare a follow-up.' : t.stage === 3 ? 'Next: track the committee milestone and public record.' : 'Next: revise the proposal and choose a new outreach step.'}</p><a href={t.stage === 4 ? route('feed',item?.id) : route('sponsors',item?.id)}>{t.stage === 4 ? 'Return to the feed →' : 'Update tracker →'}</a></article>)}</div>{!visibleOutcomes.length && <p className="workflow-empty">No simulated outcomes match this filter. Move a card to Replied, Introduced or offered, or Stalled to explore this stage. <a href={route('sponsors',item?.id)}>Open sponsor tracker →</a></p>}</section></>}
    <footer className="workflow-footer"><a href="/proposals/new?guided=1">Propose a change · private guided draft →</a><p>Sample clauses are fictional, reference links provide background, and sponsor outcomes are simulated.</p><a href="/journal">Start with your own experience · Journal & API →</a></footer>
  </main></div>;
}
