import { useEffect, useId, useRef, useState, type CSSProperties } from 'react';
import { flushSync } from 'react-dom';
import type { DemoItem } from '../engine/demo';

/** Separate from proposal-title / plan-item identities; encode every code point. */
export function proposalCardStyle(scope: string, id: string): CSSProperties {
  return { viewTransitionName: `proposal-card-${Array.from(scope + ':' + id, c => c.codePointAt(0)!.toString(16)).join('-')}`, viewTransitionClass: 'proposal-card' } as CSSProperties;
}
const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

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
  const identity = useId().replace(/[^a-zA-Z0-9-]/g, '');
  const [text, setText] = useState(query);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const active = useRef<ViewTransition | null>(null);
  const revision = useRef(0);
  useEffect(() => () => {
    clearTimeout(timer.current);
    revision.current++;
    active.current?.skipTransition();
  }, []);
  function update(nextQuery: string, nextTopic: string) {
    clearTimeout(timer.current);
    const current = ++revision.current;
    active.current?.skipTransition();
    const commit = () => { if (current === revision.current) flushSync(() => { setQuery(nextQuery); setTopic(nextTopic); }); };
    if (reducedMotion() || typeof document.startViewTransition !== 'function') { commit(); return; }
    const transition = document.startViewTransition({ update: commit, types: ['filter'] });
    active.current = transition;
    void transition.ready.catch(() => {});
  }
  function search(value: string) {
    setText(value);
    clearTimeout(timer.current);
    // Invalidate an older snapshot callback immediately, before the debounce.
    revision.current++;
    active.current?.skipTransition();
    if (reducedMotion()) update(value, topic);
    else timer.current = setTimeout(() => update(value, topic), 120);
  }
  const topics = ['All topics', ...new Set(items.map(i => i.topic))];
  const filtered = filterProposals(items, query, topic);
  function reset() { setText(''); update('', 'All topics'); input.current?.focus(); }
  return <div className="proposal-search">
    <form className="feed-controls" role="search" aria-label="Sample proposal search" onSubmit={e => e.preventDefault()}>
      <label>Search sample proposals<input ref={input} type="search" style={{ viewTransitionClass: 'filter-control', viewTransitionName: `proposal-search-${identity}` }} value={text} placeholder="Search proposals…" onChange={e => search(e.target.value)} onKeyDown={e => { if (e.key === 'Escape') { e.preventDefault(); setText(''); update('', topic); } }} /></label>
      <label>Filter by topic<select style={{ viewTransitionClass: 'filter-control', viewTransitionName: `proposal-topic-${identity}` }} value={topic} onChange={e => update(text, e.target.value)}>{topics.map(t => <option key={t}>{t}</option>)}</select></label>
      <button type="button" className="outline" disabled={!text && !query && topic === 'All topics'} onClick={reset}>Clear all filters</button>
    </form>
    <p>Search titles, summaries, sources and jurisdictions in this sample list.</p>
    <p style={{ viewTransitionName: `proposal-count-${identity}` }} role="status" aria-live="polite">{loaded ? `Showing ${filtered.length} of ${items.length} proposals · Sample data` : failed ? 'Sample proposals unavailable. Use the retry control above.' : 'Loading sample proposals…'}</p>
    {loaded && !filtered.length && <div className="empty-feed"><p>{items.length ? 'No proposals match your search and topic. Try a broader term or reset filters.' : 'No sample proposals are available in the loaded list.'}</p><button type="button" className="outline" onClick={reset}>Reset filters</button></div>}
  </div>;
}
