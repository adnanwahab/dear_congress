import { useEffect, useState } from 'react';
import type { LiveSnapshot } from '../server/live-rounds';
import { AdvisoryVoteBars } from './AdvisoryVoteBars';
import './workflow.css';

export function LiveRound({code, presenter}: {code:string; presenter:boolean}) {
  const [round,setRound]=useState<LiveSnapshot>();
  const [status,setStatus]=useState('Connecting…');
  const [error,setError]=useState('');
  const [busy,setBusy]=useState(false);
  useEffect(()=>{
    let active=true;
    // Establish the signed browser cookie before opening the stream.
    let stream: EventSource | undefined;
    fetch('/api/live/'+code).then(async r=>{const data=await r.json();if(!r.ok)throw Error(data.error);if(!active)return;setRound(data);
      stream=new EventSource('/api/live/'+code+'/events');
      stream.onmessage=e=>{if(active){setRound(JSON.parse(e.data));setStatus('Connected');}};
      stream.onerror=()=>setStatus('Connection lost. Reconnecting…');
    }).catch(e=>{if(active)setError(String(e));});
    return ()=>{active=false;stream?.close();};
  },[code]);
  async function send(action:string, body:unknown) {
    setBusy(true);setError('');
    try{const response=await fetch(`/api/live/${code}/${action}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});const data=await response.json();if(!response.ok)throw Error(data.error);setRound(data);}catch(e){setError(String(e));}finally{setBusy(false);}
  }
  const link=window.location.origin+'/live/'+code;
  return <div className="civic-shell"><main className="workflow-main"><a href="/votes">← Votes</a><section className="panel"><p>Live round · advisory · not a poll</p>{error&&<p role="alert">{error}</p>}{round?<>
    <h1>Should we {round.item.title.charAt(0).toLowerCase()+round.item.title.slice(1)}?</h1>
    {presenter&&<div className="live-join"><img width="320" height="320" src={`/api/live/${code}/qr`} alt="Scan to vote in this live round"/><p><a href={link}>{link}</a></p></div>}
    <p aria-live="polite">{round.total} {round.total===1?'voter':'voters'} · {round.endedAt?'Round ended · results frozen':status}</p>
    <AdvisoryVoteBars item={round.item} live pulses={round.pulses} choice={round.choice} busy={busy||!!round.endedAt||presenter} confirmation={0} onVote={stance=>void send('vote',{stance})}/>
    {!presenter&&<p>{round.choice!==undefined?'Your vote is saved. You can change it until the round ends.':'Choose Support, Oppose or Not sure.'} One anonymous browser, one vote per round. No names or free text collected.</p>}
    {presenter&&round.canEnd&&!round.endedAt&&<button disabled={busy} onClick={()=>void send('end',{})}>End round</button>}
    <p>Expires {new Date(round.expiresAt).toLocaleTimeString()}. Temporary rounds are lost if this server restarts.</p>
  </>:<p>Loading round…</p>}</section></main></div>;
}
