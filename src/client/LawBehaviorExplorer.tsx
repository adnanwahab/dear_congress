import SaveToJourney from './SaveToJourney';
import { WorldPortal } from './WorldPortal';
import { requestHaptic } from './haptics';
import {useEffect,useMemo,useRef,useState} from 'react';
import './law-behavior-explorer.css';
import {LawEnsemble} from './LawEnsemble';
import {FuturePostcard} from './FuturePostcard';
import {lawOutcomeTrace} from './law-outcome-trace';
import {parseCivicLawContext,civicLawQuery,parseSimulationShare,simulationShareQuery,structuredAmendment,type CivicLawContext} from './civic-law-context';

/** Read-only, provenance-tagged synthetic records supplied by the same HBL model that powers World Diff. */
type Actor = {id:string;label?:string;x?:number;z?:number;[key:string]:string|number|boolean|null|undefined};
type Metrics = Record<string,number>;
type FrameSide = {metrics:Metrics;actors:Actor[]};
export type LawBehaviorFrame = {time:number;baseline:FrameSide;edited:FrameSide};
export type LawBehaviorReceipt = {
  schemaVersion:'hbl-law-behavior-receipt.v1';status:'completed'|'mechanism-unavailable';
  law:{id:string;number:number;title:string};engine?:'population'|'city';unit?:'minute'|'month';
  manifest?:{modelVersion:string|null;seed:number;population:number;implementationStrength:number;
    pairedInitialState:boolean;start:number;end:number;recordedCheckpoints:number;scope:string}|null;
  frames:LawBehaviorFrame[];reason?:string;limitations?:string[];
};
const MODELED_LAWS=[
  {id:83,label:'83 · Transit frequency',editable:true},
  {id:22,label:'22 · Housing construction cost',editable:true},
  {id:23,label:'23 · Permit processing capacity',editable:true},
  {id:21,label:'21 · Upzoning (fixed model rule)',editable:false}
] as const;
const SCENARIO_PRESETS=[
  {id:'housing',label:'Housing · construction assumption',lawId:22,strength:50},
  {id:'transit',label:'Transit · frequency assumption',lawId:83,strength:50}
] as const;
const METRICS:Record<string,{label:string;unit:string}>={
  trips:{label:'Modeled trips',unit:'trips'},
  completedTrips:{label:'Completed modeled trips',unit:'trips'},
  meanCommuteMinutes:{label:'Mean planned travel',unit:'minutes/trip'},
  meanExperiencedTravelMinutes:{label:'Mean experienced travel',unit:'minutes/trip'},
  deniedBoardings:{label:'Modeled denied boardings',unit:'boardings'},
  meanHousingBurden:{label:'Mean housing burden',unit:'fraction'},
  employmentRate:{label:'Employment in model',unit:'fraction'},
  modeledUtility:{label:'Modeled utility',unit:'model units'},
  transitCrowding:{label:'Synthetic transit crowding',unit:'model index'},
  housingUnits:{label:'Modeled built housing units',unit:'units'},
  availableUnits:{label:'Model housing vacancies',unit:'units'},
  entitledCapacity:{label:'Permitted capacity (not built housing)',unit:'capacity units'},
  meanRent:{label:'Mean synthetic rent',unit:'synthetic USD/month'},
  meanRentBurden:{label:'Mean rent burden',unit:'fraction'},
  meanSavings:{label:'Mean synthetic savings',unit:'synthetic USD'},
  completedProjects:{label:'Modeled completed projects',unit:'projects'},
  jobs:{label:'Modeled jobs',unit:'jobs'},
  balance:{label:'Model treasury balance',unit:'synthetic USD'}
};
const PERSON_FIELDS=['activity','mode','commuteMinutes','employmentStatus','homeDistrictId','workDistrictId','x','z'];
const HOUSE_FIELDS=['districtId','unitId','monthlyIncome','monthlyRent','savings','unhoused'];
const LABELS:Record<string,string>={activity:'Activity',mode:'Travel mode',commuteMinutes:'Commute minutes',
  employmentStatus:'Employment',homeDistrictId:'Home district',workDistrictId:'Work district',
  districtId:'District',unitId:'Assigned unit',monthlyIncome:'Monthly income',monthlyRent:'Monthly rent',
  savings:'Savings',unhoused:'No assigned unit',x:'Local x',z:'Local z'};
const isFiniteNumber=(v:unknown):v is number=>typeof v==='number'&&Number.isFinite(v);
const formatted=(n:unknown)=>isFiniteNumber(n)?new Intl.NumberFormat(undefined,{maximumFractionDigits:2}).format(n):
  n===null||n===undefined?'Unavailable':String(n);

export function parseLawBehaviorReceipt(value:unknown):LawBehaviorReceipt {
  if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Invalid behavior receipt.');
  const data=value as Partial<LawBehaviorReceipt>;
  const object=(v:unknown)=>!!v&&typeof v==='object'&&!Array.isArray(v);
  if(data.schemaVersion!=='hbl-law-behavior-receipt.v1'||!Array.isArray(data.frames)||
    !data.law||!Number.isInteger(data.law.number)||typeof data.law.title!=='string'||data.frames.length>100)
    throw Error('Unknown law behavior contract; model data not displayed.');
  if(data.limitations!==undefined&&(!Array.isArray(data.limitations)||data.limitations.length>100||
    data.limitations.some(text=>typeof text!=='string'||text.length>10000)))
    throw Error('Invalid model limitations; model data not displayed.');
  if(data.status==='mechanism-unavailable')return data as LawBehaviorReceipt;
  if(data.status!=='completed'||!data.manifest?.pairedInitialState||
    !['population','city'].includes(data.engine||'')||
    !['minute','month'].includes(data.unit||'')||
    !Number.isInteger(data.manifest.seed)||data.manifest.seed<0||data.manifest.seed>4294967295||
    !isFiniteNumber(data.manifest.implementationStrength)||data.manifest.implementationStrength<0||data.manifest.implementationStrength>1||
    !Number.isInteger(data.manifest.population)||data.manifest.population<1||data.manifest.population>60||
    data.manifest.recordedCheckpoints!==data.frames.length||
    !isFiniteNumber(data.manifest.start)||!isFiniteNumber(data.manifest.end)||
    data.manifest.start>data.manifest.end||typeof data.manifest.modelVersion!=='string'||!(/^[A-Za-z0-9._-]{1,80}$/).test(data.manifest.modelVersion)||
    !data.frames.length)throw Error('The model did not supply comparable recorded behavior.');
  for(let i=0;i<data.frames.length;i++){
    const frame=data.frames[i];
    if(!isFiniteNumber(frame?.time)||i>0&&frame.time<=data.frames[i-1]!.time||
      !frame.baseline||!frame.edited||!Array.isArray(frame.baseline.actors)||
      !Array.isArray(frame.edited.actors)||frame.baseline.actors.length>12||frame.edited.actors.length>12)
      throw Error('Nonmatching or unbounded model checkpoints cannot be displayed.');
    for(const side of [frame.baseline,frame.edited]){
      if(!object(side.metrics)||Object.values(side.metrics).some(v=>!isFiniteNumber(v))||
        side.actors.some(a=>!object(a)||typeof a.id!=='string'||!a.id||a.id.length>100||
          Object.values(a).some(v=>typeof v==='number'&&!Number.isFinite(v)))||
        new Set(side.actors.map(a=>a.id)).size!==side.actors.length)throw Error('Invalid model metrics or actor identities.');
    }
    if(frame.time<data.manifest.start||frame.time>data.manifest.end)throw Error('Checkpoint outside the recorded horizon.');
  }
  return data as LawBehaviorReceipt;
}

export function actualActorDifferences(frame:LawBehaviorFrame|undefined,engine:string|undefined){
  if(!frame)return[];
  const after=new Map(frame.edited.actors.map(row=>[row.id,row]));
  const fields=engine==='city'?HOUSE_FIELDS:PERSON_FIELDS;
  return frame.baseline.actors.filter(row=>after.has(row.id)).map(row=>{
    const current=after.get(row.id)!;
    const changed=fields.filter(key=>row[key]!==undefined&&current[key]!==undefined&&!Object.is(row[key],current[key]));
    return{id:row.id,label:row.label||row.id,before:row,after:current,fields:changed};
  });
}
function validMetricKeys(frames:LawBehaviorFrame[]){
  const first=frames[0];
  if(!first)return[];
  return Object.keys(METRICS).filter(key=>frames.some(frame=>
    isFiniteNumber(frame.baseline.metrics[key])&&isFiniteNumber(frame.edited.metrics[key])));
}
function defaultMetric(frames:LawBehaviorFrame[],keys:string[]){
  return keys.find(key=>frames.some(frame=>isFiniteNumber(frame.baseline.metrics[key])&&
    isFiniteNumber(frame.edited.metrics[key])&&Math.abs(frame.edited.metrics[key]-frame.baseline.metrics[key])>1e-8))||keys[0]||'';
}
function ActorPositionMap({actors,bounds,label,changed}:{
  actors:Actor[];bounds:{x0:number;x1:number;z0:number;z1:number}|null;label:string;changed:Set<string>;
}){
  if(!bounds)return null;
  const spanX=Math.max(1,bounds.x1-bounds.x0),spanZ=Math.max(1,bounds.z1-bounds.z0);
  return <svg viewBox="0 0 240 138" role="img" aria-label={label+' · recorded synthetic local actor positions'}>
    <rect x="5" y="5" width="230" height="128" rx="8" fill="#fff" stroke="#cfdee9"/>
    {actors.filter(a=>isFiniteNumber(a.x)&&isFiniteNumber(a.z)).map(a=><circle key={a.id}
      cx={14+212*(a.x!-bounds.x0)/spanX} cy={14+108*(a.z!-bounds.z0)/spanZ}
      r={changed.has(a.id)?5:3} className={changed.has(a.id)?'sim-actor-changed':'sim-actor'}>
      <title>{a.label||a.id} · {a.activity||'activity unavailable'} · {a.mode||'mode unavailable'}</title>
    </circle>)}
  </svg>;
}
function ActualTimeChart({frames,metric,index}:{frames:LawBehaviorFrame[];metric:string;index:number}){
  if(frames.length<2||!metric||frames.some(f=>!isFiniteNumber(f.baseline.metrics[metric])||
    !isFiniteNumber(f.edited.metrics[metric])))return <p className="muted s">No complete paired recorded series for this outcome.</p>;
  // The guard above establishes a finite observed value in *every* paired frame.
  const value=(frame:LawBehaviorFrame,side:'baseline'|'edited'):number=>frame[side].metrics[metric]!;
  const values=frames.flatMap(f=>[value(f,'baseline'),value(f,'edited')]);
  const min=Math.min(...values),max=Math.max(...values),span=max-min||1;
  const start=frames[0]!.time,extent=frames.at(-1)!.time-start||1;
  const x=(v:number)=>28+(v-start)*478/extent,y=(v:number)=>143-(v-min)*111/span;
  const path=(side:'baseline'|'edited')=>frames.map(f=>x(f.time).toFixed(1)+','+y(value(f,side)).toFixed(1)).join(' ');
  const current=frames[index]!;
  return <svg viewBox="0 0 530 174" role="img" aria-label="Time-aligned plot of actual current-rule and edited-law model outputs">
    <line x1="28" y1="143" x2="505" y2="143" stroke="#92a9ba"/>
    <polyline points={path('baseline')} className="sim-plot-base"/>
    <polyline points={path('edited')} className="sim-plot-edited"/>
    {frames.map(f=><g key={f.time}>
      <circle cx={x(f.time)} cy={y(value(f,'baseline'))} r="2" fill="#166d9e"/>
      <circle cx={x(f.time)} cy={y(value(f,'edited'))} r="2" fill="#15845a"/>
    </g>)}
    <line x1={x(current.time)} x2={x(current.time)} y1="12" y2="143" stroke="#d98b17" strokeDasharray="4 3" strokeWidth="2"/>
    <text x="30" y="13" fontSize="11" fill="#3a5160">{formatted(max)}</text>
    <text x="30" y="164" fontSize="11" fill="#3a5160">{formatted(min)}</text>
  </svg>;
}

/** Native React behavior UI. The HBL endpoint delivers *data*, not an iframe or screenshot. */
export function LawBehaviorExplorer({seed,hblOrigin}:{seed:number;hblOrigin:string}){
  const [imported]=useState(()=>typeof window==='undefined'?null:(new URLSearchParams(window.location.search).has('simulationShare')?parseSimulationShare(window.location.search):parseCivicLawContext(window.location.search)));
  const effectiveSeed=imported?.seed??seed;
  const invalidContext=typeof window!=='undefined'&&['civicContext','simulationShare'].some(key=>new URLSearchParams(window.location.search).has(key))&&!imported;
  const [lawId,setLawId]=useState(imported?.lawId??83);
  const [strength,setStrength]=useState((imported?.implementationStrength??1)*100);
  const [revision,setRevision]=useState(imported?.revision??1);
  const [selectedActor,setSelectedActor]=useState('');
  const [receipt,setReceipt]=useState<LawBehaviorReceipt|null>(null);
  const [reference,setReference]=useState<LawBehaviorReceipt|null>(null);
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[dirty,setDirty]=useState(true);
  const [frameIndex,setFrameIndex]=useState(0),[playing,setPlaying]=useState(false);
  const [metric,setMetric]=useState('');
  const [speed,setSpeed]=useState(1);
  const [reducedMotion,setReducedMotion]=useState(false);
  const [traceOpen,setTraceOpen]=useState(false);
  const context:CivicLawContext={lawId,implementationStrength:strength/100,seed:effectiveSeed,population:24,revision,proposalId:imported?.proposalId||`demo-law-${lawId}`,...((receipt?.manifest?.modelVersion||imported?.modelVersion)?{modelVersion:receipt?.manifest?.modelVersion||imported?.modelVersion}: {})};
  const amendment=structuredAmendment(context);
  const controller=useRef<AbortController|null>(null),generation=useRef(0);
  const law=MODELED_LAWS.find(row=>row.id===lawId)!;
  const frames=receipt?.status==='completed'?receipt.frames:[];
  const frame=frames[Math.min(frameIndex,frames.length-1)];
  const metricKeys=useMemo(()=>validMetricKeys(frames),[receipt]);
  const selectedMetric=metricKeys.includes(metric)?metric:metricKeys[0]||'';
  const unit=METRICS[selectedMetric]?.unit||'model units';
  const matched=useMemo(()=>actualActorDifferences(frame,receipt?.engine),[frame,receipt?.engine]);
  const actorChanges=matched.filter(row=>row.fields.length);
  const bounds=useMemo(()=>{
    const locations=frames.flatMap(f=>[...f.baseline.actors,...f.edited.actors]).filter(a=>
      isFiniteNumber(a.x)&&isFiniteNumber(a.z));
    return locations.length?{x0:Math.min(...locations.map(a=>a.x!)),x1:Math.max(...locations.map(a=>a.x!)),
      z0:Math.min(...locations.map(a=>a.z!)),z1:Math.max(...locations.map(a=>a.z!))}:null;
  },[receipt]);
  const changedIds=new Set(actorChanges.map(row=>row.id));
  const baselineMetric=frame?.baseline.metrics[selectedMetric],editedMetric=frame?.edited.metrics[selectedMetric];
  const diff=isFiniteNumber(baselineMetric)&&isFiniteNumber(editedMetric)?editedMetric-baselineMetric:null;
  const originalAtTime=reference?.status==='completed'&&reference.engine===receipt?.engine&&
    reference.law.number===receipt?.law.number&&reference.unit===receipt?.unit&&
    reference.manifest?.modelVersion===receipt?.manifest?.modelVersion&&
    reference.manifest?.population===receipt?.manifest?.population&&
    reference.manifest?.seed===receipt?.manifest?.seed?
    reference.frames.find(row=>row.time===frame?.time):undefined;
  const originalValue=originalAtTime?.edited.metrics[selectedMetric];

  useEffect(()=>()=>{controller.current?.abort();generation.current++;},[]);
  useEffect(()=>{
    const preference=window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if(!preference)return;
    const update=()=>{setReducedMotion(preference.matches);setPlaying(false);};
    update();
    preference.addEventListener?.('change',update);
    const hide=()=>{if(document.hidden)setPlaying(false);};
    document.addEventListener('visibilitychange',hide);
    return()=>{preference.removeEventListener?.('change',update);document.removeEventListener('visibilitychange',hide);};
  },[]);
  useEffect(()=>{
    if(!playing||frames.length<2)return;
    if(frameIndex>=frames.length-1){setPlaying(false);return;}
    // One exact recorded pair per tick; never invent in-between states or model time.
    const delay=Math.max(100,Math.min(650,Math.round(6500/(frames.length-1))))/speed;
    const timer=window.setTimeout(()=>setFrameIndex(frameIndex+1),delay);
    return()=>window.clearTimeout(timer);
  },[playing,receipt,frameIndex,speed]);
  function seek(index:number){setPlaying(false);setFrameIndex(Math.max(0,Math.min(frames.length-1,index)));}
  function changedInput(nextLawId:number,nextStrength:number){
    generation.current++;controller.current?.abort();setPlaying(false);setBusy(false);
    setReceipt(null);setTraceOpen(false);setError('');setDirty(true);setFrameIndex(0);
    if(nextLawId!==lawId)setReference(null);
    setLawId(nextLawId);setStrength(nextStrength);setRevision(old=>Math.min(1000000,old+1));setSelectedActor('');
  }
  async function run(){
    if(!Number.isInteger(effectiveSeed)||effectiveSeed<0||effectiveSeed>4294967295)return;
    const request=++generation.current;controller.current?.abort();
    const abort=new AbortController();controller.current=abort;
    setBusy(true);setPlaying(false);setReceipt(null);setError('');setDirty(false);
    let timedOut=false;
    const timeout=window.setTimeout(()=>{timedOut=true;abort.abort();},45000);
    try{
      const response=await fetch(new URL('/api/law-behavior',hblOrigin),{
        method:'POST',headers:{'content-type':'application/json'},signal:abort.signal,
        body:JSON.stringify({lawId,seed:effectiveSeed,population:24,implementationStrength:strength/100})
      });
      const bytes=await response.text();
      if(bytes.length>2_000_000)throw Error('Model receipt exceeds the display limit.');
      let payload;try{payload=JSON.parse(bytes);}catch{throw Error('The model returned an unreadable receipt.');}
      if(!response.ok)throw Error(typeof payload?.error==='string'?payload.error:'Model request unavailable.');
      const parsed=parseLawBehaviorReceipt(payload);
      if(parsed.law.number!==lawId||parsed.status==='completed'&&(parsed.manifest?.seed!==effectiveSeed||parsed.manifest?.population!==24||parsed.manifest?.implementationStrength!==strength/100))throw Error('The returned scenario does not match this request.');
      if(parsed.status==='completed'&&(parsed.manifest?.start!==0||parsed.manifest?.end!==amendment.horizon||parsed.unit!==amendment.clock))throw Error('Model horizon changed. This scenario cannot be reproduced by this provider.');
      if(imported?.modelVersion&&parsed.status==='completed'&&parsed.manifest?.modelVersion!==imported.modelVersion)throw Error('Model version mismatch. The shared scenario cannot be reproduced by this provider version.');
      if(request!==generation.current)return;
      setReceipt(parsed);setFrameIndex(parsed.frames.length?parsed.frames.length-1:0);
      const keys=validMetricKeys(parsed.frames);
      setMetric(defaultMetric(parsed.frames,keys));
      if(parsed.status==='completed'&&strength===100)setReference(old=>old&&old.law.number===lawId?old:parsed);
    }catch(err){
      if(request!==generation.current)return;
      if(timedOut){setError('The model exceeded the 45-second limit. Retry when the service is available.');return;}
      if(abort.signal.aborted)return;
      setError(err instanceof Error?err.message:'Behavior model unavailable.');
    }finally{window.clearTimeout(timeout);if(request===generation.current)setBusy(false);}
  }
  return <section className="civic-law-behavior card" aria-label="Real modeled behavior after editing a law">
    <h3>Run two futures for one policy</h3>
    <p>Explore how one reviewed transit or housing assumption changes two synthetic worlds.</p>
    <p className="civic-law-provenance">Demo sandbox · modeled synthetic worlds, not actual outcomes. Real votes and resident records are separate.</p>
    <button type="button" onClick={()=>{
      changedInput(imported?.lawId??83,(imported?.implementationStrength??1)*100);
      setReference(null);setMetric('');
    }}>Reset local scenario</button>
    <p className="muted s">Reset restores this page’s starting parameters and clears local results; it does not save or change records.</p>
    <fieldset className="civic-scenario-gallery" disabled={busy||invalidContext}>
      <legend>Scenario presets · select, review, then run</legend>
      {SCENARIO_PRESETS.map(preset=>{
        const preview=structuredAmendment({...context,lawId:preset.lawId,implementationStrength:preset.strength/100});
        return <button type="button" key={preset.id}
          aria-pressed={lawId===preset.lawId&&strength===preset.strength}
          onClick={()=>changedInput(preset.lawId,preset.strength)}>
          <strong>{preset.label}</strong>
          <span>Law {preset.lawId} · {preview.parameterKey}: {preview.originalValue} → {preview.editedValue} {preview.units}</span>
          <span>Seed {effectiveSeed} · 24 synthetic actors · {preview.horizon} {preview.clock}s</span>
        </button>;
      })}
      <p className="muted s">Flood scenario unavailable: no reviewed flood parameter is supported by this simulator. No flood effects are inferred.</p>
    </fieldset>
    <p className="muted s">Demo / sandbox · pending review. Illustrative model, not a forecast or a simulation of your proposed legal text.</p>
    {imported?.modelVersion&&<p role="status">Shared model version: {imported.modelVersion}. Inputs restored; run to check provider compatibility. Nothing runs automatically.</p>}
    <p className="muted s">Shared links contain only reviewed model settings, seed, fixed horizon, population and model version. Journals, identities and unpublished proposals are excluded.</p>
    <section className="civic-model-limits" aria-labelledby="model-limits-title">
      <h4 id="model-limits-title">What this model cannot tell you</h4>
      <p><strong>Demo / sandbox · awaiting review.</strong> Synthetic examples and model projections are separate from real votes. No arbitrary bill prose is implemented in HappyBearLandia.</p>
      <h4>Reviewed mechanisms</h4>
      <ul>{MODELED_LAWS.map(row=><li key={row.id}>{row.label}{row.editable?' · adjustable implementation strength':' · no partial-strength mapping'}</li>)}</ul>
      <p>“Reviewed” identifies the allowlisted mapping, not empirical validation or approval of this demo. <a href={new URL('/world/constitution-city.html',hblOrigin).href} target="_blank" rel="noopener">Source: HappyBearLandia synthetic model</a>. A completed run supplies its model version and recorded checkpoints below.</p>
      <h4>Unmodeled claims</h4>
      <ul><li>Effects of your bill text or frozen civic package; neither is compiled into this model.</li><li>Real-world happiness, rights, budget feasibility, causal attribution and representative resident outcomes.</li><li>Enactment, public consent or verified vote authority. <a href="/votes">Read and give advisory views</a> separately.</li></ul>
      <h4>Sensitivity parameters</h4>
      <p>Move implementation strength from 100% to 50% while keeping seed {effectiveSeed}, population 24 and the same mechanism. Run each setting to inspect recorded differences. A smaller assumption need not produce a smaller effect. Transit covers 720 minutes; housing covers 12 months. Seed and short horizon also limit generalization.</p>
      <fieldset disabled={busy||invalidContext} className="civic-sensitivity-examples">
        <legend>Try an assumption (then Run two futures)</legend>
        {[83,22,23].map(id=><button key={id} type="button" onClick={()=>changedInput(id,50)}>
          {id===83?'Transit':id===22?'Construction cost':'Permit capacity'} at 50%
        </button>)}
        <button type="button" disabled={!law.editable} onClick={()=>changedInput(lawId,100)}>Restore 100% assumption</button>
      </fieldset>
      <h4>Failed assumptions and missing checks</h4>
      <p>{error?'Run check failed: no comparable effects are displayed. See the error and retry below.':receipt?.status==='mechanism-unavailable'?'Mapping assumption failed: the provider has no reviewed behavior mechanism for this run.':receipt?.status==='completed'?'Receipt checks passed for this run; that does not validate real-world assumptions.':'No run checked yet. Paired starting state, request identity and model version are checked when data arrives.'}</p>
      <p>The receipt cannot test whether implementation succeeds in practice or whether these synthetic actors represent your community. It supplies no validated causal explanation or project/event IDs. Missing evidence is not a passed assumption.</p>
      {receipt?.status==='completed'&&<><h4>Provider-reported limitations</h4>{receipt.limitations?.length?<ul>{receipt.limitations.map((text,index)=><li key={index}>{text}</li>)}</ul>:<p>No additional limitations supplied; this does not mean none exist.</p>}</>}
    </section>
    {invalidContext&&<p role="alert">This shared scenario has invalid or unsupported context. Open /synth without these parameters to start a new model scenario.</p>}
    <fieldset disabled={busy||invalidContext} className="civic-law-controls">
      <legend>Change and rerun one supported law model</legend>
      <label>Reviewed law
        <select value={lawId} onChange={e=>{const id=Number(e.target.value);
          changedInput(id,100);}}>
          {MODELED_LAWS.map(row=><option key={row.id} value={row.id}>{row.label}</option>)}
        </select>
      </label>
      <label>Implementation strength: <strong>{strength}%</strong>
        <input type="range" min="0" max="100" step="25" value={strength}
          disabled={!law.editable} onChange={e=>changedInput(lawId,Number(e.target.value))}/>
      </label>
      {!law.editable&&<p className="muted s">This supported law uses a fixed/discrete engine rule. No partial-strength effects are invented.</p>}
      <button type="button" onClick={()=>void run()} disabled={!Number.isInteger(effectiveSeed)||busy}>
        {busy?'Running same-seed worlds…':'Run two futures'}
      </button>
    </fieldset>
    <p className="muted s">Reviewed amendment: law {lawId}, {amendment.parameterKey}, {amendment.originalValue} → {amendment.editedValue} {amendment.units}; revision {revision}. Seed {effectiveSeed}; {amendment.horizon} {amendment.clock}s. Synthetic draft only; no legal text or vote is changed.</p>
    {busy&&<p role="status">Requesting recorded paired worlds (45-second limit)… <button type="button" onClick={()=>{generation.current++;controller.current?.abort();setBusy(false);setDirty(true);setError('Run canceled. You can retry.');}}>Cancel run</button></p>}
    <details><summary>What this amendment models</summary><p>This is a separate reviewed mechanism sandbox: your frozen civic package is not automatically applied. Native React displays actual synthetic HBL model receipts, not screenshots. The control edits a modeled assumption, not the text or legal status of a law.</p><pre className="civic-law-draft">{JSON.stringify(amendment,null,2)}</pre><p>Only this allowlisted parameter is modeled. Arbitrary legal prose has no reviewed simulation mechanism. <a href="/proposals/new">Write a discussion proposal</a> using the existing proposal flow.</p></details>
    {dirty&&<p className="muted s" role="status">The input has changed. Run the model to see recorded behavior; previous results are not reused.</p>}
    {error&&<p role="alert" className="note warn">Model data unavailable: {error}. The paired snapshot links above remain available.</p>}
    {receipt?.status==='mechanism-unavailable'&&<p role="status">No reviewed behavior mapping: {receipt.reason||'Effects unavailable.'}</p>}
    {receipt?.status==='completed'&&frames.length>0&&<>
      {!dirty && !busy && !error && <SaveToJourney category="Sandbox runs" kind="Model simulation" text={JSON.stringify({ source: 'hbl-law-behavior-receipt.v1', law: receipt.law, amendment, revision, engine: receipt.engine, manifest: receipt.manifest, unit: receipt.unit, limitations: receipt.limitations, note: 'Completed synthetic run metadata only; actor frames are not copied. No legal effect or civic ballot.' }, null, 2)} />}
      <p className="civic-law-provenance" role="status">Recorded model: {receipt.manifest?.modelVersion||'version unavailable'}
        {' · '}seed {formatted(receipt.manifest?.seed)}
        {' · '}{receipt.manifest?.population} synthetic actors
        {' · '}{strength}% reviewed parameter
        {' · '}{frames.length} checkpoints, {receipt.unit}s {frames[0]?.time}–{frames.at(-1)?.time}.
      </p>
      <div className="civic-law-playback-controls">
        <label>Recorded model outcome
          <select value={selectedMetric} onChange={e=>{setMetric(e.target.value);setPlaying(false);}}>
            {metricKeys.map(key=><option key={key} value={key}>{METRICS[key]?.label||key}</option>)}
          </select>
        </label>
        <label>Time: {receipt.unit} {String(frame?.time)} ({frameIndex+1}/{frames.length} recorded)
          <input type="range" min="0" max={frames.length-1} step="1" value={frameIndex}
            aria-valuetext={`${receipt.unit} ${String(frame?.time)}, checkpoint ${frameIndex+1} of ${frames.length}`}
            onChange={e=>{const next=Number(e.target.value);if(next!==frameIndex)requestHaptic(e.nativeEvent);seek(next);}}
            aria-label="Recorded simulation time"/>
        </label>
        <label>Playback speed
          <select value={speed} onChange={e=>setSpeed(Number(e.target.value))}>
            {[0.5,1,2,4].map(value=><option key={value} value={value}>{value}×</option>)}
          </select>
        </label>
        <button type="button" disabled={frameIndex===0&&!playing} onClick={()=>seek(0)}>Rewind to first checkpoint</button>
        <button type="button" disabled={frameIndex===0} onClick={()=>seek(frameIndex-1)}>Step back</button>
        <button type="button" disabled={frameIndex===frames.length-1} onClick={()=>seek(frameIndex+1)}>Step forward</button>
        <button type="button" disabled={frames.length<2} onClick={()=>{
          if(playing)setPlaying(false);else{if(frameIndex===frames.length-1)setFrameIndex(0);setPlaying(true);}
        }}>{playing?'Pause recorded playback':'Play recorded behavior'}</button>
      </div>
      <p className="muted s" role="status">{playing?'Playing':frameIndex===frames.length-1?'Playback complete':'Paused'} · Both worlds synchronized at {receipt.unit} {String(frame?.time)}. Recorded range: {String(frames[0]?.time)}–{String(frames.at(-1)?.time)} {receipt.unit}s.</p>
      <p className="muted s">Speed controls checkpoint pacing, not model time. Only recorded paired states are loaded; no intermediate events are invented. Use arrow keys on the time slider or the step buttons to inspect checkpoints.</p>
      {reducedMotion&&<p className="muted s">Reduced motion is enabled. Playback stays paused until you explicitly press Play; stepping and scrubbing remain available.</p>}
      <div className="civic-law-lanes">
        <section className="civic-law-lane civic-law-before">
          <h4>World A · current rules</h4>
          <p className="civic-law-value">{formatted(baselineMetric)} <small>{unit}</small></p>
          <ActorPositionMap actors={frame?.baseline.actors||[]} bounds={bounds} label="Current rules" changed={changedIds}/>
        </section>
        <section className="civic-law-lane civic-law-after">
          <h4>World B · edited law</h4>
          <p className="civic-law-value">{formatted(editedMetric)} <small>{unit}</small></p>
          <ActorPositionMap actors={frame?.edited.actors||[]} bounds={bounds} label="Edited law" changed={changedIds}/>
        </section>
      </div>
      <p className="civic-law-difference">Recorded difference: {formatted(diff)} {unit} (edited minus current rules).</p>
      <button type="button" aria-expanded={traceOpen} aria-controls="law-outcome-trace" onClick={()=>{setTraceOpen(old=>!old);setPlaying(false);}}>Inspect selected outcome evidence</button>
      {traceOpen&&frame&&<section id="law-outcome-trace" aria-label="Selected outcome evidence">
        <h4>{METRICS[selectedMetric]?.label||'Outcome unavailable'} · sandbox why-chain</h4>
        <p><strong>Observed simulation correlation:</strong> {formatted(baselineMetric)} → {formatted(editedMetric)} {unit} at {receipt.unit} {frame.time}. These are paired recorded outputs, not real votes or measured policy effects.</p>
        <p><strong>Model rule mapping:</strong> {law.label}; {amendment.parameterKey}: {amendment.originalValue} → {amendment.editedValue} {amendment.units}. This local mapping is not an executed mechanism receipt.</p>
        <p><strong>Causal interpretation unavailable:</strong> the receipt does not supply project/event IDs or a validated causal explanation. Event timestamps and executed mechanism receipts are missing; checkpoint times must not be treated as event times.</p>
        <p>Seed {receipt.manifest?.seed} · model version {receipt.manifest?.modelVersion} · code version unavailable. Model version alone does not establish a code revision.</p>
        <a download={`law-${lawId}-${selectedMetric}-trace.json`} href={'data:application/json;charset=utf-8,'+encodeURIComponent(JSON.stringify(lawOutcomeTrace(receipt,context,selectedMetric,frameIndex,new URL(hblOrigin).origin),null,2))}>Export selected outcome trace (JSON)</a>
        <p className="muted s">Export includes the full recorded receipt, selected checkpoint, scenario revision, parameter mapping, seed and explicit missing evidence.</p>
      </section>}
      {reference&&strength!==100&&isFiniteNumber(originalValue)&&<p className="muted s">
        Original 100% setting at this checkpoint: {formatted(originalValue)} {unit}. The original run is retained.
      </p>}
      <LawEnsemble key={`${lawId}:${strength}:${revision}`} lawId={lawId} strength={strength/100} seed={effectiveSeed} hblOrigin={hblOrigin} modelVersion={receipt.manifest?.modelVersion||undefined} metric={selectedMetric} unit={unit}/>
      <div className="civic-law-chart"><ActualTimeChart frames={frames} metric={selectedMetric} index={frameIndex}/></div>
      <p className="muted s">Blue: current rules · green: edited law · gold: selected recorded checkpoint.
        Lines join recorded checkpoints and are not fabricated intermediate outcomes.</p>
      <p><a href={'/synth?'+simulationShareQuery(context)}>Reproducible scenario link</a></p>
      <WorldPortal title={law.label} source={`${context.proposalId} · model recipe revision ${revision} · ${strength}% implementation · seed ${effectiveSeed}`}>
        <p>Static cross-origin handoff. The external world opens in another tab; this exact source view stays here. Its loading status cannot be verified here. If unavailable, close that tab and return here to retry. This is a separate reviewed model, not your bill text.</p>
        <a href={new URL('/world/constitution-city.html?'+civicLawQuery({...context,proposalId:undefined}),hblOrigin).href} target="_blank" rel="noopener">Open reviewed world in HappyBearLandia ↗</a>
      </WorldPortal>
      <p><a href="/votes">Give your view (advisory)</a> · <a href="/proposals/new">Suggest an amendment</a></p>
      {frame&&receipt.manifest&&isFiniteNumber(baselineMetric)&&isFiniteNumber(editedMetric)&&<FuturePostcard
        key={`${revision}:${frame.time}:${selectedMetric}`}
        facts={{law:receipt.law.number,seed:receipt.manifest.seed,strength:receipt.manifest.implementationStrength*100,
          revision,model:receipt.manifest.modelVersion||'unavailable',time:frame.time,clock:receipt.unit||'model time',
          metric:METRICS[selectedMetric]!.label,unit,baseline:baselineMetric,edited:editedMetric}}/>}
      <section aria-label="Recorded actor behavior changes">
        <h4>{receipt.engine==='city'?'What modeled households did':'What modeled residents did differently'}</h4>
        <p className="muted s">{actorChanges.length} of {matched.length} tracked synthetic
          {receipt.engine==='city'?' households':' residents'} differ at this checkpoint.
          Up to 12 fixed IDs are shown; this is not a representative sample.</p>
        {matched.length>0&&<label>Follow the same synthetic actor<select aria-label="Synthetic actor" value={selectedActor} onChange={e=>setSelectedActor(e.target.value)}><option value="">All sampled actors</option>{matched.map(row=><option key={row.id} value={row.id}>{row.label}</option>)}</select></label>}
        {selectedActor&&matched.filter(row=>row.id===selectedActor).map(row=><article key={row.id}><h4>{row.label} · current rules → edited law</h4>{(receipt.engine==='city'?HOUSE_FIELDS:PERSON_FIELDS).map(key=><p key={key}>{LABELS[key]}: {formatted(row.before[key])} → {formatted(row.after[key])}</p>)}</article>)}
        {actorChanges.length>0?<div className="civic-law-actors">
          {actorChanges.slice(0,6).map(row=><article key={row.id} className="civic-law-actor">
            <b>{row.label}</b>
            {row.fields.slice(0,4).map(key=><p key={key}>{LABELS[key]||key}: {formatted(row.before[key])} → {formatted(row.after[key])}</p>)}
          </article>)}
        </div>:<p className="muted s">No recorded difference among these sampled actors. This does not establish zero effects across the model.</p>}
      </section>
      <details><summary>Why did this change? Model evidence and limitations</summary>
        <p>This comparison changes only law {lawId}'s reviewed parameter from current rules to {strength}%. Above are actual sampled states at {receipt.unit} {frame?.time}, not generated explanations. Model {receipt.manifest?.modelVersion||'unavailable'}, seed {effectiveSeed}. The receipt does not supply project/event IDs or a validated causal explanation; those are unavailable here.</p>
        <p>Only reviewed parameters are executable. Synthetic results are not claims about actual people, future legislation, happiness, rights or budgets.</p>
        <ul>{receipt.limitations?.map((text,index)=><li key={index}>{text}</li>)}</ul>
      </details>
    </>}
  </section>;
}
