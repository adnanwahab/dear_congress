import {useState} from 'react';
import type {LawBehaviorReceipt} from './LawBehaviorExplorer';

const FIELDS={activity:'Activity',mode:'Travel mode',employmentStatus:'Employment',districtId:'District',unitId:'Assigned unit',unhoused:'No assigned unit',x:'Local x',z:'Local z'} as const;

/** Schematic slots are stable actor IDs, never invented geography or buildings. */
export function TownDiorama({receipt,index,checkpointLink}:{receipt:LawBehaviorReceipt;index:number;checkpointLink:string}){
  const [list,setList]=useState(false);
  const frame=receipt.frames[index];
  if(receipt.status!=='completed'||!frame)return null;
  return <section className="town-diorama" aria-label="Miniature synthetic town">
    <h4>Miniature synthetic town · {receipt.unit} {frame.time}</h4>
    <p>Synthetic recorded states · seed {receipt.manifest?.seed} · model {receipt.manifest?.modelVersion} · horizon {receipt.manifest?.start}–{receipt.manifest?.end} {receipt.unit}s.</p>
    <p className="muted s">Schematic actor slots, not a geographic map. Only recorded checkpoints change. Building geometry, event IDs and causal explanations are unavailable. Sampled actors are not representative; effects are uncertain and are not forecasts. No legal text is enacted.</p>
    <button type="button" aria-pressed={list} onClick={()=>setList(value=>!value)}>{list?'Show compact town':'Show list alternative'}</button>
    <a href={checkpointLink}>Inspect seed and this recorded time</a>
    <div className={list?'town-list':'town-grid'}>
      {(['baseline','edited'] as const).map(side=><section key={side} aria-label={side==='baseline'?'Town under current rules':'Town under edited law'}>
        <h4>{side==='baseline'?'Current rules':'Edited law'}</h4>
        {frame[side].actors.length===0&&<p>No sampled actor states available.</p>}
        <ul>{frame[side].actors.map(actor=><li key={actor.id}>
          <details><summary>{actor.label||actor.id}<br/><small>{actor.activity??actor.employmentStatus??(actor.unhoused===true?'No assigned unit':actor.unitId??'Status unavailable')}</small></summary>
            <p>Synthetic ID: {actor.id}</p>
            <dl>{(Object.keys(FIELDS) as (keyof typeof FIELDS)[]).map(key=><div key={key}><dt>{FIELDS[key]}</dt><dd>{actor[key]===undefined||actor[key]===null?'Unavailable':String(actor[key])}</dd></div>)}</dl>
          </details>
        </li>)}</ul>
      </section>)}
    </div>
    <details><summary>Inspectable recorded receipt</summary><pre className="civic-law-draft">{JSON.stringify(receipt,null,2)}</pre></details>
  </section>;
}
