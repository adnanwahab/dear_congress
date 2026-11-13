import { AdvisoryVoteBars } from './AdvisoryVoteBars';
import { SponsorBoard } from './SponsorBoard';
import { PatchChange, transitionProposal } from './PatchChange';
import { filterProposals, ProposalSearch } from './ProposalSearch';
import { CIVIC_STAGES, stageRoute } from '../shared/civic-stages';
import { useEffect, useRef, useState } from 'react';
import type { DemoItem, DemoPayload } from '../engine/demo';

type Request = <T>(path: string, body?: unknown, method?: string) => Promise<T>;
const LANES = ['Drafted', 'Ready to send', 'Replied', 'Introduced or offered', 'Stalled'];
interface Tracked { id: string; title: string; office: string; stage: number; updatedAt: string; }
const TRACKER_KEY = 'civic_demo_tracker_v1';
function initialTracker(): Tracked[] {
  try { const value = JSON.parse(localStorage.getItem(TRACKER_KEY) ?? 'null'); if (Array.isArray(value) && value.every(v => v && typeof v.id === 'string' && typeof v.title === 'string' && typeof v.office === 'string' && Number.isInteger(v.stage) && v.stage >= 0 && v.stage < 5 && typeof v.updatedAt === 'string')) return value; } catch {}
  return [
    { id: 'sample-drainage', title: 'Neighborhood drainage priorities', office: 'County infrastructure office', stage: 2, updatedAt: 'Sample reply received' },
    { id: 'sample-crossings', title: 'Safer school crossings', office: 'City transportation committee', stage: 3, updatedAt: 'Sample committee referral' },
    { id: 'sample-food', title: 'Weekly mobile grocery stops', office: 'County community services', stage: 4, updatedAt: 'Next: revise the pilot budget' },
  ];
}
const dateLabel = (value: string) => new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' });

export function Dashboard({ request }: { request: Request }) {
  const [data, setData] = useState<DemoPayload | null>(null);
  const [selected, setSelected] = useState<string | null>(() => new URLSearchParams(window.location.search).get('proposal'));
  const [topic, setTopic] = useState('All topics');
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmation, setConfirmation] = useState(0);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [tracker, setTracker] = useState<Tracked[]>(initialTracker);
  const [office, setOffice] = useState('');
  const voteRef = useRef<HTMLElement>(null);
  const load = async () => { const next = await request<DemoPayload>('/api/demo'); setData(next); };
  useEffect(() => {
    let active = true;
    const refresh = () => request<DemoPayload>('/api/demo').then(next => { if (active) { setData(next); setError(''); } }).catch(() => { if (active) setError('Could not load or refresh sample proposals. Previously loaded proposals, if any, remain available.'); });
    refresh();
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible') refresh(); }, 60_000);
    return () => { active = false; clearInterval(timer); };
  }, []);
  const items = data?.items ?? [];
  const item = items.find(i => i.id === selected) ?? items[0];
  const filtered = filterProposals(items, query, topic);
  const total = item ? item.support + item.oppose + item.unsure : 0;
  const chosen = item ? data?.votes[item.id] : undefined;
  const tracked = item ? tracker.some(t => t.id === item.id) : false;
  function persist(next: Tracked[]) {
    try { localStorage.setItem(TRACKER_KEY, JSON.stringify(next)); setTracker(next); return true; }
    catch { setError('Browser storage is unavailable. Enable local storage to save the sponsor walkthrough.'); return false; }
  }
  function select(next: DemoItem) { if (busy || next.id === item?.id) return; transitionProposal(() => { const url = new URL(window.location.href); url.searchParams.set('proposal', next.id); window.history.replaceState(null, '', url); setSelected(next.id); setOffice(''); setNotice(''); voteRef.current?.focus({ preventScroll: true }); }); }
  async function vote(stance: number) {
    if (!item || busy) return;
    setBusy(true); setError(''); setNotice('');
    try {
      await request('/api/votes', { votes: [{ proposalId: item.id, stance, importance: .5, acceptCompromise: true, concern: '', changeMind: '' }] });
      await load(); setConfirmation(n => n + 1); setNotice('Advisory vote saved. You can change it at any time.');
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not save your vote. Please try again.'); }
    finally { setBusy(false); }
  }
  function download() {
    if (!item) return;
    const text = `CIVIC SYNTHESIS — SAMPLE DRAFT\nFictional demo. Not submitted to a public office. Not legal advice.\n\n${item.title}\n\nContext (not a quotation)\n${item.currentText}\n\nProposed text\n${item.proposedText}\n\nPlain-English summary\n${item.summary}\n\nReference for background only\n${item.sourceUrl}\n\nPossible office\n${office || item.sponsors[0]}\n\nIllustrative responses: ${total}\n`;
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
    const a = document.createElement('a'); a.href = url; a.download = `${item.id}-draft.txt`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    setNotice('Sample draft downloaded. Review it before contacting any office.');
  }
  function prepare() {
    if (!item || tracked) return;
    if (persist([...tracker, { id: item.id, title: item.title, office: office || item.sponsors[0]!, stage: 0, updatedAt: `Prepared ${dateLabel(new Date().toISOString())}` }])) setNotice('Draft added to your local demo tracker. No message was sent.');
  }
  return <div className="civic-shell">
    <header className="civic-header"><div className="header-brand"><a href="/">Civic Synthesis</a><span className="pill">Live demo</span></div><div className="header-meta"><span className="pill warn">SAMPLE DATA</span><span className="pill info">Advisory · not binding</span></div></header>
    <main className="civic-main">
      <section className="hero"><h1>One proposal, from published change to sponsor</h1><p>Understand a change. Add your voice. Turn a shared need into a draft someone can act on.</p><p><a className="dashboard-button" href={stageRoute('votes', item?.id)}>Read a proposal & vote →</a></p><ol className="stage-grid">{CIVIC_STAGES.map(({title,time,description,n,route}) => <li className="stage-card" key={title}><div className="stage-top"><span>{n}</span><small>{time}</small></div><h2><a href={`${route}${item ? `?proposal=${encodeURIComponent(item.id)}` : ''}`}>{title}</a></h2><p>{description}</p></li>)}</ol></section>
      <div className="demo-context"><span><strong>A complete sample journey.</strong> Fictional proposals, illustrative responses, and simulated sponsor outcomes.</span><span>{data ? `Demo refreshed ${dateLabel(data.updatedAt)}` : error ? 'Sample scenarios unavailable' : 'Loading sample scenarios…'}</span></div>
      {error && <div className="dashboard-alert" role="alert">{error} <button onClick={() => load().then(() => setError('')).catch(() => setError('Still unable to connect. Please try again shortly.'))}>Try again</button></div>}
      <div className="triple-grid">
        <section className="panel feed-panel"><div className="panel-head"><h2>Explore changes</h2></div><ProposalSearch items={items} query={query} topic={topic} setQuery={setQuery} setTopic={setTopic} loaded={!!data} failed={!!error} />
          <div className="entry-list">{filtered.map(i => <article className={`entry-item ${item?.id === i.id ? 'entry-selected' : ''}`} key={i.id}><div className="entry-source">{i.source} <span>· {i.topic}</span></div><h3>{i.title}</h3><p>{i.jurisdiction} · Sample proposal</p><button className="outline" disabled={busy} onClick={() => select(i)}>View proposal</button></article>)}{!data && !error && <div className="dashboard-skeleton" aria-label="Loading proposals" />}</div>
        </section>
        <section className="panel vote-panel" ref={voteRef} tabIndex={-1} aria-labelledby="vote-title"><div className="panel-head"><h2 id="vote-title">Cast advisory vote</h2><span className="pill info">Non-binding</span></div><h3 className="vote-question">{item ? `Should we ${item.title.charAt(0).toLowerCase() + item.title.slice(1)}?` : 'Loading proposal…'}</h3><p className="vote-summary">{item?.summary}</p><p>Viewing a proposal does not cast a vote. Choose Support, Oppose, or Not sure below to save a non-binding advisory vote.</p>{item && <AdvisoryVoteBars key={item.id} item={item} choice={chosen} busy={busy} confirmation={confirmation} onVote={vote} />}<div className="vote-foot"><p>{total.toLocaleString()} illustrative responses<br/>Demo voting window ends {data ? dateLabel(data.closesAt) : '—'}</p><p>One browser account, one advisory vote per proposal. Sample counts are not verified residents or a representative public poll.</p>{item && <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer">Official background reference ↗</a>}</div></section>
        <section className="panel patch-panel"><div className="panel-head"><h2>This week’s patch</h2><span>Sample draft</span></div>{item ? <PatchChange key={item.id} item={item} /> : <p>Loading draft…</p>}<h3 className="patch-label">Possible sponsor offices</h3><label className="sponsor-picker"><span className="sr">Choose a sponsor office</span><select value={office || item?.sponsors[0] || ''} onChange={e => setOffice(e.target.value)}>{item?.sponsors.map(s => <option key={s}>{s}</option>)}</select></label><div className="draft-actions"><button disabled={!item || tracked} onClick={prepare}>{tracked ? 'Added to tracker ✓' : 'Prepare sponsor draft'}</button><button className="outline" disabled={!item} onClick={download}>Download draft</button></div><p className="draft-caption">Demo preparation only. Nothing is sent to a public office.</p></section>
      </div>
      <p className="dashboard-status" role="status" aria-live="polite">{busy ? 'Saving your vote…' : notice}</p>
      <section className="panel tracker"><div className="panel-head"><h2>Sponsor tracker</h2><span>Local demo · no real outreach · saved in this browser</span></div><SponsorBoard cards={tracker} save={persist} className="tracker-grid" /><p>Simulated outcomes demonstrate the workflow. A stalled item needs a revised next step before outreach.</p></section>
      <footer className="civic-footer"><div><h2>What this is</h2><p>A working demo of advisory votes, draft preparation, and sponsor follow-through.</p><a href="/journal">Share a need →</a></div><div><h2>What this is not</h2><p>Not an official ballot, a public poll, or legal advice. No sponsor has been contacted.</p></div><div><h2>Where facts come from</h2><p>Official links provide background. Sample clauses are fictional and are not quoted law.</p><a href="/synth">Explore the synthesis engine →</a></div></footer>
    </main>
  </div>;
}
