import { useEffect, useState } from 'react';
import type { DemoItem } from '../engine/demo';
import { stageRoute } from '../shared/civic-stages';
import { ProposalProvenance } from './ProposalProvenance';
import { motionDisabled, motionDuration } from './motion';
import './civic-marble-run.css';

export type Constraint = 'clear' | 'review' | 'votes' | 'capacity';
export const STOPS = [
  ['Drafting office', 'A fictional sponsor prepares and introduces a federal bill.'],
  ['Committee review', 'Committees consider the proposal; many bills do not advance.'],
  ['House and Senate votes', 'Both chambers must agree to the same text. This sample assumes that agreement.'],
  ['President’s desk', 'This path assumes a presidential signature. Vetoes and overrides are omitted.'],
  ['Agency delivery', 'Implementation can require funding, rules and administrative capacity. Enactment alone does not prove delivery.'],
] as const;
export const CONSTRAINTS: Record<Constraint, string> = { clear: 'Assume all sample gates clear', review: 'Committee requests revision', votes: 'Chamber support falls short', capacity: 'Delivery capacity unavailable' };
export function marblePath(constraint: Constraint): number[] {
  if (constraint === 'review') return [0, 1, 5];
  if (constraint === 'votes') return [0, 1, 2, 6];
  if (constraint === 'capacity') return [0, 1, 2, 3, 4, 7];
  return [0, 1, 2, 3, 4, 8];
}
const BRANCHES = [
  ['Revise draft', 'Return to drafting in a new run; no passage assumed.'],
  ['Proposal stalls', 'No enactment in this hypothetical run.'],
  ['Delivery waits', 'Funding or capacity must be resolved; no service delivered yet.'],
  ['Hypothetical delivery', 'The sample reaches delivery. No real outcome is established.'],
] as const;
const NODES = [...STOPS, ...BRANCHES];

export function CivicMarbleRun({ item }: { item: DemoItem }) {
  const [constraint, setConstraint] = useState<Constraint>('clear');
  const [step, setStep] = useState(0);
  const [running, setRunning] = useState(false);
  const path = marblePath(constraint);
  const node = path[step]!;
  const end = step === path.length - 1;
  useEffect(() => {
    if (!running || end) return;
    const timer = window.setTimeout(() => {
      if (motionDisabled()) { setRunning(false); return; }
      setStep(s => Math.min(s + 1, path.length - 1));
    }, motionDuration(1600));
    return () => window.clearTimeout(timer);
  }, [running, step, end, constraint]);
  function move(delta: number) { setRunning(false); setStep(s => Math.max(0, Math.min(path.length - 1, s + delta))); }
  return <section className="panel marble-run" aria-label="Civic marble-run sandbox">
    <span className="pill info">Educational sandbox · unreviewed demo</span>
    <h2>Trace a policy through institutions</h2>
    <p>Move a fictional marble through a simplified US federal bill process. These sample constraints are invented, not vote counts, probabilities, forecasts or actual status. Local and state processes differ.</p>
    <p>Selected fictional proposal: <strong>{item.title}</strong>. Its jurisdiction is background only; this federal example does not assert that Congress is the appropriate office.</p>
    <ProposalProvenance item={item} />
    <label>Sample constraint <select value={constraint} onChange={e => { setConstraint(e.target.value as Constraint); setStep(0); setRunning(false); }}>{Object.entries(CONSTRAINTS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
    <div className="marble-controls">
      <button onClick={() => { if (motionDisabled()) { move(1); } else setRunning(r => !r); }} disabled={end}>{running && !end ? 'Pause' : 'Play / advance without motion'}</button>
      <button onClick={() => move(-1)} disabled={step === 0}>Previous stage</button>
      <button onClick={() => move(1)} disabled={end}>Next stage</button>
      <button onClick={() => { setStep(0); setRunning(false); }}>Reset run</button>
    </div>
    <p>Keyboard: Tab to a control, then Enter or Space. Touch: tap the same controls. Reduced motion uses manual steps.</p>
    <div className="marble-track" aria-hidden="true">{path.map((id, index) => <div key={id} className={`marble-stop ${index === step ? 'active' : ''}`}><span className="marble">{index === step ? '●' : '○'}</span><span>{NODES[id]![0]}</span>{index < path.length - 1 && <span>↓</span>}</div>)}</div>
    <p role="status" aria-live="polite">Step {step + 1} of {path.length}: <strong>{NODES[node]![0]}</strong>. {NODES[node]![1]} {end ? 'Run complete. Reset or change a constraint to explore another path.' : ''}</p>
    <details open><summary>Static decision diagram · all branches</summary>
      <ol>{STOPS.map(([title, description], i) => <li key={title}><strong>{title}</strong>: {description}{i === 1 && <p>Revision requested → Revise draft (stop). Otherwise → chamber votes.</p>}{i === 2 && <p>Support falls short → Proposal stalls (stop). Otherwise → President’s desk.</p>}{i === 4 && <p>Capacity unavailable → Delivery waits (stop). Otherwise → Hypothetical delivery.</p>}</li>)}</ol>
      <p>This diagram and every branch remain available without animation. Timing is illustrative; real processes can repeat, diverge or stop.</p>
    </details>
    <p>Process source: <a href="https://www.congress.gov/legislative-process">Library of Congress · Legislative Process</a>. <a href="https://www.usa.gov/how-laws-are-made">USA.gov · How laws are made</a>. Sources describe the process, not this fictional proposal.</p>
    <p><a href={stageRoute('published', item.id)}>Official source desk and actual bill status (separate records)</a> · <a href={stageRoute('sponsors', item.id)}>Sample office tracker</a> · <a href="/synth">Explore policy effect models separately</a></p>
  </section>;
}
