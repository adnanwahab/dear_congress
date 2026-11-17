import {civicLawQuery, structuredAmendment, type CivicLawContext} from './civic-law-context';
import type {LawBehaviorReceipt} from './LawBehaviorExplorer';
export type BatchJob = {key:string; context:CivicLawContext; status:'queued'|'running'|'completed'|'failed'|'canceled'; attempts:number; receipt?:LawBehaviorReceipt; error?:string};
export type BatchRunner = (context:CivicLawContext, signal:AbortSignal)=>Promise<LawBehaviorReceipt>;
export function batchRecipe(context:CivicLawContext,count:number,origin:string){
  civicLawQuery(context);
  if(!Number.isInteger(count)||count<1||count>8||context.seed+count-1>4294967295)throw Error('Choose 1–8 runs within the seed range.');
  const inputs=Array.from({length:count},(_,i)=>({...context,seed:context.seed+i}));
  const key=JSON.stringify(['civic-batch.v1',new URL(origin).origin,inputs.map(c=>civicLawQuery(c).toString())]);
  return {key,inputs,estimate:{requests:count,pairedWorlds:count*2,actors:count*48,deadlineSeconds:count*45},amendment:structuredAmendment(context)};
}
/** One page-local batch. No persistence, automatic retries or shared server capacity claims. */
export class SimulationBatch {
  jobs:BatchJob[]=[];
  private active=false;
  private stopped=false;
  private controller:AbortController|null=null;
  constructor(private run:BatchRunner,private update:()=>void){}
  get busy(){return this.active;}
  queue(inputs:CivicLawContext[]){
    if(this.active)throw Error('Wait for the current request to settle.');
    if(inputs.length<1||inputs.length>8||new Set(inputs.map(c=>civicLawQuery(c).toString())).size!==inputs.length)throw Error('Queue requires 1–8 distinct supported runs.');
    this.jobs=inputs.map(context=>({key:civicLawQuery(context).toString(),context:{...context},status:'queued',attempts:0}));
    return this.start();
  }
  cancel(){
    this.stopped=true;
    for(const job of this.jobs)if(job.status==='queued'||job.status==='running')job.status='canceled';
    this.controller?.abort();this.update();
  }
  retry(){
    if(this.active)return;
    for(const job of this.jobs)if(job.status==='failed'||job.status==='canceled'){job.status='queued';job.error=undefined;}
    return this.start();
  }
  private async start(){
    this.active=true;this.stopped=false;this.update();
    let version=this.jobs.find(j=>j.receipt)?.receipt?.manifest?.modelVersion;
    try{
      for(const job of this.jobs){
        if(this.stopped)break;
        if(job.status!=='queued')continue;
        const controller=new AbortController();this.controller=controller;
        job.status='running';job.attempts++;this.update();
        let timeout=false;
        const timer=setTimeout(()=>{timeout=true;controller.abort();},45000);
        try{
          const receipt=await this.run({...job.context,...(version?{modelVersion:version}:{})},controller.signal);
          if(this.stopped)continue;
          if(timeout)throw Error('45-second request limit exceeded.');
          if(receipt.status!=='completed')throw Error(receipt.reason||'Reviewed mechanism unavailable.');
          if(!receipt.manifest?.modelVersion||version&&receipt.manifest.modelVersion!==version)throw Error('Model version changed within this batch.');
          version=receipt.manifest.modelVersion;
          job.receipt=receipt;job.status='completed';
        }catch(error){
          if(!this.stopped){job.status='failed';job.error=timeout?'45-second request limit exceeded.':error instanceof Error?error.message:'Model unavailable.';}
        }finally{clearTimeout(timer);this.update();}
      }
    }finally{this.active=false;this.controller=null;this.update();}
  }
}
