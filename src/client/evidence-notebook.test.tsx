import { test, expect } from 'bun:test';
import { Window } from 'happy-dom';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { EvidenceNotebook, SaveClaim } from './EvidenceNotebook';

test('save, revisit changed source, read frozen note, remove and recover corrupt storage', async () => {
 const dom = new Window({url:'https://example.test/feed'});
 const keys=['window','document','navigator','HTMLElement','Node','Event','localStorage','IS_REACT_ACT_ENVIRONMENT'];
 const previous=keys.map(k=>Object.getOwnPropertyDescriptor(globalThis,k));
 for(const key of keys) Object.defineProperty(globalThis,key,{configurable:true,value:key==='IS_REACT_ACT_ENVIRONMENT'?true:key==='window'?dom:(dom as any)[key]});
 const container=dom.document.createElement('div'); dom.document.body.append(container);
 const root=createRoot(container as unknown as HTMLElement);
 const source={kind:'sample-proposal' as const,id:'test',claim:'Original claim',citation:'Fictional sample',url:'https://example.org',revision:'one'};
 try {
  await act(async()=>root.render(<EvidenceNotebook/>));
  expect(container.textContent).toContain('No clips yet');
  expect(container.querySelector('button')!.disabled).toBe(true);
  await act(async()=>root.render(<SaveClaim source={source}/>));
  expect(container.querySelector('label')!.textContent).toContain('Your note');
  await act(async()=>{container.querySelector('form')!.dispatchEvent(new dom.Event('submit',{bubbles:true,cancelable:true}));});
  expect(container.querySelector('[role=status]')!.textContent).toContain('saved privately');
  await act(async()=>root.render(<SaveClaim source={{...source,claim:'Updated claim',revision:'two'}}/>));
  await act(async()=>root.render(<EvidenceNotebook/>));
  expect(container.textContent).toContain('Original claim'); expect(container.textContent).not.toContain('Updated claim'); expect(container.textContent).toContain('Stale');
  await act(async()=>{[...container.querySelectorAll('button')].find(b=>b.textContent==='Remove clip')!.click();});
  expect(container.textContent).toContain('No clips yet');
  dom.localStorage.setItem('civic_evidence_clips_v1','broken');
  await act(async()=>{[...container.querySelectorAll('button')].find(b=>b.textContent==='Refresh notebook / retry')!.click();});
  expect(container.querySelector('[role=alert]')).not.toBeNull(); expect(dom.localStorage.getItem('civic_evidence_clips_v1')).toBe('broken');
 } finally {
  await act(async()=>root.unmount());
  keys.forEach((k,i)=>{if(previous[i])Object.defineProperty(globalThis,k,previous[i]!);else delete (globalThis as any)[k];});
  await dom.happyDOM.close();
 }
});
