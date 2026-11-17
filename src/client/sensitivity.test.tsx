import {expect,test} from 'bun:test';
import {act} from 'react';
import {Window} from 'happy-dom';
import {getByRole,fireEvent} from '@testing-library/dom';
import {LawBehaviorExplorer,sensitivityReceipt,type LawBehaviorReceipt} from './LawBehaviorExplorer';
const context={lawId:83,seed:42,population:24 as const,revision:1,implementationStrength:.5};
function receipt(strength:number):LawBehaviorReceipt{return {
 schemaVersion:'hbl-law-behavior-receipt.v1',status:'completed',law:{id:'law-83',number:83,title:'Transit'},engine:'population',unit:'minute',
 manifest:{modelVersion:'v1',seed:42,population:24,implementationStrength:strength,pairedInitialState:true,start:0,end:720,recordedCheckpoints:2,scope:'synthetic'},
 frames:[0,720].map(time=>({time,baseline:{metrics:{trips:10},actors:[]},edited:{metrics:{trips:10+strength*8},actors:[]}}))
};}
test('bounded receipt replays exactly and rejects incompatible comparisons',()=>{
 const receipts=[receipt(.5),receipt(0),receipt(1)];
 const result=sensitivityReceipt(context,receipts);
 expect(result.rows[0]).toMatchObject({lowDelta:-4,highDelta:4,unit:'trips'});
 expect(JSON.stringify(sensitivityReceipt(context,structuredClone(receipts)))).toBe(JSON.stringify(result));
 for(const mutate of [(r:LawBehaviorReceipt)=>r.manifest!.seed++, (r:LawBehaviorReceipt)=>r.manifest!.modelVersion='v2',
  (r:LawBehaviorReceipt)=>r.frames[0]!.baseline.metrics.trips=20,(r:LawBehaviorReceipt)=>r.manifest!.end=721,
  (r:LawBehaviorReceipt)=>r.manifest!.implementationStrength=.25]){
  const changed=structuredClone(receipts);mutate(changed[1]!);expect(()=>sensitivityReceipt(context,changed)).toThrow();
 }
 expect(()=>sensitivityReceipt({...context,lawId:21},receipts)).toThrow();
 expect(()=>sensitivityReceipt(context,receipts.slice(1))).toThrow();
});
test('bounds controls expose exact outcomes, replay, loading, cancellation and failure',async()=>{
 const browser=new Window({url:'https://example.test/synth'});
 const keys=['window','document','navigator','fetch','IS_REACT_ACT_ENVIRONMENT'];
 const previous=Object.fromEntries(keys.map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));
 let mode='success';const strengths:number[]=[];
 const mockedFetch=async(_u:unknown,init:RequestInit)=>{
  const strength=JSON.parse(String(init.body)).implementationStrength;strengths.push(strength);
  if(mode==='pending')return new Promise<Response>((_resolve,reject)=>init.signal!.addEventListener('abort',()=>reject(Error('aborted'))));
  return mode==='failure'?new Response('',{status:503}):Response.json(receipt(strength));
 };
 for(const [k,v] of Object.entries({window:browser,document:browser.document,navigator:browser.navigator,fetch:mockedFetch,IS_REACT_ACT_ENVIRONMENT:true}))Object.defineProperty(globalThis,k,{configurable:true,writable:true,value:v});
 const host=document.createElement('main');document.body.append(host);const {createRoot}=await import('react-dom/client');const root=createRoot(host);
 try{
  await act(async()=>root.render(<LawBehaviorExplorer seed={42} hblOrigin="https://example.test"/>));
  const run=()=>getByRole(host,'button',{name:'Run sensitivity bounds'});
  await act(async()=>run().click());
  expect(strengths).toEqual([1,0]);
  expect(host.textContent).toContain('exact delta -8 trips');
  expect(getByRole(host,'img',{name:/Implementation strength tornado/})).toBeTruthy();
  const first=host.querySelector('pre')?.textContent;
  await act(async()=>run().click());expect(host.querySelector('pre')?.textContent).toBe(first);
  const select=getByRole(host,'combobox',{name:'Sensitivity outcome'});await act(async()=>fireEvent.change(select,{target:{value:'trips'}}));
  expect(select.tagName).toBe('SELECT');expect(run().tagName).toBe('BUTTON');
  mode='pending';await act(async()=>run().click());expect(host.textContent).toContain('Loading bounded experiment');
  await act(async()=>getByRole(host,'button',{name:'Cancel bounds'}).click());expect(host.textContent).toContain('Experiment canceled');
  mode='failure';await act(async()=>run().click());expect(host.textContent).toContain('Provider unavailable (503)');expect(host.querySelector('[aria-label^="Implementation strength tornado"]')).toBeNull();
 }finally{await act(async()=>root.unmount());host.remove();for(const k of keys){if(previous[k])Object.defineProperty(globalThis,k,previous[k]!);else Reflect.deleteProperty(globalThis,k);}await browser.happyDOM.close();}
});
