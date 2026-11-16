import { useRef, useState } from 'react';
import './policy-pinball.css';

// Authored fiction only: no proposal inputs, participation callbacks or persistence.
export const PINBALL_RULES = [
  { gate: 'Budget', rule: 'If a token costs 3 counters and the pocket holds 2, bounce to the smaller pilot lane.', result: 'Triangle becomes a 2-counter pilot. One counter of scope is removed.', x: 78, y: 24 },
  { gate: 'Jurisdiction', rule: 'If the pilot crosses two imaginary districts, bounce to their shared desk.', result: 'Triangle waits at the shared desk. Budget fit alone cannot grant authority.', x: 22, y: 44 },
  { gate: 'Evidence', rule: 'If the shared desk has only one fictional observation, bounce to a trial lane requiring two observations.', result: 'Triangle collects a second scripted observation. This is invented evidence, not research.', x: 78, y: 64 },
  { gate: 'Implementation', rule: 'If the trial needs two crews but only one is available, bounce to a two-turn schedule.', result: 'Triangle finishes as a smaller, shared, trial project over two turns. No real policy outcome is predicted.', x: 40, y: 84 },
] as const;

export function PolicyPinball({ onOpen }: { onOpen?: () => void }) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const launch = useRef<HTMLButtonElement>(null);
  function close() { setOpen(false); setStep(0); launch.current?.focus(); }
  const current = PINBALL_RULES[step - 1];
  return <section className="policy-pinball" aria-label="Policy systems pinball">
    <button ref={launch} type="button" aria-expanded={open} onClick={() => { onOpen?.(); setOpen(true); }}>Play policy pinball · fictional learning game</button>
    {open && <div onKeyDown={e => { if (e.key === 'Escape') { e.stopPropagation(); close(); } }}>
      <h2>Policy systems pinball</h2>
      <span className="chip">Source: scripted hypothetical · local only</span>
      <p>Every scene is fictional. Launch an abstract triangle through interacting constraints. No real vote, advisory participation, bill, or record changes. No points, rewards or ideological choices.</p>
      <div className="pinball-board" aria-hidden="true">
        <svg viewBox="0 0 100 100" focusable="false"><polyline points={'50,5 ' + PINBALL_RULES.slice(0, step).map(r => `${r.x},${r.y}`).join(' ')} /><text x={current?.x ?? 50} y={current?.y ?? 5}>▲</text></svg>
        {PINBALL_RULES.map((r, i) => <span key={r.gate} className={step === i + 1 ? 'active' : ''} style={{ left: `${r.x}%`, top: `${r.y}%` }}>{i + 1} · {r.gate}</span>)}
      </div>
      <p role="status" aria-live="polite">{current ? `Fictional bounce ${step} of 4 · ${current.gate}: ${current.result}` : 'Fictional launch pad: triangle costs 3 counters; pocket holds 2. Ready to launch.'}{step === 4 && ' Playthrough complete.'}</p>
      {current && <p><strong>Rule card · {current.gate}:</strong> {current.rule}</p>}
      <div className="pinball-controls">
        <button type="button" disabled={step === 4} onClick={() => setStep(s => Math.min(4, s + 1))}>{step === 0 ? 'Launch token' : 'Next bounce'}</button>
        <button type="button" onClick={() => setStep(0)}>Restart</button>
        <button type="button" onClick={close}>Skip</button>
        <button type="button" onClick={close}>Exit</button>
      </div>
      <details><summary>Complete text explanation and all rule cards</summary>
        <p>Fictional launch: triangle costs 3 counters with only 2 available. Each press advances exactly one scripted bounce, with no timer or random physics. Tap buttons or use Tab and Enter/Space. Escape exits. Restart returns to launch; Skip and Exit return to the page. Closing or leaving discards game state.</p>
        <ol>{PINBALL_RULES.map(r => <li key={r.gate}><strong>{r.gate}</strong>: {r.rule} {r.result}</li>)}</ol>
        <p>The constraints interact: affordable scope still needs authority, evidence and staffing. Completion is an educational illustration, never approval or a forecast.</p>
      </details>
    </div>}
  </section>;
}
