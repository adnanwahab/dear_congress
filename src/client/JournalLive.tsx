import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { JournalEntry } from '../engine/types';
import { isPublicEntry } from '../shared/moderation';

type Snapshot = { entries: JournalEntry[]; needs: { id: string; label: string }[] };
const Live = createContext<{ snapshot: Snapshot | null; status: 'connecting' | 'live' | 'reconnecting' }>({ snapshot: null, status: 'connecting' });
export const useJournalLive = () => useContext(Live);
export function JournalLiveProvider({ children }: { children: ReactNode }) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [status, setStatus] = useState<'connecting' | 'live' | 'reconnecting'>('connecting');
  useEffect(() => {
    const stream = new EventSource('/api/entries/events');
    stream.onopen = () => setStatus('live');
    stream.onerror = () => setStatus('reconnecting');
    stream.onmessage = event => {
      try {
        const data = JSON.parse(event.data);
        if (!Array.isArray(data.entries) || !Array.isArray(data.needs)) return;
        setSnapshot({ entries: data.entries.filter(isPublicEntry), needs: data.needs });
        setStatus('live');
      } catch { /* Ignore malformed snapshots; retain reconnect behavior. */ }
    };
    return () => stream.close();
  }, []);
  return <Live.Provider value={{ snapshot, status }}>{children}</Live.Provider>;
}

export function tickerText(entry: JournalEntry, needs: Snapshot['needs']) {
  const label = needs.find(n => n.id === entry.extraction.needs[0]?.id)?.label ?? 'Shared experience';
  return ['New story', 'Location not shared', label, ...(entry.seeded ? ['Sample'] : []), ...(entry.synthetic ? ['Simulated'] : []), 'just now'].join(' · ');
}

// The initial snapshot is a baseline, including after a full page navigation.
export function reconcileTicker(previous: Set<string> | null, queue: string[], entries: JournalEntry[]) {
  const visible = entries.filter(isPublicEntry);
  const ids = new Set(visible.map(e => e.id));
  return { ids, queue: previous === null ? [] : [...queue.filter(id => ids.has(id)), ...visible.filter(e => !previous.has(e.id) && !queue.includes(e.id)).map(e => e.id)].slice(-20) };
}

export function JournalTicker() {
  const { snapshot } = useJournalLive();
  const seen = useRef<Set<string> | null>(null);
  const [queue, setQueue] = useState<string[]>([]);
  const [paused, setPaused] = useState(false);
  const [dismissed, setDismissed] = useState(() => { try { return sessionStorage.getItem('journal-ticker-dismissed') === '1'; } catch { return false; } });
  const [announcement, setAnnouncement] = useState('');
  const lastAnnouncement = useRef(-Infinity);
  useEffect(() => {
    if (!snapshot) return;
    const previous = seen.current;
    setQueue(old => reconcileTicker(previous, old, snapshot.entries).queue);
    seen.current = new Set(snapshot.entries.map(e => e.id));
  }, [snapshot]);
  const entry = snapshot?.entries.find(e => e.id === queue[0]);
  const text = entry && snapshot ? tickerText(entry, snapshot.needs) : '';
  useEffect(() => {
    if (paused || dismissed || !queue.length) return;
    const timer = setTimeout(() => setQueue(old => old.slice(1)), 8000);
    return () => clearTimeout(timer);
  }, [queue, paused, dismissed]);
  useEffect(() => {
    if (dismissed || !text) { setAnnouncement(''); return; }
    if (Date.now() - lastAnnouncement.current >= 30000) {
      lastAnnouncement.current = Date.now(); setAnnouncement(text);
    } else setAnnouncement('');
  }, [text, dismissed]);
  return <><span className="journal-ticker-sr" role="status" aria-live="polite" aria-atomic="true">{announcement}</span>{!dismissed && entry && <aside className="journal-ticker" aria-label="New journal stories" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onFocus={() => setPaused(true)} onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget)) setPaused(false); }}><a key={entry.id} href={`/journal?entry=${encodeURIComponent(entry.id)}#story-${encodeURIComponent(entry.id)}`}>{text}</a><button aria-label="Dismiss story ticker for this session" onClick={() => { setDismissed(true); try { sessionStorage.setItem('journal-ticker-dismissed', '1'); } catch { /* Memory fallback. */ } }}>×</button></aside>}</>;
}
