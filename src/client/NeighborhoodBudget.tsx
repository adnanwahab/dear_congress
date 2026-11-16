import { useState } from 'react';
import { BLOCKS, coveredBlocks, DEMO_BUDGET, place, PROJECTS, projectById, spent, type Allocation, type ProjectId } from './neighborhood-budget';

export function NeighborhoodBudget() {
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [selected, setSelected] = useState<ProjectId>('shade');
  const [list, setList] = useState(false);
  const [message, setMessage] = useState('Choose a project, then choose a block.');
  function allocate(block: number, project: string) {
    const result = place(allocations, block, project);
    setAllocations(result.allocations);
    setMessage(result.message);
  }
  const coverage = coveredBlocks(allocations);
  return <section className="neighborhood-budget" aria-labelledby="neighborhood-title">
    <p className="map-eyebrow">Local imagination · fictional neighborhood</p>
    <h2 id="neighborhood-title">Build a neighborhood, one block at a time.</h2>
    <p>Spend 100 hypothetical credits on public projects. Demo allocations stay in page memory and disappear on reload. Nothing is submitted, funded or counted as verified civic participation.</p>
    <details><summary>Sources and coverage assumptions</summary><p>Source: neighborhood-budget-v1, a bundled fictional teaching fixture. These nine equal blocks are not actual addresses. Costs are invented credits, not estimates or currency. Every block assumes 100 residents. Coverage uses north/south/east/west block distance, including the project block, clipped at the neighborhood edge. Trees and play spaces reach one block; hubs reach two. Overlapping coverage counts each block once. Covered residents are illustrative potential beneficiaries, not measured users; barriers, capacity and demographic differences are not modeled.</p></details>
    <p><strong>{DEMO_BUDGET - spent(allocations)} / 100 credits remaining</strong> · {coverage.length} / 9 blocks covered · {coverage.length * 100} / 900 fictional residents within reach</p>
    <div className="neighborhood-projects" aria-label="Choose a public project">{PROJECTS.map(p => <button key={p.id} type="button" draggable aria-pressed={selected === p.id} onClick={() => setSelected(p.id)} onDragStart={e => { setSelected(p.id); e.dataTransfer.setData('application/x-neighborhood-project', p.id); e.dataTransfer.effectAllowed = 'copy'; }}>
      <strong>{p.name} · {p.cost} credits</strong><span>{p.benefits} · reach {p.radius} block{p.radius > 1 ? 's' : ''}</span>
    </button>)}</div>
    <p id="neighborhood-help">Drag a project onto a block, or select a project and tap a Place button. With a keyboard, Tab to a project and press Enter or Space, then Tab to Place. Replacing a project refunds its cost. Use Remove to refund a block.</p>
    <button type="button" aria-pressed={list} onClick={() => setList(v => !v)}>{list ? 'Use block grid' : 'Use vertical block list'}</button>
    <div className={list ? 'neighborhood-blocks neighborhood-list' : 'neighborhood-blocks'} aria-label="Fictional blocks, north to south by row" aria-describedby="neighborhood-help">{BLOCKS.map((name, block) => {
      const current = allocations.find(a => a.block === block);
      return <div key={name} className="neighborhood-block" onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); allocate(block, e.dataTransfer.getData('application/x-neighborhood-project')); }}>
        <h3>Block {name}</h3><p>{current ? projectById(current.project)!.name : 'No project'} · {coverage.includes(block) ? 'Within modeled reach' : 'Outside modeled reach'}</p>
        <button type="button" onClick={() => allocate(block, selected)}>{current ? 'Replace' : 'Place'} {projectById(selected)!.name} at {name}</button>
        {current && <button type="button" onClick={() => { setAllocations(a => a.filter(item => item.block !== block)); setMessage(`Removed project at ${name}; credits refunded.`); }}>Remove project at {name}</button>}
      </div>;
    })}</div>
    <p role="status" aria-live="polite">{message}</p>
    <button type="button" onClick={() => { setAllocations([]); setMessage('Demo cleared. 100 credits remaining.'); }}>Clear neighborhood demo</button>
    <h3>Who could benefit?</h3>
    <ul>{PROJECTS.map(p => <li key={p.id}>{p.name}: {p.benefits}. {allocations.filter(a => a.project === p.id).length} placed.</li>)}</ul>
  </section>;
}
