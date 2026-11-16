import {useId} from 'react';
import type {LawBehaviorReceipt} from './LawBehaviorExplorer';

export const FICTION_LABEL='Simulated fiction, not prediction';
export type FutureLetter = {
  label:typeof FICTION_LABEL; title:string; creative:string[]; assumption:string;
  seed:number; horizon:string; model:string; limitations:string[];
  outcomes:{text:string;receiptIndex:number}[]; receipt:LawBehaviorReceipt;
};

/** No extrapolation, invented events, or generated causal claims. Values come from the final logged pair. */
export function buildFutureLetter(receipt:LawBehaviorReceipt):FutureLetter|null {
  const manifest=receipt.manifest, index=receipt.frames.length-1, frame=receipt.frames[index];
  if(receipt.status!=='completed'||!manifest||!frame)return null;
  const outcomes=Object.keys(frame.baseline.metrics).sort().flatMap(key=>{
    const before=frame.baseline.metrics[key],after=frame.edited.metrics[key];
    return Number.isFinite(before)&&Number.isFinite(after)?[{
      text:`At recorded ${receipt.unit} ${frame.time}, ${key}: current rules ${before}; edited law ${after}.`,receiptIndex:index
    }]:[];
  });
  if(!outcomes.length)return null;
  return {label:FICTION_LABEL,title:'Letter from a possible 2035',
    creative:['Dear neighbor, I am writing from an imagined 2035. I have folded two small worlds into this envelope, like maps of paths we might have taken.',
      'I leave their numbers beside the story so you can question them. The rest of this future is unwritten. With curiosity, an imagined neighbor.'],
    assumption:`Law ${receipt.law.number}: ${receipt.law.title}; implementation strength ${manifest.implementationStrength*100}%; paired initial state; ${manifest.population} synthetic actors. Scope: ${manifest.scope}`,
    seed:manifest.seed,horizon:`${manifest.start}–${manifest.end} ${receipt.unit}s; 2035 is a fictional setting, not a modeled date.`,
    model:manifest.modelVersion||'Unavailable',limitations:receipt.limitations||[],outcomes,receipt};
}
const escapeHtml=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
/** Self-contained export keeps citations and exact logged records together, without publishing anything. */
export function exportFutureLetter(letter:FutureLetter):string {
  const p=(s:string)=>`<p>${escapeHtml(s)}</p>`;
  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escapeHtml(letter.title)}</title><style>body{max-width:48rem;margin:2rem auto;padding:1rem;font:1rem/1.6 system-ui;overflow-wrap:anywhere}pre{white-space:pre-wrap}a:focus-visible{outline:3px solid}</style><main><h1>${letter.title}</h1><strong>${letter.label}</strong>${p('Creative connective text: '+letter.creative[0])}<h2>Logged model outcomes</h2>${letter.outcomes.map(o=>p(o.text)+`<a href="#receipt-${o.receiptIndex}">Supporting checkpoint receipt</a>`).join('')}${p('Creative connective text: '+letter.creative[1])}<h2>Attached assumptions</h2>${p(letter.assumption)}${p('Seed: '+letter.seed)}${p('Horizon: '+letter.horizon)}${p('Model: '+letter.model)}${p('Provider event/project receipts are unavailable in v1. Links cite logged checkpoints, not causal event evidence. The exact civic package and legal text were not modeled.')}${letter.limitations.map(p).join('')}<h2>Supporting logged receipt</h2>${letter.receipt.frames.map((f,i)=>`<section id="receipt-${i}"><h3>Checkpoint ${i}: ${f.time}</h3><pre>${escapeHtml(JSON.stringify(f,null,2))}</pre></section>`).join('')}<h2>Full provider receipt</h2><pre>${escapeHtml(JSON.stringify(letter.receipt,null,2))}</pre></main></html>`;
}

export function FutureLetterCard({receipt,busy,error}:{receipt:LawBehaviorReceipt|null;busy:boolean;error:string}){
  const prefix=useId(),letter=receipt?buildFutureLetter(receipt):null;
  return <section className="civic-future-letter" aria-label="Letter from a possible 2035">
    <h4>Letter from a possible 2035</h4><strong>{FICTION_LABEL}</strong>
    {busy?<p role="status">Waiting for logged model outcomes before writing the letter.</p>:error?<p>No letter is available because the model run failed or was canceled. Retry the run above.</p>:!letter?<p>Run a supported model to attach logged outcomes. No letter can be written without comparable records.</p>:<>
      <p><b>Creative connective text:</b> {letter.creative[0]}</p>
      <ul>{letter.outcomes.map((o,i)=><li key={i}>{o.text} <a href={`#${prefix}-receipt-${o.receiptIndex}`}>Supporting checkpoint receipt</a></li>)}</ul>
      <p><b>Creative connective text:</b> {letter.creative[1]}</p>
      <p>Seed: {letter.seed} · Model: {letter.model}</p><p>Horizon: {letter.horizon}</p><p>Assumption: {letter.assumption}</p>
      <p>Provider event/project receipts are unavailable in v1. These links cite logged checkpoints, not causal event evidence. The exact civic package and legal text were not modeled.</p>
      <ul>{letter.limitations.map((s,i)=><li key={i}>{s}</li>)}</ul>
      <a download="possible-2035-letter.html" href={'data:text/html;charset=utf-8,'+encodeURIComponent(exportFutureLetter(letter))}>Download letter with supporting receipts</a>
      <p>The download stays local until you choose to share it.</p>
      <details><summary>Supporting logged checkpoint receipts</summary>{letter.receipt.frames.map((f,i)=><section key={i} id={`${prefix}-receipt-${i}`} tabIndex={-1}><h4>Checkpoint {i}: {f.time} {receipt?.unit}</h4><pre>{JSON.stringify(f,null,2)}</pre></section>)}</details>
    </>}
  </section>;
}
