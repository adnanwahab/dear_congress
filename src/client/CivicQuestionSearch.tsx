import { useEffect, useId, useState } from 'react';
import { billCollection } from '../shared/bill-catalog';
import { NEEDS } from '../engine/catalog';
import { DEMO_ITEMS } from '../engine/demo';
import { metadataFreshness, type BillObservation } from '../shared/legislation';
import { freshness, sourceUrl } from './ProposalProvenance';
import { TopicChip } from './TopicChip';

export const SEARCH_TYPES = ['All types', 'Bills', 'Needs', 'Drafts', 'Official sources', 'Outcomes'] as const;
export interface CivicMatch { key: string; type: string; title: string; text: string; href: string; status: string; topic?: string }
export function civicIndex(official: BillObservation[], now = Date.now()): CivicMatch[] {
  return [
    ...billCollection.bills.map(b => ({ key: `eudaimonia-100:${b.id}:${b.revision}`, type: 'Bills', title: `${b.id}: ${b.title}`, text: `${b.problem} ${b.proposedChange} ${b.category} ${b.jurisdiction} ${b.safeguards} ${b.metrics} ${b.dimensions}`, href: `/bills/${b.id}`, status: `Hypothetical editorial concept · version 1 · 2026-11-13 · evidence not assessed · revision ${b.revision}` })),
    ...NEEDS.map(n => ({ key: `need:${n.id}`, type: 'Needs', title: n.label, text: `${n.goal} ${n.metric} ${n.keywords.join(' ')}`, href: `/needs?need=${encodeURIComponent(n.id)}`, status: 'Illustrative catalog goal, not a measured condition · freshness unknown' })),
    ...DEMO_ITEMS.flatMap(i => [
      { key: `sample-draft:${i.id}`, type: 'Drafts', title: i.title, text: i.summary, href: `/draft?proposal=${i.id}`, topic: i.topic, status: `Hypothetical sample scenario · ${freshness(i, now)}` },
      { key: `sample-outcome:${i.id}`, type: 'Outcomes', title: `${i.title} — outcome coverage`, text: i.summary, href: `/outcomes?proposal=${i.id}`, topic: i.topic, status: 'Hypothetical walkthrough only · no verified implemented policy or measured outcome · freshness unknown' },
      ...(sourceUrl(i) ? [{ key: `background:${i.id}`, type: 'Official sources', title: i.background?.name ?? i.source, text: `${i.topic} ${i.background?.scope ?? ''}`, href: sourceUrl(i)!, topic: i.topic, status: `Background only; does not substantiate the scenario · ${freshness(i, now)}` }] : []),
    ]),
    ...official.map(b => ({ key: `congress:${b.id}:${b.sourceHash}`, type: 'Bills', title: `${b.type.toUpperCase()} ${b.number}, Congress ${b.congress}: ${b.title}`, text: b.latestAction.text, href: b.sourceUrl, status: `Official metadata only; current legal status unverified · ${metadataFreshness(b, now)} · checked ${b.checkedAt} · SHA-256 ${b.sourceHash}` })),
  ];
}
const stopWords = new Set('a an the what which where when why how can could would should do does did is are was were i we my our to for of in on about me please'.split(' '));
export function searchCivic(index: CivicMatch[], question: string, type: string) {
  const terms = (question.toLowerCase().match(/[\p{L}\p{N}-]+/gu) ?? []).filter(t => !stopWords.has(t));
  if (!terms.length) return [];
  return index.filter(r => (type === 'All types' || r.type === type) && terms.every(t => `${r.title} ${r.text}`.toLowerCase().includes(t)));
}
export function CivicQuestionSearch() {
  const [open, setOpen] = useState(() => new URLSearchParams(window.location.search).has('ask'));
  useEffect(() => {
    const restore = () => { if (new URLSearchParams(window.location.search).has('ask')) setOpen(true); };
    window.addEventListener('popstate', restore);
    return () => window.removeEventListener('popstate', restore);
  }, []);
  return <details open={open} onToggle={e => setOpen(e.currentTarget.open)}><summary>Ask a civic question · search across sources</summary>{open && <QuestionSearch />}</details>;
}
function QuestionSearch() {
  const id = useId();
  const read = () => new URLSearchParams(window.location.search);
  const [params, setParams] = useState(read);
  const [question, setQuestion] = useState(() => read().get('ask') ?? '');
  const [official, setOfficial] = useState<BillObservation[]>([]);
  const [coverage, setCoverage] = useState('Official bill metadata loading…');
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const restore = () => { const next = read(); setParams(next); setQuestion(next.get('ask') ?? ''); };
    window.addEventListener('popstate', restore);
    return () => window.removeEventListener('popstate', restore);
  }, []);
  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const response = await fetch('/api/legislation');
        if (!response.ok) throw new Error();
        const data = await response.json() as { bills: BillObservation[] };
        if (!Array.isArray(data.bills)) throw new Error();
        if (active) { setOfficial(data.bills); setCoverage(`${data.bills.length} official bill metadata records loaded; coverage incomplete.`); }
      } catch { if (active) { setOfficial(previous => previous.map(b => ({ ...b, refreshFailed: true }))); setCoverage('Official bill metadata unavailable; results are incomplete.'); } }
      if (active) setNow(Date.now());
    };
    void load(); const timer = setInterval(() => void load(), 60000);
    return () => { active = false; clearInterval(timer); };
  }, []);
  const selectedType = params.get('askType') ?? 'All types';
  const type = SEARCH_TYPES.includes(selectedType as typeof SEARCH_TYPES[number]) ? selectedType : 'All types';
  const query = params.get('ask') ?? '';
  const results = searchCivic(civicIndex(official, now), query, type);
  function commit(q: string, t: string) {
    const url = new URL(window.location.href);
    if (q) url.searchParams.set('ask', q); else url.searchParams.delete('ask');
    if (t !== 'All types') url.searchParams.set('askType', t); else url.searchParams.delete('askType');
    window.history.pushState(null, '', url); setParams(new URLSearchParams(url.search));
  }
  return <section className="panel" aria-labelledby={`${id}-title`} style={{ overflowWrap: 'anywhere' }}>
    <h2 id={`${id}-title`}>Ask a civic question</h2>
    <p>Search source records by question or keywords. Matches are references, not an answer or evidence of effectiveness. Try “How can childcare cost less?” or a bill ID. All search controls and results work without animation or a graphics engine.</p>
    <form role="search" aria-label="Search across civic sources" onSubmit={e => { e.preventDefault(); commit(question, type); }}>
      <label htmlFor={`${id}-question`}>Your civic question</label>
      <input id={`${id}-question`} type="search" value={question} onChange={e => setQuestion(e.target.value)} />
      <label htmlFor={`${id}-type`}>Source type</label>
      <select id={`${id}-type`} value={type} onChange={e => commit(question, e.target.value)}>{SEARCH_TYPES.map(t => <option key={t}>{t}</option>)}</select>
      <button type="submit">Search sources</button>
      <button type="button" onClick={() => { setQuestion(''); commit('', 'All types'); document.getElementById(`${id}-question`)?.focus(); }}>Clear question</button>
    </form>
    <p>{coverage} Private drafts and personal journals are excluded. Citizen submissions are not indexed. No verified outcome dataset is registered.</p>
    <p role="status" aria-live="polite">{query ? `${results.length} source matches` : 'Enter a question to search.'}</p>
    {query && !results.length && <p>No supported answer found in the indexed records. Try fewer keywords or another source type. Missing matches do not establish that a policy or evidence does not exist.</p>}
    <ul>{results.map(r => <li key={r.key}><article><h3><a href={r.href}>{r.title}</a></h3><p>{r.type} {r.topic && <TopicChip topic={r.topic} />}</p><p>{r.text}</p><p>{r.status}</p><small>Source identity: {r.key}</small></article></li>)}</ul>
  </section>;
}
