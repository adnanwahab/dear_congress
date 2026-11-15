import { useEffect, useRef, useState } from 'react';
import type { VoteRequest } from './advisory-mutation';
import './priority-allocation.css';
type Allocation = Record<string, number>;
type Need = { id: string; label: string };
export function movePoint(value: Allocation, source: string, target: string): Allocation {
  if (source === target || (source !== '' && !(value[source]! > 0))) return value;
  const used = Object.values(value).reduce((sum, n) => sum + n, 0);
  if (source === '' && used >= 100) return value;
  const next = { ...value };
  if (source) next[source] = next[source]! - 1;
  if (target) next[target] = (next[target] ?? 0) + 1;
  return next;
}
export function PriorityAllocation({ needs, initial, save }: { needs: Need[]; initial: Allocation; save: (value: Allocation) => Promise<void> }) {
  const [value, setValue] = useState(initial);
  const [history, setHistory] = useState<Allocation[]>([]);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [message, setMessage] = useState('');
  const [dirty, setDirty] = useState(false);
  const drag = useRef<{ source: string; pointer: number } | null>(null);
  const used = Object.values(value).reduce((sum, n) => sum + n, 0);
  function edit(next: Allocation) {
    if (busy || next === value) return;
    setHistory(old => [...old, value]); setValue(next); setDirty(true); setMessage('Unsaved changes.');
  }
  function tokens(amount: number) {
    return <span className="priority-tokens" aria-hidden="true">{Array.from({ length: amount }, (_, i) => <span key={i} className="priority-token" />)}</span>;
  }
  function zone(source: string, amount: number, label: string) {
    return <button type="button" className="priority-tray" data-priority-zone={source} disabled={busy || !amount}
      aria-label={`Move one point from ${label}. Use numeric inputs or plus and minus buttons to allocate without dragging.`}
      onPointerDown={event => {
        if (!event.isPrimary || event.button !== 0 || !amount) return;
        drag.current = { source, pointer: event.pointerId }; event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerCancel={() => { drag.current = null; }}
      onPointerUp={event => {
        const start = drag.current; drag.current = null;
        if (!start || start.pointer !== event.pointerId) return;
        const target = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>('[data-priority-zone]');
        if (target) edit(movePoint(value, start.source, target.dataset.priorityZone!));
      }}>{tokens(amount)}<span>{amount} {amount === 1 ? 'point' : 'points'}</span></button>;
  }
  return <section className="panel priority-allocation" data-no-stage-swipe aria-labelledby="priority-title">
    <h2 id="priority-title">Your 100 priority points</h2>
    <p>Personal, non-binding priorities. Drag one point between trays, or use the numeric inputs and + / − buttons. Only Save priorities sends your allocation. This does not cast a proposal vote.</p>
    <p role="status" aria-live="polite">{used} allocated · {100 - used} remaining · 100 total. {message}</p>
    <div data-priority-zone=""><h3>Points remaining</h3>{zone('', 100 - used, 'points remaining')}</div>
    {!needs.length && <p>No needs available yet. Your existing allocation is unchanged.</p>}
    {needs.map(need => <div key={need.id} className="priority-need" data-priority-zone={need.id}>
      <label htmlFor={`priority-${need.id}`}>{need.label}</label>
      <div className="priority-controls"><button type="button" disabled={busy || !(value[need.id]! > 0)} aria-label={`Remove one point from ${need.label}`} onClick={() => edit(movePoint(value, need.id, ''))}>−</button>
        <input id={`priority-${need.id}`} type="number" min="0" max={100 - used + (value[need.id] ?? 0)} step="1" value={value[need.id] ?? 0} disabled={busy} onChange={event => {
          const n = Number(event.target.value);
          if (!Number.isFinite(n)) return;
          edit({ ...value, [need.id]: Math.max(0, Math.min(Math.floor(n), 100 - used + (value[need.id] ?? 0))) });
        }} />
        <button type="button" disabled={busy || used >= 100} aria-label={`Add one point to ${need.label}`} onClick={() => edit(movePoint(value, '', need.id))}>+</button></div>
      {zone(need.id, value[need.id] ?? 0, need.label)}
    </div>)}
    <div className="priority-actions"><button type="button" disabled={busy || !history.length} onClick={() => { setValue(history[history.length - 1]!); setHistory(history.slice(0, -1)); setDirty(true); setMessage('Last change undone. Save to keep this allocation.'); }}>Undo</button>
    <button type="button" disabled={busy || !dirty || !needs.length} onClick={async () => {
      if (lock.current) return;
      lock.current = true; setBusy(true); setMessage('Saving priorities…');
      try { await save({ ...value }); setDirty(false); setHistory([]); setMessage('Priorities saved. Available on refresh in this browser identity.'); }
      catch { setMessage('Could not confirm the save. Your draft is still here; retry Save priorities.'); }
      finally { lock.current = false; setBusy(false); }
    }}>{busy ? 'Saving…' : 'Save priorities'}</button></div>
  </section>;
}
export function PersonalPriorities({ request }: { request: VoteRequest }) {
  const [data, setData] = useState<{ needs: Need[]; user: { allocation: Allocation } } | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setError(false);
    request<{ needs: Need[]; user: { allocation: Allocation } }>('/api/state').then(value => {
      if (!Array.isArray(value?.needs) || !value.user?.allocation || Object.values(value.user.allocation).some(n => !Number.isFinite(n) || n < 0) || Object.values(value.user.allocation).reduce((a, b) => a + b, 0) > 100) throw new Error('Invalid priorities');
      if (active) { setData(value); setError(false); }
    }).catch(() => { if (active) setError(true); });
    return () => { active = false; };
  }, [request, attempt]);
  if (!data) return <section className="panel" aria-busy={!error}>{error ? <><p role="alert">Could not load your priorities.</p><button onClick={() => setAttempt(attempt + 1)}>Retry priorities</button></> : <p role="status">Loading your priority points…</p>}</section>;
  return <PriorityAllocation needs={data.needs} initial={data.user.allocation} save={async allocation => {
    const result = await request<{ ok?: boolean }>('/api/votes', { allocation });
    if (result.ok !== true) throw new Error('Missing acknowledgement');
  }} />;
}
