import { useEffect, useState } from 'react';
import './place-costs.css';

type Metric = { value: string; period: string; scope: string; source: string; publisher: string };
export type CostPlace = { id: string; name: string; housing: Metric; transit: Metric };
const checked = '2026-11-17';
export const COST_PLACES: readonly CostPlace[] = [
  { id: 'chicago-il', name: 'Chicago, Illinois (city)', housing: { value: '$1,440 / month', period: '2020–2024', scope: 'Median gross rent; occupied rental housing, city boundary; pooled survey estimate, not asking rent.', source: 'https://www.census.gov/quickfacts/chicagocityillinois', publisher: 'U.S. Census Bureau · QuickFacts' }, transit: { value: '$2.50 / rail ride', period: 'Effective 2023-02-20', scope: 'CTA full fare paid from transit account; excludes O’Hare premium. Service area differs from city boundary.', source: 'https://www.transitchicago.com/fares/', publisher: 'Chicago Transit Authority' } },
  { id: 'new-york-ny', name: 'New York, New York (city)', housing: { value: '$1,821 / month', period: '2020–2024', scope: 'Median gross rent; occupied rental housing, city boundary; pooled survey estimate, not asking rent.', source: 'https://www.census.gov/quickfacts/newyorkcitynewyork', publisher: 'U.S. Census Bureau · QuickFacts' }, transit: { value: '$3 / subway ride', period: 'Effective date not captured', scope: 'MTA regular subway fare for most riders; service area differs from city boundary. Verify current conditions at source.', source: 'https://www.mta.info/fares-tolls', publisher: 'Metropolitan Transportation Authority' } },
];
export function PlaceCosts({ places = COST_PLACES, now = Date.now() }: { places?: readonly CostPlace[]; now?: number }) {
  const read = () => new URLSearchParams(window.location.search);
  const [params, setParams] = useState(read);
  useEffect(() => { const restore = () => setParams(read()); window.addEventListener('popstate', restore); return () => window.removeEventListener('popstate', restore); }, []);
  const query = params.get('placeSearch') ?? '';
  function update(key: string, value: string) {
    const next = read(); if (value || key === 'placeA' || key === 'placeB') next.set(key, value); else next.delete(key);
    window.history.pushState(null, '', `${window.location.pathname}${next.size ? '?' + next : ''}${window.location.hash}`); setParams(next);
  }
  const stale = now - Date.parse(checked + 'T00:00:00Z') > 30 * 86400000;
  const matches = places.filter(p => p.name.toLowerCase().includes(query.toLowerCase()));
  return <section className="place-costs" id="place-costs" aria-labelledby="place-cost-title">
    <h2 id="place-cost-title">Compare place-based living costs</h2>
    <p>Published context for discussing national proposals. Broad places only; no address, location detection or personal eligibility judgment. These metrics do not estimate a bill’s impact.</p>
    <label>Search places<input type="search" value={query} onChange={e => update('placeSearch', e.target.value)} /></label>
    <p role="status">{matches.length} places match. Search narrows choices; existing selections remain visible.</p>
    {!places.length && <p>No published place dataset is available.</p>}
    {!!places.length && !matches.length && <p>No places match. Clear search to see all choices.</p>}
    <button type="button" onClick={() => update('placeSearch', '')}>Clear place search</button>
    <div className="place-cost-columns">{['A', 'B'].map((side, index) => {
      const key = `place${side}`; const selected = params.get(key) ?? places[index]?.id ?? '';
      const place = places.find(p => p.id === selected);
      const options = places.filter(p => matches.includes(p) || p.id === selected);
      return <section key={side} aria-label={`Place ${side}`}><label>Place {side}<select value={selected} onChange={e => update(key, e.target.value)}><option value="">Choose a place</option>{!place && selected && <option value={selected}>Unavailable place</option>}{options.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
        {!place ? <p>Select an available place to inspect evidence.</p> : <><h3>{place.name}</h3>{(['housing', 'transit'] as const).map(topic => { const metric = place[topic]; return <section key={topic}><h4><a href={`/topics/${topic}`}>{topic === 'housing' ? 'Housing' : 'Transit'}</a></h4><strong>{metric.value}</strong><p>Evidence period: {metric.period}</p><p>{metric.scope}</p><a className="workflow-source-status" href={metric.source}>{metric.publisher} ↗</a><p>Source checked {checked} · {stale ? 'Stale source check — recheck before use' : 'Snapshot; source may change'}</p></section>; })}
        <h4><a href="/topics/childcare">Childcare</a></h4><p>Missing: no reviewed city-wide childcare price is included. County prices must not be substituted for a city average. Age, care setting and weekly/annual units require review.</p><a href="https://www.dol.gov/agencies/wb/topics/featured-childcare">U.S. Department of Labor · county childcare data (2008–2022) ↗</a></>}
      </section>;
    })}</div>
    <p>Comparability: housing uses the same survey period and monthly units. Transit uses different operators and effective-date coverage; do not rank cities from these fares. Childcare is unavailable. Years and units differ across categories; no total, inflation adjustment or personal budget is calculated.</p>
    <p>Hypothetical example: the same $100 monthly housing support could cover different shares of local rent. This is a discussion scenario, not a funded benefit or an eligibility estimate.</p>
    <a href="/bills">Browse draft concepts</a>
  </section>;
}
