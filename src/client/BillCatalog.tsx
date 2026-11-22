import { CivicCrossword } from './CivicCrossword';
import { TownHallGame } from './TownHallGame';
import { BudgetShock } from './BudgetShock';
import { OutcomeMetricPuzzle } from './OutcomeMetricPuzzle';
import { MissingVoice } from './MissingVoice';
import { PolicyPinball } from './PolicyPinball';
import { GlossaryText } from './CivicGlossary';
import { GovernancePrism } from './GovernancePrism';
import { PolicyAtlas } from './PolicyAtlas';
import { BillVisualizations } from './BillVisualizations';
import { LawCarousel } from './LawCarousel';
import { useEffect, useMemo, useState } from 'react';
import { billCollection, searchBills } from '../shared/bill-catalog';
import { atlasBills } from '../shared/policy-atlas';
import { editorialGate } from '../shared/bill-editorial';
import { arrivalSpan, estimateArrivals, formatArrival } from '../shared/bill-eta';
import { ArrivalAssumptions, ArrivalLine, ArrivalPanel } from './ArrivalEstimate';
import { CatalogAdvisoryBallot } from './CatalogAdvisoryBallot';
import supplement from '../../content/bill-details/HFL-051.md' with { type: 'text' };
import { LegalAuthorityChecklist } from './LegalAuthorityChecklist';
import { PlaceCosts } from './PlaceCosts';
import { CivicConstellation } from './CivicConstellation';
import { PolicyQuestions } from './PolicyQuestions';
import { FinanceExplorer } from './FinanceExplorer';
import { Exhibition } from './Exhibition';
import { CivicHeader } from './CivicHeader';
import './bill-catalog.css';

/** Deliberately limited Markdown: headings, plain paragraphs and unordered lists.
 * Everything is a React text child; HTML, links and inline markup never execute. */
export function LegislativeMarkdown({ source }: { source: string }) {
  return <div className="bill-document">{source.split(/\n\n+/).map((block, i) => {
    if (block.startsWith('### ')) return <h4 key={i}>{block.slice(4)}</h4>;
    if (block.startsWith('## ')) return <h3 key={i}>{block.slice(3)}</h3>;
    if (block.startsWith('# ')) return <h2 key={i}>{block.slice(2)}</h2>;
    if (block.split('\n').every(line => line.startsWith('- '))) return <ul key={i}>{block.split('\n').map((line,j) => <li key={j}><GlossaryText text={line.slice(2)} /></li>)}</ul>;
    return <p key={i}><GlossaryText text={block} /></p>;
  })}</div>;
}
export default function BillCatalog({ masterDetail = false }: { masterDetail?: boolean }) {
  const read = () => new URLSearchParams(window.location.search);
  const [params, setParams] = useState(read);
  const [amendments, setAmendments] = useState<Record<string, string>>({});
  const [previewed, setPreviewed] = useState<Record<string, boolean>>({});
  const [amendmentStatus, setAmendmentStatus] = useState<Record<string, { state: 'loading' | 'saved' | 'saving' | 'error'; message: string }>>({});
  // Planning estimates only: computed from the review ledger for today's date; no votes or records are read or written.
  const arrivals = useMemo(() => estimateArrivals(), []);
  const span = arrivalSpan(arrivals.values());
  useEffect(() => {
    const update = () => setParams(read());
    window.addEventListener('popstate', update);
    return () => window.removeEventListener('popstate', update);
  }, []);
  const query = params.get('q') ?? '';
  const category = params.get('category') ?? '';
  function update(q: string, c: string) {
    const next = new URLSearchParams(window.location.search);
    if (q) next.set('q', q); else next.delete('q');
    if (c) next.set('category', c); else next.delete('category');
    window.history.pushState(null, '', `${window.location.pathname}${next.size ? '?' + next : ''}`);
    setParams(next);
  }
  function changeAtlas(key: string, value: string) {
    const next = new URLSearchParams(window.location.search);
    if (value) next.set(key, value); else next.delete(key);
    window.history.pushState(null, '', `${window.location.pathname}${next.size ? '?' + next : ''}`);
    setParams(next);
  }
  const id = window.location.pathname.replace(/\/+$/, '').split('/')[2];
  const bill = billCollection.bills.find(b => b.id === id);
  const gate = bill ? editorialGate(bill) : undefined;
  const results = atlasBills(searchBills(query, category), params);
  const back = `/bills${params.size ? '?' + params : ''}`;
  const selectedBill = masterDetail ? billCollection.bills.find(item => item.id === params.get('bill')) : undefined;
  useEffect(() => {
    if (!selectedBill) return;
    const billId = selectedBill.id;
    let active = true;
    setAmendmentStatus(current => ({ ...current, [billId]: { state: 'loading', message: 'Loading your private draft…' } }));
    fetch(`/api/catalog-bills/${encodeURIComponent(billId)}/amendment-draft`, { credentials: 'same-origin' })
      .then(async response => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || `Draft load failed (${response.status})`);
        if (!active || data.revision !== selectedBill.revision) return;
        if (data.draft) setAmendments(current => ({ ...current, [billId]: data.draft.text }));
        setAmendmentStatus(current => ({ ...current, [billId]: { state: 'saved', message: data.draft ? `Private draft loaded · last saved ${new Date(data.draft.updatedAt).toLocaleString()}` : 'No saved private draft for this bill yet.' } }));
      })
      .catch(error => {
        if (active) setAmendmentStatus(current => ({ ...current, [billId]: { state: 'error', message: error instanceof Error ? error.message : 'Could not load your private draft.' } }));
      });
    return () => { active = false; };
  }, [selectedBill?.id, selectedBill?.revision]);
  async function saveAmendment(billId: string) {
    const text = amendments[billId]?.trim();
    const target = billCollection.bills.find(item => item.id === billId);
    if (!target || !text) return;
    setAmendmentStatus(current => ({ ...current, [billId]: { state: 'saving', message: 'Saving private draft…' } }));
    try {
      const response = await fetch(`/api/catalog-bills/${encodeURIComponent(billId)}/amendment-draft`, {
        method: 'PUT', credentials: 'same-origin', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ revision: target.revision, text, requestId: crypto.randomUUID() }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || `Draft save failed (${response.status})`);
      if (data.saved !== true || !data.receipt?.id) throw new Error('The server did not confirm this draft save.');
      setAmendmentStatus(current => ({ ...current, [billId]: { state: 'saved', message: `Private draft saved to the database · receipt ${data.receipt.id}` } }));
    } catch (error) {
      setAmendmentStatus(current => ({ ...current, [billId]: { state: 'error', message: error instanceof Error ? error.message : 'Could not save your private draft.' } }));
    }
  }
  if (masterDetail) return <div className="bill-catalog votes-explorer"><header className="votes-top"><a href="/" aria-label="Civic Synthesis home">✳ Civic Synthesis</a><nav><a href="/votes" aria-current="page">Explore {billCollection.bills.length} Bills</a><a href="/account" aria-label="My activity">My activity</a></nav></header><main><div className="votes-master-detail"><nav className="votes-list" aria-label="Bill proposals">{results.map(b => <a key={b.id} href={`/votes?bill=${encodeURIComponent(b.id)}${query ? `&q=${encodeURIComponent(query)}` : ''}${category ? `&category=${encodeURIComponent(category)}` : ''}`} onClick={event => { event.preventDefault(); const next = new URLSearchParams(params); next.set('bill', b.id); window.history.pushState(null, '', `/votes?${next}`); setParams(next); }} aria-current={params.get('bill') === b.id ? 'true' : undefined}><small>{b.category} · {b.id}</small><strong>{b.title}</strong>{arrivals.get(b.id) && <small className="votes-eta">Est. arrival {formatArrival(arrivals.get(b.id)!.expected)}</small>}</a>)}</nav><article className="votes-detail">{selectedBill ? <><p className="bill-eyebrow">PROPOSAL · ILLUSTRATIVE / NON-BINDING · {selectedBill.id}</p><h2>{selectedBill.title}</h2><p className="bill-lead">{selectedBill.proposedChange}</p><ArrivalLine estimate={arrivals.get(selectedBill.id)} className="votes-eta-line" /><h3>What would this change?</h3><p>{selectedBill.problem}</p><details><summary>How could this work?</summary><p>{selectedBill.safeguards}</p></details><details><summary>How could we evaluate it?</summary><p>{selectedBill.metrics} These are proposed metrics, not measured results.</p></details><p className="votes-simulation-note">◉ &nbsp;Interactive before/after simulation — planned</p><details><summary>Evidence, costs, and jurisdiction</summary><p>Evidence has not been independently assessed. Fiscal estimate: unknown. Proposed jurisdiction: {selectedBill.jurisdiction}. Legal authority is unverified.</p></details><ArrivalPanel estimate={arrivals.get(selectedBill.id)} headingLevel={3} /><CatalogAdvisoryBallot key={selectedBill.id} billId={selectedBill.id} revision={selectedBill.revision} /><section className="votes-amendment"><h3>Help improve this bill</h3><p>What would you change? Suggestions are welcome regardless of your choice.</p><label htmlFor={`amendment-${selectedBill.id}`}>Proposed amendment</label><textarea id={`amendment-${selectedBill.id}`} rows={4} maxLength={10000} value={amendments[selectedBill.id] ?? ""} onChange={event => { setAmendments(current => ({ ...current, [selectedBill.id]: event.target.value })); setAmendmentStatus(current => ({ ...current, [selectedBill.id]: { state: 'error', message: 'Unsaved changes' } })); }} placeholder="Describe a change you would make…" /><button type="button" disabled={!amendments[selectedBill.id]?.trim()} onClick={() => setPreviewed(current => ({ ...current, [selectedBill.id]: true }))}>Preview amendment</button><button type="button" disabled={!amendments[selectedBill.id]?.trim() || amendmentStatus[selectedBill.id]?.state === 'saving'} onClick={() => saveAmendment(selectedBill.id)}>{amendmentStatus[selectedBill.id]?.state === 'saving' ? 'Saving…' : 'Save private draft'}</button><p role="status" aria-live="polite">{amendmentStatus[selectedBill.id]?.message}</p>{previewed[selectedBill.id] && <div className="amendment-preview"><strong>Your proposed amendment</strong><p>{amendments[selectedBill.id]}</p><small>Private draft, stored for this browser. Not submitted for review or a vote.</small></div>}<p><a href={`/bills/${selectedBill.id}`}>Review draft status and sources →</a></p></section></> : <><p className="bill-eyebrow">SELECT A PROPOSAL</p><h2>Browse ideas for a better world.</h2><p>Choose a title to read its plain-language summary, possible measures, evidence status, and review gate.</p></>}</article></div></main></div>;
  return <div className="bill-catalog"><CivicHeader stage="Draft catalog" dataLabel="CURATED DRAFTS" /><main id="main-content" tabIndex={-1}>{params.has('exhibit') ? <Exhibition /> : <><BudgetShock /><OutcomeMetricPuzzle /><MissingVoice /><PolicyPinball />
    <CivicCrossword /><p className="bill-eyebrow">CIVIC SYNTHESIS · CURATED DRAFTS</p>
    {id ? bill ? <>
      <a href={back}>← All {billCollection.bills.length} proposals</a>
      <p className="bill-meta">{bill.id} · Proposed jurisdiction: {bill.jurisdiction} · Draft concept</p>
      <h1>{bill.title}</h1>
      <p className="bill-lead">{bill.proposedChange}</p>
      <GovernancePrism bill={bill} />
      <PolicyQuestions key={bill.id} bill={bill} />
      <dl className="bill-fields">{[
        ['Purpose / problem', bill.problem], ['Proposed change', bill.proposedChange],
        ['Proposed jurisdiction', bill.jurisdiction], ['Trade-offs and safeguards', bill.safeguards],
        ['Success metrics', bill.metrics], ['Flourishing dimensions', bill.dimensions],
        ['Research / evidence status', 'Not yet assessed — requires independent review'],
        ['Fiscal estimate', 'Unknown until assessed'],
        ['Status / provenance', `Unreviewed editorial policy concept · ${billCollection.metadata.collection_id} · version ${billCollection.metadata.version} · ${billCollection.metadata.date}`],
        ['Immutable catalog revision (SHA-256)', bill.revision],
      ].map(([label, value]) => <div id={({'Proposed change': 'catalog-proposedChange', 'Proposed jurisdiction': 'catalog-jurisdiction', 'Trade-offs and safeguards': 'catalog-safeguards', 'Success metrics': 'catalog-metrics'} as Record<string, string>)[label!]} key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
      <LegalAuthorityChecklist bill={bill} />
      <section className="bill-notice" aria-label="Human editorial review gate"><h2>Human editorial review gate</h2>
        <p>{gate?.reviewReady ? 'Editorial record complete; advisory publication remains unavailable.' : 'Human review incomplete. Advisory publication unavailable: this revision is blocked from publication.'}</p>
        <ul>{gate?.blockers.map(reason => <li key={reason}>{reason}</li>)}</ul>
        <p>Reviews cover this catalog revision only. Separate legislative supplements require their own review. Review readiness does not establish official status, verified evidence or assessed cost.</p>
      </section>
      <ArrivalPanel estimate={arrivals.get(bill.id)} />
      <section className="bill-notice"><h2>Review before participation</h2><p>This draft is not introduced legislation, enacted law, a citizen submission or a ballot. Advisory participation is unavailable until authorized review pins an immutable revision. No votes or endorsements are claimed.</p><a href="/proposals/new?guided=1">Prepare your own private civic proposal</a><p>This opens the existing private workspace. Catalog text and identity are not submitted or transferred.</p></section>
      {bill.id === 'HFL-051' && <section aria-label="Expanded legislative discussion draft"><LegislativeMarkdown source={supplement} /></section>}
      <section><h2>Related draft concepts</h2><ul>{billCollection.bills.filter(b => b.category === bill.category && b.id !== bill.id).slice(0,3).map(b => <li key={b.id}><a href={`/bills/${b.id}`}>{b.id}: {b.title}</a></li>)}</ul></section>
    </> : <><h1>Draft concept not found</h1><a href="/bills">Browse all proposals</a></> : <>
      <p><a href="/bills?finance=1#finance-title">Explore public finance · hypothetical example</a></p>
      {params.get('finance') === '1' && <FinanceExplorer />}
      <p><a href="/bills?exhibit=builder">Build a civic exhibition</a></p>
      <h1>{billCollection.metadata.collection_title}</h1><p><a href="/topics">Explore civic problem neighborhoods</a> · Separate illustrative needs and policy catalog; no reviewed binding to these draft bills.</p><p className="bill-lead">Searchable draft legislation catalog</p><p>{billCollection.bills.length} proposals · {billCollection.categories.length} categories</p>
      {span.first && <p className="bill-eta-summary">Estimated arrivals: <time dateTime={span.first}>{formatArrival(span.first)}</time> to <time dateTime={span.last}>{formatArrival(span.last)}</time> (expected), if human review starts next Monday.</p>}
      <ArrivalAssumptions id="arrival-estimates" />
      <p className="bill-notice">Discussion drafts requiring legal, fiscal and evidence review. These are not introduced bills, enacted laws, official endorsements or public ballots.</p>
      <LawCarousel bills={results} />
      <BillVisualizations bills={results} />
      <PolicyAtlas params={params} change={changeAtlas} />
      <label htmlFor="bill-search">Search bills</label>
      <input id="bill-search" type="search" placeholder="Search bills…" value={query} onChange={e => update(e.target.value, category)} />
      <div className="bill-chips" role="group" aria-label="Filter by category"><button aria-pressed={!category} onClick={() => update(query, '')}>All categories</button>{billCollection.categories.map(c => <button key={c} aria-pressed={category === c} onClick={() => update(query, category === c ? '' : c)}>{c}</button>)}</div>
      <div className="bill-results"><p role="status" aria-live="polite">{results.length} {results.length === 1 ? 'proposal' : 'proposals'} found</p><button onClick={() => { window.history.pushState(null, '', window.location.pathname); setParams(new URLSearchParams()); }}>Clear / reset</button></div>
      {!results.length && <p>No draft concepts match your search, category and geographic scope. Clear the filters to browse all {billCollection.bills.length} proposals.</p>}
      <CivicConstellation query={query} category={category} topic={params.get('topic') ?? ''} />
      <TownHallGame />
      <div className="bill-grid">{results.map(b => <article key={b.id}><p className="bill-meta">{b.id} · {b.jurisdiction} · Draft concept · Legal authority: unverified</p><p>Publish gate: blocked · Human review required</p><ArrivalLine estimate={arrivals.get(b.id)} /><p className="bill-category">{b.category}</p><h2>{b.title}</h2><p>{b.proposedChange}</p><a href={`/bills/${b.id}${params.size ? '?' + params : ''}`} aria-label={`Explore proposal ${b.id}: ${b.title}`}>Explore proposal →</a></article>)}</div>
      <details><summary>Compare local cost context</summary><PlaceCosts /></details>
    </>}
    {id && <TownHallGame />}</>}
  </main></div>;
}
