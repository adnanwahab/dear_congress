import { SourceStatus } from './SourceStatus';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { DemoItem } from '../engine/demo';
import { filterProposals, ProposalSearch, proposalCardStyle } from './ProposalSearch';
import { TopicChip } from './TopicChip';
import { Skeleton } from './LoadingSkeleton';
import { runViewTransition } from './motion';

export function galleryItems(items: DemoItem[], query: string, topic: string, sort: string) {
  const result = filterProposals(items, query, topic);
  if (sort === 'title') result.sort((a, b) => a.title.localeCompare(b.title) || a.id.localeCompare(b.id));
  if (sort === 'topic') result.sort((a, b) => a.topic.localeCompare(b.topic) || a.title.localeCompare(b.title) || a.id.localeCompare(b.id));
  return result;
}

/** Freeze the whole result set, rather than only the hovered tile: neighbours also stay put. */
export function ProposalGallery({ items, loaded, failed, selected, busy, onSelect }: {
  items: DemoItem[]; loaded: boolean; failed: boolean; selected?: string; busy: boolean; onSelect: (item: DemoItem) => void;
}) {
  const [query, setQuery] = useState('');
  const [topic, setTopic] = useState('All topics');
  const [sort, setSort] = useState('source');
  const [layout, setLayout] = useState('mosaic');
  const [locked, setLocked] = useState(false);
  const pointers = useRef(new Set<number>());
  const hovering = useRef(false);
  const root = useRef<HTMLDivElement>(null);
  const desired = useMemo(() => galleryItems(items, query, topic, sort), [items, query, topic, sort]);
  const [shown, setShown] = useState(desired);
  const revision = useRef(0);
  const active = useRef<ViewTransition | null>(null);
  function lock() { revision.current++; active.current?.skipTransition(); setLocked(true); }
  function release() { setLocked(hovering.current || pointers.current.size > 0 || !!root.current?.contains(document.activeElement)); }
  useEffect(() => {
    const finish = (event: PointerEvent) => { pointers.current.delete(event.pointerId); release(); };
    window.addEventListener('pointerup', finish);
    window.addEventListener('pointercancel', finish);
    return () => { window.removeEventListener('pointerup', finish); window.removeEventListener('pointercancel', finish); };
  }, []);
  useEffect(() => {
    if (locked || shown === desired) return;
    const version = ++revision.current;
    queueMicrotask(() => {
      if (version !== revision.current) return;
      void runViewTransition(() => {
        if (version === revision.current) setShown(desired);
      }, 'filter', transition => { active.current = transition; });
    });
    return () => { revision.current++; active.current?.skipTransition(); };
  }, [desired, locked, shown]);
  return <>
    <ProposalSearch items={items} query={query} topic={topic} setQuery={setQuery} setTopic={setTopic} loaded={loaded} failed={failed} />
    <div className="gallery-controls">
      <label>Sort sample proposals<select value={sort} onChange={e => setSort(e.target.value)}><option value="source">Original order</option><option value="title">Title A–Z</option><option value="topic">Topic A–Z</option></select></label>
      <div role="group" aria-label="Proposal layout">{['mosaic', 'list'].map(mode => <button key={mode} type="button" className="outline" aria-pressed={layout === mode} onClick={() => { active.current?.skipTransition(); setLayout(mode); }}>{mode === 'mosaic' ? 'Mosaic' : 'Compact list'}</button>)}</div>
    </div>
    <p role="status">{locked && shown !== desired ? 'Results will update when you leave the proposals.' : ''}</p>
    <div ref={root} className={`entry-list proposal-gallery gallery-${layout}`} aria-label="Sample proposals"
      onPointerEnter={e => { if (e.pointerType !== 'touch') { hovering.current = true; lock(); } }}
      onPointerLeave={() => { hovering.current = false; release(); }}
      onPointerDown={e => { pointers.current.add(e.pointerId); lock(); }}
      onPointerUp={e => { pointers.current.delete(e.pointerId); release(); }}
      onPointerCancel={e => { pointers.current.delete(e.pointerId); release(); }}
      onFocusCapture={lock} onBlurCapture={e => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) release(); }}>
      {shown.map(i => <article className={`entry-item ${selected === i.id ? 'entry-selected' : ''}`} key={i.id} data-motion-proposal={i.id} data-motion-revision={i.title} style={proposalCardStyle('home', i.id)}>
        <SourceStatus kind="sample" /><div className="entry-source">{i.source} <TopicChip linked topic={i.topic} /></div><h3 data-motion-proposal={i.id} data-motion-revision={i.title}>{i.title}</h3><p>{i.jurisdiction} · Sample proposal</p><button className="outline" disabled={busy} onClick={() => onSelect(i)}>View proposal<span className="sr">: {i.title}</span></button>
      </article>)}
      {!loaded && !failed && <Skeleton kind="list" />}
    </div>
  </>;
}
