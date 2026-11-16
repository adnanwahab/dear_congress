import { useState } from 'react';
import { DEMO_PROJECTS, PROJECT_AS_OF, queueDemoCorrection, updateFreshness, type DemoCorrection } from './local-projects';
import './local-projects.css';

export function LocalProjectCheckins() {
  const [showDemo, setShowDemo] = useState(false);
  const [selected, setSelected] = useState(DEMO_PROJECTS[0]!.id);
  const [queue, setQueue] = useState<DemoCorrection[]>([]);
  const [error, setError] = useState('');
  const [receipt, setReceipt] = useState('');
  const project = DEMO_PROJECTS.find(p => p.id === selected)!;
  function select(id: string) { setSelected(id); setError(''); setReceipt(''); }
  return <section className="local-projects" aria-labelledby="local-project-heading">
    <p className="map-eyebrow">Neighborhood project check-ins</p>
    <h2 id="local-project-heading">Follow the work, inspect the evidence.</h2>
    <p role="status">Real projects: unavailable. No verified neighborhood project feed or shared correction service is connected.</p>
    <p>Published plans describe intentions. Observations describe reported work; neither proves a benefit was caused by a project. Resident corrections require moderation before facts can change.</p>
    <button type="button" aria-expanded={showDemo} aria-controls="local-project-demo" onClick={() => setShowDemo(v => !v)}>{showDemo ? 'Hide fictional project examples' : 'Explore fictional project examples'}</button>
    {showDemo && <div id="local-project-demo">
      <p><strong>DEMO ONLY · fictional places, documents and activity.</strong> Snapshot {PROJECT_AS_OF}. No civic participation or project update is verified. Nothing here is sent to a moderator. The rehearsal queue lasts only until this page reloads.</p>
      <div className="local-project-layout">
        <div><svg viewBox="0 0 360 360" role="img" aria-label="Schematic fictional neighborhood locations. Choose a project from the equivalent button list below.">
          <rect x="1" y="1" width="358" height="358" fill="none" stroke="currentColor" />
          <path d="M0 140H360 M0 240H360 M140 0V360 M230 0V360" fill="none" stroke="currentColor" opacity=".2" />
          {DEMO_PROJECTS.map((p, i) => <g key={p.id}><circle cx={p.point[0]} cy={p.point[1]} r={selected === p.id ? 19 : 14} fill="var(--accent)" /><text x={p.point[0]} y={p.point[1] + 5} textAnchor="middle" fill="var(--bg)">{i + 1}</text></g>)}
        </svg><p>Schematic only; these are not real coordinates.</p>
        <div className="local-project-list" aria-label="Fictional projects">{DEMO_PROJECTS.map((p, i) => <button type="button" key={p.id} aria-pressed={selected === p.id} onClick={() => select(p.id)}>{i + 1}. {p.name} · {p.state === 'progress' ? 'Reported progress (demo)' : p.state}</button>)}</div></div>
        <article aria-label="Selected fictional project">
          <h3>{project.name}</h3><p>{project.neighborhood} · {project.id} · revision {project.revision}</p>
          <p><strong>{project.state === 'progress' ? 'Reported progress (demo)' : project.state === 'stalled' ? 'Stalled (demo)' : 'Unknown'}</strong>: {project.stateReason}</p>
          <h4>Published evidence history · fictional</h4>
          <ol>{project.evidence.map(e => <li key={e.id}><strong>{e.kind}: {e.title}</strong><p>Published {e.publishedOn} · observed {e.observedOn ?? 'not recorded'} · {updateFreshness(e)}</p><p>Source identity: {e.id} · revision {e.revision}. Synthetic record in the bundled demo; no external document or reviewer exists.</p></li>)}</ol>
          <h4>Prediction · separate from observed work</h4>
          <p>{project.prediction ? `${project.prediction.text} Prediction made ${project.prediction.madeOn}.` : 'No forecast available. No completion date is inferred.'}</p>
          <form key={project.id} onSubmit={event => {
            event.preventDefault();
            const form = event.currentTarget;
            const data = new FormData(form);
            try {
              const next = queueDemoCorrection(queue, project.id, String(data.get('evidence')), String(data.get('correction')), String(data.get('source')));
              setQueue(next); setError(''); setReceipt(`${next.at(-1)!.id}: pending in the page-only demo queue. No facts changed; not submitted to a real moderator.`); form.reset();
            } catch (cause) { setReceipt(''); setError(cause instanceof Error ? cause.message : 'Could not queue the example correction. Your text remains in the form.'); }
          }}>
            <h4>Rehearse a correction</h4>
            <p id="project-correction-help">Use fictional text only, without personal details. Evidence stays unchanged. Real submissions are unavailable.</p>
            <label>Evidence to correct<select name="evidence" required>{project.evidence.map(e => <option key={e.id} value={e.id}>{e.title} · revision {e.revision}</option>)}</select></label>
            <label>Proposed correction<textarea name="correction" required maxLength={2000} aria-describedby="project-correction-help" /></label>
            <label>Supporting public HTTPS URL<input name="source" type="url" required maxLength={2000} /></label>
            <button type="submit">Add to demo moderation queue</button>
            {error && <p role="alert">{error}</p>}
            <p role="status">{receipt}</p>
          </form>
        </article>
      </div>
      <details><summary>Page-only demo moderation queue ({queue.length} pending)</summary><p>No approval or publish action exists in this prototype. Reloading clears this rehearsal.</p><ul>{queue.map(c => <li key={c.id}>{c.id} · {c.projectId} revision {c.projectRevision} · {c.evidenceId} revision {c.evidenceRevision} · pending (demo)<p>{c.text}</p><p>Submitted source (unreviewed, not endorsed): {c.source}</p></li>)}</ul></details>
    </div>}
  </section>;
}
