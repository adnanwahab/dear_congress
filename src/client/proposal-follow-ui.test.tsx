import { test, expect } from 'bun:test';
import { Window } from 'happy-dom';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { ProposalFollow, ProposalWatchlist } from './ProposalFollow';
import { FOLLOW_KEY } from './proposal-follows';
test('follow, reload, watchlist and delete work without submitting a vote or requesting notifications', async () => {
 const dom = new Window({url:'https://example.test/feed'});
 const keys=['window','document','navigator','HTMLElement','Node','Event','localStorage','IS_REACT_ACT_ENVIRONMENT'];
 const previous=keys.map(k=>Object.getOwnPropertyDescriptor(globalThis,k));
 for(const key of keys) Object.defineProperty(globalThis,key,{configurable:true,value:key==='IS_REACT_ACT_ENVIRONMENT'?true:key==='window'?dom:(dom as any)[key]});
 const container=dom.document.createElement('div'); dom.document.body.append(container);
 const root=createRoot(container as unknown as HTMLElement);
 const source={kind:'sample' as const,id:'test',title:'<script>Title</script>',text:'Original'};
 let submits=0;
 try {
  await act(async()=>{root.render(<form onSubmit={e=>{e.preventDefault();submits++;}}><ProposalFollow source={source}/></form>);});
  await act(async()=>{container.querySelector('button')!.click();});
  expect(container.querySelector('button')!.getAttribute('aria-pressed')).toBe('true');
  expect(submits).toBe(0);
  await act(async()=>{root.render(<ProposalWatchlist/>);});
  expect(container.textContent).toContain(source.title);
  expect(container.querySelector('script')).toBeNull();
  expect(container.textContent).toContain('Next known step: unavailable');
  expect(container.textContent).toContain('notifications are unavailable');
  await act(async()=>{[...container.querySelectorAll('button')].find(b=>b.textContent==='Unfollow proposal')!.click();});
  expect(container.textContent).toContain('No followed proposals');
  await act(async()=>{root.render(<ProposalFollow source={source}/>);});
  await act(async()=>{container.querySelector('button')!.click();});
  await act(async()=>{root.render(<ProposalWatchlist/>);});
  await act(async()=>{[...container.querySelectorAll('button')].find(b=>b.textContent==='Delete all follows')!.click();});
  expect(JSON.parse(dom.localStorage.getItem(FOLLOW_KEY)!).items).toEqual([]);
 } finally {
  await act(async()=>root.unmount());
  keys.forEach((k,i)=>{if(previous[i])Object.defineProperty(globalThis,k,previous[i]!);else delete (globalThis as any)[k];});
  await dom.happyDOM.close();
 }
});
