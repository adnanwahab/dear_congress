import { randomUUID } from 'node:crypto';
import type { Database } from 'bun:sqlite';
import type { Policy, Pull, Tally } from '../../shared/hbl-governance';
import { evaluateEligibility, intendedCutoff } from './policy';
export interface BatchStore { db:Database; freeze(cutoff:number,now:number):Pull[]; tally(number:number,version:string,cutoff?:number):Tally; }
export interface BatchSource { listPulls():Promise<Pull[]>; detail(number:number):Promise<Pull>; merge(number:number,sha:string):Promise<{merged:boolean;sha?:string}>; }
export interface BatchReceipt {
  number:number; status:'merged'|'dry-run'|'blocked'|'unknown'; reason:string;
  policyVersion:string; cutoff:string; version:string; headSha:string; base:string; baseSha:string|null;
  tally:Tally; snapshotRef:string;
  evidence:{checks:{name:string;status:string;conclusion:string|null;sha:string}[];reviews:{state:string;commitId:string|null}[];requestedReviewers:number;mergeable:boolean|null;mergeableState:string;protectionsKnown:boolean;protectedBase:boolean;sensitive:boolean;maintainerApproved:boolean}|null;
  apiResult:'not-requested'|'requested'|'merged'|'declined'|'unknown'; mergeCommit:string|null;
}
export interface BatchResult { cutoff:string|null; status:'disabled'|'outside-window'|'leased'|'complete'|'unknown'; receipts:BatchReceipt[]; }
type Run={cutoff:number;owner:string;fence:number;lease_until:number;status:string;receipts:string};
/** All live batches must use this durable single-writer DB. A lost lease never retries a mutation. */
export class BatchWorker {
  private owner=randomUUID();
  constructor(private store:BatchStore,private source:BatchSource,private policy:Policy,private options:{killSwitch?:()=>boolean;clock?:()=>number;leaseMs?:number}={}) {
    store.db.exec(`CREATE TABLE IF NOT EXISTS hbl_batch_runs(cutoff INTEGER PRIMARY KEY,owner TEXT NOT NULL,fence INTEGER NOT NULL,lease_until INTEGER NOT NULL,status TEXT NOT NULL,receipts TEXT NOT NULL);`);
  }
  private now() { return (this.options.clock??Date.now)(); }
  private killed() { return !this.policy.enabled || (this.options.killSwitch?.()??false); }
  private row(cutoff:number) { return this.store.db.query('SELECT * FROM hbl_batch_runs WHERE cutoff=?').get(cutoff) as Run|null; }
  private claim(cutoff:number):Run|null {
    const db=this.store.db,now=this.now();
    db.exec('BEGIN IMMEDIATE');
    try {
      const old=this.row(cutoff);
      if(old && (old.status==='complete'||old.status==='unknown'||old.lease_until>now)) { db.exec('COMMIT'); return null; }
      // A process can die after sending a merge but before observing its result.
      if(old?.status==='merging') { db.query("UPDATE hbl_batch_runs SET status='unknown' WHERE cutoff=?").run(cutoff); db.exec('COMMIT'); return null; }
      db.query(`INSERT INTO hbl_batch_runs VALUES(?,?,1,?,'running','[]') ON CONFLICT(cutoff) DO UPDATE SET owner=excluded.owner,fence=hbl_batch_runs.fence+1,lease_until=excluded.lease_until,status='running'`).run(cutoff,this.owner,now+(this.options.leaseMs??120_000));
      const row=this.row(cutoff)!; db.exec('COMMIT'); return row;
    } catch(e) { db.exec('ROLLBACK'); throw e; }
  }
  private save(run:Run,status:string,receipts:BatchReceipt[]) {
    const now=this.now();
    const changed=this.store.db.query('UPDATE hbl_batch_runs SET status=?,receipts=?,lease_until=? WHERE cutoff=? AND owner=? AND fence=? AND lease_until>?').run(status,JSON.stringify(receipts),now+(this.options.leaseMs??120_000),run.cutoff,this.owner,run.fence,now);
    if(changed.changes!==1) throw new Error('Batch lease lost');
  }
  async run():Promise<BatchResult> {
    if(this.killed()) return {cutoff:null,status:'disabled',receipts:[]};
    const cutoff=intendedCutoff(this.now(),this.policy.maxRecoveryHours);
    if(cutoff===null) return {cutoff:null,status:'outside-window',receipts:[]};
    const iso=new Date(cutoff).toISOString(),run=this.claim(cutoff);
    if(!run) { const prior=this.row(cutoff)!; return {cutoff:iso,status:prior.status==='complete'?'complete':prior.status==='unknown'?'unknown':'leased',receipts:JSON.parse(prior.receipts)}; }
    const receipts:BatchReceipt[]=JSON.parse(run.receipts);
    let frozen:Pull[]=[];
    try {
      frozen=this.store.freeze(cutoff,this.now());
      // Refresh the complete open-head inventory before evaluating stacked branches.
      const open=await this.source.listPulls();
      const changedBases=new Set(frozen.filter(p=>receipts.some(r=>r.number===p.number && r.status==='merged')).map(p=>p.base));
      for(const p of frozen) {
        if(receipts.some(r=>r.number===p.number)) continue;
        this.save(run,'running',receipts);
        const receipt:BatchReceipt={number:p.number,status:'blocked',reason:'Not evaluated',policyVersion:this.policy.version,cutoff:iso,version:p.version,headSha:p.headSha,base:p.base,baseSha:p.evidence?.baseSha??null,tally:this.store.tally(p.number,p.version,cutoff),snapshotRef:`frozen_pulls:${cutoff}:${p.number}:${p.version}`,evidence:null,apiResult:'not-requested',mergeCommit:null};
        const recordEvidence=(pull:Pull)=>{ const e=pull.evidence; receipt.baseSha=e?.baseSha??null; receipt.evidence=e?{...e,reviews:e.reviews.map(r=>({state:r.state,commitId:r.commitId}))}:null; receipt.tally=this.store.tally(p.number,p.version,cutoff); };
        recordEvidence(p);
        const blocked=(reason:string)=>receipts.push({...receipt,status:'blocked',reason});
        if(this.killed()) { blocked('Integration disabled'); continue; }
        if(changedBases.has(p.base)) { blocked('Base changed after an earlier merge; new evidence required'); continue; }
        if(!open.some(o=>o.number===p.number && o.version===p.version)) { blocked('Pull closed or version changed since cutoff'); continue; }
        const first=await this.source.detail(p.number);
        recordEvidence(first);
        if(first.version!==p.version || first.headSha!==p.headSha || first.base!==p.base) { blocked('Pull version changed since cutoff'); continue; }
        const initial=evaluateEligibility({...first,firstSeenAt:p.firstSeenAt},this.store.tally(p.number,p.version,cutoff),this.policy,cutoff);
        if(!initial.eligible) { blocked(initial.reason); continue; }
        // Fresh evidence immediately before mutation; base advancement invalidates the first check.
        const fresh=await this.source.detail(p.number);
        recordEvidence(fresh);
        if(fresh.version!==p.version || fresh.headSha!==p.headSha || fresh.base!==p.base || fresh.evidence?.baseSha!==first.evidence?.baseSha) { blocked('Head or base changed during evaluation'); continue; }
        const eligible=evaluateEligibility({...fresh,firstSeenAt:p.firstSeenAt},this.store.tally(p.number,p.version,cutoff),this.policy,cutoff);
        if(!eligible.eligible || this.killed()) { blocked(this.killed()?'Integration disabled':eligible.reason); continue; }
        if(this.policy.dryRun) { receipts.push({...receipt,status:'dry-run',reason:'Eligible; no merge requested'}); continue; }
        receipts.push({...receipt,status:'unknown',apiResult:'requested',reason:'Merge requested; reconciliation required until confirmed'});
        this.save(run,'merging',receipts);
        try {
          const result=await this.source.merge(p.number,p.headSha);
          if(!result.merged || !result.sha || !/^[a-f0-9]{40}$/i.test(result.sha)) throw new Error('Merge result unconfirmed');
          receipts[receipts.length-1]={...receipt,status:'merged',apiResult:'merged',mergeCommit:result.sha,reason:'Merged with expected head SHA'};
          if(result.merged) changedBases.add(p.base);
        } catch {
          receipts[receipts.length-1]={...receipt,status:'unknown',apiResult:'unknown',reason:'Merge outcome unknown; manual read-only reconciliation required; automatic retries disabled'};
          this.save(run,'unknown',receipts);
          return {cutoff:iso,status:'unknown',receipts};
        }
        this.save(run,'running',receipts);
      }
      this.save(run,'complete',receipts);
      return {cutoff:iso,status:'complete',receipts};
    } catch {
      // Fail closed without disclosing source errors or credentials.
      for(const p of frozen) if(!receipts.some(r=>r.number===p.number)) receipts.push({number:p.number,status:'blocked',reason:'Source evidence unavailable; no merge requested',policyVersion:this.policy.version,cutoff:iso,version:p.version,headSha:p.headSha,base:p.base,baseSha:p.evidence?.baseSha??null,tally:this.store.tally(p.number,p.version,cutoff),snapshotRef:`frozen_pulls:${cutoff}:${p.number}:${p.version}`,evidence:null,apiResult:'not-requested',mergeCommit:null});
      try { this.save(run,'unknown',receipts); } catch { /* Lease owner alone may persist. */ }
      return {cutoff:iso,status:'unknown',receipts};
    }
  }
}
