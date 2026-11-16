import { useId, useRef, useState, type ReactNode } from 'react';
import type { PublicPull, PullDetail } from '../shared/hbl-governance';

export type SourceState = { state:'idle'|'loading' } | { state:'error'|'permission'; message:string } | { state:'loaded'; pull:PublicPull };
export function reviewStatus(pull:PublicPull):string {
  const e=pull.evidence;
  if(pull.eligibility.state==='blocked'||pull.draft||pull.state!=='open')return 'Blocked / not ready for review';
  if(!e||!e.protectionsKnown||!e.checks.length||e.checks.some(c=>c.sha!==pull.headSha||c.status!=='completed'||c.conclusion===null))return 'Checks pending or unverified';
  if(e.checks.some(c=>c.conclusion!=='success'&&c.conclusion!=='neutral'&&c.conclusion!=='skipped'))return 'Blocked by checks';
  return 'Checks reported complete · human review required';
}
export function PatchCard({pull,api,repository,sourceNote,children}:{pull:PublicPull;api:string;repository:string;sourceNote:string;children:ReactNode}) {
  const [back,setBack]=useState(false);
  const [source,setSource]=useState<SourceState>(pull.files?{state:'loaded',pull}:{state:'idle'});
  const busy=useRef(false), id=useId();
  const current=source.state==='loaded'?source.pull:pull;
  async function load() {
    if(busy.current)return;
    busy.current=true;setSource({state:'loading'});
    try {
      const response=await fetch(`${api}/${pull.number}`,{credentials:'same-origin'});
      if(!response.ok){setSource({state:response.status===401||response.status===403?'permission':'error',message:response.status===401||response.status===403?'Permission denied. Sign in and refresh source.':'Source unavailable. Retry or open GitHub.'});return;}
      const detail=await response.json() as PullDetail, next=detail.pull;
      if(!next||next.kind==='issue'||next.repositoryId!==pull.repositoryId||next.number!==pull.number||next.version!==pull.version||next.headSha!==pull.headSha||next.base!==pull.base||next.url!==pull.url)throw Error('Revision changed. Refresh the list before reviewing this patch.');
      setSource({state:'loaded',pull:next});
    }catch(error){setSource({state:'error',message:error instanceof Error?error.message:'Source unavailable.'});}
    finally{busy.current=false;}
  }
  function flip(){setBack(!back);if(!back&&source.state==='idle')void load();}
  const files=current.files;
  // Construct official links from the route's allowlisted repository, never contributor text.
  const github=`https://github.com/${repository}/pull/${pull.number}`;
  return <section className="gp-card" aria-label={`Source card for PR #${pull.number}`}>
    <p className="gp-meta">GitHub · {repository} · repository ID {pull.repositoryId} · PR #{pull.number}<br/>{sourceNote}</p>
    <p className="gp-meta">Head <code>{pull.headSha}</code> · Base <code>{pull.base}</code> · Revision <code>{pull.version}</code></p>
    <p role="status">{reviewStatus(current)}</p>
    <p className="gp-meta">Checks: {current.evidence?.checks.map(c=>`${c.name}: ${c.status} / ${c.conclusion??'pending'} (commit ${c.sha})`).join('; ')||'Not reported / unverified'}. Protection evidence: {current.evidence?.protectionsKnown?'available':'unknown or inaccessible'}.</p>
    <p>{files?`${files.length} changed files · +${files.reduce((n,f)=>n+f.additions,0)} −${files.reduce((n,f)=>n+f.deletions,0)}`:'Changed-file summary not fetched. Flip to load source.'}</p>
    <div className="gp-links"><a href={github} target="_blank" rel="noopener noreferrer">Official GitHub PR ↗</a><a href={`${github}/files`} target="_blank" rel="noopener noreferrer">Complete source diff ↗</a></div>
    <button type="button" aria-expanded={back} aria-controls={id} onClick={flip}>{back?'Flip to overview':'Flip to source diff'}</button>
    <p className="gp-meta">Viewing or flipping is not a vote. Checks never authorize a merge; a human maintainer decides.</p>
    <div hidden={back}>{children}</div>
    <div id={id} hidden={!back} className="gp-card-back">
      <h3>Source diff · PR #{pull.number}</h3>
      {source.state==='loading'&&<p role="status">Loading GitHub files for this revision…</p>}
      {(source.state==='error'||source.state==='permission')&&<><p role="alert">{source.message}</p><button type="button" onClick={()=>void load()}>Retry source</button></>}
      {source.state==='loaded'&&<><p>GitHub patches may be partial; binary or omitted patches require the complete source link.</p><p>Base SHA: <code>{current.evidence?.baseSha||'Unavailable'}</code></p><ul aria-label="Changed files">{files?.map((f,index)=><li key={f.filename}><a href={`#${id}-file-${index}`}>{f.filename}</a> · {f.status} · +{f.additions} −{f.deletions}</li>)}</ul>{!files?.length&&<p>No file diffs reported.</p>}{files?.map((f,index)=><details key={f.filename} id={`${id}-file-${index}`} open><summary>{f.filename} · {f.status} · +{f.additions} −{f.deletions}</summary><pre className="gp-diff" tabIndex={0} aria-label={`Diff for ${f.filename}`}><code>{f.patch||'Patch unavailable (binary, omitted or truncated). Open the complete source diff on GitHub.'}</code></pre></details>)}</>}
    </div>
  </section>;
}
