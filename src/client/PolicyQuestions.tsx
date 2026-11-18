import { useEffect, useRef, useState } from 'react';
import type { CatalogBill } from '../shared/bill-catalog';

const branches = [
  { id: 'who', question: 'Who could this affect?', field: 'proposedChange', next: ['cost', 'implementation'] },
  { id: 'cost', question: 'What could it cost?', field: 'metrics', next: ['implementation', 'risk'] },
  { id: 'implementation', question: 'How would it be implemented?', field: 'jurisdiction', next: ['legal', 'cost'] },
  { id: 'legal', question: 'What is the legal basis?', field: 'jurisdiction', next: ['risk', 'who'] },
  { id: 'risk', question: 'What could go wrong?', field: 'safeguards', next: ['who', 'implementation'] },
] as const;

/** Read-only editorial questions. Never infer evidence, legal authority or cost. */
export function PolicyQuestions({ bill }: { bill: CatalogBill | null }) {
  const read = () => new URLSearchParams(window.location.search).get('question') ?? '';
  const [selected, setSelected] = useState(read);
  const [query, setQuery] = useState('');
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    const restore = () => { setSelected(read()); setQuery(''); };
    window.addEventListener('popstate', restore);
    return () => window.removeEventListener('popstate', restore);
  }, []);
  function choose(id: string) {
    const url = new URL(window.location.href);
    url.searchParams.set('question', id);
    window.history.pushState(null, '', url);
    setSelected(id);
    heading.current?.focus();
  }
  const branch = branches.find(b => b.id === selected);
  return <section className="bill-notice" aria-labelledby="policy-questions-title">
    <h2 id="policy-questions-title">Explore one practical question at a time</h2>
    <p>Static, low-power exploration. All answers describe a hypothetical editorial draft, not established effects or enacted law.</p>
    {!bill ? <p>No draft text is available. <a href="/bills">Search the draft catalog</a>.</p> : <>
      <label htmlFor="policy-question-search">Search questions</label>
      <input id="policy-question-search" type="search" value={query} onChange={e => setQuery(e.target.value)} />
      <nav className="bill-chips" aria-label="Policy questions">{branches.filter(b => b.question.toLowerCase().includes(query.toLowerCase())).map(b => <button key={b.id} aria-pressed={selected === b.id} onClick={() => choose(b.id)}>{b.question}</button>)}</nav>
      {!branches.some(b => b.question.toLowerCase().includes(query.toLowerCase())) && <p role="status">No questions match. <button onClick={() => setQuery('')}>Clear question search</button></p>}
      <h3 ref={heading} tabIndex={-1}>{branch?.question ?? 'Choose a question to begin'}</h3>
      {selected && !branch && <p>This question is unavailable. Choose any question above.</p>}
      {branch && <>
        <p><strong>Hypothetical · unreviewed catalog text</strong></p>
        <p>{branch.id === 'cost' ? 'Fiscal estimate unknown until assessed. The catalog supplies proposed success metrics, not a budget or a finding of cost effectiveness.' : branch.id === 'legal' ? 'Legal basis has not been assessed. The proposed jurisdiction below is an editorial suggestion, not verified statutory authority.' : branch.id === 'implementation' ? 'Implementation has not been assessed. The catalog suggests a jurisdiction; responsible agencies, timing and delivery arrangements require review.' : branch.id === 'risk' ? 'These are proposed safeguards, not evidence that risks have been resolved.' : 'The proposed change describes intended scope; eligibility and actual effects have not been independently assessed.'}</p>
        <a className="workflow-source-status" href={`#catalog-${branch.field}`}>Source: {bill.id} · eudaimonia-100 v1 · underlying {branch.field} text</a>
        <p>Evidence freshness: not checked. Catalog dated 2026-11-13; no verified current evidence is registered. Revision: {bill.revision}</p>
        <details><summary>View underlying catalog text</summary><p>{bill[branch.field]}</p></details>
        <p>Where next?</p><div className="bill-chips">{branch.next.map(id => <button key={id} onClick={() => choose(id)}>{branches.find(b => b.id === id)!.question}</button>)}</div>
      </>}
    </>}
  </section>;
}
