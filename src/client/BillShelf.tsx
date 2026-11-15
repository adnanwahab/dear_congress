import { useEffect, useState } from 'react';
import { billCollection, type CatalogBill } from '../shared/bill-catalog';
import { readShelf, resolveShelf, SHELF_KEY, SHELF_MAX, type ShelfEntry } from './bill-shelf';

export function useBillShelf(search: string) {
  const [entries, setEntries] = useState<ShelfEntry[]>(() => {
    const linked = new URLSearchParams(search).get('shelf');
    if (linked !== null) return readShelf(linked);
    try { return readShelf(localStorage.getItem(SHELF_KEY)); } catch { return []; }
  });
  const [notice, setNotice] = useState('');
  useEffect(() => {
    const linked = new URLSearchParams(search).get('shelf');
    if (linked !== null) setEntries(readShelf(linked));
  }, [search]);
  function save(next: ShelfEntry[]) {
    setEntries(next);
    try { localStorage.setItem(SHELF_KEY, JSON.stringify(next)); setNotice('Shelf saved in this browser.'); }
    catch { setNotice('Browser storage unavailable. Shelf lasts for this page; use its link to keep it.'); }
    // Once viewing a shared shelf, edits retain a revision-bound history entry.
    if (new URLSearchParams(window.location.search).has('shelf')) {
      const url = new URL(window.location.href); url.searchParams.set('shelf', JSON.stringify(next));
      window.history.pushState(null, '', url); window.dispatchEvent(new window.PopStateEvent('popstate'));
    }
  }
  function add(bill: CatalogBill) {
    if (entries.some(e => e.id === bill.id)) return;
    if (entries.length >= SHELF_MAX) { setNotice('Shelf full. Remove a draft before adding another.'); return; }
    save([...entries, { id: bill.id, revision: bill.revision }]);
  }
  return { entries, notice, add, remove: (id: string) => save(entries.filter(e => e.id !== id)), clear: () => save([]) };
}
export function BillShelf({ shelf, search }: { shelf: ReturnType<typeof useBillShelf>; search: string }) {
  const linked = new URLSearchParams(search).get('shelf');
  const invalidLink = linked !== null && linked.trim() !== '[]' && readShelf(linked).length === 0;
  const params = new URLSearchParams(search); params.set('shelf', JSON.stringify(shelf.entries));
  return <section className="bill-shelf" id="research-shelf" aria-labelledby="shelf-title"
    onDragOver={e => { if (e.dataTransfer.types.includes('application/x-civic-catalog')) e.preventDefault(); }}
    onDrop={e => { e.preventDefault(); const bill = billCollection.bills.find(b => b.id === e.dataTransfer.getData('application/x-civic-catalog')); if (bill) shelf.add(bill); }}>
    <h2 id="shelf-title">Research shelf · compare drafts</h2>
    <p>Save up to {SHELF_MAX} draft concepts. Selection is local browser state, never a vote or endorsement. Use Add to shelf buttons or drag cards here. No animation is needed.</p>
    {invalidLink && <p role="alert">Shelf link unavailable: invalid catalog identities, revisions or count. Choose up to four drafts to create a new link.</p>}
    <p role="status">{shelf.entries.length} of {SHELF_MAX} saved. {shelf.entries.length === SHELF_MAX ? 'Shelf full; remove a draft to add another.' : 'Choose drafts to compare.'} {shelf.notice}</p>
    {!shelf.entries.length && <p>Your shelf is empty. Search or filter the catalog, then add a draft.</p>}
    {!!shelf.entries.length && <><a href={`/bills?${params}#research-shelf`}>Open link to this revision-bound shelf</a><p>This link reveals the selected draft IDs and revisions to anyone you share it with.</p><button onClick={shelf.clear}>Clear shelf</button></>}
    <div className="bill-shelf-grid">{shelf.entries.map(entry => {
      const bill = resolveShelf(entry, billCollection.bills);
      return <div className="bill-shelf-item" key={entry.id}><h3>{entry.id}: {bill?.title ?? 'Saved revision unavailable'}</h3>
        {bill ? <><p className="bill-category">Curated draft · eudaimonia-100 · {bill.category}</p><dl>{[['Purpose / problem', bill.problem], ['Proposed change · hypothetical', bill.proposedChange], ['Jurisdiction', bill.jurisdiction], ['Trade-offs / safeguards', bill.safeguards], ['Success metrics · proposed', bill.metrics]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl><p>Evidence not assessed; fiscal estimate unknown. No verified outcomes claimed.</p><a href={`/bills/${bill.id}?${search}`}>Inspect draft and provenance</a></> : <p role="alert">This saved text is missing or changed. No current text or evidence has been substituted. Remove and explicitly add the current draft to review it.</p>}
        <details><summary>Saved revision</summary><p>{entry.revision}</p></details><button onClick={() => shelf.remove(entry.id)}>Remove {entry.id} from shelf</button>
      </div>;
    })}</div>
  </section>;
}
