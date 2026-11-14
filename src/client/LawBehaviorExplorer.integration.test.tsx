import {expect,test} from 'bun:test';
import {act} from 'react';
import {createRoot} from 'react-dom/client';
import {Window} from 'happy-dom';
import {getByRole,fireEvent} from '@testing-library/dom';
import {LawBehaviorExplorer,type LawBehaviorReceipt} from './LawBehaviorExplorer';

const receipt=(strength:number):LawBehaviorReceipt=>({
  schemaVersion:'hbl-law-behavior-receipt.v1',status:'completed',
  law:{id:'law-83',number:83,title:'Transit frequency'},engine:'population',unit:'minute',
  manifest:{modelVersion:'population.v1',seed:42,population:24,implementationStrength:strength,
    pairedInitialState:true,start:0,end:30,recordedCheckpoints:3,
    scope:'separate synthetic reviewed model; no citizen package applied'},
  frames:[0,15,30].map((time,i)=>({
    time,
    baseline:{metrics:{trips:i,meanCommuteMinutes:20},actors:[
      {id:'p0',label:'Resident 1',mode:'walk',activity:'home',x:time,z:1}]},
    edited:{metrics:{trips:i,meanCommuteMinutes:20-6*strength},actors:[
      {id:'p0',label:'Resident 1',mode:'bus',activity:'work',x:time+5,z:2}]}
  })),
  limitations:['Synthetic observations only.']
});

test('native simulate → edit lever → rerun displays actual paired actor changes and retains original',async()=>{
  const browser=new Window({url:'https://civic-synthesis.fly.dev/synth'});
  const requests:{href:string;body:{lawId:number;seed:number;population:number;implementationStrength:number}}[]=[];
  const mockedFetch=(async(uri:string|URL,init?:RequestInit)=>{
    const body=JSON.parse(String(init?.body)) as {lawId:number;seed:number;population:number;implementationStrength:number};
    requests.push({href:String(uri),body});
    const payload=receipt(body.implementationStrength);
    return{ok:true,status:200,json:async()=>payload} as Response;
  }) as typeof fetch;
  const globals={window:browser,document:browser.document,navigator:browser.navigator,
    fetch:mockedFetch,IS_REACT_ACT_ENVIRONMENT:true};
  const previous=Object.fromEntries(Object.keys(globals).map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
  for(const [key,value] of Object.entries(globals))Object.defineProperty(globalThis,key,{configurable:true,writable:true,value});
  const host=browser.document.createElement('main');
  browser.document.body.append(host);
  const root=createRoot(host);
  try{
    await act(async()=>root.render(<LawBehaviorExplorer seed={42} hblOrigin="https://happybearlandia.fly.dev"/>));
    expect(host.querySelector('iframe')).toBeNull();
    expect(host.textContent).toContain('frozen civic package is not automatically applied');
    await act(async()=>getByRole(host,'button',{name:'Run two simulated worlds'}).click());
    expect(requests).toHaveLength(1);
    expect(requests[0]).toEqual({href:'https://happybearlandia.fly.dev/api/law-behavior',
      body:{lawId:83,seed:42,population:24,implementationStrength:1}});
    expect(host.textContent).toContain('World A · current rules');
    expect(host.textContent).toContain('World B · edited law');
    expect(host.textContent).toContain('What modeled residents did differently');
    expect(host.textContent).toContain('Resident 1');
    expect(host.textContent).toContain('Travel mode: walk → bus');
    expect(host.querySelectorAll('polyline').length).toBe(2);
    expect(host.textContent).toContain('Minute 30');
    const timeSlider=getByRole(host,'slider',{name:'Recorded simulation time'}) as HTMLInputElement;
    await act(async()=>fireEvent.change(timeSlider,{target:{value:'0'}}));
    expect(host.textContent).toContain('minute 0');
    const strength=host.querySelector('.civic-law-controls input[type=range]') as HTMLInputElement;
    await act(async()=>fireEvent.change(strength,{target:{value:'50'}}));
    expect(host.querySelector('.civic-law-lanes')).toBeNull();
    expect(host.textContent).toContain('The input has changed');
    await act(async()=>getByRole(host,'button',{name:'Run two simulated worlds'}).click());
    expect(requests).toHaveLength(2);
    expect(requests[1]?.body.implementationStrength).toBe(.5);
    expect(host.textContent).toContain('Original 100% setting');
    expect(host.textContent).toContain('Recorded difference');
    expect(host.querySelector('iframe')).toBeNull();
  }finally{
    await act(async()=>root.unmount());host.remove();
    for(const key of Object.keys(globals)){
      if(previous[key])Object.defineProperty(globalThis,key,previous[key]!);
      else Reflect.deleteProperty(globalThis,key);
    }
    await browser.happyDOM.close();
  }
});
