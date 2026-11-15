import type { CatalogBill } from '../shared/bill-catalog';
import { billDependencies, dependencyStatus, type BillDependency } from '../shared/bill-dependencies';

export function BillSubway({ bills, selected, select, params, edges = billDependencies, today = new Date().toISOString().slice(0, 10) }: {
  bills: readonly CatalogBill[]; selected: string; select: (id: string) => void; params: URLSearchParams;
  edges?: readonly BillDependency[]; today?: string;
}) {
  const bill = bills.find(b => b.id === selected);
  const routes = bill ? edges.filter(e => e.prerequisite === bill.id || e.dependent === bill.id) : [];
  const current = routes.filter(e => dependencyStatus(e, bills, today) === 'reviewed');
  const excluded = routes.length - current.length;
  function link(id: string) { return `/bills/${encodeURIComponent(id)}?${params}`; }
  return <section className="bill-subway" aria-labelledby="subway-title">
    <h2 id="subway-title">Policy dependency subway</h2>
    <p>Static, low-power explorer. Stations are draft concepts grouped by catalog category. Category membership is not a prerequisite, implementation order or shared agency.</p>
    <p>{!edges.length ? 'No reviewed dependency links are registered in this catalog. ' : 'Only current reviewed links are shown. '} Funding, administering agency and implementation order require independent source review. Missing routes mean unknown, not independent.</p>
    <a href="#bill-route">Skip stations to route explanation</a>
    {!bills.length && <p>No stations match the current filters. Clear / reset to browse the catalog.</p>}
    <div className="bill-station-lines">{[...new Set(bills.map(b => b.category))].map(category => <section key={category} aria-label={category}>
      <h3>{category}</h3><ul>{bills.filter(b => b.category === category).map(b => <li key={b.id}><button aria-pressed={selected === b.id} onClick={() => select(b.id)}>{b.id} · {b.title}</button></li>)}</ul>
    </section>)}</div>
    <section id="bill-route" tabIndex={-1} aria-labelledby="route-title"><h3 id="route-title">Route explanation · accessible text graph</h3>
      <p role="status">{bill ? `Selected station: ${bill.id} · ${bill.title}` : selected ? 'Selected station is outside the current filters or unavailable.' : 'Select a station to inspect its prerequisites.'}</p>
      {bill && <><a href={link(bill.id)}>Read {bill.id} draft and source identity</a>
        {!current.length && <p>No current reviewed prerequisites or dependent bills are available for this station.</p>}
        {!!excluded && <p>{excluded} route record(s) withheld: evidence is stale, unavailable, outside the filters or bound to a different catalog revision. Re-review is required.</p>}
        <ul>{current.map(edge => <li key={edge.id}>
          <a href={link(edge.prerequisite)}>{edge.prerequisite}</a> → <a href={link(edge.dependent)}>{edge.dependent}</a> · {edge.kind}
          <p>{edge.explanation}</p><a className="bill-source-chip" href={edge.source.url}>{edge.source.label}</a>
          <p>Reviewed {edge.source.reviewedOn} · review due {edge.source.reviewBy}. Review metadata is not proof of current legal status.</p>
        </li>)}</ul>
      </>}
    </section>
  </section>;
}
