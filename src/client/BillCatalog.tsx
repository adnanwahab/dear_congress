import { useEffect, useState } from 'react';
import { billCollection, searchBills } from '../shared/bill-catalog';
import supplement from '../../content/bill-details/HFL-051.md' with { type: 'text' };
import { CivicHeader } from './CivicHeader';
import './bill-catalog.css';

/** Deliberately limited Markdown: headings, plain paragraphs and unordered lists.
 * Everything is a React text child; HTML, links and inline markup never execute. */
export function LegislativeMarkdown({ source }: { source: string }) {
  return <div className="bill-document">{source.split(/\n\n+/).map((block, i) => {
    if (block.startsWith('### ')) return <h4 key={i}>{block.slice(4)}</h4>;
    if (block.startsWith('## ')) return <h3 key={i}>{block.slice(3)}</h3>;
    if (block.startsWith('# ')) return <h2 key={i}>{block.slice(2)}</h2>;
    if (block.split('\n').every(line => line.startsWith('- '))) return <ul key={i}>{block.split('\n').map((line,j) => <li key={j}>{line.slice(2)}</li>)}</ul>;
    return <p key={i}>{block}</p>;
  })}</div>;
}
export default function BillCatalog() {
  const read = () => new URLSearchParams(window.location.search);
  const [params, setParams] = useState(read);
  useEffect(() => {
    const update = () => setParams(read());
    window.addEventListener('popstate', update);
    return () => window.removeEventListener('popstate', update);
  }, []);
  const query = params.get('q') ?? '';
  const category = params.get('category') ?? '';
  function update(q: string, c: string) {
    const next = new URLSearchParams();
    if (q) next.set('q', q);
    if (c) next.set('category', c);
    window.history.pushState(null, '', `${window.location.pathname}${next.size ? '?' + next : ''}`);
    setParams(next);
  }
  const id = window.location.pathname.replace(/\/+$/, '').split('/')[2];
  const bill = billCollection.bills.find(b => b.id === id);
  const results = searchBills(query, category);
  const back = `/bills${params.size ? '?' + params : ''}`;
  return <div className="bill-catalog"><CivicHeader stage="Draft catalog" dataLabel="CURATED DRAFTS" /><main id="main-content" tabIndex={-1}>
    <p className="bill-eyebrow">CIVIC SYNTHESIS · CURATED DRAFTS</p>
    {id ? bill ? <>
      <a href={back}>← All 100 proposals</a>
      <p className="bill-meta">{bill.id} · Proposed jurisdiction: {bill.jurisdiction} · Draft concept</p>
      <h1>{bill.title}</h1>
      <p className="bill-lead">{bill.proposedChange}</p>
      <dl className="bill-fields">{[
        ['Purpose / problem', bill.problem], ['Proposed change', bill.proposedChange],
        ['Proposed jurisdiction', bill.jurisdiction], ['Trade-offs and safeguards', bill.safeguards],
        ['Success metrics', bill.metrics], ['Flourishing dimensions', bill.dimensions],
        ['Research / evidence status', 'Not yet assessed — requires independent review'],
        ['Fiscal estimate', 'Unknown until assessed'],
        ['Status / provenance', 'Unreviewed editorial policy concept · eudaimonia-100 · version 1 · 2026-11-13'],
        ['Immutable catalog revision (SHA-256)', bill.revision],
      ].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
      <section className="bill-notice"><h2>Review before participation</h2><p>This draft is not introduced legislation, enacted law, a citizen submission or a ballot. Advisory participation is unavailable until authorized review pins an immutable revision. No votes or endorsements are claimed.</p><a href="/proposals/new?guided=1">Prepare your own private civic proposal</a><p>This opens the existing private workspace. Catalog text and identity are not submitted or transferred.</p></section>
      {bill.id === 'HFL-051' && <section aria-label="Expanded legislative discussion draft"><LegislativeMarkdown source={supplement} /></section>}
      <section><h2>Related draft concepts</h2><ul>{billCollection.bills.filter(b => b.category === bill.category && b.id !== bill.id).slice(0,3).map(b => <li key={b.id}><a href={`/bills/${b.id}`}>{b.id}: {b.title}</a></li>)}</ul></section>
    </> : <><h1>Draft concept not found</h1><a href="/bills">Browse all proposals</a></> : <>
      <h1>100 Bills for Human Flourishing</h1><p className="bill-lead">Searchable draft legislation catalog</p><p>100 proposals · 10 categories</p>
      <p className="bill-notice">Discussion drafts requiring legal, fiscal and evidence review. These are not introduced bills, enacted laws, official endorsements or public ballots.</p>
      <label htmlFor="bill-search">Search bills</label>
      <input id="bill-search" type="search" placeholder="Search bills…" value={query} onChange={e => update(e.target.value, category)} />
      <div className="bill-chips" role="group" aria-label="Filter by category"><button aria-pressed={!category} onClick={() => update(query, '')}>All categories</button>{billCollection.categories.map(c => <button key={c} aria-pressed={category === c} onClick={() => update(query, category === c ? '' : c)}>{c}</button>)}</div>
      <div className="bill-results"><p role="status" aria-live="polite">{results.length} {results.length === 1 ? 'proposal' : 'proposals'} found</p><button onClick={() => update('', '')}>Clear / reset</button></div>
      {!results.length && <p>No draft concepts match your search and category. Clear the filters to browse all 100 proposals.</p>}
      <div className="bill-grid">{results.map(b => <article key={b.id}><p className="bill-meta">{b.id} · {b.jurisdiction} · Draft concept</p><p className="bill-category">{b.category}</p><h2>{b.title}</h2><p>{b.proposedChange}</p><a href={`/bills/${b.id}${params.size ? '?' + params : ''}`} aria-label={`Explore proposal ${b.id}: ${b.title}`}>Explore proposal →</a></article>)}</div>
    </>}
  </main></div>;
}
