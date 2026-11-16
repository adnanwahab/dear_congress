import { useEffect, useState } from 'react';
import type { DemoItem } from '../engine/demo';
import { ProposalProvenance } from './ProposalProvenance';
import { createJury, juryReady, nextTurn, tickJury, consentedSummary, JURY_AGENDA } from './citizen-jury';
import './citizen-jury.css';

export function CitizenJury({ item }: { item: DemoItem }) {
  const [room, setRoom] = useState(createJury);
  const [opened, setOpened] = useState(false);
  useEffect(() => {
    if (!opened || room.paused) return;
    const id = window.setInterval(() => setRoom(tickJury), 1000);
    const pause = () => { if (document.hidden) setRoom(r => ({ ...r, paused: true })); };
    document.addEventListener('visibilitychange', pause);
    return () => { window.clearInterval(id); document.removeEventListener('visibilitychange', pause); };
  }, [opened, room.paused]);
  const complete = room.turn === 9;
  const summary = consentedSummary(room);
  return <section className="panel citizen-jury" aria-label="Mini citizen jury rehearsal">
    <h2>Mini citizen jury</h2>
    <p>Opt-in, shared-device rehearsal for three people and a facilitator. Local demo only; no verified civic participation. Public pilot and publishing are disabled.</p>
    <p>Use pseudonyms only. Notes and consent stay in page memory and disappear on reload, proposal change or deletion. Do not enter sensitive information. Reports here only pause this device; no moderator receives them.</p>
    {!opened ? <button onClick={() => setOpened(true)}>Open local rehearsal</button> : <>
      <h3>Agenda · {item.title}</h3>
      <ol>{JURY_AGENDA.map(step => <li key={step}>{step} · one 60-second turn per seat</li>)}</ol>
      <p>Facilitator: pass the device to each person for consent. Listen without interruption. Each seat gets one turn per agenda item; passing is always allowed. Pause for access needs.</p>
      <fieldset><legend>Opt in individually</legend>{room.seats.map((seat, i) => <div key={i}>
        <label>Pseudonym for seat {i + 1}<input maxLength={30} value={seat.alias} onChange={e => setRoom(r => ({ ...r, seats: r.seats.map((s, j) => j === i ? { ...s, alias: e.target.value, summaryConsent: false } : s) }))} /></label>
        <label><input type="checkbox" checked={seat.consent} onChange={e => setRoom(r => ({ ...r, paused: true, summary: '', seats: r.seats.map((s, j) => j === i ? { ...s, consent: e.target.checked, summaryConsent: false } : { ...s, summaryConsent: false }) }))} />Seat {i + 1}: I agree to this local rehearsal and respectful discussion; I can withdraw and delete at any time.</label>
      </div>)}</fieldset>
      <h3>Cited claim card · proposal clause</h3>
      <blockquote>{item.proposedText}</blockquote>
      <p>Citation: adnanwahab/dear_congress · fictional-demo · {item.id} · current sample proposal text. This card quotes the proposal, not evidence of its effects. Discuss benefits, objections and missing evidence separately.</p>
      <ProposalProvenance item={item} compact />
      {!juryReady(room) && <p role="status">Waiting for all three seats to opt in.</p>}
      <p role="status">{complete ? 'All seats have had equal turn opportunities. Review the summary together.' : `${JURY_AGENDA[Math.floor(room.turn / 3)]} — Seat ${room.turn % 3 + 1}: ${room.seats[room.turn % 3]!.alias || 'Unnamed'}. ${room.paused ? 'Paused.' : 'Turn running.'}`}</p>
      {!complete && <><p role="timer" aria-label="Seconds remaining">{room.remaining} seconds remaining</p>
        <button disabled={!juryReady(room) || room.reported || room.remaining === 0} onClick={() => setRoom(r => ({ ...r, paused: !r.paused }))}>{room.paused ? 'Start / resume turn' : 'Pause turn'}</button>
        <button disabled={!juryReady(room) || room.reported} onClick={() => setRoom(nextTurn)}>Finish or pass turn</button></>}
      <button onClick={() => setRoom(r => ({ ...r, reported: true, paused: true, seats: r.seats.map(s => ({ ...s, summaryConsent: false })) }))}>Report concern and pause</button>
      {room.reported && <div role="alert"><p>Rehearsal paused for facilitator review. Nothing was sent. Resolve the concern together or delete the room; resume only with everyone's agreement.</p><button onClick={() => setRoom(r => ({ ...r, reported: false, paused: true }))}>Facilitator: concern reviewed, keep paused</button></div>}
      <label>Draft summary · include disagreement and uncertainty<textarea maxLength={2000} value={room.summary} onChange={e => setRoom(r => ({ ...r, summary: e.target.value, seats: r.seats.map(s => ({ ...s, summaryConsent: false })) }))} /></label>
      <fieldset disabled={!complete || !juryReady(room) || room.reported}><legend>Consent to this exact summary · pass device to each seat</legend>{room.seats.map((s, i) => <label key={i}><input type="checkbox" checked={s.summaryConsent} onChange={e => setRoom(r => ({ ...r, seats: r.seats.map((seat, j) => j === i ? { ...seat, summaryConsent: e.target.checked } : seat) }))} />Seat {i + 1}: I consent to previewing this exact summary locally.</label>)}</fieldset>
      {summary && <section aria-label="Consented local summary"><h3>Consented local preview</h3><p style={{ whiteSpace: 'pre-wrap' }}>{summary}</p></section>}
      <p>Public publishing is unavailable. A real pilot requires authenticated opt-in membership, private reporting to trained moderators, enforceable deletion and separately recorded publication consent.</p>
      <button onClick={() => { setRoom(createJury()); setOpened(false); }}>Delete room, notes and consent / withdraw</button>
    </>}
  </section>;
}
