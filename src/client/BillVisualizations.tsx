import { useState, type KeyboardEvent } from 'react';
import { billCollection, type CatalogBill } from '../shared/bill-catalog';
import {
  billDimensions, billRelatedness, billsForFocus, dimensionCount,
  flourishingDimensions, sharedDimensionCount,
} from '../shared/bill-visualization';
import './bill-visualization.css';

type View = 'constellation' | 'connections' | 'heatmap';
type Focus = { dimension: string; category?: string } | null;

const fullCatalog = billCollection.bills;
const categories = billCollection.categories;
const dimensions = flourishingDimensions(fullCatalog);
const categoryNames = ['Security', 'Housing', 'Health', 'Learning', 'Work', 'Belonging', 'Justice', 'Democracy', 'Technology', 'Nature', 'Global'];
const categoryColors = ['#9de8b3', '#ffce87', '#ec98ae', '#b9a2fc', '#80bedf', '#ffb987', '#f29fcd', '#88d8d2', '#a7eaff', '#afd482', '#9eb8fc'];
const dimensionNames: Record<string, string> = {
  'Economic security': 'Security', Agency: 'Agency', Health: 'Health', Time: 'Time',
  Justice: 'Justice', Environment: 'Nature', Relationships: 'Connection', Education: 'Learning',
};
const dimensionColors = ['#88f0c6', '#ffca88', '#d9a6f9', '#81d8ef', '#a2e39a', '#f4a6bf', '#fff0ab', '#9eb8fc'];

function categoryIndex(category: string) { return Math.max(0, categories.indexOf(category)); }
function position(bill: CatalogBill) {
  const category = categoryIndex(bill.category);
  const slot = fullCatalog.filter(b => b.category === bill.category).findIndex(b => b.id === bill.id);
  const angle = -Math.PI / 2 + (slot / 10) * Math.PI * 2;
  const radius = slot % 2 ? 74 : 66;
  return {
    x: 84 + (category % 6) * 166 + Math.cos(angle) * (radius - 17),
    y: 170 + Math.floor(category / 6) * 287 + Math.sin(angle) * (radius - 17),
  };
}
function dimensionPosition(index: number) {
  const angle = index / dimensions.length * Math.PI * 2 - Math.PI / 2;
  return { x: 500 + Math.cos(angle) * 202, y: 282 + Math.sin(angle) * 198 };
}
function isActivation(event: KeyboardEvent) {
  return event.key === 'Enter' || event.key === ' ';
}

export function BillVisualizations({ bills = fullCatalog }: { bills?: readonly CatalogBill[] }) {
  const [view, setView] = useState<View>('constellation');
  const [selectedId, setSelectedId] = useState('HFL-051');
  const [focus, setFocus] = useState<Focus>(null);
  const visibleIds = new Set(bills.map(b => b.id));
  const matches = billsForFocus(bills, focus);
  const matchingIds = new Set(matches.map(b => b.id));
  const spotlight = matches.find(b => b.id === selectedId) ?? matches[0];
  const connected = spotlight
    ? fullCatalog.filter(b => b.id !== spotlight.id && matchingIds.has(b.id) && billRelatedness(spotlight, b) > 0)
    : [];

  function inspect(bill: CatalogBill) {
    setSelectedId(bill.id);
    if (focus && !matchingIds.has(bill.id)) setFocus(null);
  }
  function toggleDimension(dimension: string) {
    setFocus(current => current?.dimension === dimension && !current.category ? null : { dimension });
  }
  function toggleCell(dimension: string, category: string) {
    setFocus(current => current?.dimension === dimension && current.category === category ? null : { dimension, category });
  }
  const viewText: Record<View, string> = {
    constellation: 'Each point is one catalog proposal. Lines appear for selected bills sharing catalog flourishing tags. Color denotes an editorial category, not expected benefit.',
    connections: 'Each circle is a declared flourishing dimension. Line thickness counts proposals tagged with both dimensions; it does not imply causal influence.',
    heatmap: 'Each cell is the number of proposals in a category tagged with a flourishing dimension. Click a cell to explore those actual drafts.',
  };

  return <section className="bill-viz" aria-labelledby="bill-viz-title">
    <div className="bill-viz__intro">
      <div>
        <p className="bill-viz__eyebrow">THE HUMAN FLOURISHING ATLAS · CATALOG VIEW</p>
        <h2 id="bill-viz-title">{fullCatalog.length} ideas. A connected picture.</h2>
        <p>Explore what the proposals aim to change and the measures they suggest tracking.</p>
      </div>
      <div className="bill-viz__stats" aria-label="Catalog totals">
        <div><strong>{fullCatalog.length}</strong><span>draft ideas</span></div>
        <div><strong>{categories.length}</strong><span>policy areas</span></div>
        <div><strong>{dimensions.length}</strong><span>flourishing tags</span></div>
      </div>
    </div>

    <div className="bill-viz__tabs" role="group" aria-label="Choose a visualization">
      <button type="button" aria-pressed={view === 'constellation'} onClick={() => setView('constellation')}>✦ Constellation</button>
      <button type="button" aria-pressed={view === 'connections'} onClick={() => setView('connections')}>◎ Connections</button>
      <button type="button" aria-pressed={view === 'heatmap'} onClick={() => setView('heatmap')}>▦ Heatmap</button>
    </div>
    <p id="bill-viz-explainer" className="bill-viz__explainer">{viewText[view]}</p>

    <div className="bill-viz__filters" aria-label="Filter by flourishing dimension">
      <span>Explore a dimension</span>
      {dimensions.map((d, i) => <button key={d} type="button"
        aria-pressed={focus?.dimension === d && !focus.category}
        onClick={() => toggleDimension(d)}>
        <span className="bill-viz__dot" style={{ backgroundColor: dimensionColors[i % dimensionColors.length] }} />
        {d} <strong>{dimensionCount(bills, d)}</strong>
      </button>)}
      {focus && <button type="button" className="bill-viz__clear" onClick={() => setFocus(null)}>Clear focus ×</button>}
    </div>

    <div className="bill-viz__workspace">
      <div className="bill-viz__main">
        {view === 'constellation' && <>
          <div className="bill-viz__graphic">
            <svg viewBox="0 0 1000 616" role="group" aria-label="Eleven clusters of draft bills. Select a point to inspect its proposal.">
              {categories.map((category, i) => {
                const centerX = 84 + (i % 6) * 166;
                const centerY = 170 + Math.floor(i / 6) * 287;
                return <g key={category}>
                  <circle cx={centerX} cy={centerY} r="72" fill={categoryColors[i]} fillOpacity=".055"
                    stroke={categoryColors[i]} strokeOpacity=".23" strokeWidth="1.5" strokeDasharray="3 8" />
                  <text x={centerX} y={centerY} textAnchor="middle" className="bill-viz__cluster-name">{categoryNames[i]}</text>
                  <text x={centerX} y={centerY + 20} textAnchor="middle" className="bill-viz__cluster-count">
                    {fullCatalog.filter(b => b.category === category && visibleIds.has(b.id)).length} / 10
                  </text>
                </g>;
              })}
              {spotlight && connected.map(b => {
                const a = position(spotlight), z = position(b);
                return <line key={b.id} x1={a.x} y1={a.y} x2={z.x} y2={z.y}
                  stroke="#ffffff" strokeOpacity=".15" strokeWidth={Math.max(1, billRelatedness(spotlight, b))} />;
              })}
              {fullCatalog.map(b => {
                const pos = position(b);
                const valid = visibleIds.has(b.id);
                const highlighted = matchingIds.has(b.id);
                const selected = spotlight?.id === b.id;
                return <circle key={b.id} cx={pos.x} cy={pos.y} r={selected ? 13 : 9}
                  fill={categoryColors[categoryIndex(b.category)]}
                  fillOpacity={valid ? highlighted ? 1 : .3 : .1}
                  stroke={selected ? '#ffffff' : categoryColors[categoryIndex(b.category)]}
                  strokeWidth={selected ? 3 : 1}
                  role="button" tabIndex={valid ? 0 : -1}
                  aria-label={`Inspect ${b.id}: ${b.title}`}
                  aria-pressed={selected}
                  className={valid ? 'bill-viz__point' : 'bill-viz__point bill-viz__point--dim'}
                  onClick={() => { if (valid) inspect(b); }}
                  onKeyDown={e => { if (valid && isActivation(e)) { e.preventDefault(); inspect(b); } }}>
                  <title>{b.id}: {b.title}</title>
                </circle>;
              })}
            </svg>
          </div>
          <div className="bill-viz__legend" aria-label="Category legend">
            {categories.map((category, i) => <span key={category}><i aria-hidden="true" style={{ background: categoryColors[i] }} />{categoryNames[i]}</span>)}
          </div>
        </>}

        {view === 'connections' && <>
          <div className="bill-viz__graphic">
            <svg viewBox="0 0 1000 590" role="group" aria-label="Network of flourishing dimensions. Edges count draft bills tagged with both dimensions.">
              <circle cx="500" cy="282" r="197" fill="none" stroke="#55718b" strokeOpacity=".3" strokeDasharray="2 10" />
              {dimensions.flatMap((left, i) => dimensions.slice(i + 1).map((right, offset) => {
                const j = i + offset + 1;
                const weight = sharedDimensionCount(bills, left, right);
                if (!weight) return null;
                const a = dimensionPosition(i), b = dimensionPosition(j);
                const relevant = !focus || focus.dimension === left || focus.dimension === right;
                return <line key={left + '|' + right} x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                  stroke="#84d6c7" strokeWidth={.8 + weight * .54}
                  strokeOpacity={relevant ? Math.min(.52, .10 + weight * .035) : .055}>
                  <title>{left} + {right}: {weight} shared catalog proposals</title>
                </line>;
              }))}
              {dimensions.map((dimension, i) => {
                const p = dimensionPosition(i), selected = focus?.dimension === dimension;
                return <g key={dimension} role="button" tabIndex={0}
                  aria-label={`Focus ${dimension}: ${dimensionCount(bills, dimension)} proposals`}
                  aria-pressed={selected}
                  className="bill-viz__network-point"
                  onClick={() => toggleDimension(dimension)}
                  onKeyDown={e => { if (isActivation(e)) { e.preventDefault(); toggleDimension(dimension); } }}>
                  <circle cx={p.x} cy={p.y} r={selected ? 43 : 38} fill="#112a36"
                    stroke={dimensionColors[i % dimensionColors.length]} strokeWidth={selected ? 4 : 2.5} />
                  <text x={p.x} y={p.y + 6} textAnchor="middle" className="bill-viz__network-count">{dimensionCount(bills, dimension)}</text>
                  <text x={p.x} y={p.y + 64} textAnchor="middle" className="bill-viz__network-label">
                    {dimensionNames[dimension] ?? dimension}
                  </text>
                </g>;
              })}
            </svg>
          </div>
          <div className="bill-viz__note">Links represent shared editorial tags, not relationships established by research. More links do not mean a policy is better.</div>
        </>}

        {view === 'heatmap' && <>
          <div className="bill-viz__heatmap" role="region" aria-label="Policy area by flourishing dimension counts" tabIndex={0}>
            <table>
              <caption>Number of matching draft bills per category and flourishing dimension</caption>
              <thead><tr><th scope="col">Policy area</th>{dimensions.map(d => <th scope="col" key={d}><span>{dimensionNames[d] ?? d}</span></th>)}</tr></thead>
              <tbody>{categories.map((category, i) => <tr key={category}>
                <th scope="row"><span className="bill-viz__category-key" style={{ background: categoryColors[i] }} />{categoryNames[i]}</th>
                {dimensions.map(d => {
                  const n = dimensionCount(bills, d, category);
                  const chosen = focus?.category === category && focus.dimension === d;
                  return <td key={d}><button type="button" disabled={n === 0} aria-pressed={chosen}
                    aria-label={`${category}: ${n} draft bills tagged ${d}`}
                    onClick={() => toggleCell(d, category)}
                    style={{ backgroundColor: n ? `rgba(83, 221, 188, ${.10 + n * .075})` : 'rgba(255,255,255,.035)' }}>
                    {n || '·'}
                  </button></td>;
                })}
              </tr>)}</tbody>
            </table>
          </div>
          <p className="bill-viz__note">A bill can carry multiple flourishing tags, so columns do not sum to {fullCatalog.length}. Values are classifications, not forecasts, funding or public support.</p>
        </>}

        <div className="bill-viz__matches">
          <div><h3>{focus ? focus.category ? `${dimensionNames[focus.dimension] ?? focus.dimension} in ${categoryNames[categoryIndex(focus.category)]}` : focus.dimension : 'Explore the proposals'}</h3>
            <p role="status">{matches.length} of {fullCatalog.length} proposals in this view{focus ? ' match your focus' : ''}.</p>
          </div>
          {matches.length > 0 ? <ol>
            {matches.slice(0, 10).map(b => <li key={b.id}>
              <button type="button" aria-pressed={spotlight?.id === b.id} onClick={() => inspect(b)}>
                <span>{b.id}</span> {b.title}
              </button>
            </li>)}
          </ol> : <p>No proposals match this focus and the current catalog search. Clear the focus or change the search.</p>}
          {matches.length > 10 && <p>Showing the first 10; use the searchable catalog below to explore all {matches.length} matches.</p>}
        </div>
      </div>

      <aside className="bill-viz__detail" aria-label="Selected draft proposal">
        <div className="bill-viz__detail-overline">PROPOSAL INSPECTOR · EDITORIAL DRAFT</div>
        {spotlight ? <>
          <p className="bill-viz__detail-id">{spotlight.id} · {categoryNames[categoryIndex(spotlight.category)]}</p>
          <h3>{spotlight.title}</h3>
          <p className="bill-viz__detail-lead">{spotlight.proposedChange}</p>
          <dl>
            <dt>Why it was proposed</dt><dd>{spotlight.problem}</dd>
            <dt>Suggested success measures</dt><dd>{spotlight.metrics}</dd>
            <dt>Safeguards to review</dt><dd>{spotlight.safeguards}</dd>
            <dt>Flourishing tags</dt><dd>{billDimensions(spotlight).join(' · ')}</dd>
          </dl>
          <a className="bill-viz__open" href={`/bills/${spotlight.id}`}>Read full draft {spotlight.id} ↗</a>
        </> : <p>Select a visible proposal or clear your filters to inspect a draft.</p>}
        <p className="bill-viz__disclosure">No legal review, cost estimate or independently verified impact is implied. These are unreviewed catalog proposals, not introduced or enacted laws, and not a public ballot.</p>
      </aside>
    </div>
  </section>;
}
