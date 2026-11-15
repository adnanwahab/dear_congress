import assert from 'node:assert/strict';
import { Window } from 'happy-dom';
const dom=new Window({url:'http://localhost/vote/dear_congress?view=prs'});
for(const key of ['window','document','navigator','HTMLElement','Element','Node','Event','MutationObserver'])Object.defineProperty(globalThis,key,{configurable:true,value:key==='window'?dom:(dom as any)[key]});
(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;
const {act}=await import('react');
const {createRoot}=await import('react-dom/client');
const {fireEvent,within}=await import('@testing-library/dom');
const {PatchCard}=await import('../src/client/PatchCard');
const fixture={number:1,repositoryId:1,title:'PR',body:'',author:'fixture',url:'https://github.com/adnanwahab/dear_congress/pull/1',updatedAt:'',headSha:'head',base:'main',draft:false,state:'open',version:'head:main',firstSeenAt:0,labels:[]};
const pull={...fixture,tally:{yes:2,no:1,participation:3,feedback:0},eligibility:{eligible:false,state:'open-for-voting' as const,reason:'Advisory'}};
const root=createRoot(document.body.appendChild(document.createElement('div')));
let requests:RequestInit[]=[],mode='ok';
const original=globalThis.fetch;
globalThis.fetch=(async (_url:any,init?:RequestInit)=>{
 requests.push(init??{});
 if(mode==='permission')return new Response('{}',{status:403});
 return Response.json({pull:{...pull,headSha:mode==='stale'?'other':pull.headSha,files:[{filename:'source.ts',status:'modified',additions:1,deletions:0,patch:'+ safe source'}]}});
}) as typeof fetch;
async function mount(key:string){await act(async()=>root.render(<PatchCard key={key} pull={pull} api="/api/hbl/repos/dear_congress/pulls" repository="adnanwahab/dear_congress" sourceNote="GitHub"><p>Front content</p></PatchCard>));}
const q=within(document.body);
async function flip(){await act(async()=>fireEvent.click(q.getByRole('button',{name:'Flip to source diff'})));}
try{
 await mount('ok');assert.equal(requests.length,0);await flip();
 assert.equal(q.getByRole('button',{name:'Flip to overview'}).getAttribute('aria-expanded'),'true');
 assert.equal(document.querySelector('pre')?.getAttribute('aria-label'),'Diff for source.ts');
 assert.ok(document.body.textContent?.includes('+ safe source'));
 await act(async()=>fireEvent.click(q.getByRole('button',{name:'Flip to overview'})));await flip();assert.equal(requests.length,1);
 mode='permission';await mount('permission');await flip();assert.ok(q.getByRole('alert').textContent?.includes('Permission denied'));
 mode='stale';await act(async()=>fireEvent.click(q.getByRole('button',{name:'Retry source'})));assert.ok(q.getByRole('alert').textContent?.includes('Revision changed'));assert.equal(document.querySelector('pre'),null);
 assert.ok(requests.every(init=>!init.method||init.method==='GET'));assert.equal(pull.tally.yes,2);
 console.log('PASS read-only flips, lazy source, permissions, retry and revision isolation');
}finally{await act(async()=>root.unmount());globalThis.fetch=original;await dom.happyDOM.close();}
