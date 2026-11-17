import {useEffect,useState} from 'react';
import {batchRecipe,SimulationBatch,type BatchRunner} from './simulation-batch';
import {civicLawQuery,type CivicLawContext} from './civic-law-context';
export function SimulationBatchConsole({context,origin,run,disabled,onBusy}:{context:CivicLawContext;origin:string;run:BatchRunner;disabled:boolean;onBusy?:(busy:boolean)=>void}){
  const [,refresh]=useState(0),[count,setCount]=useState(3);
  const [batch]=useState(()=>new SimulationBatch(run,()=>refresh(n=>n+1)));
  useEffect(()=>()=>batch.cancel(),[batch]);
  // Canonical input order and explicit seeds make duplicate submissions and replay reviewable.
  let recipe:ReturnType<typeof batchRecipe>|undefined;
  try{recipe=batchRecipe(context,count,origin);}catch{}
  const [lastKey,setLastKey]=useState('');
  useEffect(()=>onBusy?.(batch.busy),[batch.busy,onBusy]);
  const completed=batch.jobs.filter(j=>j.status==='completed').length;
  return <section aria-label="Simulation batch queue" className="simulation-batch">
    <h4>Simulation batch queue</h4>
    <p>Run a small same-assumption experiment across consecutive seeds. This queue stays in this page; closing it loses results. Synthetic model results are not forecasts and do not enact legal text.</p>
    <p>Source data mode: synthetic paired worlds. Seed {context.seed} onward; model version {batch.jobs.find(j=>j.receipt)?.receipt?.manifest?.modelVersion||context.modelVersion||'unpinned until first receipt'}; horizon {context.lawId===83?'720 minutes':'12 months'}. Major uncertainty: uncalibrated model assumptions; no validated real-world causal effects.</p>
    <label>Batch size <select value={count} disabled={batch.busy} onChange={e=>setCount(Number(e.target.value))}>{[1,2,3,4,5,6,7,8].map(n=><option key={n}>{n}</option>)}</select></label>
    <p>Compute estimate: {count} requests, {count*2} worlds, {count*48} synthetic actor instances; request budget up to {count*45} seconds. Actual CPU cost unavailable. Concurrency cap: 1 batch request in this console; provider limits also apply. Progress counts receipts, not simulated time.</p>
    <button type="button" disabled={disabled||batch.busy||!recipe||recipe.key===lastKey} onClick={()=>{if(!recipe)return;setLastKey(recipe.key);void batch.queue(recipe.inputs);}}>Queue batch</button>
    <button type="button" disabled={!batch.busy} onClick={()=>batch.cancel()}>Cancel batch</button>
    <button type="button" disabled={disabled||batch.busy||!batch.jobs.some(j=>j.status==='failed'||j.status==='canceled')} onClick={()=>void batch.retry()}>Retry unfinished runs</button>
    {!recipe&&<p role="alert">Invalid batch inputs or seed range.</p>}
    <p role="status">{completed}/{batch.jobs.length} completed receipts. {batch.jobs.filter(j=>j.status==='running').length} running; {batch.jobs.filter(j=>j.status==='queued').length} queued; {batch.jobs.filter(j=>j.status==='failed').length} failed; {batch.jobs.filter(j=>j.status==='canceled').length} canceled. {batch.busy?'Working or waiting for cancellation to settle.':batch.jobs.length?'Queue stopped. Partial results remain available.':'No batch submitted.'}</p>
    {lastKey&&<details><summary>Deduplication key and receipt bundle</summary><p>Identical submissions are disabled. Retry preserves completed receipts. Replay links restore one run without executing it; pin the recorded model version before rerunning. Provider version availability is required for deterministic replay.</p><pre style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{JSON.stringify({schemaVersion:'civic-batch.v1',key:lastKey,provider:origin,sourceMode:'synthetic',jobs:batch.jobs},null,2)}</pre></details>}
    <ol>{batch.jobs.map(job=><li key={job.key}>
      Seed {job.context.seed} · {job.status} · attempt {job.attempts} · model {job.receipt?.manifest?.modelVersion||job.context.modelVersion||'unavailable'} · horizon {job.context.lawId===83?'720 minutes':'12 months'} · synthetic; uncalibrated assumptions.
      {job.error&&<span> {job.error}</span>}
      {job.receipt&&<><p>{job.receipt.frames.length} recorded checkpoints; partial batch results only apply to this completed run.</p><a href={'/synth?'+civicLawQuery({...job.context,modelVersion:job.receipt.manifest!.modelVersion!})}>Replay seed {job.context.seed}</a><details><summary>Recorded results for seed {job.context.seed}</summary><pre style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{JSON.stringify(job.receipt,null,2)}</pre></details></>}
    </li>)}</ol>
  </section>;
}
