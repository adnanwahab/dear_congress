import { useState } from 'react';
import { billCollection, searchBills } from '../shared/bill-catalog';

export default function FeedConcepts() {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const results = searchBills(query, category);
  return <section className="panel" aria-label="Unreviewed concepts">
    <h2>Unreviewed concepts</h2>
    <p>Curated editorial drafts requiring legal, fiscal and evidence review. Not introduced bills, enacted law, citizen submissions or official endorsements. Costs and effects are unknown until assessed.</p>
    <label>Search unreviewed concepts<input type="search" value={query} onChange={e => setQuery(e.target.value)} /></label>
    <label>Concept category<select value={category} onChange={e => setCategory(e.target.value)}><option value="">All categories</option>{billCollection.categories.map(c => <option key={c}>{c}</option>)}</select></label>
    <button type="button" onClick={() => { setQuery(''); setCategory(''); }}>Reset concept filters</button>
    <p role="status">Unreviewed concepts: Showing {results.length} of {billCollection.bills.length}</p>
    {!results.length && <p>No unreviewed concepts match these filters.</p>}
    {results.map(b => <article key={b.id}><h3><a href={`/bills/${b.id}`}>{b.id}: {b.title}</a></h3><p>{b.proposedChange}</p><p>Unreviewed editorial concept · {b.category} · {b.jurisdiction}</p></article>)}
  </section>;
}
