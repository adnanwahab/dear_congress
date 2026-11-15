import { useEffect, useRef, useState } from 'react';
import './flood-logistics.css';

const places = [
  { name: 'Willow homes', pressure: 7 },
  { name: 'Orchard workshop', pressure: 5 },
  { name: 'Lantern square', pressure: 6 },
];
const tools = {
  crew: { label: 'Crew', cost: 3, time: 2, reduction: 3 },
  kit: { label: 'Drainage kit', cost: 2, time: 1, reduction: 2 },
  closure: { label: 'Road closure', cost: 1, time: 1, reduction: 1 },
};
type Tool = keyof typeof tools;
type Placement = { place: number; tool: Tool };
export function FloodLogistics() {
  const scene = useRef<HTMLParagraphElement>(null);
  const invitation = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [round, setRound] = useState(0);
  const [placements, setPlacements] = useState<Placement[]>([]);
  const [tool, setTool] = useState<Tool>('crew');
  const [history, setHistory] = useState<string[]>([]);
  const [message, setMessage] = useState('');
  const spent = placements.reduce((n, p) => n + tools[p.tool].cost, 0);
  const time = placements.reduce((n, p) => n + tools[p.tool].time, 0);
  const finished = round === 3;
  useEffect(() => { if (open) scene.current?.focus(); }, [open, round]);
  function restart() { setRound(0); setPlacements([]); setHistory([]); setMessage('Fictional exercise restarted.'); }
  function close() { restart(); setOpen(false); window.requestAnimationFrame(() => invitation.current?.focus()); }
  function advance(skip = false) {
    const plan = skip ? [] : placements;
    const uncertainty = [0, 2, 1][round]!;
    const results = places.map((place, i) => {
      const reduction = plan.filter(p => p.place === i).reduce((n, p) => n + tools[p.tool].reduction, 0);
      return `${place.name}: ${Math.max(0, place.pressure + uncertainty - reduction)} remaining disruption units`;
    });
    setHistory(h => [...h, `Hypothetical round ${round + 1}${skip ? ' skipped; no resources placed' : ''}. Toy rainfall variation +${uncertainty}. ${results.join('; ')}.`]);
    setRound(r => r + 1); setPlacements([]); setMessage('Round recorded locally. Resources reset for the next round.');
  }
  return <section className="panel flood-game" aria-label="Fictional flood logistics exercise">
    <span className="entry-source">CivicPlay · Fictional learning fixture · No live map data</span>
    <h2>Flood response logistics lab</h2>
    <p>Optional educational game in imaginary Willow Basin. Every scene and outcome is hypothetical, never real emergency guidance. Playing, skipping and exiting never changes advisory participation.</p>
    {!open ? <button ref={invitation} onClick={() => { restart(); setOpen(true); }}>Start fictional exercise</button> : <>
      <p ref={scene} tabIndex={-1}><strong>{finished ? 'Fictional exercise complete' : `Hypothetical scene ${round + 1} of 3 · Willow Basin`}</strong></p>
      {!finished && <>
        <p>Allocate up to 8 budget tokens and 4 work hours per round. There is one of each resource per round. No countdown.</p>
        <p role="status">Budget: {8 - spent} tokens remaining · Time: {4 - time} hours remaining. {message}</p>
        <label>Resource to place <select value={tool} onChange={e => setTool(e.target.value as Tool)}>{Object.entries(tools).map(([key, value]) => <option key={key} value={key}>{value.label} · {value.cost} tokens · {value.time} hours</option>)}</select></label>
        <div className="flood-map" role="group" aria-label="Schematic fictional map, west to east">
          {places.map((place, i) => <article key={place.name}><h3>{place.name}</h3><p>Base disruption: {place.pressure} toy units</p><p>Placed: {placements.filter(p => p.place === i).map(p => tools[p.tool].label).join(', ') || 'none'}</p><button disabled={spent + tools[tool].cost > 8 || time + tools[tool].time > 4 || placements.some(p => p.tool === tool)} onClick={() => { setPlacements(p => [...p, { place: i, tool }]); setMessage(`${tools[tool].label} placed at ${place.name}.`); }}>Place {tools[tool].label.toLowerCase()} at {place.name}</button></article>)}
        </div>
        <p>Willow homes — Orchard workshop — Lantern square. Adjacency is illustrative; it has no scoring effect.</p>
        <button onClick={() => { setPlacements([]); setMessage('Current placements cleared.'); }}>Clear placements</button>{' '}
        <button onClick={() => advance()}>Run hypothetical round</button>{' '}
        <button onClick={() => advance(true)}>Skip round</button>
      </>}
      <div aria-live="polite"><h3>Simulated outcome record</h3>{history.length ? <ol>{history.map((entry, i) => <li key={i}>{entry}</li>)}</ol> : <p>No rounds run yet.</p>}{finished && <p>Compare trade-offs by restarting. There are no political choices, rewards or participation points.</p>}</div>
      <button onClick={restart}>Restart exercise</button>{' '}<button onClick={close}>Exit exercise</button>
    </>}
    <details><summary>Complete-text explanation and uncertainty</summary>
      <p>This fictional map contains three invented locations, west to east: Willow homes (7 base disruption units), Orchard workshop (5), and Lantern square (6). The text cards contain all map information. Select a resource, then activate a location’s Place button using touch, mouse, or Tab and Enter/Space. Disabled placement buttons mean that resource is already used or the budget or hours would be exceeded. Clear placements restores the current round’s resources.</p>
      <p>Each of three independent hypothetical rounds starts with 8 tokens, 4 hours, one crew, one drainage kit and one road closure. A crew costs 3 tokens and 2 hours and subtracts 3 disruption units; a kit costs 2 tokens and 1 hour and subtracts 2; a closure costs 1 token and 1 hour and subtracts 1. A closure represents diverted access in this toy model, not reduced water levels. Real closures have costs and risks omitted here.</p>
      <p>Run records each location’s base units plus toy rainfall variation (0, 2, then 1 across the three rounds), minus its placed resources’ reductions, with a minimum of zero. Skip records a round with no placements. Uncertainty is illustrated by those fixed variations, not a forecast, probability or validated model. Geography, travel, safety, capacity, vulnerability and cascading effects are omitted. Lower disruption units are only a toy comparison, never a prediction of lives or property protected.</p>
      <p>Restart clears all rounds. Exit clears the exercise and returns to its invitation. State exists only in page memory and disappears on reload. No game action submits votes, edits proposals, changes sources or sends emergency instructions. No ideology is scored. The outcome record provides the complete numerical result without color, animation or map interaction.</p>
    </details>
  </section>;
}
