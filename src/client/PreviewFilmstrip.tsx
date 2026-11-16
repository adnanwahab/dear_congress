import { useState } from 'react';
import type { PublicPull } from '../shared/hbl-governance';
import { HBL_REPOSITORY } from '../shared/hbl-governance';

export type CaptureStatus =
  | { state: 'unavailable' | 'pending'; reason: string }
  | { state: 'verified'; receipt: NonNullable<PublicPull['preview']> };

/** Registry receipts belong to HBL only; never infer authority from PR text. */
export function captureStatus(pull: PublicPull, revision: string | undefined, receipt: PublicPull['preview']): CaptureStatus {
  if (pull.kind === 'issue' || !revision || !/^[a-f0-9]{40}$/.test(revision)) return {state:'unavailable',reason:'GitHub revision identity is unavailable. Refresh source or check repository access.'};
  const prefix=`https://github.com/${HBL_REPOSITORY}/pull/${pull.number}`;
  if(pull.url!==prefix || !receipt || receipt.headSha!==revision) return {state:'unavailable',reason:'No verified capture receipt is available for this revision. Use Refresh source to check again; this does not start a build.'};
  const expectedImage=`/api/hbl/previews/${pull.number}/${revision}/image`;
  let preview: URL;
  try { preview=new URL(receipt.exploreUrl!); } catch { return {state:'pending',reason:'Capture or preview verification is incomplete. No build image is shown.'}; }
  if(receipt.screenshotUrl!==expectedImage || !Number.isFinite(Date.parse(receipt.capturedAt)) || !Number.isFinite(Date.parse(receipt.deploymentVerifiedAt??'')) || preview.protocol!=='https:' || preview.host!==`hbl-pr-${pull.number}-${revision.slice(0,8)}.fly.dev` || preview.username || preview.password || preview.hash || preview.pathname+preview.search!==receipt.route)
    return {state:'pending',reason:'Capture or preview verification is incomplete. No build image is shown.'};
  return {state:'verified',receipt};
}
function CaptureFrame({label,status}:{label:string;status:CaptureStatus}) {
  const [imageState,setImageState]=useState<'loading'|'loaded'|'failed'>('loading');
  const [attempt,setAttempt]=useState(0);
  if(status.state!=='verified')return <section className="gp-capture"><h4>{label}</h4><p role="status">{status.state==='pending'?'Verification pending':'Capture unavailable'}</p><p>{status.reason}</p></section>;
  const r=status.receipt;
  return <figure className="gp-capture"><h4>{label}</h4><figcaption>Operator capture receipt · commit <code>{r.headSha}</code><br/>Captured {r.capturedAt} · preview verified {r.deploymentVerifiedAt}{r.note&&<p>{r.note}</p>}</figcaption>
    {imageState==='loading'&&<p role="status">Loading verified screenshot…</p>}
    {imageState==='failed'?<div role="alert"><p>Screenshot failed to load. Access may be restricted or the capture may be unavailable.</p><button onClick={()=>{setImageState('loading');setAttempt(n=>n+1);}}>Retry screenshot</button></div>:<a href={r.screenshotUrl} target="_blank" rel="noopener noreferrer" aria-label={`Open ${label.toLowerCase()} screenshot`}><img key={attempt} src={r.screenshotUrl} alt={`${label} app at commit ${r.headSha}`} loading="lazy" width="1440" height="1000" onLoad={()=>setImageState('loaded')} onError={()=>setImageState('failed')}/></a>}
    <p><a href={r.exploreUrl} target="_blank" rel="noopener noreferrer">Open verified preview ↗</a></p>
  </figure>;
}
export function PreviewFilmstrip({pull}:{pull:PublicPull}) {
  if(pull.kind==='issue')return null;
  const before=pull.evidence?.baseSha;
  return <section className="gp-filmstrip" aria-label={`Verified build filmstrip for PR #${pull.number}`}><h3>Build filmstrip</h3><p>Source: {pull.url} · {pull.eligibility.state}. Capture readiness is separate from checks and merge approval. Browsing does not cast a vote.</p><div className="gp-filmstrip-frames">
    <CaptureFrame key={`before:${pull.url}:${before}:${pull.beforePreview?.capturedAt}`} label="Before · base revision" status={captureStatus(pull,before,pull.beforePreview)}/>
    <CaptureFrame key={`current:${pull.url}:${pull.headSha}:${pull.preview?.capturedAt}`} label="Current · PR head" status={captureStatus(pull,pull.headSha,pull.preview)}/>
  </div><p>Preview access is read-only here; the external host may require permission. No capture is queued by browsing.</p></section>;
}
