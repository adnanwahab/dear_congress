import { useRef } from 'react';
import type { DemoItem } from '../engine/demo';

export function filterProposals(items: DemoItem[], query: string, topic: string) {
  const needle = query.trim().toLowerCase();
  return items.filter(i => (topic === 'All topics' || i.topic === topic)
    && [i.title, i.summary, i.source, i.jurisdiction].some(value => value.toLowerCase().includes(needle)));
}

export function ProposalSearch({ items, query, topic, setQuery, setTopic, loaded, failed = false }: {
  items: DemoItem[]; query: string; topic: string; setQuery: (value: string) => void;
  setTopic: (value: string) => void; loaded: boolean; failed?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const topics = ['All topics', ...new Set(items.map(i => i.topic))];
  const filtered = filterProposals(items, query, topic);
  function reset() { setQuery(''); setTopic('All topics'); input.current?.focus(); }
  return <div className="proposal-search">
    <form className="feed-controls" role="search" aria-label="Sample proposal search" onSubmit={e => e.preventDefault()}>
      <label>Search sample proposals<input ref={input} type="search" value={query} placeholder="Search proposals…" onChange={e => setQuery(e.target.value)} onKeyDown={e => { if (e.key === 'Escape') { e.preventDefault(); setQuery(''); } }} /></label>
      <label>Filter by topic<select value={topic} onChange={e => setTopic(e.target.value)}>{topics.map(t => <option key={t}>{t}</option>)}</select></label>
      <button type="button" className="outline" disabled={!query && topic === 'All topics'} onClick={reset}>Clear all filters</button>
    </form>
    <p>Search titles, summaries, sources and jurisdictions in this sample list.</p>
    <p role="status" aria-live="polite">{loaded ? `Showing ${filtered.length} of ${items.length} proposals · Sample data` : failed ? 'Sample proposals unavailable. Use the retry control above.' : 'Loading sample proposals…'}</p>
    {loaded && !filtered.length && <div className="empty-feed"><p>{items.length ? 'No proposals match your search and topic. Try a broader term or reset filters.' : 'No sample proposals are available in the loaded list.'}</p><button type="button" className="outline" onClick={reset}>Reset filters</button></div>}
  </div>;
}
