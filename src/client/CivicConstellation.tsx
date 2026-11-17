import { useEffect, useRef, useState } from 'react';
import { civicEvents, eventDate, eventSource, eventState, type CivicEvent } from '../shared/civic-events';
import { billCollection } from '../shared/bill-catalog';
import { TOPICS } from '../shared/topics';
import { TopicChip } from './TopicChip';
import './civic-constellation.css';

export function CivicConstellation({ events = civicEvents, query = '', category = '', topic = '' }: { events?: readonly CivicEvent[]; query?: string; category?: string; topic?: string }) {
  const read = () => new URLSearchParams(window.location.search).get('event') ?? '';
  const [selected, setSelected] = useState(read);
  const [list, setList] = useState(false);
  const [now, setNow] = useState(Date.now);
  const detail = useRef<HTMLElement>(null);
  useEffect(() => {
    const restore = () => setSelected(read());
    window.addEventListener('popstate', restore);
    const timer = window.setInterval(() => setNow(Date.now()), 60000);
    return () => { window.removeEventListener('popstate', restore); window.clearInterval(timer); };
  }, []);
  const visible = events.filter(e => (!topic || e.topicIds.includes(topic)) && (!category || e.billIds.some(id => billCollection.bills.some(b => b.id === id && b.category === category))) && query.toLowerCase().split(/\s+/).every(term => `${e.title} ${e.institution} ${e.committee} ${e.billIds.join(' ')} ${e.topicIds.join(' ')}`.toLowerCase().includes(term)));
  const chosen = visible.find(e => e.id === selected);
  const pins = visible.filter(e => eventState(e, now) === 'Confirmed');
  function select(id: string) {
    const url = new URL(window.location.href); url.searchParams.set('event', id);
    window.history.pushState(null, '', url); setSelected(id);
    // Same destination and focus behavior from ring and list.
    window.setTimeout(() => detail.current?.focus(), 0);
  }
  return <section id="civic-dates" className="civic-constellation" aria-labelledby="constellation-title">
    <h2 id="constellation-title">Upcoming civic decisions</h2>
    <p>Only sourced, confirmed dates checked within 24 hours appear on the calendar ring. Dates are shown in UTC. Selection opens evidence; it does not RSVP, vote or contact an institution.</p>
    <label><input type="checkbox" checked={list} onChange={e => setList(e.target.checked)} /> Static / low-power list</label>
    <p role="status">{visible.length} events match the current search and filters · {pins.length} confirmed dates</p>
    {!list && <div className="civic-orbit" aria-label="Calendar ring of confirmed dates"><span className="civic-orbit-center">Calendar<br />UTC · by month</span>{pins.map((e, i) => {
      const date = new Date(e.date);
      const angle = ((date.getUTCMonth() + (date.getUTCDate() - 1) / 31) / 12 * 2 * Math.PI) - Math.PI / 2;
      return <button key={e.id} style={{ left: `${50 + 38 * Math.cos(angle)}%`, top: `${50 + 38 * Math.sin(angle)}%` }} aria-label={`${e.title}, ${eventDate(e)}`} onClick={() => select(e.id)}>{i + 1}</button>;
    })}</div>}
    {!visible.length && <p>No sourced events match. {events.length ? 'Registered events are excluded by the current filters.' : 'No reviewed meeting dates are registered in this repository yet.'} Draft proposals and sample deadlines do not establish official hearings. Try clearing the filters to inspect all registered events.</p>}
    <ol>{visible.map(e => <li key={e.id}><button onClick={() => select(e.id)} aria-current={selected === e.id ? 'true' : undefined}>{e.title}</button> — {eventDate(e)} · {eventState(e, now)} · {e.institution} / {e.committee}</li>)}</ol>
    {selected && !chosen && <p>The selected event is unavailable or excluded by the current filters.</p>}
    {chosen && <section ref={detail} tabIndex={-1} aria-label="Selected event evidence"><h3>{chosen.title}</h3><p>{eventState(chosen, now)} · {eventDate(chosen)}</p><p>{chosen.institution} / {chosen.committee}</p><p>Source checked: {chosen.source.checkedAt}. Confirmation is a recorded observation, not a guarantee that the meeting will occur. Recheck the source before making plans.</p>{eventSource(chosen) ? <a className="workflow-source-status" href={eventSource(chosen)!} rel="noopener noreferrer" target="_blank">{chosen.source.publisher || 'Recorded source'} ↗</a> : <p>Source unavailable / unverified</p>}<p>{chosen.topicIds.map(id => TOPICS.find(t => t.id === id)).filter(t => !!t).map(t => <TopicChip key={t.id} topic={t.label} linked />)}</p><p>{chosen.billIds.filter(id => billCollection.bills.some(b => b.id === id)).map(id => <a key={id} href={`/bills/${id}`}>{id} · related editorial draft </a>)}</p></section>}
  </section>;
}
