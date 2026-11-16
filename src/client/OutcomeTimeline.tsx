import { useEffect, useRef, useState } from 'react';
import { runViewTransition } from './motion';
import { changeScale, DEFAULT_RANGE, panRange, rangeURL, readTimeRange, spans, TIME_SCALES, type TimeRange } from './time-range';
import './outcome-timeline.css';

type Lane = 'history' | 'planned' | 'projection';
export type TimelineEntry = { id: string; date: string; label: string; source: string } & ({ lane: 'history'; synthetic: boolean } | { lane: 'planned' | 'projection'; synthetic: true });
export const TIMELINE_DEMO: readonly TimelineEntry[] = [
  { id: 'draft', date: '2026-11-14', label: 'Legislative draft example', source: 'Timeline fixture v1; no official bill', lane: 'planned', synthetic: true },
  { id: 'review', date: '2027-02-14', label: 'Proposed pilot review', source: 'Timeline fixture v1; no scheduled government action', lane: 'planned', synthetic: true },
  { id: 'future', date: '2031-11-14', label: 'Long-run scenario checkpoint; no predicted benefit', source: 'Timeline fixture v1; illustrative assumption, not a forecast', lane: 'projection', synthetic: true },
];
const lanes: [Lane, string][] = [['history', 'Historical measurements'], ['planned', 'Planned milestones'], ['projection', 'Synthetic future projections']];
const stamp = (time: number) => new Date(time).toISOString().slice(0, 16).replace('T', ' ');
export function OutcomeTimeline({ entries = TIMELINE_DEMO, loading = false }: { entries?: readonly TimelineEntry[]; loading?: boolean }) {
  const [range, setRange] = useState<TimeRange>(() => typeof window === 'undefined' ? DEFAULT_RANGE : readTimeRange(window.location.search));
  const surface = useRef<HTMLDivElement>(null);
  const active = useRef<ViewTransition | null>(null);
  const current = useRef(range); current.current = range;
  const pointers = useRef(new Map<number, number>());
  const gesture = useRef<number | null>(null);
  function update(next: TimeRange) {
    active.current?.skipTransition();
    current.current = next;
    window.history.replaceState(window.history.state, '', rangeURL(window.location.href, next));
    void runViewTransition(() => setRange(next), 'time-zoom', transition => { active.current = transition; });
  }
  useEffect(() => {
    const restore = () => { active.current?.skipTransition(); setRange(readTimeRange(window.location.search)); };
    window.addEventListener('popstate', restore);
    const node = surface.current!;
    const wheel = (event: WheelEvent) => {
      if (!event.ctrlKey || !event.deltaY) return;
      event.preventDefault();
      update(changeScale(current.current, event.deltaY > 0 ? 1 : -1));
    };
    node.addEventListener('wheel', wheel, { passive: false });
    return () => { window.removeEventListener('popstate', restore); node.removeEventListener('wheel', wheel); active.current?.skipTransition(); };
  }, []);
  const width = spans[range.scale], start = range.center - width / 2, end = range.center + width / 2;
  return <section className="panel outcome-timeline" aria-labelledby="time-title" aria-busy={loading}>
    <h2 id="time-title">Draft to long-run outcome</h2>
    <p>Advisory exploration only. Demo milestones and synthetic projections are separate from real participation. No publication or voting occurs here.</p>
    <div role="group" aria-label="Time scale">{TIME_SCALES.map(scale => <button key={scale} aria-pressed={range.scale === scale} onClick={() => update({ ...current.current, scale })}>{scale}</button>)}</div>
    <p id="time-help">Focus the timeline: + / − zoom, Left / Right move, Home resets. Ctrl + wheel zooms. Touch: pinch to zoom or use the scale and range buttons. All dates are UTC.</p>
    <div className="time-controls"><button onClick={() => update(panRange(current.current, -1))}>Earlier</button><button onClick={() => update(DEFAULT_RANGE)}>Reset range</button><button onClick={() => update(panRange(current.current, 1))}>Later</button></div>
    <div ref={surface} tabIndex={0} role="region" aria-label="Outcome time range" aria-describedby="time-help"
      onKeyDown={event => {
        if (event.target !== event.currentTarget) return;
        const next = event.key === '+' || event.key === '=' ? changeScale(current.current, -1) : event.key === '-' ? changeScale(current.current, 1) : event.key === 'ArrowLeft' ? panRange(current.current, -1) : event.key === 'ArrowRight' ? panRange(current.current, 1) : event.key === 'Home' ? DEFAULT_RANGE : null;
        if (next) { event.preventDefault(); update(next); }
      }}
      onPointerDown={event => { if (event.pointerType !== 'touch') return; pointers.current.set(event.pointerId, event.clientX); event.currentTarget.setPointerCapture?.(event.pointerId); gesture.current = null; }}
      onPointerMove={event => {
        if (!pointers.current.has(event.pointerId)) return;
        pointers.current.set(event.pointerId, event.clientX);
        if (pointers.current.size !== 2) return;
        const [a, b] = [...pointers.current.values()]; const distance = Math.abs(a! - b!);
        if (gesture.current !== null && Math.abs(distance - gesture.current) > 45) { update(changeScale(current.current, distance > gesture.current ? -1 : 1)); gesture.current = distance; }
        else if (gesture.current === null) gesture.current = distance;
      }}
      onPointerUp={event => { pointers.current.delete(event.pointerId); gesture.current = null; }}
      onPointerCancel={() => { pointers.current.clear(); gesture.current = null; }}>
      <p aria-live="polite">{range.scale} view · {stamp(start)} — {stamp(end)} UTC</p>
      <div className="time-ticks" key={`${range.center}-${range.scale}`} aria-hidden="true">{Array.from({ length: 5 }, (_, i) => <span key={i}>{stamp(start + width * i / 4)}</span>)}</div>
      {loading ? <p role="status">Loading timeline…</p> : lanes.map(([lane, label]) => {
        const rows = entries.filter(row => row.lane === lane && Date.parse(row.date) >= start && Date.parse(row.date) <= end);
        return <section key={lane} className={`time-lane time-${lane}`}><h3>{label}</h3>
          {rows.length ? <ul>{rows.map(row => <li key={row.id}><time dateTime={row.date}>{row.date}</time> · {row.label}<br /><strong>{row.synthetic ? 'Synthetic / demo' : 'Historical source record'}</strong> · Source: {row.source}</li>)}</ul> : <p>{lane === 'history' ? 'No historical measurements supplied in this range.' : 'No entries in this range.'}</p>}
        </section>;
      })}
    </div>
    <p>The center stays fixed when zooming. Entries outside this range remain available by zooming out or moving earlier/later.</p>
    <a href={rangeURL('https://local.invalid' + (typeof window === 'undefined' ? '/outcomes' : window.location.pathname + window.location.search), range).search}>Link to this time range</a>
  </section>;
}
