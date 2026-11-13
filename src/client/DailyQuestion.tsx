import { useEffect, useState } from 'react';
import type { DemoPayload } from '../engine/demo';
import { chicagoDate, dailyQuestion, nextChicagoDay } from '../shared/daily-question';
import './daily-question.css';

type Request = <T>(path: string, body?: unknown, method?: string) => Promise<T>;
export function DailyQuestion({ request }: { request: Request }) {
  const [snapshot, setSnapshot] = useState<{ data: DemoPayload; day: string } | null>(null);
  const [now, setNow] = useState(() => new Date());
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true, generation = 0;
    let timer: ReturnType<typeof setTimeout>;
    async function refresh() {
      const current = ++generation;
      clearTimeout(timer);
      setSnapshot(null); setError(false); setNow(new Date());
      try {
        const data = await request<DemoPayload>('/api/demo');
        if (!active || generation !== current) return;
        const time = new Date();
        setNow(time); setSnapshot({ data, day: chicagoDate(time) });
        const expiry = Date.parse(data.closesAt);
        const boundary = Math.min(nextChicagoDay(time), expiry > +time ? expiry : Infinity);
        timer = setTimeout(refresh, Math.max(1, boundary - +time));
      } catch {
        if (active && generation === current) setError(true);
      }
    }
    const resume = () => { if (document.visibilityState !== 'hidden') void refresh(); };
    void refresh();
    window.addEventListener('focus', resume);
    document.addEventListener('visibilitychange', resume);
    window.addEventListener('advisory-vote:saved', resume);
    return () => { active = false; clearTimeout(timer); window.removeEventListener('focus', resume); document.removeEventListener('visibilitychange', resume); window.removeEventListener('advisory-vote:saved', resume); };
  }, [request, attempt]);
  const item = snapshot && snapshot.day === chicagoDate(now) ? dailyQuestion(snapshot.data, now) : undefined;
  const choice = item ? snapshot?.data.votes[item.id] : undefined;
  const completed = choice === -1 || choice === 0 || choice === 1;
  return <section className="panel daily-question" aria-labelledby="daily-title">
    <h2 id="daily-title">Today's question</h2>
    <p>{chicagoDate(now)} · America/Chicago</p>
    {error ? <><p role="alert">Today's question could not be loaded. No choice has been changed.</p><button onClick={() => setAttempt(n => n + 1)}>Retry today's question</button></> : !snapshot ? <p role="status">Loading today's question…</p> : !item ? <p>No open question is available right now. Come back tomorrow or explore the proposal feed.</p> : <>
      <p><strong>Fictional demo proposal · non-binding advisory choice</strong></p>
      <h3>{item.title}</h3><p>{item.summary}</p>
      <p>Sample tallies elsewhere are illustrative and include demo activity; they are not verified public participation.</p>
      {completed && <p role="status">Your advisory choice is saved: {choice === 1 ? 'Support' : choice === -1 ? 'Oppose' : 'Not sure'}. Come back tomorrow for another question.</p>}
      <div className="daily-actions"><a href={`/feed?proposal=${encodeURIComponent(item.id)}`}>Read why</a><a href={`/votes?proposal=${encodeURIComponent(item.id)}#advisory-choice`}>{completed ? 'Change your advisory choice' : 'Make an advisory choice'}</a></div>
    </>}
  </section>;
}
