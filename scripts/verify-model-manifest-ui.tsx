import assert from 'node:assert/strict';
import {Window} from 'happy-dom';
import {act} from 'react';
import {createRoot} from 'react-dom/client';
import {LawBehaviorExplorer} from '../src/client/LawBehaviorExplorer';
const dom=new Window({url:'http://localhost/synth'});
for(const key of ['window','document','navigator'])Object.defineProperty(globalThis,key,{configurable:true,value:key==='window'?dom:(dom as any)[key]});
(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;
let calls=0;
globalThis.fetch=async (_url,options)=>{
  calls++;
  const input=JSON.parse(String(options?.body));
  return Response.json({schemaVersion:'hbl-law-behavior-receipt.v1',status:'completed',law:{id:'law-83',number:83,title:'Transit'},engine:'population',unit:'minute',
    manifest:{modelVersion:'population-test',...input,pairedInitialState:true,start:0,end:720,recordedCheckpoints:1,scope:'synthetic'},
    frames:[{time:720,baseline:{metrics:{trips:1},actors:[]},edited:{metrics:{trips:2},actors:[]}}]});
};
const container=dom.document.createElement('div');dom.document.body.append(container);
const root=createRoot(container as any);
const link=()=>container.querySelector('a[download$="model-input-manifest.json"]');
await act(async()=>root.render(<LawBehaviorExplorer seed={42} hblOrigin="https://model.example"/>));
assert.equal(link(),null);
const run=Array.from(container.querySelectorAll('button')).find(b=>b.textContent==='Run two futures')!;
await act(async()=>(run as any).click());
assert(link());
const payload=JSON.parse(decodeURIComponent(link()!.getAttribute('href')!.split(',')[1]!));
assert.equal(payload.scenario.seed,42);assert.equal(payload.synthetic,true);assert(payload.sources[0].retrievedAt);
assert.equal(calls,1);
const preset=Array.from(container.querySelectorAll('button')).find(b=>b.textContent?.includes('Housing · construction assumption'))!;
assert(preset);
await act(async()=>(preset as any).click());
assert.equal(link(),null);assert.equal(calls,1);
await act(async()=>root.unmount());
await dom.happyDOM.abort();
console.log('PASS model manifest download and stale-input isolation');
