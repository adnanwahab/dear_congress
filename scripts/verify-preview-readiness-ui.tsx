import assert from 'node:assert/strict';
import { Window } from 'happy-dom';
import type { PublicPull, PullDetail } from '../src/shared/hbl-governance';
import { DEFAULT_POLICY } from '../src/server/hbl/policy';
const dom=new Window({url:'http://localhost/vote/dear_congress/pr/7'});
for(const key of ['window','document','navigator','HTMLElement','Element','Node','Event','MutationObserver'])Object.defineProperty(globalThis,key,{configurable:true,value:key==='window'?dom:(dom as any)[key]});
(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;
const {act}=await import('react');const {createRoot}=await import('react-dom/client');const {fireEvent,within}=await import('@testing-library/dom');const {PreviewReadiness}=await import('../src/client/PreviewReadiness');
const pull:PublicPull={number:7,repositoryId:1,title:'Patch',body:'',author:'fixture',url:'',updatedAt:'',headSha:'head',base:'main',draft:false,state:'open',version:'head:main',firstSeenAt:0,labels:[],tally:{yes:0,no:0,participation:0,feedback:0},eligibility:{eligible:false,state:'blocked',reason:'Base branch is not allowed'}};
const data:PullDetail={contract:'hbl-governance.v1',pull,viewer:{authenticated:false,approved:false},choice:null,feedback:[],historicalVotes:[]};
let mode='ok';const calls:string[]=[];let tick:(()=>void)|undefined;let cleared=false;
const originalSetInterval=globalThis.setInterval,originalClearInterval=globalThis.clearInterval;
globalThis.setInterval=((callback:()=>void,delay:number)=>{assert.equal(delay,30000);tick=callback;return 1;}) as any;globalThis.clearInterval=(()=>{cleared=true;}) as any;
globalThis.fetch=(async(input,init)=>{assert.equal(init?.method??'GET','GET');calls.push(String(input));if(mode==='denied')return new Response('',{status:403});if(mode==='stale')return Response.json({...data,stale:true});return Response.json(data);}) as typeof fetch;
const root=createRoot(document.body.appendChild(document.createElement('div')));
try{
 await act(async()=>root.render(<PreviewReadiness pull={pull} policy={DEFAULT_POLICY} api="/api/hbl/repos/dear_congress/pulls" repository="adnanwahab/dear_congress"/>));
 assert.equal(calls.length,0);const details=document.querySelector('details')!;
 await act(async()=>{details.open=true;fireEvent(details,new dom.Event('toggle'));});
 const q=within(document.body);assert.match(document.body.textContent!,/repository ID 1/);assert.match(document.body.textContent!,/empty; fail closed/);assert.equal(calls[0],'/api/hbl/repos/dear_congress/pulls/7');
 await act(async()=>tick!());assert.equal(calls.length,2);
 mode='denied';await act(async()=>fireEvent.click(q.getByRole('button',{name:'Refresh diagnostics'})));
 assert.match(q.getByRole('alert').textContent!,/Permission denied/);assert.match(document.body.textContent!,/previous receipts retained/);assert.match(document.querySelector('summary')!.textContent!,/unknown/);
 mode='stale';await act(async()=>fireEvent.click(q.getByRole('button',{name:'Refresh diagnostics'})));assert.match(document.body.textContent!,/Stale cached receipts/);
 assert.equal(document.querySelectorAll('button').length,1);assert.equal(document.querySelectorAll('a').length,2);
 assert.equal(pull.tally.participation,0);
 console.log('PASS diagnostics GET-only expansion, refresh, permission, stale and identity states');
}finally{await act(async()=>root.unmount());assert.equal(cleared,true);globalThis.setInterval=originalSetInterval;globalThis.clearInterval=originalClearInterval;await dom.happyDOM.close();}
