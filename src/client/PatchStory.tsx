import type { PublicPull } from '../shared/hbl-governance';
import { REPOSITORIES } from '../shared/repository-voting';
import { attachedScreenshots } from './pr-screenshots';

export type StoryStatus = 'loading' | 'error' | 'blocked' | 'checks-pending' | 'review-ready' | 'pending';
export interface StoryStep { file:string; hunk:string; before:string; after:string; oldLine:number; newLine:number }
export function storySteps(pull:PublicPull):StoryStep[] {
  if(pull.kind==='issue')return [];
  return (pull.files??[]).flatMap(file=>{
    const steps:StoryStep[]=[];
    for(const section of (file.patch??'').split(/(?=^@@ )/m)) {
      const header=/^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@([^\n]*)/.exec(section);
      if(!header)continue;
      const lines=section.split('\n').slice(1);
      steps.push({file:file.filename,hunk:header[0],oldLine:Number(header[1]),newLine:Number(header[2]),before:lines.filter(l=>l.startsWith('-')).map(l=>l.slice(1)).join('\n'),after:lines.filter(l=>l.startsWith('+')).map(l=>l.slice(1)).join('\n')});
    }
    return steps;
  });
}
export function storyStatus(pull:PublicPull,loading=false,error=''):StoryStatus {
  if(error)return 'error';
  if(loading)return 'loading';
  if(pull.eligibility.state==='blocked'||pull.state!=='open')return 'blocked';
  if(pull.eligibility.state==='waiting-for-checks'||pull.evidence?.checks.some(c=>c.sha!==pull.headSha||c.status!=='completed'))return 'checks-pending';
  if(!pull.draft&&pull.evidence&&pull.evidence.checks.length>0&&pull.evidence.checks.every(c=>c.sha===pull.headSha&&c.conclusion==='success'))return 'review-ready';
  return 'pending';
}
/** Read-only source interpretation: no publication, voting or merge capability. */
export function PatchStory({pull,loading=false,error='',permission='Read-only browsing available'}:{pull:PublicPull;loading?:boolean;error?:string;permission?:string}) {
  if(pull.kind==='issue')return null;
  const source=Object.values(REPOSITORIES).find(r=>pull.url===`https://github.com/${r.repository}/pull/${pull.number}`);
  const steps=source?storySteps(pull):[];
  const base=pull.evidence?.baseSha;
  const screenshots=attachedScreenshots(pull).filter(i=>i.commit===base||i.commit===pull.headSha);
  return <section className="gp-panel gp-story" aria-label="Patch changelog story">
    <h2>Patch story · draft</h2><p>Generated interpretation requires human review before public publication. Code excerpts are evidence, not verified descriptions of behavior.</p>
    <p role="status">Story: {storyStatus(pull,loading,error)} · {pull.eligibility.reason}{error&&` · ${error}`}</p><p>{permission}. Browsing this story does not cast a vote or authorize a merge.</p>
    <p className="gp-meta">Source: {source?.repository??'Unverified source'} · Repository ID {pull.repositoryId} · PR #{pull.number} · Version {pull.version} · Base {pull.base} <code>{base??'SHA unavailable'}</code> · Head <code>{pull.headSha}</code></p>
    {source&&<a href={`${pull.url}/files`} target="_blank" rel="noopener noreferrer">Review full GitHub diff ↗</a>}
    <ol>{steps.map((step,index)=><li key={`${pull.version}:${step.file}:${index}`}><details><summary>Step {index+1} · {step.file} · {step.after?step.before?'Replace behavior':'Add behavior':'Remove behavior'} (draft)</summary><div className="gp-story-content"><p>Draft: review the changed lines in context to confirm their effect.</p><code>{step.hunk}</code><div className="gp-story-pair">{(['before','after'] as const).map(side=><section key={side}><h3>{side==='before'?'Before':'After'}</h3><pre className="gp-diff">{step[side]||'No changed lines on this side.'}</pre>{source&&(side==='after'||base)&&<a href={`https://github.com/${source.repository}/blob/${side==='before'?base:pull.headSha}/${step.file.split('/').map(encodeURIComponent).join('/')}#L${side==='before'?step.oldLine:step.newLine}`} target="_blank" rel="noopener noreferrer">{side==='before'?'Base':'Head'} source lines ↗</a>}</section>)}</div></div></details></li>)}</ol>
    {!steps.length&&<p>{loading?'Loading diff hunks…':'Diff hunks unavailable or omitted. Review the complete GitHub diff; binary and truncated changes cannot be explained here.'}</p>}
    {pull.files?.filter(f=>!f.patch).map(f=><p key={f.filename}>{f.filename}: diff unavailable.</p>)}
    <h3>Revision screenshot receipts</h3><p>Screenshots cover the revision; file-level visual effects have not been verified.</p>
    <div className="gp-story-pair">{screenshots.map(image=><figure key={image.src}><a href={image.src} target="_blank" rel="noopener noreferrer"><img src={image.src} alt={image.alt||'PR attachment'} loading="lazy" referrerPolicy="no-referrer"/></a><figcaption>{image.commit===base?'Before · base':'After · head'} attachment · <code>{image.commit}</code> · contributor supplied</figcaption></figure>)}</div>
    {pull.preview?.headSha===pull.headSha&&<figure><img src={pull.preview.screenshotUrl} alt={`Registered head preview for PR #${pull.number}`} loading="lazy"/><figcaption>After · operator receipt · {pull.preview.capturedAt} · {pull.preview.route} · {pull.preview.note}</figcaption></figure>}
    {!screenshots.some(i=>i.commit===base)&&<p>Before screenshot pending: no exact-base receipt.</p>}
    {!screenshots.some(i=>i.commit===pull.headSha)&&pull.preview?.headSha!==pull.headSha&&<p>After screenshot pending: no exact-head receipt.</p>}
  </section>;
}
