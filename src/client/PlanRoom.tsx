import { useEffect, useRef, useState } from 'react';
import type { RoomSeed, RoomSnapshot } from '../shared/plan-room';
import { budgetMoney, budgetUnits } from '../shared/plan-budget';

export function PlanRoom({ seed }: { seed: RoomSeed }) {
  const [invite, setInvite] = useState('');
  const [credentials, setCredentials] = useState<{ invite: string; member: string; alias: string } | null>(null);
  const [room, setRoom] = useState<RoomSnapshot | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [itemId, setItemId] = useState(''), [amount, setAmount] = useState('');
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  async function request(body: Record<string, unknown>) {
    const response = await fetch('/api/plan-rooms', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(10000) });
    const value = await response.json();
    if (!response.ok) throw new Error(value.error || 'Room unavailable.');
    return value;
  }
  useEffect(() => {
    if (!credentials) return;
    let cancelled = false;
    async function poll() {
      try { const value = await request({ action: 'poll', ...credentials }); if (!cancelled) { setRoom(value); setError(''); } }
      catch (e) { if (!cancelled) { setRoom(null); setError(e instanceof Error ? e.message : 'Connection lost.'); } }
    }
    void poll(); const timer = setInterval(() => void poll(), 15000);
    return () => { cancelled = true; clearInterval(timer); };
  }, [credentials]);
  async function enter(create: boolean) {
    setBusy(true); setError('');
    try {
      const token = create ? (await request({ action: 'create', seed })).invite : invite.trim().split('#plan-room=')[1] || invite.trim();
      if (!/^[a-f0-9]{64}$/.test(token)) throw new Error('Paste a complete room invitation.');
      const { member, alias } = await request({ action: 'join', invite: token });
      if (alive.current) { setInvite(token); setCredentials({ invite: token, member, alias }); }
    } catch (e) { if (alive.current) setError(e instanceof Error ? e.message : 'Room unavailable.'); }
    finally { if (alive.current) setBusy(false); }
  }
  return <details className="plan-room"><summary>Collaborative plan lab · private sandbox</summary>
    <p>Simulated fiscal suggestions only. Nothing here changes public synthesis, advisory votes or official decisions. Rooms disappear after one hour or a server restart. No private journals or votes are shared.</p>
    <p>Share only with trusted friends: anyone holding the invitation can join and see the frozen fiscal snapshot, pseudonyms and history. Guest names identify room sessions, not verified people. Presence means a connection in the last 45 seconds.</p>
    {!credentials && <><button disabled={busy} onClick={() => void enter(true)}>Create one-hour room from this ledger</button>
      <label>Room invitation <input value={invite} onChange={e => setInvite(e.target.value)} autoComplete="off" /></label>
      <button disabled={busy || !invite.trim()} onClick={() => void enter(false)}>Join invited room</button></>}
    {busy && <p role="status">Opening room…</p>}
    {error && <p role="alert">{error} {credentials && <button onClick={() => setCredentials({ ...credentials })}>Retry connection</button>}</p>}
    {credentials && <><p>Your pseudonym: {credentials.alias}.</p><label>Invitation to copy and send privately <input readOnly value={`${window.location.origin}/synth#plan-room=${credentials.invite}`} onFocus={e => e.currentTarget.select()} /></label>
      <p>Recipients open Synthesize, then paste this invitation into any Collaborative plan lab. Do not post it publicly.</p>
      {!room && !error && <p role="status">Loading room…</p>}
      <button disabled={busy} onClick={() => { setCredentials(null); setRoom(null); setInvite(''); setError(''); }}>Leave room</button></>}
    {room && <><h5>Room package {room.seed.packageId} · {room.seed.lane} · simulated snapshot</h5>
      <p>Expires {new Date(room.expiresAt).toLocaleString()}. Suggestions do not alter this frozen baseline and are not a jointly approved package.</p>
      <ul>{room.people.map(p => <li key={p.alias}>{p.alias}: {p.present ? 'present' : 'away'}</li>)}</ul>
      <ul>{room.seed.rows.map(r => <li key={r.id}>{r.title} · {r.jurisdiction}: {budgetMoney(r.amount)}. Source: {r.source}; date and uncertainty unknown.</li>)}</ul>
      <form onSubmit={async e => {
        e.preventDefault(); setBusy(true); setError('');
        try { if (!amount.trim()) throw new Error('Enter an annual allocation.'); const value = await request({ action: 'suggest', ...credentials, itemId, amount: budgetUnits(Number(amount)) }); if (alive.current) setRoom(value); }
        catch (e) { if (alive.current) setError(e instanceof Error ? e.message : 'Suggestion failed.'); }
        finally { if (alive.current) setBusy(false); }
      }}><label>Item <select required value={itemId} onChange={e => setItemId(e.target.value)}><option value="">Choose room item</option>{room.seed.rows.map(r => <option key={r.id} value={r.id}>{r.title}</option>)}</select></label>
        <label>Suggested annual allocation (USD billions) <input required type="number" min="0" max={room.seed.budget / 1000} step="0.001" value={amount} onChange={e => setAmount(e.target.value)} /></label>
        <button disabled={busy}>Suggest sandbox allocation</button></form>
      <h5>Visible change history</h5><p>Individual suggestions may conflict; no automatic application or combined-budget approval.</p>
      {!room.history.length && <p>No suggestions yet.</p>}
      <ol>{room.history.map((h, i) => <li key={i}>{h.alias} · {new Date(h.at).toLocaleTimeString()}: {room.seed.rows.find(r => r.id === h.itemId)?.title} → {budgetMoney(h.amount)}</li>)}</ol>
    </>}
  </details>;
}
