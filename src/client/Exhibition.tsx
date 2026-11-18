import { useEffect, useRef, useState } from 'react';
import { billCollection, searchBills } from '../shared/bill-catalog';
import { exhibitDocument, PANEL_ROLES, panelText, readExhibit, type ExhibitPanel, type PanelRole } from '../shared/exhibition';
import { TOPICS } from '../shared/topics';

export function Exhibition() {
  const [url, setUrl] = useState(() => new URL(window.location.href));
  const [panels, setPanels] = useState<ExhibitPanel[]>([]);
  const [checks, setChecks] = useState([false, false, false]);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { const update = () => setUrl(new URL(window.location.href)); window.addEventListener('popstate', update); return () => window.removeEventListener('popstate', update); }, []);
  const preview = url.searchParams.get('exhibit') === 'preview';
  const exhibit = readExhibit(url.searchParams.get('panels'));
  const query = url.searchParams.get('q') ?? '', category = url.searchParams.get('category') ?? '';
  const results = searchBills(query, category);
  function navigate(next: URL) { window.history.pushState(null, '', next); setUrl(next); }
  function filter(key: string, value: string) { const next = new URL(url); value ? next.searchParams.set(key, value) : next.searchParams.delete(key); navigate(next); }
  function select(role: PanelRole, id: string) {
    const bill = billCollection.bills.find(b => b.id === id);
    setPanels(current => [...current.filter(p => p.role !== role), ...(bill ? [{ role, id, revision: bill.revision }] : [])]);
    setChecks([false, false, false]);
  }
  function download() {
    if (!exhibit) return;
    const objectUrl = URL.createObjectURL(new Blob([exhibitDocument(exhibit, window.location.origin)], { type: 'text/html;charset=utf-8' }));
    const link = document.createElement('a'); link.href = objectUrl; link.download = 'civic-exhibition.html'; link.click(); setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  }
  return <section aria-label="Civic exhibition"><h1 ref={heading} tabIndex={-1}>Civic exhibition {preview ? 'preview' : 'builder'}</h1>
    <p>Static / low-power experience. Use search, Tab and panel links; no animation or dragging required. All panels are hypothetical, unreviewed catalog concepts. Verified artifacts are not available in this catalog.</p>
    {preview ? exhibit ? <>
      <p>Read-only preview. Consent, accessibility and labeling are curator attestations, not independent verification.</p>
      <nav aria-label="Exhibit panels">{exhibit.panels.map(p => <a key={p.role} href={`#exhibit-${p.role}`}>{p.role} · </a>)}</nav>
      <button onClick={download}>Download self-contained read-only exhibit</button><p>The downloaded HTML can be hosted or embedded in a sandboxed iframe. It has no scripts or editing controls. Source links require connectivity.</p>
      {exhibit.panels.map(p => { const bill = billCollection.bills.find(b => b.id === p.id)!; return <article id={`exhibit-${p.role}`} tabIndex={0} key={p.role}><h2>{p.role}: {bill.title}</h2><strong>Hypothetical</strong><p>{panelText(p.role, bill)}</p><a href={`/bills/${bill.id}`}>Catalog source · {bill.id}</a><p>eudaimonia-100 · revision {p.revision}</p><p>Evidence not assessed; source freshness not verified.</p></article>; })}
    </> : <p role="alert">Exhibit unavailable: missing, invalid or stale source revisions. Rebuild from the current catalog; no source is silently substituted.</p> : <>
      <label>Search panel sources<input type="search" value={query} onChange={e => filter('q', e.target.value)} /></label>
      <label>Category<select value={category} onChange={e => filter('category', e.target.value)}><option value="">All categories</option>{billCollection.categories.map(c => <option key={c}>{c}</option>)}</select></label>
      <p role="status">{results.length} sources found · {panels.length} of 5 panels selected</p>
      {!results.length && <p>No sources match. Clear search and category to choose panels.</p>}
      <button onClick={() => { const next = new URL(url); next.searchParams.delete('q'); next.searchParams.delete('category'); navigate(next); }}>Clear source filters</button>
      {PANEL_ROLES.map(role => <fieldset key={role}><legend>{role} panel</legend><label>Choose {role} source<select value={panels.find(p => p.role === role)?.id ?? ''} onChange={e => select(role, e.target.value)}><option value="">Choose a catalog source</option>{billCollection.bills.filter(b => results.includes(b) || panels.some(p => p.role === role && p.id === b.id)).map(b => <option key={b.id} value={b.id}>{b.id} · {b.title}</option>)}</select></label>{panels.filter(p => p.role === role).map(p => <p key={p.id}>Hypothetical · <a href={`/bills/${p.id}`}>{p.id} source</a> · {panelText(role, billCollection.bills.find(b => b.id === p.id)!)}</p>)}</fieldset>)}
      <fieldset><legend>Required preview checks</legend>{['Consent: only public editorial catalog content; no personal testimony included.', 'Accessibility: reviewed panel text, source links and keyboard reading order.', 'Labeling: all concepts hypothetical; evidence and measured results unavailable.'].map((label, i) => <label style={{ display: 'block' }} key={label}><input style={{ width: 'auto', display: 'inline' }} type="checkbox" checked={checks[i]} onChange={e => setChecks(c => c.map((v, n) => n === i ? e.target.checked : v))} />{label}</label>)}</fieldset>
      <button disabled={panels.length !== 5 || !checks.every(Boolean)} onClick={() => { const next = new URL(url); next.searchParams.set('exhibit', 'preview'); next.searchParams.set('panels', JSON.stringify({ version: 1, panels })); navigate(next); heading.current?.focus(); }}>Publish local preview</button><p>Creates a shareable URL only; does not publish to a server or record votes. Anyone with the URL can read it. Checks reset when selection changes.</p>
      <nav aria-label="Related topic hubs">{TOPICS.map(t => <a key={t.id} href={`/topics/${t.id}`}>{t.label} · </a>)}</nav>
    </>}
    <p><a href="/bills?exhibit=builder">Start a new exhibit</a> · <a href="/bills">Draft catalog</a></p>
  </section>;
}
