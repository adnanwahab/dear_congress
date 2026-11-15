import { useState } from 'react';
import { COALITION_BUDGET, COALITION_OPTIONS, DEFAULT_COALITION_ASSUMPTIONS, evaluateCoalition, type CoalitionAssumptions, type CoalitionOption } from './coalition-scenario';
import './coalition-quest.css';

export function CoalitionQuest() {
  const [selected, setSelected] = useState<CoalitionOption[]>([]);
  const [acknowledged, setAcknowledged] = useState<CoalitionOption[]>([]);
  const [assumptions, setAssumptions] = useState({ ...DEFAULT_COALITION_ASSUMPTIONS });
  const [reviewed, setReviewed] = useState(false);
  const result = evaluateCoalition(selected, assumptions, acknowledged);
  function toggle(id: CoalitionOption) {
    setSelected(previous => previous.includes(id) ? previous.filter(value => value !== id) : [...previous, id]);
    setAcknowledged([]); setReviewed(false);
  }
  function reset() {
    setSelected([]); setAcknowledged([]); setAssumptions({ ...DEFAULT_COALITION_ASSUMPTIONS }); setReviewed(false);
  }
  return <section className="card coalition-quest" aria-labelledby="coalition-title">
    <p className="muted">Fictional sandbox · unreviewed demo · coalition-v1</p>
    <h2 id="coalition-title">Build a coalition, keep the differences</h2>
    <p>In the invented town of Lantern Bay, share a community hall budget of {COALITION_BUDGET} tokens. Meet the public constraints and identify every selected option’s cost to others. Nobody needs to change their beliefs.</p>
    <p>These fictional stakeholders represent no real people. Tokens are invented units. This exercise is separate from real civic negotiation, resident votes, measured evidence and model projections. Nothing is saved or sent to the simulator.</p>
    <details><summary>Edit fictional assumptions</summary>
      <p>Changing a constraint changes the exercise, not anyone’s consent. Budget stays fixed. Reload or reset restores the original scenario.</p>
      {([
        ['accessRequired', 'Mira requires step-free access'],
        ['eveningRequired', 'Sol requires evening opening'],
        ['quietRequired', 'Tavi requires insulation when evenings open'],
      ] as [keyof CoalitionAssumptions, string][]).map(([key, label]) => <label key={key}><input type="checkbox" checked={assumptions[key]} onChange={e => { setAssumptions({ ...assumptions, [key]: e.target.checked }); setAcknowledged([]); setReviewed(false); }} />{label}</label>)}
    </details>
    <h3>Public preference constraints</h3>
    <p>Mira favors access; Sol favors evening activities; Tavi favors quiet and would prefer a garden. The garden is a preference, not a blocking constraint.</p>
    <ul>{result.constraints.map(constraint => <li key={constraint.name}><strong>{constraint.name}</strong>: {constraint.requirement} <b>{constraint.met ? 'Met' : 'Unmet'}</b></li>)}</ul>
    <fieldset><legend>Choose the hall package</legend>
      {COALITION_OPTIONS.map(option => <label key={option.id}><input type="checkbox" checked={selected.includes(option.id)} onChange={() => toggle(option.id)} /><span><b>{option.title} · {option.cost} tokens</b><br />{option.tradeoff}</span></label>)}
    </fieldset>
    <p role="status" aria-live="polite">Budget: {result.cost} / {COALITION_BUDGET} tokens. {result.cost > COALITION_BUDGET ? `Over budget by ${result.cost - COALITION_BUDGET}.` : `${COALITION_BUDGET - result.cost} remaining.`} {result.feasible ? 'Constraints met.' : 'Package not yet feasible.'}</p>
    <fieldset><legend>Acknowledge the actual tradeoffs</legend>
      <p>For each selected option, choose its stated drawback. This checks understanding of the toy rules; it does not verify real-world impacts.</p>
      {COALITION_OPTIONS.filter(option => selected.includes(option.id)).map(option => <label key={option.id}>{option.title}<select value={acknowledged.includes(option.id) ? 'actual' : ''} onChange={e => { setAcknowledged(previous => e.target.value === 'actual' ? [...previous.filter(id => id !== option.id), option.id] : previous.filter(id => id !== option.id)); setReviewed(false); }}>
        <option value="">Choose a tradeoff</option><option value="none">No one gives anything up</option><option value="actual">{option.tradeoff}</option>
      </select></label>)}
      {!selected.length && <p>Select an option to inspect its tradeoff.</p>}
    </fieldset>
    <button type="button" onClick={() => setReviewed(true)}>Check compromise</button>{' '}
    <button type="button" onClick={reset}>Reset scenario</button>
    <p role="status">{reviewed ? result.won ? 'Exercise complete: feasible package and accurate tradeoffs. Preferences still differ; this is not consensus or real consent.' : !selected.length ? 'Choose at least one option.' : !result.feasible ? 'Try again: stay within budget and meet every public constraint. You can also inspect the assumptions.' : 'Feasible package. Identify each selected option’s actual tradeoff to finish.' : ''}</p>
    <p>The default compromise funds access, evenings and insulation for 12 tokens. The garden remains unfunded; Tavi’s preference is still different.</p>
  </section>;
}
