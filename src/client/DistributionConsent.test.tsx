import { test, expect } from 'bun:test';
import { Window } from 'happy-dom';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { DistributionConsent, distributionHeaders, distributionCompleted } from './DistributionConsent';

test('attribution requires consent, strips only its markers, stops and suppresses repeats', async () => {
  const browser = new Window({url:'https://local/journal?cs_source=newsletter&cs_campaign=launch&need=housing#entry'});
  const keys = ['window', 'document', 'fetch', 'IS_REACT_ACT_ENVIRONMENT'];
  const original = Object.fromEntries(keys.map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const [key, value] of Object.entries({window:browser, document:browser.document, IS_REACT_ACT_ENVIRONMENT:true})) Object.defineProperty(globalThis, key, {configurable:true, writable:true, value});
  const calls: RequestInit[] = [];
  globalThis.fetch = (async (_url,init) => {calls.push(init!);return new Response(null,{status:204});}) as typeof fetch;
  const host = document.createElement('div'); document.body.append(host);
  const root = createRoot(host);
  try {
    await act(async () => {root.render(<DistributionConsent />);});
    expect(calls).toHaveLength(0); expect(distributionHeaders()).toEqual({});
    expect(browser.location.search).toBe('?need=housing'); expect(browser.location.hash).toBe('#entry');
    const button = (text:string) => [...host.querySelectorAll('button')].find(b=>b.textContent===text)!;
    await act(async () => {button('Allow launch measurement').click();});
    expect(calls).toHaveLength(1); expect(calls[0]!.credentials).toBe('omit');
    expect(JSON.parse(distributionHeaders()['x-distribution']!).source).toBe('newsletter');
    distributionCompleted(new Response(null,{headers:{'x-distribution-recorded':'1'}}));
    expect(distributionHeaders()).toEqual({});
    await act(async () => {button('Stop launch measurement').click();});
    expect(host.textContent).toBe(''); expect(distributionHeaders()).toEqual({});
  } finally {
    await act(async () => root.unmount());
    for (const key of keys) { const descriptor = original[key]; if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key); }
    browser.close();
  }
});
