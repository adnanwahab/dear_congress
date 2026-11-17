import {useEffect,useRef,useState} from 'react';
import {parseLawBehaviorReceipt,type LawBehaviorReceipt} from './LawBehaviorExplorer';
import {civicLawQuery,parseCivicLawContext,type CivicLawContext} from './civic-law-context';

export function endpointDelta(receipt:LawBehaviorReceipt,metric:string){
  const last=receipt.frames.at(-1);
  if(!last||last.time!==receipt.manifest?.end)throw Error('Complete endpoint metric unavailable.');
  const a=last.baseline.metrics[metric],b=last.edited.metrics[metric];
  if(typeof a!=='number'||typeof b!=='number'||!Number.isFinite(a)||!Number.isFinite(b)||!Number.isFinite(b-a))throw Error('Endpoint metric unavailable.');
  return b-a;
}
export function searchSeeds(start:number,count:number){
  if(!Number.isInteger(start)||start<0||!Number.isInteger(count)||count<1||count>8||start+count-1>4294967295)throw Error('Use 1–8 consecutive unsigned 32-bit seeds.');
  return Array.from({length:count},(_,i)=>start+i);
}
export function verifySearchReceipt(value:unknown,base:LawBehaviorReceipt,seed:number){
  const r=parseLawBehaviorReceipt(value),a=r.manifest,b=base.manifest;
  if(r.status!=='completed'||!a||!b||r.law.number!==base.law.number||a.seed!==seed||a.population!==b.population||a.implementationStrength!==b.implementationStrength||a.modelVersion!==b.modelVersion||a.start!==b.start||a.end!==b.end||r.unit!==base.unit||r.engine!==base.engine)throw Error('Search receipt identity, version or horizon mismatch.');
  return r;
}

/** Sequential read-only model work. Results remain bound to the captured reference. */
export function SeedCounterexamples({base,metric,label,context,origin}:{base:LawBehaviorReceipt;metric:string;label:string;context:CivicLawContext;origin:string}){
  const [start,setStart]=useState(String(Math.min(4294967288,context.seed+1))),[count,setCount]=useState('4');
  const [busy,setBusy]=useState(false),[message,setMessage]=useState('No search performed.');
  const [results,setResults]=useState<LawBehaviorReceipt[]>([]);
  const controller=useRef<AbortController|null>(null);
  useEffect(()=>()=>controller.current?.abort(),[]);
  let reference:number|null=null;try{reference=endpointDelta(base,metric);}catch{}
  async function search(){
    let seeds:number[];try{
      if(!parseCivicLawContext(civicLawQuery(context).toString()))throw Error('Unsupported simulator inputs.');
      verifySearchReceipt(base,base,context.seed);
      if(base.law.number!==context.lawId||base.manifest?.implementationStrength!==context.implementationStrength||base.manifest?.population!==context.population)throw Error('Reference does not match simulator inputs.');
      seeds=searchSeeds(Number(start),Number(count));if(!start.trim()||!count.trim())throw Error('Enter seed and budget.');}catch(e){setMessage((e as Error).message);return;}
    const abort=new AbortController();controller.current=abort;setBusy(true);setResults([]);
    let checked=0,attempted=0;const found:LawBehaviorReceipt[]=[];
    const timeout=setTimeout(()=>abort.abort(),45000);
    try{
      for(const seed of seeds){
        if(abort.signal.aborted)throw Error('Search canceled or deadline reached.');
        attempted++;setMessage(`Checking seed ${seed}; ${checked}/${seeds.length} verified. Total deadline 45 seconds.`);
        const response=await fetch(new URL('/api/law-behavior',origin),{method:'POST',headers:{'content-type':'application/json'},signal:abort.signal,body:JSON.stringify({lawId:context.lawId,seed,population:context.population,implementationStrength:context.implementationStrength})});
        const bytes=await response.text();if(bytes.length>2_000_000)throw Error('Receipt exceeds display limit.');
        if(!response.ok)throw Error(`Provider unavailable (${response.status}).`);
        const r=verifySearchReceipt(JSON.parse(bytes),base,seed),delta=endpointDelta(r,metric);
        if(abort.signal.aborted)throw Error('Search canceled or deadline reached.');
        checked++;if(reference!==null&&Math.sign(reference)!==0&&Math.sign(delta)===-Math.sign(reference))found.push(r);
      }
      setMessage(`Search complete: ${found.length} reversals. Range ${seeds[0]}–${seeds.at(-1)}; budget ${seeds.length}. ${checked}/${seeds.length} verified; ${attempted} requests attempted.`);
    }catch(e){setMessage(`Search incomplete: range ${seeds[0]}–${seeds.at(-1)}; budget ${seeds.length}. ${checked}/${seeds.length} verified; ${attempted} requests attempted. ${abort.signal.aborted?'Canceled or 45-second deadline reached.':(e as Error).message}`);}
    finally{clearTimeout(timeout);setResults(found);setBusy(false);}
  }
  return <section aria-label="Counterexample seed search">
    <h4>Find a modeled counterexample</h4>
    <p>Synthetic HBL data · reference seed {context.seed} · model {base.manifest?.modelVersion} · horizon {base.manifest?.start}–{base.manifest?.end} {base.unit}s. Major uncertainty: model assumptions and a small, nonrepresentative seed sample; not a forecast.</p>
    <p>{label}: endpoint edited minus baseline = {reference??'unavailable'}. A counterexample has the strictly opposite sign; zero is not a reversal. This tests direction, not whether an outcome is beneficial.</p>
    <fieldset disabled={busy}><legend>Bounded consecutive seed range</legend>
      <label>First search seed <input type="number" min="0" max="4294967295" step="1" value={start} onChange={e=>setStart(e.target.value)}/></label>
      <label>Seed budget (maximum 8) <input type="number" min="1" max="8" step="1" value={count} onChange={e=>setCount(e.target.value)}/></label>
      <button type="button" disabled={reference===null||reference===0} onClick={()=>void search()}>Search seeds</button>
    </fieldset>
    {busy&&<button type="button" onClick={()=>controller.current?.abort()}>Cancel seed search</button>}
    <p role="status" aria-live="polite">{message}</p>
    <p>No reversal found does not establish robustness. Only the chosen final metric and bounded range are tested; other seeds, horizons, actors and model versions may differ. No household preset or package score is modeled here.</p>
    <ul>{results.map(r=><li key={r.manifest!.seed}>Synthetic counterexample seed {r.manifest!.seed}: {label} delta {endpointDelta(r,metric)}; model {r.manifest!.modelVersion}; horizon {r.manifest!.start}–{r.manifest!.end} {r.unit}s. Same sampling and model uncertainty applies. <a href={'/synth?'+civicLawQuery({...context,seed:r.manifest!.seed,modelVersion:r.manifest!.modelVersion!})}>Reopen exact seed inputs</a><details><summary>Reproducible paired receipt</summary><pre className="civic-law-draft">{JSON.stringify(r,null,2)}</pre></details></li>)}</ul>
  </section>;
}
