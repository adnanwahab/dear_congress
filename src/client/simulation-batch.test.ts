import {expect,test} from 'bun:test';
import {SimulationBatch,batchRecipe} from './simulation-batch';
import {requestBatchBehavior,type LawBehaviorReceipt} from './LawBehaviorExplorer';
import type {CivicLawContext} from './civic-law-context';
const context:CivicLawContext={lawId:83,seed:42,population:24,implementationStrength:.5,revision:1};
const receipt=(seed:number):LawBehaviorReceipt=>({schemaVersion:'hbl-law-behavior-receipt.v1',status:'completed',law:{id:'law-83',number:83,title:'Transit'},engine:'population',unit:'minute',manifest:{modelVersion:'v1',seed,population:24,implementationStrength:.5,pairedInitialState:true,start:0,end:720,recordedCheckpoints:2,scope:'synthetic'},frames:[0,720].map(time=>({time,baseline:{metrics:{trips:0},actors:[]},edited:{metrics:{trips:1},actors:[]}}))});
test('bounded recipes have stable keys and explicit replay seeds',()=>{
 const a=batchRecipe(context,3,'https://model.example');
 expect(a).toEqual(batchRecipe({...context},3,'https://model.example'));
 expect(a.inputs.map(c=>c.seed)).toEqual([42,43,44]);
 expect(a.estimate).toEqual({requests:3,pairedWorlds:6,actors:144,deadlineSeconds:135});
 for(const count of [0,9,1.5])expect(()=>batchRecipe(context,count,'https://model.example')).toThrow();
 expect(()=>batchRecipe({...context,seed:4294967295},2,'https://model.example')).toThrow();
 expect(()=>batchRecipe({...context,lawId:31},1,'https://model.example')).toThrow();
 expect(a.key).not.toBe(batchRecipe({...context,revision:2},3,'https://model.example').key);
});
test('one active request, partial results survive cancellation, retry preserves receipts and pins model',async()=>{
 let release!:(r:LawBehaviorReceipt)=>void;
 let active=0,max=0;const seeds:number[]=[];
 const queue=new SimulationBatch(async(c)=>{
  active++;max=Math.max(max,active);seeds.push(c.seed);
  if(seeds.length>1)expect(c.modelVersion).toBe('v1');
  const result=seeds.length===2?await new Promise<LawBehaviorReceipt>(r=>release=r):receipt(c.seed);
  active--;return result;
 },()=>{});
 const pending=queue.queue(batchRecipe(context,3,'https://model.example').inputs);
 await Promise.resolve();await Promise.resolve();
 expect(queue.jobs.map(j=>j.status)).toEqual(['completed','running','queued']);
 queue.cancel();expect(queue.jobs.map(j=>j.status)).toEqual(['completed','canceled','canceled']);
 expect(()=>queue.queue([context])).toThrow();
 release(receipt(43));await pending;
 expect(queue.jobs[1]?.receipt).toBeUndefined();
 await queue.retry();expect(max).toBe(1);
 expect(seeds).toEqual([42,43,43,44]);
 expect(queue.jobs.map(j=>j.attempts)).toEqual([1,2,1]);
 expect(queue.jobs.every(j=>j.status==='completed')).toBe(true);
});
test('failure never counts as completed and model version drift fails',async()=>{
 const queue=new SimulationBatch(async c=>{if(c.seed===43)throw Error('offline');return {...receipt(c.seed),manifest:{...receipt(c.seed).manifest!,modelVersion:c.seed===44?'v2':'v1'}};},()=>{});
 await queue.queue(batchRecipe(context,3,'https://model.example').inputs);
 expect(queue.jobs.map(j=>j.status)).toEqual(['completed','failed','failed']);
 expect(queue.jobs[2]?.error).toContain('Model version changed');
});
test('batch transport allows exact inputs, deterministic receipts and rejects partial horizons or wrong identity',async()=>{
 const original=globalThis.fetch;let payload=receipt(42);const requests:string[]=[];
 globalThis.fetch=(async(_url,init)=>{requests.push(String(init?.body));expect(init?.credentials).toBe('omit');return Response.json(payload);}) as typeof fetch;
 try{
  const signal=new AbortController().signal;
  const first=await requestBatchBehavior(context,'https://model.example',signal);
  expect(await requestBatchBehavior({...context,modelVersion:'v1'},'https://model.example',signal)).toEqual(first);
  expect(JSON.parse(requests[0]!)).toEqual({lawId:83,seed:42,population:24,implementationStrength:.5});
  for(const changed of [ {...receipt(43)}, {...receipt(42),manifest:{...receipt(42).manifest!,end:30}}, {...receipt(42),frames:receipt(42).frames.slice(0,1),manifest:{...receipt(42).manifest!,recordedCheckpoints:1}} ]){
   payload=changed;await expect(requestBatchBehavior(context,'https://model.example',signal)).rejects.toThrow();
  }
 }finally{globalThis.fetch=original;}
});
