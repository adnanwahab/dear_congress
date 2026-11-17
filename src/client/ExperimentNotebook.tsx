import {useEffect,useState} from 'react';
import type {LawBehaviorReceipt} from './LawBehaviorExplorer';
import {civicLawQuery,type CivicLawContext} from './civic-law-context';
import {NOTEBOOK_KEY,NOTEBOOK_LIMIT,createRun,readNotebook,writeNotebook,comparableRuns,type ExperimentRun} from './experiment-notebook';

function ReceiptLink({run}:{run:ExperimentRun}){
 const [href,setHref]=useState('');
 useEffect(()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(run.receipt,null,2)],{type:'application/json'}));setHref(url);return()=>URL.revokeObjectURL(url);},[run.receipt]);
 return href?<a href={href} download={`experiment-${run.id}.json`}>Download receipt for {run.name}</a>:null;
}
export function RunProvenance({run}:{run:ExperimentRun}){
 const m=run.receipt.manifest!;
 return <p className="muted s">Source: synthetic recorded HBL model ({run.sourceOrigin}) · seed {m.seed} · model {m.modelVersion} · population {m.population} · horizon {m.start}–{m.end} {run.receipt.unit}s · law {run.context.lawId}, strength {m.implementationStrength}. Major uncertainty: unvalidated model assumptions and sampled actors; not a forecast. No legal text is enacted.</p>;
}
export function ExperimentNotebook({receipt,context,sourceOrigin,onReplay}:{receipt:LawBehaviorReceipt|null;context:CivicLawContext;sourceOrigin:string;onReplay:(run:ExperimentRun)=>void}){
 const [runs,setRuns]=useState<ExperimentRun[]>([]),[ready,setReady]=useState(false),[error,setError]=useState('');
 const [name,setName]=useState('Experiment 1'),[selected,setSelected]=useState<string[]>([]),[message,setMessage]=useState('');
 useEffect(()=>{try{setRuns(readNotebook(window.localStorage.getItem(NOTEBOOK_KEY)));setReady(true);}catch{setError('Local notebook could not be loaded. Existing storage is untouched; check browser storage access or recover the saved data.');}},[]);
 function commit(next:ExperimentRun[]){
  setMessage('');
  try{
   // Refuse to overwrite another tab’s edits or a notebook we could not read.
   if(writeNotebook(readNotebook(window.localStorage.getItem(NOTEBOOK_KEY)))!==writeNotebook(runs))throw Error('Notebook changed in another tab. Reload before saving.');
   window.localStorage.setItem(NOTEBOOK_KEY,writeNotebook(next));setRuns(next);setError('');setMessage('Notebook saved on this browser.');
  }catch(err){setError(err instanceof Error?err.message:'Browser storage unavailable. Nothing saved.');}
 }
 const pair=selected.map(id=>runs.find(r=>r.id===id)).filter((r):r is ExperimentRun=>!!r);
 return <section className="experiment-notebook" aria-label="Experiment notebook">
  <h4>Experiment notebook</h4>
  <p>Named, versioned records stay in this browser until its site data is cleared. Save explicitly; no journals, votes or legal text are included. Recorded replay displays saved checkpoints without contacting the model. A scenario link reruns inputs only when requested; provider versions may change.</p>
  {!ready&&!error&&<p role="status">Loading local notebook…</p>}
  <label>Run name <input maxLength={80} value={name} onChange={e=>setName(e.target.value)}/></label>
  <button type="button" disabled={!ready||!name.trim()||receipt?.status!=='completed'||runs.length>=NOTEBOOK_LIMIT} onClick={()=>{try{commit([...runs,createRun(name,context,receipt!,sourceOrigin)]);}catch(err){setError(err instanceof Error?err.message:'Cannot save run.');}}}>Save named run</button>
  <p className="muted s">{runs.length}/{NOTEBOOK_LIMIT} records · maximum 8 MB. Rename changes the label only. Duplicate creates a new record retaining the original receipt and parent identity.</p>
  {error&&<p role="alert">{error}</p>}{message&&<p role="status">{message}</p>}
  {runs.map(run=><article key={run.id}>
   <h5>{run.name}</h5><p className="muted s">Record {run.id} · {run.createdAt}{run.parentId?` · duplicated from ${run.parentId}`:''}</p>
   <RunProvenance run={run}/>
   <label><input type="checkbox" checked={selected.includes(run.id)} disabled={selected.length===2&&!selected.includes(run.id)} onChange={e=>setSelected(e.target.checked?[...selected,run.id]:selected.filter(id=>id!==run.id))}/> Compare {run.name}</label>
   <button type="button" onClick={()=>onReplay(structuredClone(run))}>Replay {run.name}</button>
   <button type="button" disabled={!ready||!name.trim()} onClick={()=>commit(runs.map(r=>r.id===run.id?{...r,name:name.trim()}:r))}>Rename {run.name} to run name</button>
   <button type="button" disabled={!ready||runs.length>=NOTEBOOK_LIMIT} onClick={()=>{try{commit([...runs,createRun((run.name+' copy').slice(0,80),run.context,run.receipt,run.sourceOrigin,run.id)]);}catch(err){setError(String(err));}}}>Duplicate {run.name}</button>
   <a href={'/synth?'+civicLawQuery(run.context)}>Scenario for {run.name}</a>
   <ReceiptLink run={run}/>
   <details><summary>Saved receipt for {run.name}</summary><pre style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{JSON.stringify(run.receipt,null,2)}</pre><ul>{run.receipt.limitations?.map((text,i)=><li key={i}>{text}</li>)}</ul></details>
  </article>)}
  {pair.length===2&&<section aria-label="Compare saved runs"><h5>{pair[0]!.name} / {pair[1]!.name}</h5>
   {pair.map(run=><RunProvenance key={run.id} run={run}/>)}
   {comparableRuns(pair[0]!,pair[1]!)?<div role="region" aria-label="Recorded final checkpoint comparison" tabIndex={0} style={{overflowX:'auto'}}><table><caption>Final recorded edited-world values; synthetic, not forecasts. Missing metrics are unavailable.</caption><thead><tr><th>Metric</th>{pair.map(r=><th key={r.id}>{r.name}</th>)}</tr></thead><tbody>{Array.from(new Set(pair.flatMap(r=>Object.keys(r.receipt.frames.at(-1)!.edited.metrics)))).map(key=><tr key={key}><th scope="row">{key} (provider model units)</th>{pair.map(r=><td key={r.id}>{r.receipt.frames.at(-1)!.edited.metrics[key]??'Unavailable'}</td>)}</tr>)}</tbody></table></div>:<p role="status">These runs have different model versions, seeds, populations, engines or horizons. Numerical comparison is unavailable.</p>}
  </section>}
 </section>;
}
