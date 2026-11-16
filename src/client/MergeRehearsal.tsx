import { useState } from 'react';
import type { PublicPull, PullDetail, PullList } from '../shared/hbl-governance';
import { rehearse } from './merge-rehearsal';

export default function MergeRehearsal({ list, api, loading, error }: { list: PullList | null; api: string; loading: boolean; error: string }) {
  const [pulls, setPulls] = useState<PublicPull[]>([]);
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState('');
  async function stage(pull: PublicPull) {
    setPending(true); setFailure('');
    try {
      const response = await fetch(`${api}/${pull.number}`, { credentials: 'same-origin' });
      if (!response.ok) throw Error('Could not load revision metadata. Refresh source and retry.');
      const detail: PullDetail = await response.json();
      const p = detail.pull;
      if (p.kind === 'issue' || p.repositoryId !== pull.repositoryId || p.number !== pull.number || p.version !== pull.version || p.headSha !== pull.headSha || p.base !== pull.base) throw Error('Source revision changed. Refresh source before staging.');
      setPulls(current => [...current.filter(row => row.number !== p.number), p]);
    } catch (err) { setFailure(err instanceof Error ? err.message : 'Metadata unavailable.'); }
    finally { setPending(false); }
  }
  const unavailable = loading || !!error || !list || list.stale;
  function move(index: number, delta: number) {
    setPulls(current => { const next = [...current]; [next[index], next[index + delta]] = [next[index + delta]!, next[index]!]; return next; });
  }
  return <section className="gp-panel gp-rehearsal" aria-labelledby="rehearsal-title">
    <h2 id="rehearsal-title">Staged merge rehearsal</h2>
    <p>Read-only simulation · reorder locally to explore dependencies and possible conflicts. No branches or votes change.</p>
    <p>Source: {list?.repository ?? 'pending'} · {loading ? 'loading' : error ? 'error' : list?.stale ? 'stale cache' : list?.sourceStatus ?? 'pending'} · synced {list?.lastSync ?? 'unknown'}</p>
    <p>Merge permission: unavailable in this sandbox. A real merge requires a separate confirmed, permission-checked GitHub action and human review. Existing governance requirements still apply.</p>
    <label>Add a PR to the rehearsal <select value="" disabled={unavailable || pending} onChange={e => { const p = list?.pulls.find(p => p.number === Number(e.target.value)); if (p) void stage(p); }}>
      <option value="">Choose a fetched PR</option>{list?.pulls.filter(p => p.kind !== 'issue' && !pulls.some(row => row.number === p.number)).map(p => <option key={p.number} value={p.number}>#{p.number} {p.title}</option>)}
    </select></label>
    {pending && <p role="status">Loading GitHub revision metadata…</p>}
    {failure && <p role="alert">{failure}</p>}
    <p>Dependency arrows mean an included commit matches another staged PR head. Shared paths indicate possible conflicts, not a tested merge. Missing ancestry, renames and unstaged dependencies may be unknown.</p>
    {!pulls.length && <p>No staged PRs. Choose a PR to begin.</p>}
    <ol aria-label="Simulated merge order">{rehearse(pulls).map((row, index) => {
      const p = row.pull;
      const current = !unavailable && list?.pulls.some(item => item.repositoryId === p.repositoryId && item.number === p.number && item.version === p.version && item.headSha === p.headSha && item.base === p.base);
      return <li key={p.version}>
        <h3><a href={`https://github.com/${list?.repository}/pull/${p.number}`} target="_blank" rel="noopener noreferrer">#{p.number} {p.title}</a></h3>
        <p>Preview status: {current ? row.status : 'unknown — refresh or restage changed source'} · {p.eligibility.reason}</p>
        <p>Repository ID {p.repositoryId} · revision <code>{p.version}</code> · head <code>{p.headSha}</code> · base {p.base} <code>{p.evidence?.baseSha ?? 'unknown'}</code></p>
        <p>Dependency graph: {row.dependencies.length ? row.dependencies.map(n => `#${n} → #${p.number}`).join(', ') : 'No dependencies identified among staged PRs'}. {row.metadataComplete ? 'Metadata fetched.' : 'Dependency/file metadata incomplete.'}</p>
        {!!row.missingEarlier.length && <p>Order blocked: stage {row.missingEarlier.map(n => `#${n}`).join(', ')} earlier.</p>}
        {row.overlaps.map(overlap => <p key={overlap.number}>Possible conflict after #{overlap.number}: {overlap.files.join(', ')}</p>)}
        <div role="group" aria-label={`Reorder PR #${p.number}`}>
          <button disabled={index === 0} onClick={() => move(index, -1)}>Move #{p.number} earlier</button>{' '}
          <button disabled={index === pulls.length - 1} onClick={() => move(index, 1)}>Move #{p.number} later</button>{' '}
          <button onClick={() => setPulls(current => current.filter(item => item.number !== p.number))}>Remove #{p.number}</button>
        </div>
      </li>;
    })}</ol>
    <p role="status">{pulls.length} PRs staged locally{pulls.length ? `: ${pulls.map(p => `#${p.number}`).join(' → ')}` : ''}.</p>
    <button disabled={!pulls.length} onClick={() => setPulls([])}>Clear rehearsal</button>
  </section>;
}
