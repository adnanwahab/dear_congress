import { useEffect, useMemo, useState } from 'react';
import counties from './data/counties.json';
import { countyVote, improvePlan, INITIAL_PLAN, PRIORITIES, requirements } from './county-simulation';

const IDS = counties.map(c => c.id);
const COLORS = { agree: '#39caa0', review: '#e6bc60', object: '#687fa8' };
const LABELS = { agree: 'Agrees', review: 'Needs refinement', object: 'Requests changes' };
export default function MapScreen() {
  const [plan, setPlan] = useState([...INITIAL_PLAN]);
  const [round, setRound] = useState(1);
  const [running, setRunning] = useState(false);
  const [selected, setSelected] = useState('48201');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [zoom, setZoom] = useState(1);
  const votes = useMemo(() => counties.map(c => ({ ...c, ...countyVote(c.id, plan) })), [plan]);
  const agreed = votes.filter(c => c.status === 'agree').length;
  const reviewing = votes.filter(c => c.status === 'review').length;
  const complete = agreed === counties.length;
  const active = votes.find(c => c.id === selected)!;
  const visible = votes.filter(c => (filter === 'all' || c.status === filter) && `${c.name} ${c.state} ${c.id}`.toLowerCase().includes(search.toLowerCase()));
  const objections = PRIORITIES.map((_, i) => votes.filter(c => c.status !== 'agree' && c.priority === i).length);
  function revise() { setPlan(p => improvePlan(p, IDS)); setRound(r => r + 1); }
  useEffect(() => {
    if (!running || complete) return;
    const timer = window.setInterval(revise, 1800);
    return () => window.clearInterval(timer);
  }, [running, complete]);
  useEffect(() => { if (complete) setRunning(false); }, [complete]);
  function reset() { setRunning(false); setPlan([...INITIAL_PLAN]); setRound(1); }
  return <div className="civic-shell map-shell county-shell">
    <header className="civic-header"><div className="header-brand"><a href="/">Civic Synthesis</a><span className="pill">National sandbox</span></div><a href="/votes">Explore proposals →</a></header>
    <main className="civic-main map-main">
      <section className="map-heading"><div><p className="map-eyebrow">One country. Thousands of perspectives.</p><h1>A plan we can all get behind.</h1><p>Every county votes at once. Listen to objections, improve the plan, and watch agreement grow.</p></div><div className="county-live"><span className={running ? 'pulse' : ''} />{complete ? 'Consensus reached' : running ? 'All counties deliberating' : 'Ready to deliberate'}</div></section>
      <div className="county-metrics"><div><strong>{counties.length.toLocaleString()}</strong><span>counties participating · 100% coverage</span></div><div><strong>{agreed.toLocaleString()} <small>/ {counties.length.toLocaleString()}</small></strong><span>counties agree</span></div><div><strong>{(agreed / counties.length * 100).toFixed(1)}%</strong><span>agreement on this revision</span></div><div><strong>{round.toString().padStart(2, '0')}</strong><span>plan revision</span></div></div>
      <div className="county-workspace"><section className="county-atlas" aria-label="Nationwide county simulation"><div className="county-atlas-head"><div><span className="map-eyebrow">United States / county vote</span><h2>{complete ? 'Every county has a yes.' : 'A shared future, taking shape.'}</h2></div><div className="county-zoom"><button onClick={() => setZoom(z => Math.max(1, z - .5))} aria-label="Zoom out">−</button><button onClick={() => setZoom(z => Math.min(3, z + .5))} aria-label="Zoom in">+</button><button onClick={() => setZoom(1)}>Reset</button></div></div>
        <div className="county-map-scroll"><svg viewBox="0 0 1000 750" style={{ width: `${zoom * 100}%`, maxWidth: 'none' }} role="img" aria-label={`County voting map: ${agreed} of ${counties.length} counties agree. Select a county or use the searchable county list.`} className="county-svg"><defs><pattern id="map-grid" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M 40 0 L 0 0 0 40" fill="none" stroke="#ffffff" strokeOpacity=".035" /></pattern></defs><rect width="1000" height="750" fill="url(#map-grid)" />{votes.map(c => <path key={c.id} d={c.path} fill={COLORS[c.status]} stroke={c.id === selected ? '#fff' : '#101f32'} strokeWidth={c.id === selected ? 1.8 : .35} opacity={filter === 'all' || c.status === filter ? 1 : .14} onClick={() => setSelected(c.id)} className="county-shape"><title>{c.name}, {c.state} · {LABELS[c.status]}</title></path>)}<text x="50" y="748">ALASKA</text><text x="305" y="735">HAWAII</text><text x="620" y="680">EVERY VOICE MOVES THE PLAN FORWARD</text></svg></div>
        <div className="county-legend">{Object.entries(LABELS).map(([key, label]) => <button key={key} className={filter === key ? 'selected' : ''} onClick={() => setFilter(f => f === key ? 'all' : key)} aria-pressed={filter === key}><i style={{ background: COLORS[key as keyof typeof COLORS] }} />{label}<b>{key === 'agree' ? agreed : key === 'review' ? reviewing : counties.length - agreed - reviewing}</b></button>)}</div>
        <div className="county-selected"><div><span className="map-eyebrow">Selected county · {active.id}</span><h3>{active.name}, {active.state}</h3></div><div><strong style={{ color: COLORS[active.status] }}>{LABELS[active.status]}</strong><p>{active.status === 'agree' ? 'All four modeled requirements are met.' : `Asks for stronger ${PRIORITIES[active.priority]!.toLowerCase()} (${requirements(active.id)[active.priority]}/100).`}</p></div></div>
      </section><aside className="county-plan"><div className="county-plan-title"><span className="map-eyebrow">The evolving plan</span><span>v{round}</span></div><h2>Stronger communities,<br />shared prosperity.</h2><p>A simulated national investment plan shaped by each county’s requirements.</p><div className="county-progress"><span>National agreement <b>{Math.round(agreed / counties.length * 100)}%</b></span><progress max={counties.length} value={agreed} /></div>
        <div className="county-priorities">{PRIORITIES.map((p, i) => <div key={p}><div><strong>{p}</strong><span>{plan[i]}/100</span></div><progress max="100" value={plan[i]} /><small>{objections[i] ? `${objections[i]!.toLocaleString()} counties prioritize this improvement` : 'No outstanding objections in this area'}</small></div>)}</div>
        <div className={`county-status ${complete ? 'complete' : ''}`} role="status">{complete ? 'Consensus achieved. Every county’s modeled requirements are satisfied.' : round === 1 ? 'The first draft is on the table. Start the simulation to hear every county.' : `Revision ${round}: strengthened all four commitments in response to county objections.`}</div>
        <button className="county-start" disabled={complete} onClick={() => setRunning(r => !r)}>{complete ? '✓ All counties agree' : running ? 'Pause deliberation' : round === 1 ? '▶ Start nationwide simulation' : '▶ Resume deliberation'}</button><div className="county-actions"><button className="outline" disabled={running || complete} onClick={revise}>Improve one revision</button><button className="outline" onClick={reset}>Restart</button></div><p className="county-disclosure">Simulation only. Each county has one synthetic vote and fixed modeled requirements. Revisions raise plan scores until those requirements are met. This is not polling, a forecast, or evidence of real public consensus.</p>
      </aside></div>
      <section className="county-directory"><div><h2>Every county has a seat.</h2><p>Search and inspect individual votes, including Alaska and Hawaii.</p></div><label>Find a county<input type="search" placeholder="County, state, or FIPS code" value={search} onChange={e => setSearch(e.target.value)} /></label><p>{visible.length.toLocaleString()} counties {filter !== 'all' ? `· ${LABELS[filter as keyof typeof LABELS]}` : ''}</p><div className="county-results">{visible.slice(0, 60).map(c => <button key={c.id} onClick={() => setSelected(c.id)} aria-pressed={selected === c.id}><span>{c.name}, {c.state}</span><small style={{ color: COLORS[c.status] }}>{LABELS[c.status]}</small></button>)}</div>{visible.length > 60 && <p>Showing the first 60 matches. Narrow your search to find a county.</p>}{!visible.length && <p>No matching counties. Try another name or clear the vote filter.</p>}</section>
      <p className="map-footnote">Geography: U.S. Census Bureau, 2023 cartographic boundaries. All {counties.length.toLocaleString()} counties and county equivalents in the 50 states and D.C.; territories excluded. Equal county votes, not population weighted. Alaska and Hawaii shown as insets.</p>
    </main></div>;
}
