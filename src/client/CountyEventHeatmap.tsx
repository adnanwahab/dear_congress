import { useEffect, useMemo, useState } from 'react';
import counties from './data/counties.json';
import { countyEvents } from './county-events';
import { motionDisabled, motionDuration } from './motion';
import './county-events.css';

const COUNTY_BY_ID = new Map(counties.map(c => [c.id, c]));

export function CountyEventHeatmap({ revision, onCounty }: { revision: number; onCounty: (id: string) => void }) {
  const events = useMemo(() => countyEvents(revision), [revision]);
  const [bucket, setBucket] = useState(1);
  const [playing, setPlaying] = useState(false);
  const [geography, setGeography] = useState(true);
  const [synthetic, setSynthetic] = useState(true);
  const [tableOnly, setTableOnly] = useState(false);
  const [svgAvailable, setSvgAvailable] = useState(false);
  const [selected, setSelected] = useState('');
  const current = Math.min(bucket, revision);
  const rows = events.filter(e => e.revision === current);
  const intensity = new Map(rows.map(e => [e.countyId, e]));
  useEffect(() => { setSvgAvailable(typeof SVGSVGElement !== 'undefined'); }, []);
  useEffect(() => { setPlaying(false); setBucket(1); setSelected(''); }, [revision]);
  useEffect(() => {
    if (!playing || motionDisabled()) return;
    const timer = window.setInterval(() => {
      if (motionDisabled()) { setPlaying(false); return; }
      setBucket(old => { if (old >= revision) { setPlaying(false); return old; } return old + 1; });
    }, motionDuration(1200));
    return () => window.clearInterval(timer);
  }, [playing, revision]);
  const example = rows.find(e => e.id === selected);
  function inspect(id: string) {
    setSelected(id); setPlaying(false);
    const event = rows.find(e => e.id === id);
    if (event) onCounty(event.countyId);
    window.setTimeout(() => document.getElementById('county-event-example')?.focus(), 0);
  }
  return <section className="county-event-panel" aria-label="Sandbox event heatmap">
    <p className="map-eyebrow">Demo · local synthetic event log · pending review</p>
    <h2>Where the model changes over time</h2>
    <p>One event is a county model changing status at one simulation revision. Buckets are revisions, not calendar dates. These are deterministic model examples, not real votes, observed impacts or forecasts.</p>
    <p>Geographic evidence: bundled Census 2023 county boundaries. Synthetic layer: county-fips-v1 status transitions. The external simulator has no reviewed county/event binding; its local actor coordinates are not placed on this map. <a href="/synth">Explore the separate simulator</a>.</p>
    <div className="county-event-controls">
      <label>Simulation revision {current} / {revision}<input aria-label="Event time bucket" type="range" min="1" max={revision} value={current} onChange={e => { setBucket(Number(e.target.value)); setPlaying(false); setSelected(''); }} /></label>
      <button disabled={revision < 2} onClick={() => { if (motionDisabled()) { setBucket(old => old >= revision ? 1 : old + 1); return; } if (current === revision) setBucket(1); setPlaying(p => !p); }}>{playing ? 'Pause event playback' : 'Play events / step with reduced motion'}</button>
      <label><input type="checkbox" checked={geography} onChange={e => setGeography(e.target.checked)} />Geographic boundaries</label>
      <label><input type="checkbox" checked={synthetic} onChange={e => setSynthetic(e.target.checked)} />Synthetic events</label>
      <label><input type="checkbox" checked={tableOnly} onChange={e => setTableOnly(e.target.checked)} />Table only</label>
    </div>
    <p role="status">Revision {current}: {rows.length.toLocaleString()} synthetic status-change events. {revision === 1 ? 'Improve one revision or start the county simulation to create the log.' : 'Play or scrub completed revisions; no intermediate events are invented.'}</p>
    <p>Legend · events per county per revision: <span className="county-event-key zero">0</span> no status change; <span className="county-event-key one">1</span> status changed. Zero is not evidence of no real-world effects.</p>
    {!tableOnly && svgAvailable ? <svg viewBox="0 0 1000 750" role="img" aria-label={`Synthetic event intensity at revision ${current}; use the event table to inspect examples`}>
      <g>{geography && counties.map(c => <path key={c.id} d={c.path} fill="var(--bg)" stroke="var(--muted)" strokeWidth=".4" />)}</g>
      <g>{synthetic && counties.filter(c => intensity.has(c.id)).map(c => <path key={c.id} d={c.path} fill="#c26715" stroke="var(--bg)" strokeWidth=".3" onClick={() => inspect(intensity.get(c.id)!.id)} />)}</g>
    </svg> : <p>Map unavailable or table selected. The complete event table below works without a map or WebGL.</p>}
    <div className="county-event-table" role="region" aria-label="Scrollable synthetic event log" tabIndex={0}><table><caption>Synthetic event log · county-fips-v1 · revision {current} · {rows.length} events</caption><thead><tr><th scope="col">County / FIPS</th><th scope="col">Events / revision</th><th scope="col">Logged example</th></tr></thead><tbody>{rows.map(e => { const c = COUNTY_BY_ID.get(e.countyId)!; return <tr key={e.id}><th scope="row">{c.name}, {c.state} · {c.id}</th><td>1</td><td><button onClick={() => inspect(e.id)}>Inspect {c.id}</button></td></tr>; })}</tbody></table></div>
    {!rows.length && <p>No logged transitions in this bucket. Revision 1 is unevaluated.</p>}
    <article id="county-event-example" tabIndex={-1} aria-label="Logged synthetic example"><h3>Underlying logged example</h3>{example ? <><p>{example.id}</p><p>FIPS {example.countyId} · revision {example.revision}: {example.before} → {example.after}. Source: county-fips-v1. Local deterministic status transition; no resident ballot or measured outcome.</p></> : <p>Select an event in the table or map. The matching county is also selected in the county inspector.</p>}</article>
  </section>;
}
