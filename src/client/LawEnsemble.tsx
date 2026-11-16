import {useEffect,useRef,useState} from 'react';
import {parseLawBehaviorReceipt,type LawBehaviorReceipt} from './LawBehaviorExplorer';

type Side='baseline'|'edited';
export function ensembleRows(receipts:LawBehaviorReceipt[],metric:string,side:Side,alignmentOnly=false){
  const first=receipts[0];
  if(!first?.manifest||receipts.length<2)throw Error('At least two completed seeds are required.');
  const m=first.manifest;
  const seeds=new Set<number>();
  for(const r of receipts){
    const n=r.manifest;
    if(r.status!=='completed'||!n||seeds.has(n.seed)||r.law.id!==first.law.id||r.law.number!==first.law.number||r.engine!==first.engine||r.unit!==first.unit||
      n.modelVersion!==m.modelVersion||n.population!==m.population||n.implementationStrength!==m.implementationStrength||n.start!==m.start||n.end!==m.end||r.frames.length!==first.frames.length||
      r.frames.some((f,i)=>f.time!==first.frames[i]!.time))throw Error('Seeds have incompatible model versions, scenarios or checkpoints.');
    seeds.add(n.seed);
  }
  return first.frames.map((f,i)=>{
    const values=receipts.map(r=>alignmentOnly ? 0 : r.frames[i]![side].metrics[metric]);
    if(values.some(v=>typeof v!=='number'||!Number.isFinite(v)))throw Error('This outcome is missing from one or more seeds.');
    const sorted=(values as number[]).toSorted((a,b)=>a-b);
    // Linear interpolation over the sorted, finite deterministic seed values.
    const q=(p:number)=>{const at=(sorted.length-1)*p,lo=Math.floor(at);return sorted[lo]!+(sorted[Math.ceil(at)]!-sorted[lo]!)*(at-lo);};
    return {time:f.time,values:values as number[],min:sorted[0]!,p25:q(.25),median:q(.5),p75:q(.75),max:sorted.at(-1)!};
  });
}
function FanPlot({receipts,metric,side,index,select,selected,unit}:{receipts:LawBehaviorReceipt[];metric:string;side:Side;index:number;select:(i:number)=>void;selected:number;unit:string}){
  let rows;try{rows=ensembleRows(receipts,metric,side);}catch(e){return <p role="status">{(e as Error).message}</p>;}
  const lo=Math.min(...rows.map(r=>r.min)),hi=Math.max(...rows.map(r=>r.max));
  const x=(i:number)=>45+i*450/Math.max(1,rows.length-1),y=(v:number)=>155-(v-lo)*125/(hi-lo||1);
  const line=(key:'min'|'max'|'p25'|'p75'|'median')=>rows.map((r,i)=>`${x(i)},${y(r[key])}`);
  const band=(a:'min'|'p25',b:'max'|'p75')=>[...line(a),...line(b).reverse()].join(' ');
  const label=side==='baseline'?'Current rules':'Edited law';
  const current=rows[index]!;
  return <section className="ensemble-plot" aria-label={label+' seed distribution'}>
    <h4>{label}</h4>
    <svg viewBox="0 0 540 190" role="img" aria-label={`${label}: ${metric} in ${unit}. Full seed range, middle 50%, median and selected seed. Exact values follow.`}>
      <polygon points={band('min','max')} fill="#dceaf4"/>
      <polygon points={band('p25','p75')} fill="#91bdd4"/>
      <polyline points={line('median').join(' ')} fill="none" stroke="#174c68" strokeWidth="3"/>
      <polyline points={rows.map((r,i)=>`${x(i)},${y(r.values[selected]!)}`).join(' ')} fill="none" stroke="#985000" strokeWidth="2" strokeDasharray="5 3"/>
      <text x="2" y="16" fontSize="11">{hi.toPrecision(4)}</text><text x="2" y="175" fontSize="11">{lo.toPrecision(4)}</text>
      <text x="45" y="188" fontSize="11">{rows[0]!.time}</text><text x="470" y="188" fontSize="11">{rows.at(-1)!.time}</text>
      <line x1={x(index)} x2={x(index)} y1="20" y2="155" stroke="#985000"/>
      {rows.map((r,i)=><rect key={r.time} x={x(i)-225/Math.max(1,rows.length-1)} y="20" width={450/Math.max(1,rows.length-1)} height="135" fill="transparent" onPointerEnter={()=>select(i)} onPointerDown={()=>select(i)}><title>{`${r.time}: median ${r.median}; min ${r.min}; p25 ${r.p25}; p75 ${r.p75}; max ${r.max}; seed ${receipts[selected]!.manifest!.seed}: ${r.values[selected]}`}</title></rect>)}
    </svg>
    <p role="status">Time {current.time}: median {current.median}; range {current.min}–{current.max}; middle 50% {current.p25}–{current.p75}; selected seed {current.values[selected]} {unit}.</p>
    <details><summary>{label}: exact data table</summary><div className="ensemble-table" tabIndex={0} role="region" aria-label={label+' exact data'}><table>
      <caption>{metric} ({unit}); time in {receipts[0]!.unit}s. All recorded values; interpolated quartiles.</caption>
      <thead><tr>{['Time','Min','25th percentile','Median','75th percentile','Max',...receipts.map(r=>'Seed '+r.manifest!.seed)].map(s=><th key={s} scope="col">{s}</th>)}</tr></thead>
      <tbody>{rows.map(r=><tr key={r.time}><th scope="row">{r.time}</th>{[r.min,r.p25,r.median,r.p75,r.max,...r.values].map((v,i)=><td key={i}>{String(v)}</td>)}</tr>)}</tbody>
    </table></div></details>
  </section>;
}
export function LawEnsemble({lawId,strength,seed,hblOrigin,modelVersion,metric,unit}:{lawId:number;strength:number;seed:number;hblOrigin:string;modelVersion?:string;metric:string;unit:string}){
  const [receipts,setReceipts]=useState<LawBehaviorReceipt[]>([]),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const [index,setIndex]=useState(0),[selected,setSelected]=useState(0),[progress,setProgress]=useState(0);
  const controller=useRef<AbortController|null>(null);
  useEffect(()=>()=>controller.current?.abort(),[]);
  async function run(){
    const abort=new AbortController();controller.current=abort;setBusy(true);setError('');setReceipts([]);setProgress(0);
    let timedOut=false;
    const timeout=window.setTimeout(()=>{timedOut=true;abort.abort();},45000);
    try{
      const result:LawBehaviorReceipt[]=[];
      for(let i=0;i<8;i++){
        const requestedSeed=(seed+i)>>>0;
        const response=await fetch(new URL('/api/law-behavior',hblOrigin),{method:'POST',headers:{'content-type':'application/json'},signal:abort.signal,
          body:JSON.stringify({lawId,seed:requestedSeed,population:24,implementationStrength:strength})});
        if(!response.ok)throw Error(`Provider returned HTTP ${response.status}. Retry the ensemble later.`);
        const bytes=await response.text();if(bytes.length>2_000_000)throw Error('Model receipt exceeds the display limit.');
        const receipt=parseLawBehaviorReceipt(JSON.parse(bytes));
        if(receipt.status!=='completed'||receipt.law.number!==lawId||receipt.manifest?.seed!==requestedSeed||receipt.manifest.population!==24||receipt.manifest.implementationStrength!==strength||
          modelVersion&&receipt.manifest.modelVersion!==modelVersion)throw Error('The returned scenario or model version does not match this ensemble.');
        if(abort.signal.aborted)return;
        result.push(receipt);setProgress(result.length);
      }
      // Validate alignment even if the currently chosen outcome is incomplete.
      ensembleRows(result,'','baseline',true);
      if(!abort.signal.aborted){setReceipts(result);setIndex(0);setSelected(0);}
    }catch(e){if(!abort.signal.aborted||timedOut)setError(timedOut?'Ensemble exceeded the 45-second limit. Retry later.':(e as Error).message);}
    finally{window.clearTimeout(timeout);if(controller.current===abort)setBusy(false);}
  }
  const first=receipts[0];
  return <section className="law-ensemble" aria-label="Synthetic futures ensemble sandbox">
    <h4>Demo sandbox · many synthetic futures</h4>
    <p>Eight consecutive deterministic seeds, starting at {seed} (wrapping at 2³²). This seed distribution is not a statistical forecast or population confidence interval. No real votes or citizen data are used.</p>
    <button type="button" disabled={busy} onClick={()=>void run()}>{busy?'Running ensemble…':'Run eight synthetic futures'}</button>
    {busy&&<p role="status">Loading {progress}/8 seeds. No partial distribution is shown. <button type="button" onClick={()=>{controller.current?.abort();setBusy(false);setError('Ensemble canceled. You can retry.');}}>Cancel ensemble</button></p>}
    {error&&<p role="alert">Ensemble unavailable: {error}</p>}
    {first&&<><p>N = {receipts.length} seeds; {first.manifest!.population} synthetic actors per seed; model {first.manifest!.modelVersion}; recorded horizon {first.manifest!.start}–{first.manifest!.end} {first.unit}s; law {lawId}, strength {strength}.</p>
      <label>Ensemble time: {first.frames[index]!.time} {first.unit}s<input aria-label="Ensemble recorded time" type="range" min="0" max={first.frames.length-1} value={index} onChange={e=>setIndex(Number(e.target.value))}/></label>
      <label>Selected seed trajectory<select value={selected} onChange={e=>setSelected(Number(e.target.value))}>{receipts.map((r,i)=><option key={i} value={i}>{r.manifest!.seed}</option>)}</select></label>
      <p>Light band: full seed range. Dark band: middle 50%. Solid line: median. Dashed line: selected seed. Lines connect recorded checkpoints only. Hover or touch the plot, use the time slider with arrow/Home/End keys, or open each exact data table. No automatic motion.</p>
      {(['baseline','edited'] as const).map(side=><FanPlot key={side} receipts={receipts} metric={metric} side={side} index={index} select={setIndex} selected={selected} unit={unit}/>)}
    </>}
  </section>;
}
