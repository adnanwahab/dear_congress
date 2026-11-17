import {test,expect} from 'bun:test';
import {experimentBundle,validateExperimentBundle} from './experiment-receipt';
import type {LawBehaviorReceipt} from './LawBehaviorExplorer';
const context={lawId:83,seed:42,population:24 as const,revision:1,implementationStrength:1,modelVersion:'test-v1',proposalId:'private-proposal'};
const receipt:LawBehaviorReceipt={schemaVersion:'hbl-law-behavior-receipt.v1',status:'completed',law:{id:'83',number:83,title:'private title'},unit:'minute',manifest:{modelVersion:'test-v1',seed:42,population:24,implementationStrength:1,pairedInitialState:true,start:0,end:720,recordedCheckpoints:1,scope:'private scope'},frames:[{time:0,baseline:{metrics:{trips:2,privateField:7},actors:[{id:'private-actor'}]},edited:{metrics:{trips:3},actors:[]}}]};
test('deterministic redacted receipt and offline validation',async()=>{
 const a=await experimentBundle(receipt,context),b=await experimentBundle(structuredClone(receipt),context);
 expect(a).toEqual(b);for(const secret of ['private-proposal','private-actor','privateField','private title','private scope']) expect(JSON.stringify(a)).not.toContain(secret);
 expect(await validateExperimentBundle(JSON.parse(JSON.stringify(a)))).toEqual(a.manifest);
 a.manifest.checkpoints[0]!.edited.trips=9;
 expect(validateExperimentBundle(a)).rejects.toThrow();
});
test('reject wrong seed, model and horizon',async()=>{
 for(const patch of [{seed:9},{modelVersion:'other'}])expect(experimentBundle(receipt,{...context,...patch})).rejects.toThrow();
 const bad=structuredClone(receipt);bad.manifest!.end=721;expect(experimentBundle(bad,context)).rejects.toThrow();
});
