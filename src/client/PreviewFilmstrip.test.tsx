import {test,expect} from 'bun:test';
import {renderToStaticMarkup} from 'react-dom/server';
import {captureStatus,PreviewFilmstrip} from './PreviewFilmstrip';
import type {PublicPull} from '../shared/hbl-governance';
const head='a'.repeat(40),base='b'.repeat(40);
const receipt=(sha=head):NonNullable<PublicPull['preview']>=>({headSha:sha,route:'/',screenshotUrl:`/api/hbl/previews/12/${sha}/image`,capturedAt:'2026-11-14T12:00:00Z',exploreUrl:`https://hbl-pr-12-${sha.slice(0,8)}.fly.dev/`,deploymentVerifiedAt:'2026-11-14T12:01:00Z'});
const pull=():PublicPull=>({number:12,repositoryId:1,url:'https://github.com/adnanwahab/happybearlandia/pull/12',body:'',title:'Fixture',author:'fixture',updatedAt:'',headSha:head,base:'main',draft:false,state:'open',version:'fixture',firstSeenAt:0,labels:[],tally:{yes:0,no:0,participation:0,feedback:0},eligibility:{eligible:false,state:'blocked',reason:'Review required'}});
for(const state of ['blocked','waiting-for-checks','open-for-voting'] as const)test(`${state}: only exact verified receipt produces build screenshot`,()=>{
 const p=pull();p.eligibility.state=state;
 expect(renderToStaticMarkup(<PreviewFilmstrip pull={p}/>)).not.toContain('<img');
 p.preview=receipt();
 const html=renderToStaticMarkup(<PreviewFilmstrip pull={p}/>);
 expect(html).toContain('Loading verified screenshot');expect(html).toContain(head);expect(html).toContain('Before · base revision');expect(html).toContain('Capture unavailable');expect(html).toContain('Open verified preview');expect(html).not.toContain('Save');
 p.headSha=base;expect(renderToStaticMarkup(<PreviewFilmstrip pull={p}/>)).not.toContain('<img');
});
test('receipt rejects other repository, PR, mutable SHA, missing timestamps and unverified deployments',()=>{
 const p=pull();for(const r of [{...receipt(),capturedAt:''},{...receipt(),deploymentVerifiedAt:undefined},{...receipt(),exploreUrl:'https://evil.test/'},{...receipt(),screenshotUrl:'/wrong.png'},{...receipt(),route:'/other'}])expect(captureStatus(p,head,r).state).not.toBe('verified');
 expect(captureStatus({...p,url:'https://github.com/adnanwahab/dear_congress/pull/12'},head,receipt()).state).not.toBe('verified');
 expect(captureStatus({...p,number:13},head,receipt()).state).not.toBe('verified');
 expect(captureStatus(p,'main',receipt()).state).not.toBe('verified');
 expect(renderToStaticMarkup(<PreviewFilmstrip pull={{...p,kind:'issue',preview:receipt()}}/>)).toBe('');
});
test('base capture requires exact GitHub base identity',()=>{
 const p=pull();p.beforePreview=receipt(base);
 expect(renderToStaticMarkup(<PreviewFilmstrip pull={p}/>)).not.toContain('<img');
 p.evidence={baseSha:base,checks:[],reviews:[],requestedReviewers:0,mergeable:true,mergeableState:'clean',protectionsKnown:true,protectedBase:true,sensitive:false,maintainerApproved:false};
 expect(renderToStaticMarkup(<PreviewFilmstrip pull={p}/>)).toContain(`/api/hbl/previews/12/${base}/image`);
 p.evidence.baseSha=head;expect(renderToStaticMarkup(<PreviewFilmstrip pull={p}/>)).not.toContain('<img');
});
test('image error, retry, load and revision reset are local and never write votes',async()=>{
 const {Window}=await import('happy-dom');const window=new Window({url:'http://localhost/vote/happybearlandia'});
 const globals={window,document:window.document,navigator:window.navigator,IS_REACT_ACT_ENVIRONMENT:true};
 const previous=Object.fromEntries(Object.keys(globals).map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
 for(const [key,value] of Object.entries(globals))Object.defineProperty(globalThis,key,{configurable:true,writable:true,value});
 const {createRoot}=await import('react-dom/client');const {act}=await import('react');const host=document.createElement('div');document.body.append(host);const root=createRoot(host);const p=pull();p.preview=receipt();const original=JSON.stringify(p);
 const originalFetch=globalThis.fetch;let requests=0;globalThis.fetch=(()=>{requests++;throw Error('No network writes expected');}) as unknown as typeof fetch;
 try{
  await act(async()=>root.render(<PreviewFilmstrip pull={p}/>));
  await act(async()=>host.querySelector('img')!.dispatchEvent(new window.Event('error') as unknown as Event));
  expect(host.querySelector('[role="alert"]')?.textContent).toContain('failed');expect(host.querySelector('img')).toBeNull();
  const button=host.querySelector('button')!;button.focus();expect(document.activeElement).toBe(button);
  await act(async()=>button.click());expect(host.textContent).toContain('Loading verified screenshot');
  await act(async()=>host.querySelector('img')!.dispatchEvent(new window.Event('load') as unknown as Event));
  expect(host.textContent).not.toContain('Loading verified screenshot');
  await act(async()=>root.render(<PreviewFilmstrip pull={{...p,headSha:base}}/>));expect(host.querySelector('img')).toBeNull();expect(requests).toBe(0);expect(JSON.stringify(p)).toBe(original);
 }finally{globalThis.fetch=originalFetch;await act(async()=>root.unmount());host.remove();for(const key of Object.keys(globals)){if(previous[key])Object.defineProperty(globalThis,key,previous[key]!);else Reflect.deleteProperty(globalThis,key);}await window.happyDOM.close();}
});
