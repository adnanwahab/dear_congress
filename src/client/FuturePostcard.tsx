import {useState} from 'react';

export type PostcardFacts={law:number;seed:number;strength:number;revision:number;model:string;
  time:number;clock:string;metric:string;unit:string;baseline:number;edited:number};
const stamp='Synthetic scenario / not forecast';
const escape=(value:string)=>value.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]!));
const number=(value:number)=>new Intl.NumberFormat('en-US',{maximumFractionDigits:2}).format(value);

/** Only aggregate modeled facts enter this export. No actor, journal, or user fields. */
export function composeFuturePostcard(f:PostcardFacts){
  if([f.law,f.seed,f.strength,f.revision,f.time,f.baseline,f.edited].some(n=>!Number.isFinite(n)))throw Error('Postcard facts unavailable.');
  const lines=[stamp,'An imagined policy future',
    `Law ${f.law} · implementation strength ${f.strength}% · revision ${f.revision}`,
    `${f.metric}: ${number(f.baseline)} → ${number(f.edited)} ${f.unit}`,
    `Edited minus current rules: ${number(f.edited-f.baseline)} ${f.unit}`,
    `Seed ${f.seed} · ${f.clock} ${f.time} · model ${f.model}`,
    'Paired HBL model outputs; separate reviewed mechanism sandbox.',
    'Not verified civic participation or evidence of real-world policy effects.'];
  // Text is bounded and XML escaped; provider strings cannot introduce SVG markup or remote assets.
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="720" viewBox="0 0 1200 720" role="img" aria-labelledby="title desc"><title id="title">An imagined policy future</title><desc id="desc">${escape(lines.join('. '))}</desc><defs><linearGradient id="sky" x2="1" y2="1"><stop stop-color="#102e46"/><stop offset="1" stop-color="#24624f"/></linearGradient></defs><rect width="1200" height="720" rx="28" fill="url(#sky)"/><circle cx="1030" cy="160" r="82" fill="#f7d58b"/><path d="M0 550 Q250 380 560 550 T1200 510 V720 H0Z" fill="#0b2535"/><g fill="#fff" font-family="system-ui,sans-serif">${lines.map((line,i)=>`<text x="54" y="${[65,155,225,315,385,465,565,625][i]}" font-size="${i===1?44:i===3?30:22}" textLength="${Math.min(1080,line.length*(i===1?24:i===3?16:12))}" lengthAdjust="spacingAndGlyphs">${escape(line)}</text>`).join('')}</g></svg>`;
  return {svg,description:lines.join('\n'),alt:lines.join('. ')};
}

export function FuturePostcard({facts}:{facts:PostcardFacts}){
  const [preview,setPreview]=useState<ReturnType<typeof composeFuturePostcard>|null>(null);
  const [message,setMessage]=useState(''),[copying,setCopying]=useState(false);
  function prepare(){try{setPreview(composeFuturePostcard(facts));setMessage('Private preview ready. Nothing has been published.');}
    catch{setMessage('Postcard unavailable. Run the model again and retry.');}}
  async function copy(){
    if(!preview||copying)return;
    setCopying(true);setMessage('Copying description…');
    try{await navigator.clipboard.writeText(preview.description);setMessage('Description copied. Review it before sharing.');}
    catch{setMessage('Copy failed. Select and copy the description below, or retry.');}
    finally{setCopying(false);}
  }
  return <section className="future-postcard" aria-label="Future postcard">
    <h4>A postcard from this imagined future</h4>
    <p>Create a private static preview of this checkpoint. Only aggregate model facts are included; no private journal content. Downloading or copying does not publish it.</p>
    <button type="button" onClick={prepare}>Preview future postcard</button>
    <p role="status">{message}</p>
    {preview&&<>
      <img width="1200" height="720" src={'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(preview.svg)} alt={preview.alt}/>
      <p><a download="synthetic-future-postcard.svg" href={'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(preview.svg)}>Download postcard (SVG)</a></p>
      <label>Accessible postcard description<textarea readOnly rows={8} value={preview.description}/></label>
      <button type="button" disabled={copying} onClick={()=>void copy()}>{copying?'Copying…':'Copy description'}</button>
      <button type="button" onClick={()=>{setPreview(null);setMessage('Private preview closed.');}}>Close preview</button>
    </>}
  </section>;
}
