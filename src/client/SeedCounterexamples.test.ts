import {expect,test} from 'bun:test';
import {endpointDelta,searchSeeds,verifySearchReceipt} from './SeedCounterexamples';
import type {LawBehaviorReceipt} from './LawBehaviorExplorer';
const receipt=():LawBehaviorReceipt=>({schemaVersion:'hbl-law-behavior-receipt.v1',status:'completed',law:{id:'law-83',number:83,title:'Transit'},engine:'population',unit:'minute',manifest:{modelVersion:'v1',seed:42,population:24,implementationStrength:1,pairedInitialState:true,start:0,end:720,recordedCheckpoints:1,scope:'synthetic'},frames:[{time:720,baseline:{metrics:{trips:2},actors:[]},edited:{metrics:{trips:1},actors:[]}}]});
test('seed budget is bounded without wrapping unsigned seeds',()=>{
 expect(searchSeeds(4294967295,1)).toEqual([4294967295]);
 for(const [start,count] of [[-1,1],[0,9],[0,0],[1.5,2],[4294967295,2],[NaN,1]])expect(()=>searchSeeds(start!,count!)).toThrow();
});
test('exact receipt replay preserves signed endpoint and rejects missing metrics and incomplete horizons',()=>{
 const r=receipt();expect(endpointDelta(r,'trips')).toBe(-1);
 expect(endpointDelta(verifySearchReceipt(JSON.parse(JSON.stringify(r)),r,42),'trips')).toBe(-1);
 expect(()=>endpointDelta(r,'unknown')).toThrow();r.frames[0]!.time=0;expect(()=>endpointDelta(r,'trips')).toThrow();
});
test('seed search rejects mismatched versions, horizons, levers, population and identity',()=>{
 const base=receipt();
 for(const field of ['seed','population','implementationStrength','start','end','modelVersion'] as const){
 const r=receipt();Object.assign(r.manifest!,{[field]:field==='modelVersion'?'v2':999});
 expect(()=>verifySearchReceipt(r,base,42)).toThrow();
 }
 const r=receipt();r.law.number=22;expect(()=>verifySearchReceipt(r,base,42)).toThrow();
});
