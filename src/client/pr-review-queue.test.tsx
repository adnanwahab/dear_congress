import {test, expect} from 'bun:test';
import {renderToStaticMarkup} from 'react-dom/server';
import {fixture} from '../server/hbl/policy.test';
import type {PublicPull} from '../shared/hbl-governance';
import {EMPTY_QUEUE_FILTERS as empty, matchesQueue, reviewStatus} from './pr-review-queue';
import {ReviewQueueFilters} from './ReviewQueueFilters';
import {Facts} from './GamePatches';
const p: PublicPull = {...fixture, updatedAt:'2026-11-01T12:34:56Z', labels:['Journal'], tally:{yes:0,no:0,participation:0,feedback:0}, eligibility:{state:'blocked',eligible:false,reason:'Base branch is not allowed'}};
test('blocked PR remains discoverable by exact reason, feature and original update age', () => {
 expect(matchesQueue(p,{...empty,reason:p.eligibility.reason,feature:'label:Journal',age:'older'},Date.parse('2026-11-14'))).toBe(true);
 expect(matchesQueue(p,{...empty,feature:'label:Votes'})).toBe(false);
 expect(matchesQueue(p,{...empty,reason:'Different blocker'})).toBe(false);
 const html=renderToStaticMarkup(<Facts pull={p}/>);
 expect(html).toContain(p.updatedAt);expect(html).toContain(p.url);expect(html).toContain(p.version);expect(html).toContain(p.eligibility.reason);
});
test('checks pending and current-head review approval are independent of policy blockers', () => {
 const pending={...p,evidence:{...p.evidence!,checks:[{name:'test',status:'in_progress',conclusion:null,sha:p.headSha}]}};
 expect(reviewStatus(pending).checks).toBe('pending');
 expect(matchesQueue(pending,{...empty,checks:'pending'})).toBe(true);
 expect(reviewStatus(p).review).toBe('review-ready');
 expect(matchesQueue(p,{...empty,checks:'passed',review:'review-ready'})).toBe(true);
 expect(p.eligibility.eligible).toBe(false);
});
test('unfetched, inaccessible, old-head and missing evidence never become verified success', () => {
 expect(reviewStatus({...p,evidence:undefined})).toEqual({checks:'unknown',review:'unknown'});
 expect(reviewStatus({...p,evidence:{...p.evidence!,protectionsKnown:false}}).review).toBe('unknown');
 expect(reviewStatus({...p,headSha:'new'})).toEqual({checks:'unknown',review:'needed'});
 expect(reviewStatus({...p,evidence:{...p.evidence!,checks:[]}}).checks).toBe('unknown');
 expect(matchesQueue({...p,updatedAt:''},{...empty,age:'unknown'})).toBe(true);
 expect(matchesQueue({...p,labels:[]},{...empty,feature:'unknown'})).toBe(true);
});
test('review blockers retain precedence over approval', () => {
 expect(reviewStatus({...p,evidence:{...p.evidence!,requestedReviewers:1}}).review).toBe('requested');
 expect(reviewStatus({...p,evidence:{...p.evidence!,reviews:[{userId:1,state:'CHANGES_REQUESTED',commitId:'old'}]}}).review).toBe('changes-requested');
});
test('discovery controls are labeled native selects and never mutate input receipts', () => {
 const before=JSON.stringify(p);
 const html=renderToStaticMarkup(<ReviewQueueFilters pulls={[p]} value={empty} onChange={()=>{}}/>);
 expect((html.match(/<select/g)||[]).length).toBe(5);expect(html).toContain('Unknown');
 expect(html).toContain('Current-head approval does not mean merge approval');
 matchesQueue(p,empty);expect(JSON.stringify(p)).toBe(before);
});
test('changing and clearing native discovery controls only updates local filters', async () => {
 const {Window}=await import('happy-dom');
 const {createRoot}=await import('react-dom/client');
 const {act}=await import('react');
 const w=new Window();
 const globals={window:w,document:w.document,IS_REACT_ACT_ENVIRONMENT:true};
 const previous=Object.fromEntries(Object.keys(globals).map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
 for(const [key,value] of Object.entries(globals))Object.defineProperty(globalThis,key,{configurable:true,value});
 const host=w.document.createElement('div');w.document.body.append(host);
 const root=createRoot(host as unknown as HTMLElement);
 let current={...empty};
 function render(){root.render(<ReviewQueueFilters pulls={[p]} value={current} onChange={next=>{current=next;render();}}/>);}
 try {
  await act(async()=>render());
  const selects=host.querySelectorAll('select');
  const checks=selects[0]!;
  checks.focus();expect(w.document.activeElement).toBe(checks);
  await act(async()=>{checks.value='pending';checks.dispatchEvent(new w.Event('change',{bubbles:true}));});
  expect(current.checks).toBe('pending');expect(matchesQueue(p,current)).toBe(false);
  await act(async()=>{host.querySelector('button')!.click();});
  expect(current).toEqual(empty);expect(matchesQueue(p,current)).toBe(true);
 } finally {
  await act(async()=>root.unmount());w.happyDOM.abort();
  for(const key of Object.keys(globals)){const descriptor=previous[key];if(descriptor)Object.defineProperty(globalThis,key,descriptor);else Reflect.deleteProperty(globalThis,key);}
 }
});
