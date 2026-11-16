import {useState} from 'react';
import type {LawBehaviorReceipt} from './LawBehaviorExplorer';

type FutureSide='baseline'|'edited';
const sides:FutureSide[]=['baseline','edited'];
const titles={baseline:'Current rules',edited:'Edited law'};
/** Both exhibits come from one validated paired receipt; never combine runs. */
export function FuturesGallery({receipt,metric,label,unit,onCompare,sourceOrigin}:{
  sourceOrigin:string;receipt:LawBehaviorReceipt;metric:string;label:string;unit:string;onCompare:(open:boolean)=>void;
}){
  const [selected,setSelected]=useState<FutureSide[]>([]);
  const [preview,setPreview]=useState<FutureSide|null>(null);
  const last=receipt.frames.at(-1)!;
  const values=receipt.frames.flatMap(f=>sides.map(s=>f[s].metrics[metric])).filter((v):v is number=>v!==undefined);
  const min=values.length?Math.min(...values):0,span=(values.length?Math.max(...values)-min:0)||1;
  const format=(value:number|undefined)=>value===undefined?'Unavailable':new Intl.NumberFormat(undefined,{maximumFractionDigits:2}).format(value);
  return <section aria-label="Alternate futures gallery" className="futures-gallery">
    <h4>Alternate futures gallery</h4>
    <p>Two hypothetical outcomes, not forecasts. Hover or focus to preview; select both to open synchronized comparisons. Touch users can select directly.</p>
    <p>Exhibition order: current rules, then edited law. No preference ranking or overall benefit score is assigned. Differences are edited minus current rules for the named metric; higher does not necessarily mean better.</p>
    <p>Matched parameters: seed {receipt.manifest?.seed}, population {receipt.manifest?.population}, model {receipt.manifest?.modelVersion}, {receipt.unit}s {receipt.manifest?.start}–{receipt.manifest?.end}. Only the reviewed law parameter changes.</p>
    <div className="futures-exhibits">
      {sides.map(side=><button type="button" key={side} aria-pressed={selected.includes(side)}
        onMouseEnter={()=>setPreview(side)} onMouseLeave={()=>setPreview(null)}
        onFocus={()=>setPreview(side)} onBlur={()=>setPreview(null)}
        onClick={()=>{const next=selected.includes(side)?selected.filter(s=>s!==side):[...selected,side];setSelected(next);onCompare(next.length===2);}}
        className="futures-exhibit">
        <strong>{titles[side]} · hypothetical</strong>
        <svg viewBox="0 0 200 64" aria-hidden="true">
          <rect x="1" y="1" width="198" height="62" rx="5" fill="none" stroke="currentColor"/>
          {receipt.frames.map((frame,index)=>{
            const value=frame[side].metrics[metric];
            return value===undefined?null:<circle key={frame.time} cx={10+180*index/Math.max(1,receipt.frames.length-1)} cy={54-44*(value-min)/span} r="3" fill="currentColor"/>;
          })}
        </svg>
        <span>{label}: {format(last[side].metrics[metric])} {unit} at {receipt.unit} {last.time}</span>
        <span>{selected.includes(side)?'Selected for comparison':'Select for comparison'}</span>
      </button>)}
    </div>
    <p className="futures-preview">{preview?`${titles[preview]} preview: ${label}, ${format(last[preview].metrics[metric])} ${unit}. Same final checkpoint in both thumbnails.`:'Thumbnails show recorded checkpoints on a shared scale; missing values are omitted.'}</p>
    <p role="status">{selected.length}/2 futures selected. {selected.length===2?'Synchronized comparison open below.':'Select both exhibits to compare.'}</p>
    <p>Source: HappyBearLandia <code>{receipt.schemaVersion}</code> · {receipt.manifest?.modelVersion}. <a href={sourceOrigin}>Model provider</a>. No resident journals or votes are sent; only the reviewed model parameters are requested.</p>
    <p>Limitations: synthetic model observations do not establish real-world outcomes, causality, rights or legal status. {receipt.limitations?.join(' ')}</p>
  </section>;
}
