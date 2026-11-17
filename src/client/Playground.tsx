import { useRef, useState } from 'react';
import { runViewTransition } from './motion';
import { ParticipationNotice } from './ParticipationNotice';
import './workflow.css';
import './playground.css';

export const SAMPLE_STATES = [
  { id: 'success', title: 'Success', text: 'Sample action completed. No real response was saved.' },
  { id: 'pending', title: 'Pending', text: 'Sample action is waiting. No result is confirmed.' },
  { id: 'blocked', title: 'Blocked', text: 'Sample action cannot continue. Review the requirement before retrying.' },
  { id: 'offline', title: 'Offline', text: 'Sample connection is unavailable. Nothing has been sent.' },
  { id: 'synthetic', title: 'Synthetic', text: 'Fictional sample data. This is not a measured outcome or a verified vote.' },
  { id: 'empty', title: 'Empty', text: 'No sample records are available. No result can be inferred.' },
] as const;
type SampleState = typeof SAMPLE_STATES[number];
export function SampleCard({ sample }: { sample: SampleState }) {
  return <article className="panel playground-card" data-sample-state={sample.id}>
    <h3>{sample.title}</h3><p>{sample.text}</p>
    <details><summary className="playground-source">Source · local synthetic fixture</summary>
      <p>Repository: adnanwahab/dear_congress. Item kind: playground fixture. No official record, ballot, PR revision, receipt or resident data is attached.</p>
    </details>
  </article>;
}
export default function Playground() {
  const [selected, setSelected] = useState<SampleState>(SAMPLE_STATES[0]);
  const [staticMode, setStaticMode] = useState(false);
  const sheet = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const [inline, setInline] = useState(false);
  const choose = (sample: SampleState) => {
    if (staticMode) setSelected(sample);
    else void runViewTransition(() => setSelected(sample), 'filter');
  };
  return <div className="civic-shell workflow-shell"><main id="main-content" tabIndex={-1} className="civic-main workflow-main playground" data-static={staticMode}>
    <h1>Civic interaction playground</h1>
    <p>Contributor gallery · synthetic fixtures only. Controls never submit votes or change civic data.</p>
    <ParticipationNotice />
    <section className="panel" aria-labelledby="playground-controls"><h2 id="playground-controls">State transitions</h2>
      <label><input type="checkbox" checked={staticMode} onChange={e => setStaticMode(e.target.checked)} /> Static preview / low power</label>
      <p>Reduced motion and motion=off also skip transitions. Every mode shows the same information.</p>
      <div className="playground-controls" role="group" aria-label="Sample state">{SAMPLE_STATES.map(sample => <button key={sample.id} aria-pressed={selected.id === sample.id} onClick={() => choose(sample)}>{sample.title}</button>)}</div>
      <div role="status" aria-live="polite" aria-atomic="true"><SampleCard sample={selected} /></div>
      <button ref={trigger} aria-haspopup="dialog" onClick={() => {
        if (typeof sheet.current?.showModal === 'function') sheet.current.showModal();
        else setInline(true);
      }}>Open sample sheet</button>
      <dialog ref={sheet} className="more-sheet" aria-labelledby="playground-sheet-title" onClose={() => trigger.current?.focus()}>
        <h2 id="playground-sheet-title">Sample sheet</h2><p>{selected.title}: {selected.text}</p>
        <button autoFocus onClick={() => sheet.current?.close()}>Close sample sheet</button>
      </dialog>
      {inline && <section aria-label="Sample sheet fallback"><h2>Sample sheet</h2><p>{selected.title}: {selected.text}</p><button onClick={() => { setInline(false); trigger.current?.focus(); }}>Close sample sheet</button></section>}
    </section>
    <section aria-labelledby="playground-gallery"><h2 id="playground-gallery">All states · static fallback</h2>
      <p>Use this gallery when transitions or modal sheets are unavailable. Source details open with Enter, Space or a tap. Escape closes the modal sheet and returns focus.</p>
      <div className="playground-grid">{SAMPLE_STATES.map(sample => <SampleCard key={sample.id} sample={sample} />)}</div>
    </section>
    <p>Drafts and preferences in participation screens are separate; this gallery collects no text and saves no choices.</p>
    <a href="/account">Participation &amp; privacy</a>
  </main></div>;
}
