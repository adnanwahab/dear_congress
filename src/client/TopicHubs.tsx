import { useEffect, useState } from 'react';
import { TOPICS } from '../shared/topics';
import { topicById, topicStageUrl, type TopicHubData } from '../shared/topic-hubs';
import type { DemoItem, DemoPayload } from '../engine/demo';
import { ProposalProvenance } from './ProposalProvenance';
import { JurisdictionPicker, sampleMatchesJurisdiction, useJurisdiction } from './JurisdictionPicker';
import { CivicHeader } from './CivicHeader';
import './topic-hubs.css';

export function TopicHubs({ request }: { request: <T>(path: string) => Promise<T> }) {
  const id = window.location.pathname.split('/')[2] ?? '';
  const topic = topicById(id);
  const [query, setQuery] = useState(() => new URLSearchParams(window.location.search).get('q') ?? '');
  const [hub, setHub] = useState<TopicHubData | null>(null);
  const [items, setItems] = useState<DemoItem[]>([]);
  const [error, setError] = useState(false);
  const [attempt, retry] = useState(0);
  const jurisdiction = useJurisdiction();
  useEffect(() => {
    const update = () => setQuery(new URLSearchParams(window.location.search).get('q') ?? '');
    window.addEventListener('popstate', update);
    return () => window.removeEventListener('popstate', update);
  }, []);
  useEffect(() => {
    if (!topic) return;
    let active = true;
    setError(false);
    Promise.all([request<TopicHubData>(`/api/topics/${id}`), request<DemoPayload>('/api/demo')])
      .then(([data, demo]) => { if (active) { setHub(data); setItems(demo.items); } })
      .catch(() => { if (active) { setHub(null); setItems([]); setError(true); } });
    return () => { active = false; };
  }, [id, request, attempt]);
  const samples = items.filter(i => i.topic === topic?.label && sampleMatchesJurisdiction(i.id, jurisdiction.value));
  return <main className="topic-hubs"><CivicHeader stage="Topics" /><h1>{topic ? `${topic.label} topic hub` : 'Topic hubs'}</h1>
    <p>Follow a topic across experiences, needs, competing proposals and evidence. Missing stages remain visible.</p>
    <form role="search" onSubmit={e => e.preventDefault()}><label>Search topics<input type="search" value={query} onChange={e => {
      const value = e.target.value; setQuery(value); const url = new URL(window.location.href);
      if (value) url.searchParams.set('q', value); else url.searchParams.delete('q');
      window.history.replaceState(null, '', url);
    }} /></label></form>
    <nav aria-label="Topic hubs">{TOPICS.filter(t => t.label.toLowerCase().includes(query.toLowerCase())).map(t => <a key={t.id} aria-current={id === t.id ? 'page' : undefined} href={`/topics/${t.id}`}>{t.label}</a>)}</nav>
    {!TOPICS.some(t => t.label.toLowerCase().includes(query.toLowerCase())) && <p>No topics match this search.</p>}
    {topic && <><section className="panel"><h2>Public human experiences</h2><p>Not yet available. Legacy journal records do not retain explicit topic-curation consent; their text is excluded.</p></section>
      {error ? <p role="alert">Topic data unavailable. <button onClick={() => retry(n => n + 1)}>Retry</button></p> : !hub ? <p role="status">Loading topic…</p> : <>
        <section className="panel"><h2>Sample experiences and recorded lineage</h2><p>Fictional repository samples. Need labels and proposal links below come from stored extraction, not new classification.</p>
          {!hub.stories.length && <p>Not yet available.</p>}{hub.stories.map(s => <article key={s.id}><p>{s.text}</p><small>Source entry: {s.id}</small><p><a href={`/api/citizen-proposals/journal/${encodeURIComponent(s.id)}`}>Inspect original public source record</a></p><p>{s.needIds.map(n => <a key={n} href={`/needs?${new URLSearchParams({ need: n, entry: s.id, topic: id })}`}>Recorded need: {n}</a>)}</p><p>{s.proposalIds.length ? s.proposalIds.map(p => <a key={p} href={`#policy-${p}`}>Recorded proposal: {p}</a>) : 'Source-to-proposal link not yet available.'}</p></article>)}</section>
        <section className="panel"><h2>Needs</h2>{!hub.needs.length && <p>Not yet available.</p>}{hub.needs.map(n => <article key={n.id}><h3><a href={`/needs?${new URLSearchParams({ need: n.id, topic: id })}`}>{n.label}</a></h3><p>{n.goal}</p><p>Metric: {n.metric}</p></article>)}</section>
        <section className="panel"><h2>Catalog policy alternatives · illustrative</h2><p>Alternatives may conflict. Sharing a topic does not establish derivation from any story or approval.</p>{!hub.proposals.length && <p>Not yet available.</p>}{hub.proposals.map(p => <article key={p.id} id={`policy-${p.id}`}><h3>{p.title}</h3><p>{p.id} → need {p.needId} · {p.jurisdiction}</p>{p.rightsIssue && <p>Rights constraint: {p.rightsIssue}</p>}<a href={`/needs?${new URLSearchParams({ need: p.needId, topic: id })}`}>Inspect need and policy alternatives</a></article>)}</section>
        <section className="panel"><h2>Sample proposals and background sources</h2><JurisdictionPicker preference={jurisdiction} count={samples.length} />{!samples.length && <p>Not yet available in this jurisdiction.</p>}{samples.map(i => <article key={i.id}><h3>{i.title}</h3><p>{i.summary}</p><ProposalProvenance item={i} /><p>No recorded derivation from a journal entry. Topic association only.</p><nav aria-label={`Explore ${i.title}`}>{['feed', 'published', 'votes', 'draft', 'outcomes'].map(stage => <a key={stage} href={topicStageUrl(stage, id, i.id)}>{stage}</a>)}</nav><p>Deliberation: sample responses are illustrative; browser choices are advisory and unverified.</p></article>)}</section>
        <section className="panel"><h2>Simulation</h2><p>Illustrative what-if model; not measured evidence. No topic-specific frozen simulation is registered.</p><a href={`/synth?topic=${id}`}>Explore the synthesis model</a></section>
      </>}
      <section className="panel"><h2>Official legislative sources</h2><p>Not yet available for this topic. Official metadata has no reviewed topic/proposal binding; background references above do not establish legislative authority.</p><a href={topicStageUrl('published', id)}>Browse the separate official metadata lane</a></section>
      <section className="panel"><h2>Simulated experiences</h2><p>Not yet available for curated topic hubs. Simulated journals are excluded from the sample and human sections.</p></section>
      <section className="panel"><h2>Verified outcome evidence</h2><p>Not yet available. No verified implemented policy is registered. Sample outreach and synthetic measurements do not demonstrate an outcome.</p></section>
    </>}
  </main>;
}
export function TopicReturn() {
  const topic = topicById(new URLSearchParams(window.location.search).get('topic') ?? '');
  return topic ? <a className="topic-return" href={`/topics/${topic.id}`}>← {topic.label} topic hub</a> : null;
}
