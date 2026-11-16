import { motionDisabled, motionDuration } from "./motion";
import { useEffect, useRef, useState, useId, type CSSProperties } from 'react';
import type { DemoItem } from '../engine/demo';
import './advisory-vote-bars.css';
import { AdvisoryShare } from './AdvisoryShare';

const OPTIONS = [['Support', 1, 'support'], ['Oppose', -1, 'oppose'], ['Not sure', 0, 'unsure']] as const;

function LivePulse({ count = 0 }: { count?: number }) {
  const previous = useRef(count);
  const queue = useRef(0);
  const [pulse, setPulse] = useState(0);
  useEffect(() => {
    queue.current += Math.max(0, count - previous.current);
    previous.current = count;
  }, [count]);
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (queue.current > 0) { queue.current--; setPulse(n => n + 1); }
    }, 100);
    return () => window.clearInterval(timer);
  }, []);
  return <span key={pulse} className={pulse ? 'live-pulse live-pulse-marker' : 'live-pulse-marker'} aria-hidden="true" />;
}

export function FictionalResponseGraphic({ item }: { item: DemoItem }) {
  const description = useId();
  const total = item.support + item.oppose + item.unsure;
  return <figure className="fictional-response-graphic" aria-describedby={description}>
    <figcaption><h3>Fictional sample responses</h3></figcaption>
    <p id={description}>Synthetic teaching data, not people or community turnout. These numbers never include your browser choice or join the browser tally.</p>
    <p>{total.toLocaleString()} fictional sample responses</p>
    <ul>{OPTIONS.map(([label, , field]) => <li key={field}>
      <span>{label}: {item[field].toLocaleString()} fictional responses</span>
      <span className="advisory-track" aria-hidden="true"><span style={{ '--vote-share': total ? item[field] / total : 0 } as CSSProperties} /></span>
    </li>)}</ul>
  </figure>;
}

/** Presentation only: choices and counts always come from the acknowledged payload. */
export function AdvisoryVoteBars({ item, choice, busy, confirmation, onVote, live, pulses, browserCounts }: {
  browserCounts?: Pick<DemoItem, "support" | "oppose" | "unsure">; live?: boolean; pulses?: number[]; item: DemoItem; choice?: number; busy: boolean; confirmation: number; onVote: (stance: number) => void;
}) {
  const description = useId();
  const counts = live ? item : browserCounts;
  const host = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [reduced, setReduced] = useState(() => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
  const [shown, setShown] = useState([0, 0, 0]);
  const current = useRef(shown);
  const [highlight, setHighlight] = useState<number>();
  const previousConfirmation = useRef(confirmation);
  const values = [counts?.support ?? 0, counts?.oppose ?? 0, counts?.unsure ?? 0];
  const total = values.reduce((sum, n) => sum + n, 0);
  useEffect(() => {
    const media = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!media) return;
    const update = () => setReduced(media.matches);
    update(); media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') { setVisible(true); return; }
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) { setVisible(true); observer.disconnect(); }
    });
    if (host.current) observer.observe(host.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (previousConfirmation.current === confirmation) return;
    previousConfirmation.current = confirmation;
    setHighlight(choice);
    const timer = window.setTimeout(() => setHighlight(undefined), motionDuration(1000));
    return () => window.clearTimeout(timer);
  }, [confirmation, choice]);
  useEffect(() => {
    if (motionDisabled() || reduced || typeof requestAnimationFrame === 'undefined') {
      current.current = values; setShown(values); return;
    }
    if (!visible) return;
    const from = current.current;
    let start: number | undefined;
    let frame: number;
    const tick = (time: number) => {
      start ??= time;
      const progress = Math.min((time - start) / motionDuration(550), 1);
      const next = values.map((n, i) => Math.round(from[i]! + (n - from[i]!) * (1 - (1 - progress) ** 3)));
      current.current = next; setShown(next);
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [visible, reduced, counts?.support, counts?.oppose, counts?.unsure]);
  return <div ref={host} className="advisory-tallies" role={live ? undefined : "region"} aria-label={live ? undefined : "Unverified browser choices"}>
    {!live && <><h3>Unverified browser choices</h3><p id={description}>Cookie-based advisory choices, not unique people, verified eligibility, or an official ballot. Fictional sample responses are excluded.</p>{counts ? <p>Support: {counts.support} · Oppose: {counts.oppose} · Not sure: {counts.unsure}</p> : <p>Browser counts unavailable.</p>}</>}
    {live && <p>Live round · advisory · not a poll</p>}
    <div className="vote-options advisory-bars">{OPTIONS.map(([label, stance, field], index) => {
      const count = counts?.[field] ?? 0;
      const share = total ? count / total : 0;
      const percentage = `${(share * 100).toFixed(1)}%`;
      return <button key={field} className={highlight === stance ? 'vote-confirmed' : undefined}
        aria-describedby={live ? undefined : description} aria-pressed={choice === stance} disabled={busy} onClick={() => onVote(stance)}
        aria-label={`Cast advisory vote: ${label}${choice === stance ? ', selected' : ''}. ${counts ? `${count.toLocaleString()} ${live ? "responses" : "browser choices"}, ${percentage}` : "browser counts unavailable"}`}>
        <span className="advisory-label">{live && <LivePulse count={pulses?.[index]} />}Cast advisory vote: {label}{choice === stance ? ' ✓' : ''}</span>
        <span className="advisory-value" aria-hidden="true">{counts ? `${(reduced ? count : shown[index]!).toLocaleString()} · ${percentage}` : "Unavailable"}</span>
        <span className="advisory-track" aria-hidden="true"><span style={{ '--vote-share': reduced || visible ? share : 0 } as CSSProperties} /></span>
      </button>;
    })}</div>
    {!live && <AdvisoryShare key={item.id} id={item.id} choice={choice} />}
  </div>;
}
