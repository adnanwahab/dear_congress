import type { SandboxHistory as History } from './sandbox-history';
export function SandboxHistory({ history, restore }: { history: History; restore: (id: number) => void }) {
  const current = history.nodes[history.current]!;
  const children = history.nodes.filter(node => node.parent === current.id);
  return <section aria-label="Local sandbox history" id="sandbox-history">
    <h3>Local sandbox history</h3>
    <p>Settings and package filter only, in this page’s memory. Restore previews current data; it never restores posts, votes, official updates or saved plans. Reloading or leaving this page clears history. Copy any settings you want to keep first.</p>
    <p role="status">Current step {current.id}: {current.label}</p>
    <button type="button" disabled={current.parent === null} onClick={() => restore(current.parent!)}>Undo sandbox edit</button>
    {children.length === 1 && <button type="button" onClick={() => restore(children[0]!.id)}>Redo sandbox edit</button>}
    {children.length > 1 && <p>Choose a redo branch below.</p>}
    <details><summary>Inspect steps and restore a branch ({history.nodes.length})</summary>
      <ol>{history.nodes.map(node => <li key={node.id}>
        <p>Step {node.id} · {node.label} · {node.parent === null ? 'root' : `from step ${node.parent}`}{node.id === current.id ? ' · current' : ''}</p>
        <p>Package {node.snapshot.packageId}; budget ${node.snapshot.budget}B; penalty {node.snapshot.lambda}. Weights: {Object.entries(node.snapshot.weights).map(([key, value]) => `${key} ${value}`).join(', ')}.</p>
        <button type="button" disabled={node.id === current.id} onClick={() => restore(node.id)} style={{ minHeight: 44 }}>Restore step {node.id}{node.parent === current.id ? ' (redo branch)' : ''}</button>
      </li>)}</ol>
    </details>
    <p>Fallback: use these buttons with Tab and Enter, or tap Restore. Native text-field Undo stays available. No animation or keyboard shortcut is required.</p>
  </section>;
}
