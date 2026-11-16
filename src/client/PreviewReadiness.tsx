import { useEffect, useRef, useState } from 'react';
import type { Policy, PublicPull, PullDetail } from '../shared/hbl-governance';
import { previewReadiness } from './preview-readiness';
export function PreviewReadiness({pull,policy,api,repository}:{pull:PublicPull;policy:Policy;api:string;repository:string}) {
 const [open,setOpen]=useState(false),[current,setCurrent]=useState<PullDetail>(),[loading,setLoading]=useState(false),[error,setError]=useState('');
 const generation=useRef(0);
 useEffect(()=>{
  if(!open)return;
  let active=true,running=false;
  const controller=new AbortController();setCurrent(undefined);
  const refresh=async()=>{
   if(running)return;running=true;const id=++generation.current;setLoading(true);setError('');
   try{const response=await fetch(`${api}/${pull.number}`,{credentials:'same-origin',signal:AbortSignal.any([controller.signal,AbortSignal.timeout(20000)])});if(!response.ok)throw Error(response.status===403?'Permission denied. Ask a maintainer to verify source read access.':response.status===429?'Rate limited. Wait before refreshing.':'GitHub diagnostics unavailable. Retry later.');const data:PullDetail=await response.json();if(data.pull.number!==pull.number||data.pull.repositoryId!==pull.repositoryId||data.pull.kind==='issue')throw Error('Source identity mismatch. Refresh the source page.');if(active&&id===generation.current)setCurrent(data);}
   catch(e){if(active)setError(String(e instanceof Error?e.message:e));}
   finally{running=false;if(active)setLoading(false);}
  };
  void refresh();const timer=setInterval(()=>{if(!document.hidden)void refresh();},30000);
  const listener=()=>void refresh();const event=`diagnostics-refresh-${pull.number}`;window.addEventListener(event,listener);
  return()=>{active=false;controller.abort();generation.current++;clearInterval(timer);window.removeEventListener(event,listener);};
 },[open,api,pull.number,pull.version]);
 const displayed=current?.pull??pull, result=previewReadiness(displayed,policy);
 const pr=`https://github.com/${repository}/pull/${pull.number}`;
 return <details className="gp-readiness" onToggle={e=>setOpen(e.currentTarget.open)}><summary>Preview readiness · {(error||current?.stale||(!current&&result.state!=='blocked')?'unknown':result.state).replaceAll('-',' ')} · preview {result.preview}</summary>
 {open&&<div aria-busy={loading}><p role="status" aria-live="polite">{loading?'Refreshing GitHub receipts…':error?'Refresh failed; previous receipts retained.':current?.stale?'Stale cached receipts':'GitHub receipts loaded'} · updates every 30 seconds while visible</p>{error&&<p role="alert">{error}</p>}
 <p>Source: {repository} · repository ID {displayed.repositoryId} · PR #{displayed.number}</p><p>Head <code>{displayed.headSha}</code> · Base {displayed.base} / <code>{displayed.evidence?.baseSha||'unknown'}</code></p><p>Receipt: {displayed.evidence?.receipt?.observedAt??'Timestamp unavailable'} · Protection read permission: {displayed.evidence?.receipt?.permission??'unknown'} · {current?.warning}</p>
 {current&&displayed.version!==pull.version&&<p>Revision changed. Refresh the source page before voting on the new revision.</p>}
 <button type="button" disabled={loading} onClick={()=>window.dispatchEvent(new Event(`diagnostics-refresh-${pull.number}`))}>Refresh diagnostics</button>
 <ul>{result.diagnostics.map(row=><li key={row.rule}><strong>{row.rule}: {row.state}</strong><p>{row.guidance}</p></li>)}</ul>
 <p>{result.preview==='pending'?'No verified deployment for this head. An operator must capture and verify an isolated preview before registering it. Refreshing does not start a build.':'A verified exact-head preview is registered.'} Attached screenshots alone do not verify a deployment.</p>
 <p>Review-ready describes fetched checks and review receipts only. A human maintainer decides whether to merge. Automatic merging remains disabled.</p><a href={pr} target="_blank" rel="noopener noreferrer">Inspect GitHub PR and rules ↗</a> · <a href={`${pr}/checks`} target="_blank" rel="noopener noreferrer">Inspect checks ↗</a></div>}
 </details>;
}
