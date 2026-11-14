import {useEffect,useMemo,useRef,useState} from 'react';
import './law-behavior-explorer.css';

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
  if(data.schemaVersion!=='hbl-law-behavior-receipt.v1'||!Array.isArray(data.frames)||
    !data.law||!Number.isInteger(data.law.number)||data.frames.length>100)
    throw Error('Unknown law behavior contract; model data not displayed.');
  if(data.status==='mechanism-unavailable')return data as LawBehaviorReceipt;
  if(data.status!=='completed'||!data.manifest?.pairedInitialState||
    !['population','city'].includes(data.engine||'')||
    !['minute','month'].includes(data.unit||'')||
    !isFiniteNumber(data.manifest.seed)||!isFiniteNumber(data.manifest.implementationStrength)||
    !data.frames.length)throw Error('The model did not supply comparable recorded behavior.');
  for(let i=0;i<data.frames.length;i++){
    const frame=data.frames[i];
    if(!isFiniteNumber(frame?.time)||i>0&&frame.time<=data.frames[i-1]!.time||
      !frame.baseline||!frame.edited||!Array.isArray(frame.baseline.actors)||
      !Array.isArray(frame.edited.actors)||frame.baseline.actors.length>12||frame.edited.actors.length>12)
      throw Error('Nonmatching or unbounded model checkpoints cannot be displayed.');
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
  const values=frames.flatMap(f=>[f.baseline.metrics[metric],f.edited.metrics[metric]]);
  const min=Math.min(...values),max=Math.max(...values),span=max-min||1;
  const start=frames[0]!.time,extent=frames.at(-1)!.time-start||1;
  const x=(v:number)=>28+(v-start)*478/extent,y=(v:number)=>143-(v-min)*111/span;
  const path=(side:'baseline'|'edited')=>frames.map(f=>x(f.time).toFixed(1)+','+y(f[side].metrics[metric]).toFixed(1)).join(' ');
  const current=frames[index]!;
  return <svg viewBox="0 0 530 174" role="img" aria-label="Time-aligned plot of actual current-rule and edited-law model outputs">
    <line x1="28" y1="143" x2="505" y2="143" stroke="#92a9ba"/>
    <polyline points={path('baseline')} className="sim-plot-base"/>
    <polyline points={path('edited')} className="sim-plot-edited"/>
    {frames.map(f=><g key={f.time}>
      <circle cx={x(f.time)} cy={y(f.baseline.metrics[metric])} r="2" fill="#166d9e"/>
      <circle cx={x(f.time)} cy={y(f.edited.metrics[metric])} r="2" fill="#15845a"/>
    </g>)}
    <line x1={x(current.time)} x2={x(current.time)} y1="12" y2="143" stroke="#d98b17" strokeDasharray="4 3" strokeWidth="2"/>
    <text x="30" y="13" fontSize="11" fill="#3a5160">{formatted(max)}</text>
    <text x="30" y="164" fontSize="11" fill="#3a5160">{formatted(min)}</text>
  </svg>;
}

/** Native React behavior UI. The HBL endpoint delivers *data*, not an iframe or screenshot. */
export function LawBehaviorExplorer({seed,hblOrigin}:{seed:number;hblOrigin:string}){
  const [lawId,setLawId]=useState(83);
  const [strength,setStrength]=useState(100);
  const [receipt,setReceipt]=useState<LawBehaviorReceipt|null>(null);
  const [reference,setReference]=useState<LawBehaviorReceipt|null>(null);
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[dirty,setDirty]=useState(true);
  const [frameIndex,setFrameIndex]=useState(0),[playing,setPlaying]=useState(false);
  const [metric,setMetric]=useState('');
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
    reference.manifest?.seed===receipt?.manifest?.seed?
    reference.frames.find(row=>row.time===frame?.time):undefined;
  const originalValue=originalAtTime?.edited.metrics[selectedMetric];

  useEffect(()=>()=>{controller.current?.abort();generation.current++;},[]);
  useEffect(()=>{
    if(!playing||frames.length<2)return;
    const delay=Math.max(100,Math.min(650,Math.round(6500/(frames.length-1))));
    const timer=window.setInterval(()=>setFrameIndex(old=>{if(old>=frames.length-1){setPlaying(false);return old;}return old+1;}),delay);
    return()=>window.clearInterval(timer);
  },[playing,receipt]);
  function changedInput(nextLawId:number,nextStrength:number){
    generation.current++;controller.current?.abort();setPlaying(false);setBusy(false);
    setReceipt(null);setError('');setDirty(true);setFrameIndex(0);
    if(nextLawId!==lawId)setReference(null);
    setLawId(nextLawId);setStrength(nextStrength);
  }
  async function run(){
    if(!Number.isInteger(seed)||seed<0||seed>4294967295)return;
    const request=++generation.current;controller.current?.abort();
    const abort=new AbortController();controller.current=abort;
    setBusy(true);setPlaying(false);setReceipt(null);setError('');setDirty(false);
    try{
      const response=await fetch(new URL('/api/law-behavior',hblOrigin),{
        method:'POST',headers:{'content-type':'application/json'},signal:abort.signal,
        body:JSON.stringify({lawId,seed,population:24,implementationStrength:strength/100})
      });
      const payload=await response.json();
      if(!response.ok)throw Error(typeof payload?.error==='string'?payload.error:'Model request unavailable.');
      const parsed=parseLawBehaviorReceipt(payload);
      if(request!==generation.current)return;
      setReceipt(parsed);setFrameIndex(parsed.frames.length?parsed.frames.length-1:0);
      const keys=validMetricKeys(parsed.frames);
      setMetric(defaultMetric(parsed.frames,keys));
      if(parsed.status==='completed'&&strength===100)setReference(old=>old&&old.law.number===lawId?old:parsed);
    }catch(err){
      if(request!==generation.current||abort.signal.aborted)return;
      setError(err instanceof Error?err.message:'Behavior model unavailable.');
    }finally{if(request===generation.current)setBusy(false);}
  }
  return <section className="civic-law-behavior card" aria-label="Real modeled behavior after editing a law">
    <h3>Watch a law change simulated behavior</h3>
    <p className="muted s">Live synthetic model data from HappyBearLandia, displayed directly here—no visible iframe or screenshots.
      This is a separate reviewed mechanism sandbox: <strong>your frozen civic package is not automatically applied</strong>.
      The slider edits a modeled assumption, not the text or legal status of a law.</p>
    <fieldset disabled={busy} className="civic-law-controls">
      <legend>Change and rerun one supported law model</legend>
      <label>Reviewed law
        <select value={lawId} onChange={e=>{const id=Number(e.target.value);
          changedInput(id,id===21?100:100);}}>
          {MODELED_LAWS.map(row=><option key={row.id} value={row.id}>{row.label}</option>)}
        </select>
      </label>
      <label>Implementation strength: <strong>{strength}%</strong>
        <input type="range" min="0" max="100" step="25" value={strength}
          disabled={!law.editable} onChange={e=>changedInput(lawId,Number(e.target.value))}/>
      </label>
      {!law.editable&&<p className="muted s">This supported law uses a fixed/discrete engine rule. No partial-strength effects are invented.</p>}
      <button type="button" onClick={()=>void run()} disabled={!Number.isInteger(seed)||busy}>
        {busy?'Running same-seed worlds…':receipt?'Rerun edited simulation':'Run two simulated worlds'}
      </button>
    </fieldset>
    {dirty&&<p className="muted s" role="status">The input has changed. Run the model to see recorded behavior; previous results are not reused.</p>}
    {error&&<p role="alert" className="note warn">Model data unavailable: {error}. The paired snapshot links above remain available.</p>}
    {receipt?.status==='mechanism-unavailable'&&<p role="status">No reviewed behavior mapping: {receipt.reason||'Effects unavailable.'}</p>}
    {receipt?.status==='completed'&&frames.length>0&&<>
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
        <label>Time: {receipt.unit} {formatted(frame?.time)} ({frameIndex+1}/{frames.length} recorded)
          <input type="range" min="0" max={frames.length-1} value={frameIndex}
            onChange={e=>{setPlaying(false);setFrameIndex(Number(e.target.value));}}
            aria-label="Recorded simulation time"/>
        </label>
        <button type="button" disabled={frames.length<2} onClick={()=>{
          if(playing)setPlaying(false);else{if(frameIndex===frames.length-1)setFrameIndex(0);setPlaying(true);}
        }}>{playing?'Pause recorded playback':'Play recorded behavior'}</button>
      </div>
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
      {reference&&strength!==100&&isFiniteNumber(originalValue)&&<p className="muted s">
        Original 100% setting at this checkpoint: {formatted(originalValue)} {unit}. The original run is retained.
      </p>}
      <div className="civic-law-chart"><ActualTimeChart frames={frames} metric={selectedMetric} index={frameIndex}/></div>
      <p className="muted s">Blue: current rules · green: edited law · gold: selected recorded checkpoint.
        Lines join recorded checkpoints and are not fabricated intermediate outcomes.</p>
      <section aria-label="Recorded actor behavior changes">
        <h4>{receipt.engine==='city'?'What modeled households did':'What modeled residents did differently'}</h4>
        <p className="muted s">{actorChanges.length} of {matched.length} tracked synthetic
          {receipt.engine==='city'?' households':' residents'} differ at this checkpoint.
          Up to 12 fixed IDs are shown; this is not a representative sample.</p>
        {actorChanges.length>0?<div className="civic-law-actors">
          {actorChanges.slice(0,6).map(row=><article key={row.id} className="civic-law-actor">
            <b>{row.label}</b>
            {row.fields.slice(0,4).map(key=><p key={key}>{LABELS[key]||key}: {formatted(row.before[key])} → {formatted(row.after[key])}</p>)}
          </article>)}
        </div>:<p className="muted s">No recorded difference among these sampled actors. This does not establish zero effects across the model.</p>}
      </section>
      <details><summary>Model provenance and limitations</summary>
        <p>Only reviewed parameters are executable. Synthetic results are not claims about actual people, future legislation, happiness, rights or budgets.</p>
        <ul>{receipt.limitations?.map((text,index)=><li key={index}>{text}</li>)}</ul>
      </details>
    </>}
  </section>;
}
