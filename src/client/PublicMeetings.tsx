import { useEffect, useState } from 'react';
import { meetingCalendar, meetingFreshness, parseMeetings, type MeetingsResponse, type PublicMeeting } from '../shared/meetings';
import './public-meetings.css';
function MeetingCard({ meeting: m, now }: { meeting: PublicMeeting; now: number }) {
  const [reminder, setReminder] = useState(false);
  const [status, setStatus] = useState('');
  function download() {
    try {
      const url = URL.createObjectURL(new Blob([meetingCalendar(m, reminder)], { type: 'text/calendar;charset=utf-8' }));
      const link = document.createElement('a'); link.href = url; link.download = 'public-meeting.ics'; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setStatus('Calendar file prepared. Import it into your calendar to finish. Your calendar controls reminders; no subscription was created.');
    } catch { setStatus('Calendar export failed. Check the organizer source and try again.'); }
  }
  return <article className="meeting-card">
    <h3>{m.title}</h3><p>{m.jurisdiction} · {m.topics.join(', ') || 'Topic unavailable'}</p>
    <p>Organizer: {m.organizer} · reviewed by {m.verifiedBy}</p>
    <p>{m.startsAt ? <time dateTime={m.startsAt}>{new Date(m.startsAt).toLocaleString(undefined, { timeZone: 'UTC', timeZoneName: 'short' })}</time> : 'Meeting time unavailable. Check the organizer notice; no time has been inferred.'}</p>
    <p>{m.agenda ? <>Agenda: {m.agenda.text} <a href={m.agenda.sourceUrl}>Read source agenda</a></> : 'Agenda unavailable. Topics and decisions cannot be confirmed until the organizer publishes an agenda.'}</p>
    <p><a href={m.sourceUrl}>Organizer notice and source</a></p>
    <p>{meetingFreshness(m, now)}. Last source check: {m.checkedAt}.</p>
    {m.startsAt && <><label className="meeting-reminder"><input type="checkbox" checked={reminder} onChange={e => setReminder(e.target.checked)} />Include a 30-minute reminder in this export</label><button type="button" onClick={download}>Download calendar event (.ics)</button></>}
    <p role="status">{status}</p>
  </article>;
}
export function PublicMeetings({ request, jurisdiction }: { request: <T>(path: string) => Promise<T>; jurisdiction: string }) {
  const [meetings, setMeetings] = useState<PublicMeeting[]>([]);
  const [phase, setPhase] = useState('loading');
  const [attempt, setAttempt] = useState(0);
  const [topic, setTopic] = useState('');
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    let active = true; setPhase('loading'); setMeetings([]);
    request<MeetingsResponse>('/api/meetings').then(data => { const parsed = parseMeetings(data.meetings); if (active) { setMeetings(parsed); setPhase('ready'); } }).catch(() => { if (active) setPhase('failed'); });
    return () => { active = false; };
  }, [request, attempt]);
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 60000); return () => clearInterval(timer); }, []);
  const scoped = meetings.filter(m => !jurisdiction || m.jurisdiction === jurisdiction);
  const topics = [...new Set(meetings.flatMap(m => m.topics))].sort();
  const visible = scoped.filter(m => !topic || m.topics.includes(topic)).sort((a,b) => (a.startsAt ?? '9999').localeCompare(b.startsAt ?? '9999'));
  return <section className="panel public-meetings" aria-label="Public meeting calendar" aria-busy={phase === 'loading'}>
    <h2>Public meeting calendar</h2>
    <p>Official notices reviewed by an operator, separate from fictional proposals and demo activity. Coverage is incomplete. A listing, download or reminder is not verified civic participation.</p>
    <p>Uses your jurisdiction browsing preference above. All dates display in UTC. Confirm local time, cancellations and access details with the organizer before attending.</p>
    <p>Nothing is exported or scheduled automatically. Calendar files are snapshots and do not receive source updates. Optional reminders work only after import into your calendar and can be removed there.</p>
    <label>Meeting topic<select value={topic} onChange={e => setTopic(e.target.value)}><option value="">All meeting topics</option>{topics.map(t => <option key={t}>{t}</option>)}</select></label>
    {phase === 'loading' && <p role="status">Loading public meeting sources…</p>}
    {phase === 'failed' && <p role="alert">Public meeting sources unavailable. No meeting times or agendas can be confirmed.</p>}
    <button type="button" disabled={phase === 'loading'} onClick={() => setAttempt(n => n + 1)}>Refresh meeting sources</button>
    {phase === 'ready' && <p role="status">{visible.length} meetings match. {!visible.length && 'No reviewed meetings available for these filters. This does not mean no meetings are scheduled.'}</p>}
    {visible.map(m => <MeetingCard key={JSON.stringify(m)} meeting={m} now={now} />)}
  </section>;
}
