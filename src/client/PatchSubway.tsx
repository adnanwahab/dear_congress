import { useId, useState } from 'react';
import type { PublicPull } from '../shared/hbl-governance';
import { patchRelationships } from '../shared/patch-relationships';
import './patch-subway.css';

export function PatchSubway({pulls,repository,loading,error,stale,sourceStatus,permission}:{pulls:PublicPull[];repository:string;loading:boolean;error:string;stale:boolean;sourceStatus:string;permission:string}) {
  const [search,setSearch]=useState('');
  const id=useId();
  const graphs=pulls.map(p=>({pull:p,...patchRelationships(p,repository)}));
  const visible=graphs.filter(g=>`${g.pull.title} ${g.status} ${g.nodes.map(n=>n.label).join(' ')}`.toLowerCase().includes(search.toLowerCase()));
  return <section className="gp-panel patch-subway" aria-labelledby={id}>
    <h2 id={id}>Branch subway · code relationships</h2>
    <p>Source: {repository} · {sourceStatus}{stale?' · stale cached metadata':''}. {permission}</p>
    <p>Read-only navigation. Review-ready is a source eligibility label; a human maintainer still decides whether to merge. Description links are contributor references, not verified implementation receipts. Parent edges show only reported GitHub commits, not a complete branch history.</p>
    {loading&&<p role="status">Loading relationship metadata…</p>}
    {error&&<p role="alert">Relationship metadata could not refresh: {error}</p>}
    <label>Search relationships<input type="search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="PR, issue ID, branch, commit or status"/></label>
    {!loading&&!visible.length&&<p>No matching source relationships are available.</p>}
    <div className="subway-lines" aria-label="Relationship map">{visible.map(g=><article key={g.nodes[0]!.id}>
      <h3>{g.nodes[0]!.label} · {g.pull.title}</h3><p>{g.status} · {g.pull.eligibility.reason}</p>
      <p>Revision: <code>{g.pull.version}</code></p>
      <ul>{g.edges.map((edge,i)=>{const from=g.nodes.find(n=>n.id===edge.from)!;const to=g.nodes.find(n=>n.id===edge.to)!;return <li key={i}><span>{from.label}</span><span className="subway-track">{edge.label} →</span><a href={to.url}>{to.label}</a></li>;})}</ul>
      {g.pull.kind!=='issue'&&!g.pull.branchSource?.commits&&<p>Commit ancestry unavailable; detail evidence may be pending or inaccessible. Base targets do not prove ancestry.</p>}
    </article>)}</div>
    <details open><summary>Searchable relationship table</summary><div className="subway-table" tabIndex={0} role="region" aria-label="Relationship table scroll area"><table><caption>Same source edges as the map; links work with Tab and Enter.</caption><thead><tr><th scope="col">Source / revision</th><th scope="col">Status</th><th scope="col">From</th><th scope="col">Relationship</th><th scope="col">To</th></tr></thead><tbody>{visible.flatMap(g=>g.edges.map((edge,i)=>{const from=g.nodes.find(n=>n.id===edge.from)!;const to=g.nodes.find(n=>n.id===edge.to)!;return <tr key={`${g.nodes[0]!.id}:${i}`}><td>{repository} · {g.pull.version}</td><td>{g.status}</td><td><a href={from.url}>{from.label}</a></td><td>{edge.label}</td><td><a href={to.url}>{to.label}</a></td></tr>;}))}</tbody></table></div></details>
  </section>;
}
