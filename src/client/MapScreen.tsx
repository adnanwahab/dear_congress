import { CivicHeader } from "./CivicHeader";
import { useEffect, useMemo, useState } from 'react';
import counties from './data/counties.json';
import { CountyCountMethodology, modeledCountyPercent } from './CountyCountMethodology';
import { countyVote, improvePlan, INITIAL_PLAN, PRIORITIES, requirements } from './county-simulation';

const IDS = counties.map(c => c.id);
const COLORS = { agree: '#39caa0', review: '#e6bc60', object: '#687fa8' };
const LABELS = { agree: 'Model supports plan', review: 'Model needs refinement', object: 'Model requests changes' };
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
    <CivicHeader stage="National sandbox" />
    <main className="civic-main map-main">
      <section className="map-heading"><div><p className="map-eyebrow">Illustrative county sandbox</p><h1>Explore a modeled county plan.</h1><p>County shapes show synthetic requirements, not constituent votes. Improve the sample plan to explore modeled support.</p></div><div className="county-live"><span className={running ? 'pulse' : ''} />{complete ? 'Model requirements met' : running ? 'Simulation running' : 'Simulation ready'}</div></section>
      <div className="county-metrics"><div><strong>{counties.length.toLocaleString()}</strong><span>county shapes modeled · 100% of bundled shapes</span><span>{counties.length.toLocaleString()} / {counties.length.toLocaleString()} bundled county models</span></div><div><strong>{agreed.toLocaleString()} <small>/ {counties.length.toLocaleString()}</small></strong><span>modeled counties supporting plan</span></div><div><strong>{modeledCountyPercent(agreed, counties.length)}</strong><span>modeled support on this revision</span><span>{agreed.toLocaleString()} / {counties.length.toLocaleString()} bundled county models</span></div><div><strong>{round.toString().padStart(2, '0')}</strong><span>plan revision</span></div></div>
      <p className="county-disclosure">Real verified county participation: unavailable. No verified county participation feed is connected. Real county support and its measured denominator are also unavailable.</p>
      <CountyCountMethodology supported={agreed} total={counties.length} revision={round} />
      <div className="county-workspace"><section className="county-atlas" aria-label="Nationwide county simulation"><div className="county-atlas-head"><div><span className="map-eyebrow">United States / illustrative model</span><h2>{complete ? 'All modeled requirements are met.' : 'A shared future, taking shape.'}</h2></div><div className="county-zoom"><button onClick={() => setZoom(z => Math.max(1, z - .5))} aria-label="Zoom out">−</button><button onClick={() => setZoom(z => Math.min(3, z + .5))} aria-label="Zoom in">+</button><button onClick={() => setZoom(1)}>Reset</button></div></div>
        <div className="county-map-scroll"><svg viewBox="0 0 1000 750" style={{ width: `${zoom * 100}%`, maxWidth: 'none' }} role="img" aria-label={`Illustrative county map: ${agreed} of ${counties.length} modeled counties supporting plan. Select a county or use the searchable county list.`} className="county-svg"><defs><pattern id="map-grid" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M 40 0 L 0 0 0 40" fill="none" stroke="#ffffff" strokeOpacity=".035" /></pattern></defs><rect width="1000" height="750" fill="url(#map-grid)" />{votes.map(c => <path key={c.id} d={c.path} fill={COLORS[c.status]} stroke={c.id === selected ? '#fff' : '#101f32'} strokeWidth={c.id === selected ? 1.8 : .35} opacity={filter === 'all' || c.status === filter ? 1 : .14} onClick={() => setSelected(c.id)} className="county-shape"><title>{`${c.name}, ${c.state} · ${LABELS[c.status]} · Synthetic requirements derived from FIPS code; no resident ballots.`}</title></path>)}<text x="50" y="748">ALASKA</text><text x="305" y="735">HAWAII</text><text x="620" y="680">ILLUSTRATIVE MODEL · NO RESIDENT BALLOTS</text></svg></div>
        <p className="county-disclosure">Illustrative data only: 100% shape coverage means all bundled county shapes are modeled. Support counts models whose four synthetic requirements are met, divided by all modeled counties. Initial support is 0/3,144; no resident ballots are counted.</p>
        <details className="county-disclosure"><summary title="County boundaries are geography; colored positions are generated locally, not collected from residents.">Data origin</summary><p>Boundaries: U.S. Census Bureau, 2023. Requirements: deterministic values generated from each county’s FIPS code. Colors and support counts are calculated locally from those requirements and the sample plan. This map reads no participation API and records no votes. Results are not representative or legally binding.</p></details>
        <div className="county-legend" aria-label="Illustrative model status legend">{Object.entries(LABELS).map(([key, label]) => <button key={key} className={filter === key ? 'selected' : ''} onClick={() => setFilter(f => f === key ? 'all' : key)} aria-pressed={filter === key}><i style={{ background: COLORS[key as keyof typeof COLORS] }} />{label}<b>{key === 'agree' ? agreed : key === 'review' ? reviewing : counties.length - agreed - reviewing}</b></button>)}</div>
        <div className="county-selected"><div><span className="map-eyebrow">Selected modeled county · {active.id}</span><h3>{active.name}, {active.state}</h3></div><div><strong style={{ color: COLORS[active.status] }}>{LABELS[active.status]}</strong><p>{active.status === 'agree' ? 'All four modeled requirements are met.' : `Model requires stronger ${PRIORITIES[active.priority]!.toLowerCase()} (${requirements(active.id)[active.priority]}/100).`}</p></div></div>
      </section><aside className="county-plan"><div className="county-plan-title"><span className="map-eyebrow">The evolving plan</span><span>v{round}</span></div><h2>Stronger communities,<br />shared prosperity.</h2><p>A simulated national investment plan shaped by synthetic county requirements.</p><div className="county-progress"><span>Modeled county support <b>{modeledCountyPercent(agreed, counties.length, 0)}</b></span><small>{agreed.toLocaleString()} / {counties.length.toLocaleString()} bundled county models meet all four requirements</small><progress aria-label="County models meeting all four synthetic requirements" max={counties.length} value={agreed} /></div>
        <div className="county-priorities">{PRIORITIES.map((p, i) => <div key={p}><div><strong>{p}</strong><span>{plan[i]}/100</span></div><progress max="100" value={plan[i]} /><small>{objections[i] ? `${objections[i]!.toLocaleString()} county models require this improvement` : 'No unmet model requirements in this area'}</small></div>)}</div>
        <div className={`county-status ${complete ? 'complete' : ''}`} role="status">{complete ? 'Simulation complete. Every county’s modeled requirements are satisfied.' : round === 1 ? 'The first draft is on the table. Start the simulation to explore synthetic requirements.' : `Revision ${round}: strengthened all four commitments in response to synthetic requirements.`}</div>
        <button className="county-start" disabled={complete} onClick={() => setRunning(r => !r)}>{complete ? '✓ All county models support plan' : running ? 'Pause simulation' : round === 1 ? '▶ Start nationwide simulation' : '▶ Resume simulation'}</button><div className="county-actions"><button className="outline" disabled={running || complete} onClick={revise}>Improve one revision</button><button className="outline" onClick={reset}>Restart</button></div><p className="county-disclosure">Simulation only. Each county has one synthetic position and fixed modeled requirements. Revisions raise plan scores until those requirements are met. Results are not representative, legally binding, polling, a forecast, or evidence of real public consensus.</p>
      </aside></div>
      <section className="county-directory"><div><h2>Inspect the county models.</h2><p>Search synthetic positions, including Alaska and Hawaii. No resident ballots are shown.</p></div><label>Find a county<input type="search" placeholder="County, state, or FIPS code" value={search} onChange={e => setSearch(e.target.value)} /></label><p>{visible.length.toLocaleString()} counties {filter !== 'all' ? `· ${LABELS[filter as keyof typeof LABELS]}` : ''}</p><div className="county-results">{visible.slice(0, 60).map(c => <button key={c.id} onClick={() => setSelected(c.id)} aria-pressed={selected === c.id}><span>{c.name}, {c.state}</span><small style={{ color: COLORS[c.status] }}>{LABELS[c.status]}</small></button>)}</div>{visible.length > 60 && <p>Showing the first 60 matches. Narrow your search to find a county.</p>}{!visible.length && <p>No matching counties. Try another name or clear the model filter.</p>}</section>
      <p className="map-footnote">Geography: U.S. Census Bureau, 2023 cartographic boundaries. All {counties.length.toLocaleString()} counties and county equivalents in the 50 states and D.C.; territories excluded. Equal county models, not population weighted. Alaska and Hawaii shown as insets.</p>
    </main></div>;
}
