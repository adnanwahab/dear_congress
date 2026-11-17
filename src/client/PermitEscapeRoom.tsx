import { useEffect, useRef, useState } from 'react';
import './permit-escape-room.css';

const permits = [
  { name: 'Building permit', clue: 'The renovation drawing is approved, but the folder has no authorization to begin building work.' },
  { name: 'Electrical permit', clue: 'New wiring is on the drawing. The electrician’s separate trade authorization is missing.' },
  { name: 'Mechanical permit', clue: 'A new ventilation unit is on the drawing. The mechanical contractor’s separate authorization is missing.' },
];
export function PermitEscapeRoom({ onOpen }: { onOpen?: () => void }) {
  const [open, setOpen] = useState(false);
  const [found, setFound] = useState<string[]>([]);
  const [scene, setScene] = useState(0);
  const [feedback, setFeedback] = useState('');
  const dialog = useRef<HTMLDialogElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const launch = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (open) { dialog.current?.showModal(); heading.current?.focus(); }
    else if (dialog.current?.open) { dialog.current.close(); launch.current?.focus(); }
  }, [open]);
  useEffect(() => { if (open) heading.current?.focus(); }, [scene]);
  function restart() { setFound([]); setScene(0); setFeedback('Restarted. All fictional folders are reset.'); }
  function exit() { restart(); setOpen(false); }
  return <section className="permit-escape" aria-label="Optional civic puzzle">
    <p>Fictional city · Optional educational puzzle · About 3 minutes</p>
    <button ref={launch} type="button" onClick={() => { onOpen?.(); restart(); setOpen(true); }}>Play permit escape room</button>
    <dialog ref={dialog} aria-label="Fictional permit escape room" onCancel={e => { e.preventDefault(); exit(); }}>
      <p className="chip">CivicPlay · Fictional / hypothetical throughout</p>
      <h2 ref={heading} tabIndex={-1}>{['1 · Find the missing permits', '2 · Untangle conflicting rules', '3 · Meet the fictional deadline', 'Fictional backlog untangled'][scene]}</h2>
      <p>Welcome to invented Lantern City. A reading room hopes to open Friday. Every folder, rule, deadline and outcome here is invented. Playing never changes city services, votes, advisory participation or saved proposals. Progress exists only while this puzzle is open.</p>
      {scene === 0 && <>
        <p>Fictional records desk: discover three missing permits by matching each folder clue. No clock runs while you read.</p>
        {permits.map(permit => <article key={permit.name}><p>{permit.clue}</p><button type="button" disabled={found.includes(permit.name)} onClick={() => { setFound(previous => [...previous, permit.name]); setFeedback(`${permit.name} found. Match this authorization to its work before inspection.`); }}>Recover {permit.name}</button></article>)}
        <p>{found.length} of 3 fictional permits recovered.</p>
        <button type="button" disabled={found.length !== 3} onClick={() => { setScene(1); setFeedback(''); }}>Review conflicting rules</button>
      </>}
      {scene === 1 && <>
        <p>Fictional scheduling desk: an old memo says “book final inspection before trade approvals.” The current fictional checklist says “finish permitted trade work before final inspection.” The memo would send the folder back into the queue.</p>
        <button type="button" onClick={() => setFeedback('The old memo conflicts with the current checklist. Ask the fictional coordinator which version applies; do not bypass inspections.')}>Follow the old memo</button>
        <button type="button" onClick={() => { setScene(2); setFeedback('Conflict resolved: the fictional coordinator confirms the current checklist.'); }}>Confirm the current checklist with the coordinator</button>
      </>}
      {scene === 2 && <>
        <p>Fictional deadline desk: it is Monday. Trade work finishes Tuesday; final inspection is Wednesday; occupancy review is Thursday. The room opens Friday only if review succeeds. These durations are invented, with no promise of real turnaround.</p>
        <button type="button" onClick={() => setFeedback('Opening before inspection and occupancy review leaves the fictional safety checks incomplete. Try ordering the dependencies first.')}>Open Tuesday to beat the deadline</button>
        <button type="button" onClick={() => { setScene(3); setFeedback('You put the dependencies in order. No real permit was issued and no civic position was scored.'); }}>Finish trade work → inspection → occupancy review → Friday opening if approved</button>
      </>}
      {scene === 3 && <p>The fictional queue moves because the missing authorizations and conflicting checklist were resolved in sequence. If review fails, reschedule the opening. There are no points, ideological rewards or participation privileges.</p>}
      <p role="status" aria-live="polite">{feedback}</p>
      <details key={open ? 'open' : 'closed'}><summary>Complete-text explanation, solution and real-process sources</summary>
        <h3>Entire fictional story and solution</h3>
        <p>Lantern City’s reading-room renovation lacks building, electrical and mechanical permits. Recover all three folders. Confirm the current checklist with the coordinator instead of relying on the old memo. Finish trade work Tuesday, inspect Wednesday and seek occupancy review Thursday before a conditional Friday opening. Delay opening if approval is missing. The city, conflict and timeline are teaching inventions, not Houston rules.</p>
        <h3>What the real process illustrates</h3>
        <p>Houston’s business portal describes construction permits, separate trade permits, inspections and a certificate of occupancy before commercial occupancy. These are distinct steps; a plan or a game result is not permission to open. Requirements depend on the actual project and jurisdiction. Check with the responsible permitting office for current requirements.</p>
        <div className="workflow-provenance"><a className="chip" href="https://www.houstontx.gov/business/plan/permits-inspections.html" target="_blank" rel="noopener noreferrer">City of Houston · Permits and Inspections ↗</a><p>Background source reviewed November 15, 2026. Supports the distinction between permits, inspections and occupancy; it does not substantiate this invented backlog, conflict or deadline.</p></div>
        <p>This local exercise sends nothing, awards no civic authority and never alters advisory participation. Skip, restart or exit without penalty. A complete text solution is available regardless of progress.</p>
      </details>
      <div className="permit-actions">
        <button type="button" onClick={() => { setScene(3); setFeedback('Puzzle skipped. The complete explanation and solution are available below.'); }}>Skip puzzle</button>
        <button type="button" onClick={restart}>Restart puzzle</button>
        <button type="button" onClick={exit}>Exit puzzle</button>
      </div>
    </dialog>
  </section>;
}
