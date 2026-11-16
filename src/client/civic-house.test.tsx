import { test, expect } from 'bun:test';
import { Window } from 'happy-dom';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { getByRole } from '@testing-library/dom';
import CivicHouse from './CivicHouse';
import { savedRoom, useRoomReturn } from './civic-house-return';
import { demoPayload } from '../engine/demo';

test('house recovers from failure, retains native stage links and never writes', async () => {
  const page = new Window({ url: 'http://localhost/?house=1' });
  const globals = { window: page, document: page.document, navigator: page.navigator, sessionStorage: page.sessionStorage, IS_REACT_ACT_ENVIRONMENT: true };
  const previous = Object.fromEntries(Object.keys(globals).map(k => [k, Object.getOwnPropertyDescriptor(globalThis, k)]));
  for (const [k,v] of Object.entries(globals)) Object.defineProperty(globalThis, k, { value:v, writable:true, configurable:true });
  const host = document.createElement('div'); document.body.append(host);
  const root = createRoot(host);
  let fail = true;
  const calls: string[] = [];
  const request = async <T,>(path: string): Promise<T> => { calls.push(path); if (fail) throw Error('offline'); return demoPayload({}, '') as T; };
  try {
    await act(async () => root.render(<CivicHouse request={request} />));
    expect(host.textContent).toContain('Previews could not load');
    expect(host.querySelectorAll('.house-room a').length).toBe(6);
    expect(getByRole(host, 'link', { name: 'Enter Draft →' }).getAttribute('href')).toBe('/draft');
    fail = false;
    await act(async () => getByRole(host, 'button', { name: 'Retry previews' }).click());
    expect(host.textContent).toContain('Previewing fictional sample');
    expect(getByRole(host, 'link', { name: 'Enter Draft →' }).getAttribute('href')).toBe('/draft?proposal=demo-housing');
    await act(async () => getByRole(host, 'button', { name: 'Orbitable 3D view' }).click());
    expect(host.querySelector('input[type=range]')).not.toBeNull();
    await act(async () => getByRole(host, 'button', { name: 'Flat grid · no motion / low GPU' }).click());
    expect(host.querySelector('input[type=range]')).toBeNull();
    page.sessionStorage.setItem('civic-house-return:/draft', JSON.stringify({url:'/draft?proposal=demo-transit#details',focus:'stage-heading'}));
    expect(savedRoom('/draft')).toEqual({ url:'/draft?proposal=demo-transit#details',focus:'stage-heading' });
    for (const url of ['https://evil.example/draft', '/votes?live=123', '/draft?live=123', 'javascript:alert(1)']) {
      page.sessionStorage.setItem('civic-house-return:/draft', JSON.stringify({url}));
      expect(savedRoom('/draft').url).toBe('/draft');
    }
    expect(calls).toEqual(['/api/demo', '/api/demo']);
    page.history.replaceState(null, '', '/draft?proposal=demo-transit#details');
    Object.defineProperty(page.document, 'referrer', { configurable: true, value: 'http://localhost/?house=1' });
    page.sessionStorage.setItem('civic-house-return:/draft', JSON.stringify({ url: '/draft?proposal=demo-transit#details', focus: 'existing-control' }));
    function Room() { useRoomReturn('/draft', true); return <input id="existing-control" />; }
    await act(async () => root.render(<Room />));
    expect(document.activeElement?.id).toBe('existing-control');
    page.dispatchEvent(new page.Event('pagehide'));
    expect(savedRoom('/draft')).toEqual({ url: '/draft?proposal=demo-transit#details', focus: 'existing-control' });
  } finally {
    await act(async () => root.unmount());
    for (const k of Object.keys(globals)) { const value = previous[k]; if (value) Object.defineProperty(globalThis,k,value); else Reflect.deleteProperty(globalThis,k); }
    await page.happyDOM.close();
  }
});
