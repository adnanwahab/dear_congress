import { useEffect, useState } from 'react';
import type { DemoItem, DemoPayload } from '../engine/demo';
import './workflow.css';
import { ProposalProvenance, provenanceText } from './ProposalProvenance';

type Stage = 'published' | 'feed' | 'votes' | 'draft' | 'sponsors' | 'outcomes';
type Request = <T>(path: string, body?: unknown, method?: string) => Promise<T>;
interface Tracked { id: string; title: string; office: string; stage: number; updatedAt: string; }
const TRACKER_KEY = 'civic_demo_tracker_v1';
const LANES = ['Drafted', 'Ready to send', 'Replied', 'Introduced or offered', 'Stalled'];
const STAGES: Record<Stage, { n: number; title: string; heading: string; description: string; time: string; next?: Stage }> = {
  published: { n: 1, title: 'Published', heading: 'Start with the source.', description: 'Explore the official institutions behind each sample scenario. Reference links provide background; the sample proposals are fictional.', time: 'Clock starts', next: 'feed' },
  feed: { n: 2, title: 'In the feed', heading: 'Make sense of what could change.', description: 'Find a proposal by topic, read its plain-English summary, and choose the change you want to explore.', time: 'Same day', next: 'votes' },
  votes: { n: 3, title: 'Open for votes', heading: 'Add your voice to a proposal.', description: 'Read the change, make an advisory choice, and change your vote at any time. Sample tallies are illustrative, not a public poll.', time: 'Open 7 days', next: 'draft' },
  draft: { n: 4, title: 'Weekly draft', heading: 'Turn a shared need into clear text.', description: 'Compare the illustrative current approach with a proposed clause, review the summary, and prepare a downloadable sample draft.', time: 'Every week', next: 'sponsors' },
  sponsors: { n: 5, title: 'Sponsor contact', heading: 'Give every draft a next step.', description: 'Choose a possible office and walk a sample draft through preparation and follow-up. Nothing is sent to a public office.', time: 'Within a week', next: 'outcomes' },
  outcomes: { n: 6, title: 'Outcome', heading: 'Keep the story moving.', description: 'Review simulated replies, committee introductions, and stalled items. Record a clear next step rather than letting a draft disappear.', time: 'Tracked weekly' },
};
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
const route = (stage: Stage, id?: string) => `/${stage}${id ? `?proposal=${encodeURIComponent(id)}` : ''}`;

export default function WorkflowScreen({ stage, request }: { stage: Stage; request: Request }) {
  const [data, setData] = useState<DemoPayload | null>(null);
  const [selected, setSelected] = useState(() => new URLSearchParams(window.location.search).get('proposal'));
  const [topic, setTopic] = useState('All topics');
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [office, setOffice] = useState('');
  const [tracker, setTracker] = useState<Tracked[]>(readTracker);
  const [outcomeFilter, setOutcomeFilter] = useState('All outcomes');
  const meta = STAGES[stage];
  const load = () => request<DemoPayload>('/api/demo').then(setData);
  useEffect(() => { let active = true; request<DemoPayload>('/api/demo').then(value => { if (active) setData(value); }).catch(() => { if (active) setError('Could not load proposals. Please retry.'); }); return () => { active = false; }; }, [request]);
  useEffect(() => { const update = () => setTracker(readTracker()); window.addEventListener('storage', update); return () => window.removeEventListener('storage', update); }, []);
  const items = data?.items ?? [];
  const filtered = items.filter(i => (topic === 'All topics' || i.topic === topic) && `${i.title} ${i.summary} ${i.source} ${i.jurisdiction}`.toLowerCase().includes(query.toLowerCase()));
  const item = items.find(i => i.id === selected) ?? filtered[0] ?? items[0];
  const choice = item ? data?.votes[item.id] : undefined;
  const selectedOffice = office || item?.sponsors[0] || '';
  const topics = ['All topics', ...new Set(items.map(i => i.topic))];
  function choose(id: string) { setSelected(id); setOffice(''); setStatus(''); window.history.replaceState(null, '', route(stage,id)); }
  function saveTracker(next: Tracked[]) { try { localStorage.setItem(TRACKER_KEY, JSON.stringify(next)); setTracker(next); return true; } catch { setError('Could not save the walkthrough in this browser. Enable local storage and try again.'); return false; } }
  async function vote(stance: number) {
    if (!item || busy) return;
    setBusy(true); setError(''); setStatus('');
    try { await request('/api/votes', { votes: [{ proposalId: item.id, stance, importance: .5, acceptCompromise: true, concern: '', changeMind: '' }] }); await load(); setStatus('Your advisory vote is saved. You can change it at any time.'); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not save your vote. Please try again.'); }
    finally { setBusy(false); }
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
  const filterControls = <div className="workflow-filters"><label><span className="sr">Search sample proposals</span><input type="search" placeholder="Search proposals…" value={query} onChange={e => setQuery(e.target.value)} /></label><label><span className="sr">Filter proposals by topic</span><select value={topic} onChange={e => setTopic(e.target.value)}>{topics.map(t => <option key={t}>{t}</option>)}</select></label></div>;
  const selectControl = <label className="workflow-select">Proposal<select value={item?.id ?? ''} onChange={e => choose(e.target.value)} disabled={!items.length}>{items.map(i => <option key={i.id} value={i.id}>{i.title}</option>)}</select></label>;
  const draftDetail = item && <><ProposalProvenance item={item} /><h3 className="patch-label">Current approach · illustrative</h3><div className="patch-code removed">− {item.currentText}</div><h3 className="patch-label">Proposed text</h3><div className="patch-code added">+ {item.proposedText}</div><h3 className="patch-label">Plain-English summary</h3><p>{item.summary}</p></>;
  const visibleOutcomes = tracker.filter(t => t.stage >= 2 && (outcomeFilter === 'All outcomes' || LANES[t.stage] === outcomeFilter));
  return <div className="civic-shell workflow-shell"><header className="civic-header"><div className="header-brand"><a href="/">Civic Synthesis</a><span className="pill">{meta.title}</span></div><div className="header-meta"><span className="pill warn">SAMPLE DATA</span><span className="pill info">Advisory · not binding</span></div></header><main className="civic-main workflow-main">
    <section className="workflow-heading"><div><p className="workflow-eyebrow">Stage {meta.n} of 6 · {meta.time}</p><h1>{meta.heading}</h1>{stage === "votes" && <a href="/vote/happybearlandia">Game patches · HappyBearLandia →</a>}<p>{meta.description}</p></div>{meta.next && <a className="workflow-next" href={route(meta.next,item?.id)}>{STAGES[meta.next].title} →</a>}</section>
    <div className="demo-context"><span><strong>A repeatable sample journey.</strong> Fictional proposals, illustrative tallies, and browser-local sponsor progress.</span><span>{data ? `Demo activity date ${date(data.updatedAt)} · not a source check` : 'Loading…'}</span></div>
    {error && <div className="dashboard-alert" role="alert">{error} <button onClick={() => load().then(() => setError('')).catch(() => setError('Still unable to load. Please try again shortly.'))}>Try again</button></div>}
    <p className="workflow-status" role="status" aria-live="polite">{busy ? 'Saving…' : status}</p>
    {stage === 'published' && <section className="panel"><div className="panel-head"><h2>Source desk</h2><span>{filtered.length} sample scenarios</span></div>{filterControls}<div className="workflow-source-grid">{filtered.map(i => <article className="workflow-source" key={i.id}><div className="entry-source">{i.source}</div><span className="workflow-topic">{i.jurisdiction} · {i.topic}</span><h3>{i.title}</h3><p>{i.summary}</p><ProposalProvenance item={i} /><div className="workflow-card-actions"><a href={route('feed',i.id)}>Read in feed →</a></div></article>)}</div>{data && !filtered.length && <p className="workflow-empty">No sample scenarios match these filters.</p>}</section>}
    {stage === 'feed' && <div className="workflow-feed-layout"><section className="panel"><div className="panel-head"><h2>Changes to explore</h2><span>{filtered.length} items</span></div>{filterControls}<div className="workflow-feed-list">{filtered.map(i => <article className={`workflow-feed-item ${item?.id === i.id ? 'selected' : ''}`} key={i.id}><div className="entry-source">{i.topic} · {i.jurisdiction}</div><h3>{i.title}</h3><p>{i.summary}</p><ProposalProvenance item={i} /><div className="workflow-feed-bottom"><span>{count(i).toLocaleString()} sample responses</span><button className={item?.id === i.id ? '' : 'outline'} onClick={() => choose(i.id)}>{item?.id === i.id ? 'Selected ✓' : 'Read proposal'}</button></div></article>)}</div>{data && !filtered.length && <p className="workflow-empty">No proposals match your search.</p>}</section><aside className="panel workflow-sticky">{item ? <><span className="pill info">Selected sample scenario</span><ProposalProvenance item={item} /><h2 className="workflow-detail-title">{item.title}</h2><p>{item.summary}</p><div className="workflow-detail-meta"><span>{item.topic}</span><span>{item.jurisdiction}</span></div><a className="dashboard-button" href={route('votes',item.id)}>Read & vote →</a><a className="workflow-reference" href={route('published',item.id)}>Explore background sources</a></> : <p>Loading proposal…</p>}</aside></div>}
    {stage === 'votes' && <div className="workflow-two"><section className="panel vote-panel"><div className="panel-head"><h2>Open for vote</h2><span className="pill info">Non-binding</span></div>{selectControl}{item && <><h3 className="workflow-detail-title">Should we {item.title.charAt(0).toLowerCase()+item.title.slice(1)}?</h3><p className="vote-summary">{item.summary}</p><ProposalProvenance item={item} /><div className="vote-options">{([['Support',1,item.support],['Oppose',-1,item.oppose],['Not sure',0,item.unsure]] as const).map(([label,stance,n]) => <button key={label} aria-pressed={choice === stance} disabled={busy} onClick={() => vote(stance)}><span>{label}{choice === stance ? ' ✓' : ''}</span><span>{n.toLocaleString()}</span></button>)}</div><div className="vote-foot"><p>{count(item).toLocaleString()} illustrative responses<br/>Demo voting window ends {data ? date(data.closesAt) : '—'}</p><p>One browser account, one advisory vote per proposal. Sample counts are not verified residents or a representative public poll.</p></div><a className="workflow-reference" href={route('draft',item.id)}>Review the sample draft →</a></>}</section><section className="panel"><h2>Understand the change</h2>{draftDetail}</section></div>}
    {stage === 'draft' && <div className="workflow-two"><section className="panel"><div className="panel-head"><h2>This week’s patch</h2><span className="pill info">Sample draft</span></div>{selectControl}{draftDetail}</section><aside className="panel workflow-sticky"><h2>Prepare for a sponsor</h2><p className="workflow-body-muted">Choose the kind of office that could review this proposal. These are sample office categories, not confirmed sponsors.</p><label className="workflow-select">Possible office<select value={selectedOffice} onChange={e => setOffice(e.target.value)}>{item?.sponsors.map(s => <option key={s}>{s}</option>)}</select></label><div className="workflow-action-stack"><button disabled={!item} onClick={prepare}>{tracker.some(t => t.id === item?.id) ? 'Already in sponsor tracker ✓' : 'Prepare sponsor draft'}</button><button className="outline" disabled={!item} onClick={download}>Download sample draft</button><a href={route('sponsors',item?.id)}>Open sponsor tracker →</a></div><div className="workflow-source-note">Nothing is sent. Downloaded language is illustrative and needs review before outreach.</div></aside></div>}
    {stage === 'sponsors' && <><section className="panel workflow-prepare"><div><h2>Prepare a sample outreach card</h2><p className="workflow-body-muted">Cards are saved in this browser and shared with the dashboard walkthrough.</p></div><div>{selectControl}<label className="workflow-select">Possible office<select value={selectedOffice} onChange={e => setOffice(e.target.value)}>{item?.sponsors.map(s => <option key={s}>{s}</option>)}</select></label><button disabled={!item} onClick={prepare}>Add to tracker</button></div></section><section className="panel workflow-tracker"><div className="panel-head"><h2>Sponsor tracker</h2><span>Local demo · no real outreach</span></div><div className="workflow-board">{LANES.map((lane,laneIndex) => <section className="tracker-lane" key={lane}><h3>{laneIndex+1} · {lane}</h3>{tracker.filter(t => t.stage === laneIndex).map(t => <article className="tracked-draft" key={t.id}><strong>{t.title}</strong><span>{t.office}</span><small>{t.updatedAt}</small><label><span className="sr">Demo stage for {t.title}</span><select value={t.stage} onChange={e => { if (saveTracker(tracker.map(v => v.id === t.id ? { ...v, stage: Number(e.target.value), updatedAt: `Demo updated ${date(new Date().toISOString())}` } : v))) setStatus('Demo stage saved in this browser.'); }}>{LANES.map((l,i) => <option key={l} value={i}>{l}</option>)}</select></label></article>)}{!tracker.some(t => t.stage === laneIndex) && <p className="workflow-empty">No sample cards here yet.</p>}</section>)}</div></section></>}
    {stage === 'outcomes' && <><div className="workflow-outcome-stats">{[2,3,4].map(n => <section className="panel" key={n}><strong>{tracker.filter(t => t.stage === n).length}</strong><span>{LANES[n]}</span><small>Simulated outcomes</small></section>)}</div><section className="panel"><div className="panel-head"><h2>Follow-through log</h2><label><span className="sr">Filter outcomes</span><select value={outcomeFilter} onChange={e => setOutcomeFilter(e.target.value)}>{['All outcomes',...LANES.slice(2)].map(s => <option key={s}>{s}</option>)}</select></label></div><div className="workflow-outcome-list">{visibleOutcomes.map(t => <article key={t.id}><span className={`workflow-outcome-badge outcome-${t.stage}`}>{LANES[t.stage]} · demo</span><h3>{t.title}</h3><p>{t.office}</p><small>{t.updatedAt}</small><p className="workflow-next-step">{t.stage === 2 ? 'Next: review the sample reply and prepare a follow-up.' : t.stage === 3 ? 'Next: track the committee milestone and public record.' : 'Next: revise the proposal and choose a new outreach step.'}</p><a href={t.stage === 4 ? route('feed') : route('sponsors')}>{t.stage === 4 ? 'Return to the feed →' : 'Update tracker →'}</a></article>)}</div>{!visibleOutcomes.length && <p className="workflow-empty">No simulated outcomes match this filter. Move a card in the sponsor tracker to explore this stage.</p>}</section></>}
    <footer className="workflow-footer"><p>Sample clauses are fictional, reference links provide background, and sponsor outcomes are simulated.</p><a href="/journal">Start with your own experience · Journal & API →</a></footer>
  </main></div>;
}
