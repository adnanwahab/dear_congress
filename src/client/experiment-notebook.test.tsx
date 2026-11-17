import {expect,test} from 'bun:test';
import {act} from 'react';
import {Window} from 'happy-dom';
import {fireEvent,getByRole} from '@testing-library/dom';
import {LawBehaviorExplorer,type LawBehaviorReceipt} from './LawBehaviorExplorer';
import {NOTEBOOK_KEY,createRun,readNotebook,writeNotebook,comparableRuns} from './experiment-notebook';
const context={lawId:83,implementationStrength:1,seed:42,population:24 as const,revision:1,modelVersion:'population.v1'};
const receipt:LawBehaviorReceipt={schemaVersion:'hbl-law-behavior-receipt.v1',status:'completed',law:{id:'law-83',number:83,title:'Transit'},engine:'population',unit:'minute',manifest:{modelVersion:'population.v1',seed:42,population:24,implementationStrength:1,pairedInitialState:true,start:0,end:30,recordedCheckpoints:2,scope:'synthetic'},frames:[0,30].map(time=>({time,baseline:{metrics:{trips:time},actors:[]},edited:{metrics:{trips:time+1},actors:[]}})),limitations:['Unvalidated synthetic assumptions.']};
const origin='https://happybearlandia.fly.dev';
test('notebook round trip keeps exact checkpoints, identities and version; invalid and oversized storage fails closed',()=>{
 const run=createRun('Transit test',context,receipt,origin);
 const before=JSON.stringify(run);
 const copy=createRun('Copy',run.context,run.receipt,origin,run.id);
 expect(copy.id).not.toBe(run.id);expect(copy.parentId).toBe(run.id);
 copy.receipt.frames[0]!.edited.metrics.trips=999;
 expect(JSON.stringify(run)).toBe(before);
 expect(readNotebook(writeNotebook([run]))).toEqual([run]);
 for(const raw of ['{}','bad',JSON.stringify({schemaVersion:'civic-experiment-notebook.v1',runs:[run,run]}),'x'.repeat(8_000_001)])expect(()=>readNotebook(raw)).toThrow();
 for(const mutate of [(v:any)=>v.context.seed=43,(v:any)=>v.context.lawId=84,(v:any)=>v.context.modelVersion='v2',(v:any)=>v.receipt.manifest=null,(v:any)=>v.sourceOrigin='https://evil.invalid',(v:any)=>v.receipt.limitations=[{}]]){
  const v=structuredClone(run);mutate(v);expect(()=>writeNotebook([v])).toThrow();
 }
 expect(comparableRuns(run,run)).toBe(true);
 const other=structuredClone(run);other.receipt.manifest!.modelVersion='v2';expect(comparableRuns(run,other)).toBe(false);
});

test('save, duplicate, rename, compare and reload replay exact saved frames without fetching; storage failures preserve records',async()=>{
 const browser=new Window({url:'https://civic-synthesis.fly.dev/synth'});
 let requests=0;
 const globals={window:browser,document:browser.document,navigator:browser.navigator,IS_REACT_ACT_ENVIRONMENT:true,fetch:async()=>{requests++;return Response.json(receipt);}};
 const previous=Object.fromEntries(Object.keys(globals).map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));
 for(const [key,value] of Object.entries(globals))Object.defineProperty(globalThis,key,{configurable:true,writable:true,value});
 const host=document.createElement('main');document.body.append(host);const {createRoot}=await import('react-dom/client');const root=createRoot(host);
 try{
  await act(async()=>root.render(<LawBehaviorExplorer seed={42} hblOrigin={origin}/>));
  expect((getByRole(host,'button',{name:'Save named run'}) as HTMLButtonElement).disabled).toBe(true);
  await act(async()=>getByRole(host,'button',{name:'Run two futures'}).click());
  await act(async()=>getByRole(host,'button',{name:'Save named run'}).click());
  const first=readNotebook(browser.localStorage.getItem(NOTEBOOK_KEY))[0]!;
  expect(first.receipt).toEqual(receipt);
  await act(async()=>getByRole(host,'button',{name:'Duplicate Experiment 1'}).click());
  const input=getByRole(host,'textbox',{name:'Run name'});
  await act(async()=>fireEvent.change(input,{target:{value:'Renamed'}}));
  await act(async()=>getByRole(host,'button',{name:'Rename Experiment 1 to run name'}).click());
  const saved=readNotebook(browser.localStorage.getItem(NOTEBOOK_KEY));
  expect(saved[0]).toEqual({...first,name:'Renamed'});expect(saved[1]!.parentId).toBe(first.id);
  await act(async()=>{getByRole(host,'checkbox',{name:'Compare Renamed'}).click();});
  await act(async()=>{getByRole(host,'checkbox',{name:'Compare Experiment 1 copy'}).click();});
  expect(getByRole(host,'region',{name:'Recorded final checkpoint comparison'}).textContent).toContain('31');
  // Remount the entire explorer to prove reload persistence, then restore exact recorded state.
  await act(async()=>root.render(<LawBehaviorExplorer key="reload" seed={99} hblOrigin={origin}/>));
  await act(async()=>getByRole(host,'button',{name:'Replay Renamed'}).click());
  expect(requests).toBe(1);expect(host.textContent).toContain('Recorded replay:');
  expect((getByRole(host,'slider',{name:'Recorded simulation time'}) as HTMLInputElement).value).toBe('0');
  await act(async()=>fireEvent.change(getByRole(host,'slider',{name:'Recorded simulation time'}),{target:{value:'1'}}));
  expect(host.textContent).toContain('minute 30');expect(host.textContent).toContain('seed 42');
  const prior=browser.localStorage.getItem(NOTEBOOK_KEY)!;
  browser.localStorage.setItem(NOTEBOOK_KEY,writeNotebook(saved.slice(0,1)));
  await act(async()=>getByRole(host,'button',{name:'Duplicate Renamed'}).click());
  expect(host.textContent).toContain('changed in another tab');
  expect(browser.localStorage.getItem(NOTEBOOK_KEY)).toBe(writeNotebook(saved.slice(0,1)));
  browser.localStorage.setItem(NOTEBOOK_KEY,prior);
  const storage=browser.localStorage;
  Object.defineProperty(browser,'localStorage',{configurable:true,value:{getItem:storage.getItem.bind(storage),setItem:()=>{throw Error('Storage quota exceeded');}}});
  await act(async()=>getByRole(host,'button',{name:'Duplicate Renamed'}).click());
  expect(host.textContent).toContain('Storage quota exceeded');expect(storage.getItem(NOTEBOOK_KEY)).toBe(prior);
  Object.defineProperty(browser,'localStorage',{configurable:true,value:storage});
  browser.localStorage.setItem(NOTEBOOK_KEY,'corrupt');
  await act(async()=>root.render(<LawBehaviorExplorer key="corrupt" seed={42} hblOrigin={origin}/>));
  expect(host.textContent).toContain('could not be loaded');expect(browser.localStorage.getItem(NOTEBOOK_KEY)).toBe('corrupt');
 }finally{
  await act(async()=>root.unmount());host.remove();
  for(const [k,v] of Object.entries(previous)){if(v)Object.defineProperty(globalThis,k,v);else Reflect.deleteProperty(globalThis,k);}
  await browser.happyDOM.close();
 }
});
