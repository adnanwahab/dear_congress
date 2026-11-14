import { createHash, randomBytes } from 'node:crypto';
import { DEMO_ITEMS } from '../engine/demo';
import { PublicInputError } from './public-security';
export class LiveRounds {
  private rounds = new Map<string, { code: string; proposalId: string; owner: string; startedAt: number; expiresAt: number; endedAt?: number; voters: Map<string, number>; pulses: number[]; listeners: Set<() => void>; timer?: ReturnType<typeof setTimeout> }>();
  constructor(private now = Date.now) {}
  private hash(id: string) { return createHash('sha256').update(id).digest('hex'); }
  start(proposalId: string, owner: string) {
    if (!DEMO_ITEMS.some(p => p.id === proposalId)) throw new PublicInputError('Unknown proposal');
    for (const [code,r] of this.rounds) if (this.now() > r.expiresAt + 86400000 && !r.listeners.size) this.rounds.delete(code);
    if (this.rounds.size >= 1000) throw new PublicInputError('Live rounds are busy', 503);
    let code: string; do { code = randomBytes(4).toString('hex'); } while(this.rounds.has(code));
    const startedAt = this.now();
    this.rounds.set(code, { code, proposalId, owner: this.hash(owner), startedAt, expiresAt: startedAt + 7200000, voters: new Map(), pulses: [0,0,0], listeners: new Set() });
    return this.snapshot(code, owner);
  }
  private get(code: string) {
    const r = this.rounds.get(code); if (!r) throw new PublicInputError('Round not found',404);
    if (!r.endedAt && this.now() >= r.expiresAt) r.endedAt = r.expiresAt;
    return r;
  }
  snapshot(code: string, voter: string) {
    const r = this.get(code), counts = { support: 0, oppose: 0, unsure: 0 };
    for (const stance of r.voters.values()) counts[stance===1?'support':stance===-1?'oppose':'unsure']++;
    return { code, item: { ...DEMO_ITEMS.find(p=>p.id===r.proposalId)!, ...counts }, startedAt:r.startedAt, expiresAt:r.expiresAt, endedAt:r.endedAt, total:r.voters.size, choice:r.voters.get(this.hash(voter)), canEnd:r.owner===this.hash(voter), pulses:[...r.pulses] };
  }
  private notify(code: string) {
    const r=this.get(code); if(r.timer)return;
    r.timer=setTimeout(()=>{r.timer=undefined;for(const fn of r.listeners)fn();},250);
  }
  vote(code: string, voter: string, stance: unknown) {
    const r=this.get(code); if(r.endedAt)throw new PublicInputError('This round has ended',409);
    if(stance!==1&&stance!==-1&&stance!==0)throw new PublicInputError('Choose Support, Oppose or Not sure');
    const id=this.hash(voter);
    if(!r.voters.has(id)&&r.voters.size>=10000)throw new PublicInputError('Round is full',503);
    if(r.voters.get(id)!==stance){r.voters.set(id,stance);r.pulses[stance===1?0:stance===-1?1:2]!++;this.notify(code);}
    return this.snapshot(code,voter);
  }
  end(code: string, voter: string) {
    const r=this.get(code);if(r.owner!==this.hash(voter))throw new PublicInputError('Only the starting browser can end this round',403);
    r.endedAt??=this.now();this.notify(code);return this.snapshot(code,voter);
  }
  events(code: string, voter: string, signal: AbortSignal) {
    const r=this.get(code);let cleanup=()=>{};
    const stream=new ReadableStream<Uint8Array>({start:controller=>{
      const write=()=>controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(this.snapshot(code,voter))}\n\n`));
      const heartbeat=setInterval(()=>{write();},15000);
      const expiry=setTimeout(()=>{write();},Math.max(1,r.expiresAt-this.now()));
      cleanup=()=>{clearInterval(heartbeat);clearTimeout(expiry);r.listeners.delete(write);signal.removeEventListener('abort',abort);};
      const abort=()=>{cleanup();try{controller.close();}catch{}};
      r.listeners.add(write);signal.addEventListener('abort',abort,{once:true});write();if(signal.aborted)abort();
    },cancel:()=>cleanup()});
    return new Response(stream,{headers:{'content-type':'text/event-stream','cache-control':'no-cache, no-transform','x-accel-buffering':'no'}});
  }
}
export type LiveSnapshot = ReturnType<LiveRounds['snapshot']>;
