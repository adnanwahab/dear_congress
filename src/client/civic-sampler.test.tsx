import { test, expect } from 'bun:test';
import { Window } from 'happy-dom';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { CivicSampler, samplerItems } from './CivicSampler';
import { DEMO_ITEMS } from '../engine/demo';
import { FOLLOW_KEY, readFollows } from './proposal-follows';

test('sampler selects five distinct topics without modifying source items', () => {
 const cards = samplerItems(DEMO_ITEMS);
 expect(cards).toHaveLength(5);
 expect(new Set(cards.map(i => i.topic)).size).toBe(5);
 expect(cards[0]).toBe(DEMO_ITEMS[0]);
});
for (const reduced of [false, true]) test(`sampler loading, recovery, save, touch and keyboard-equivalent controls; reduced motion ${reduced}`, async () => {
 const dom = new Window({url:'https://example.test/feed'});
 dom.matchMedia = ((query: string) => ({matches:reduced && query.includes('reduced-motion')})) as any;
 const keys=['window','document','navigator','HTMLElement','Node','Event','localStorage','IS_REACT_ACT_ENVIRONMENT'];
 const previous=keys.map(k=>Object.getOwnPropertyDescriptor(globalThis,k));
 for(const key of keys) Object.defineProperty(globalThis,key,{configurable:true,value:key==='IS_REACT_ACT_ENVIRONMENT'?true:key==='window'?dom:(dom as any)[key]});
 const container=dom.document.createElement('div'); dom.document.body.append(container);
 const root=createRoot(container as unknown as HTMLElement);
 let retries=0, submits=0;
 const render = async (loading=false, failed=false, items=DEMO_ITEMS) => act(async()=>root.render(<form onSubmit={e=>{e.preventDefault();submits++;}}><CivicSampler items={items} loading={loading} failed={failed} retry={()=>retries++}/></form>));
 const click = async (label:string) => act(async()=>{[...container.querySelectorAll('button')].find(b=>b.textContent===label)!.click();});
 try {
  await render(true); await click('Explore five policies');
  expect(container.textContent).toContain('Loading sample policies');
  await render(false,true); await click('Retry sampler'); expect(retries).toBe(1);
  await render(false,false,[]); expect(container.textContent).toContain('five-policy sampler is unavailable');
  await render(); expect(container.textContent).toContain('Card 1 of 5');
  expect(container.querySelector('article a[href^="/draft?"]')!.getAttribute('href')).toContain('demo-housing');
  await click('Save to reading list');
  expect(readFollows(dom.localStorage)[0]!.source.kind).toBe('sample');
  expect(container.textContent).toContain('Card 2 of 5');
  expect(dom.document.activeElement?.id).toBe('sampler-heading');
  const pointer = async (type:string,x:number,y:number) => act(async()=>{
   const event = new dom.Event(type,{bubbles:true});
   Object.assign(event,{pointerType:'touch',isPrimary:true,pointerId:1,clientX:x,clientY:y});
   container.querySelector('article')!.dispatchEvent(event);
  });
  await pointer('pointerdown',200,0); await pointer('pointerup',205,100);
  expect(container.textContent).toContain('Card 2 of 5');
  await pointer('pointerdown',200,0); await pointer('pointermove',205,100); await pointer('pointerup',0,100);
  expect(container.textContent).toContain('Card 2 of 5');
  await pointer('pointerdown',200,0); await pointer('pointercancel',200,0); await pointer('pointerup',0,0);
  expect(container.textContent).toContain('Card 2 of 5');
  await pointer('pointerdown',200,0); await pointer('pointerup',0,0);
  expect(container.textContent).toContain('Card 3 of 5');
  await click('Skip'); await click('Skip'); await click('Skip');
  expect(container.textContent).toContain("You've explored all five");
  expect(submits).toBe(0);
  await click('Explore again');
  await click('Save to reading list');
  dom.localStorage.setItem(FOLLOW_KEY, 'invalid stored data');
  await click('Save to reading list');
  expect(container.textContent).toContain('Could not save');
  expect(container.textContent).toContain('Card 2 of 5');
  expect(dom.localStorage.getItem(FOLLOW_KEY)).toBe('invalid stored data');
 } finally {
  await act(async()=>root.unmount());
  keys.forEach((k,i)=>{if(previous[i])Object.defineProperty(globalThis,k,previous[i]!);else delete (globalThis as any)[k];});
  await dom.happyDOM.close();
 }
});
