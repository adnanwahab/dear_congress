import { test, expect } from 'bun:test';
import { Window } from 'happy-dom';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { CivicPassport, decodePassport, PASSPORT_KEY } from './CivicPassport';

test('passport rejects unrelated activity, identity and malformed progress', () => {
  for (const badges of [['support'], ['public-post'], ['influence'], ['evidence', 'evidence']]) expect(() => decodePassport(JSON.stringify({version:1,badges}))).toThrow();
  expect(() => decodePassport('{')).toThrow();
  expect(decodePassport(null)).toBeNull();
});

test('optional learning journey persists, resets and deletes only its own data; storage failure preserves progress', async () => {
 const dom = new Window({url:'https://example.test/account'});
 const keys=['window','document','navigator','HTMLElement','Node','Event','localStorage','IS_REACT_ACT_ENVIRONMENT'];
 const previous=keys.map(k=>Object.getOwnPropertyDescriptor(globalThis,k));
 for(const key of keys) Object.defineProperty(globalThis,key,{configurable:true,value:key==='IS_REACT_ACT_ENVIRONMENT'?true:key==='window'?dom:(dom as any)[key]});
 const host=dom.document.createElement('div'); dom.document.body.append(host);
 const originalCreate = URL.createObjectURL;
 let exported: Blob | undefined;
 URL.createObjectURL = (blob: Blob) => { exported = blob; return 'blob:passport-test'; };
 const root=createRoot(host as unknown as HTMLElement);
 const click=async(text:string)=>{await act(async()=>{[...host.querySelectorAll('button')].find(b=>b.textContent?.includes(text))!.click();});};
 try {
  dom.localStorage.setItem('existing-votes','untouched');
  await act(async()=>root.render(<CivicPassport/>));
  expect(dom.localStorage.getItem(PASSPORT_KEY)).toBeNull();
  await click('Start optional');
  for(const title of ['Evidence explorer','Jurisdiction explorer','Perspective explorer']) await click(`earn ${title}`);
  expect(decodePassport(dom.localStorage.getItem(PASSPORT_KEY))).toHaveLength(3);
  await act(async()=>root.render(<CivicPassport key="reload"/>));
  expect(host.textContent).toContain('3 of 3');
  await click('Export passport');
  expect(JSON.parse(await exported!.text())).toEqual({version:1,badges:['evidence','jurisdiction','perspectives']});
  await click('Reset learning');
  expect(decodePassport(dom.localStorage.getItem(PASSPORT_KEY))).toEqual([]);
  dom.localStorage.setItem(PASSPORT_KEY,'broken');
  await act(async()=>root.render(<CivicPassport key="corrupt"/>));
  expect(host.querySelector('[role=alert]')?.textContent).toContain('not been replaced');
  expect(dom.localStorage.getItem(PASSPORT_KEY)).toBe('broken');
  await click('Delete passport');
  expect(dom.localStorage.getItem(PASSPORT_KEY)).toBeNull();
  expect(dom.localStorage.getItem('existing-votes')).toBe('untouched');
  Object.defineProperty(globalThis,'localStorage',{configurable:true,get(){throw Error('blocked');}});
  await click('Start optional');
  expect(host.querySelector('[role=alert]')?.textContent).toContain('Could not save');
 } finally {
  URL.createObjectURL = originalCreate;
  await act(async()=>root.unmount());
  keys.forEach((k,i)=>{if(previous[i])Object.defineProperty(globalThis,k,previous[i]!);else delete (globalThis as any)[k];});
  await dom.happyDOM.close();
 }
});
