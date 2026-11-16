import {expect,test} from 'bun:test';
import {act} from 'react';
import {Window} from 'happy-dom';
import {fireEvent,getByRole} from '@testing-library/dom';
import {LawEnsemble,ensembleRows} from './LawEnsemble';
import type {LawBehaviorReceipt} from './LawBehaviorExplorer';
const fixture=(seed:number):LawBehaviorReceipt=>({schemaVersion:'hbl-law-behavior-receipt.v1',status:'completed',law:{id:'law-83',number:83,title:'Transit'},engine:'population',unit:'minute',manifest:{modelVersion:'v1',seed,population:24,implementationStrength:1,pairedInitialState:true,start:0,end:30,recordedCheckpoints:2,scope:'synthetic'},frames:[0,30].map(time=>({time,baseline:{metrics:{trips:seed+time},actors:[]},edited:{metrics:{trips:seed+time+10},actors:[]}}))});
test('ensemble uses exact deterministic seed quantiles and rejects incompatible or missing series',()=>{
 const runs=[1,2,3,4].map(fixture);
 expect(ensembleRows(runs,'trips','baseline')[0]).toEqual({time:0,values:[1,2,3,4],min:1,p25:1.75,median:2.5,p75:3.25,max:4});
 expect(ensembleRows(runs,'trips','edited')[1]!.median).toBe(42.5);
 for(const mutate of [(r:LawBehaviorReceipt)=>r.manifest!.modelVersion='v2',(r:LawBehaviorReceipt)=>r.frames[1]!.time=29,(r:LawBehaviorReceipt)=>r.manifest!.seed=1,(r:LawBehaviorReceipt)=>r.manifest!.implementationStrength=.5]){
  const altered=structuredClone(runs);mutate(altered[1]!);expect(()=>ensembleRows(altered,'trips','baseline')).toThrow();
 }
 expect(()=>ensembleRows(runs,'missing','baseline')).toThrow('missing');
});
test('ensemble loads on demand, exposes exact tables, scrubs/selects and fails without partial results',async()=>{
 const browser=new Window({url:'https://example.test/synth'});
 let fail=false;const seeds:number[]=[];
 const globals={window:browser,document:browser.document,navigator:browser.navigator,IS_REACT_ACT_ENVIRONMENT:true,fetch:async(_url:unknown,init:RequestInit)=>{const body=JSON.parse(String(init.body));seeds.push(body.seed);return fail?new Response('',{status:429}):Response.json(fixture(body.seed));}};
 const previous=Object.fromEntries(Object.keys(globals).map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));
 for(const [key,value] of Object.entries(globals))Object.defineProperty(globalThis,key,{configurable:true,writable:true,value});
 const host=document.createElement('main');document.body.append(host);const {createRoot}=await import('react-dom/client');const root=createRoot(host);
 try{
  await act(async()=>root.render(<LawEnsemble lawId={83} strength={1} seed={1} hblOrigin="https://model.test" metric="trips" unit="trips" modelVersion="v1"/>));
  expect(seeds).toHaveLength(0);
  await act(async()=>getByRole(host,'button',{name:'Run eight synthetic futures'}).click());
  expect(seeds).toEqual([1,2,3,4,5,6,7,8]);expect(host.textContent).toContain('N = 8');
  expect(host.querySelectorAll('table')).toHaveLength(2);expect(host.querySelectorAll('tbody tr')).toHaveLength(4);
  expect(host.textContent).toContain('not a statistical forecast or population confidence interval');
  await act(async()=>fireEvent.change(getByRole(host,'slider'),{target:{value:'1'}}));
  expect(host.textContent).toContain('Time 30: median 34.5');
  await act(async()=>fireEvent.change(getByRole(host,'combobox'),{target:{value:'7'}}));
  expect(host.textContent).toContain('selected seed 38');
  await act(async()=>fireEvent.pointerOver(host.querySelector('rect')!));
  expect(host.textContent).toContain('Time 0: median 4.5');
  fail=true;await act(async()=>getByRole(host,'button',{name:'Run eight synthetic futures'}).click());
  expect(getByRole(host,'alert').textContent).toContain('429');expect(host.querySelector('svg')).toBeNull();
 }finally{await act(async()=>root.unmount());for(const [k,v] of Object.entries(previous)){if(v)Object.defineProperty(globalThis,k,v);else Reflect.deleteProperty(globalThis,k);}await browser.happyDOM.close();}
});
