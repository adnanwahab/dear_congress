import { test, expect } from 'bun:test';
import { Window } from 'happy-dom';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import PrivateJourney from './PrivateJourney';
import SaveToJourney from './SaveToJourney';
import { JOURNEY_KEY, saveJourneyEntry } from './civic-journey';
test('account log renders safe categorized notes and selective delete/reset with native controls', async () => {
 const dom = new Window({url:'https://example.test/account'});
 const keys=['window','document','navigator','HTMLElement','Node','Event','localStorage','IS_REACT_ACT_ENVIRONMENT'];
 const previous=keys.map(k=>Object.getOwnPropertyDescriptor(globalThis,k));
 for(const key of keys) Object.defineProperty(globalThis,key,{configurable:true,value:key==='IS_REACT_ACT_ENVIRONMENT'?true:key==='window'?dom:(dom as any)[key]});
 const container=dom.document.createElement('div'); dom.document.body.append(container); const root=createRoot(container as unknown as HTMLElement);
 try {
  await act(async()=>root.render(<PrivateJourney/>));
  expect(container.textContent).toContain('No saved topics notes yet.');
  expect(container.querySelectorAll('label').length).toBe(3);
  saveJourneyEntry(dom.localStorage,{id:'x',savedAt:'2026-11-14T12:00:00Z',category:'Sandbox runs',kind:'Model simulation',text:'<script>unsafe</script>'});
  const click=async(text:string)=>act(async()=>{[...container.querySelectorAll('button')].find(b=>b.textContent===text)!.click();});
  await click('Reload private journey'); expect(container.textContent).toContain('<script>unsafe</script>'); expect(container.querySelector('script')).toBeNull();
  await click('Delete note'); expect(JSON.parse(dom.localStorage.getItem(JOURNEY_KEY)!).entries).toEqual([]);
  dom.localStorage.setItem('unrelated','preserve');
  await click('Reset private journey…'); await click('Cancel reset'); expect(container.textContent).not.toContain('Delete all journey notes');
  await click('Reset private journey…'); await click('Delete all journey notes'); expect(dom.localStorage.getItem('unrelated')).toBe('preserve');
  await act(async()=>root.render(<SaveToJourney category="Explicit votes" kind="Citizen advisory activity" text={JSON.stringify({source:'citizen',id:'one',choice:'support'})}/>));
  await click('Save explicit votes snapshot privately');
  expect(JSON.parse(dom.localStorage.getItem(JOURNEY_KEY)!).entries[0].category).toBe('Explicit votes');
  expect(container.textContent).toContain('Snapshot saved only in this browser.');
  await act(async()=>root.render(<PrivateJourney/>));
  dom.localStorage.setItem(JOURNEY_KEY,'broken'); await click('Reload private journey'); expect(container.querySelector('[role="alert"]')).not.toBeNull(); expect(dom.localStorage.getItem(JOURNEY_KEY)).toBe('broken');
 } finally { await act(async()=>root.unmount()); keys.forEach((k,i)=>{if(previous[i])Object.defineProperty(globalThis,k,previous[i]!);else delete (globalThis as any)[k];}); await dom.happyDOM.close(); }
});
