import assert from 'node:assert/strict';
import { Window } from 'happy-dom';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { EvidenceCalendar } from '../src/client/EvidenceCalendar';
const dom = new Window({ url: 'http://localhost/outcomes' });
for (const key of ['window','document','navigator']) Object.defineProperty(globalThis,key,{ configurable:true,value:key === 'window' ? dom : (dom as any)[key] });
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
const host = dom.document.createElement('div'); dom.document.body.append(host);
const root = createRoot(host as any);
await act(async () => root.render(<EvidenceCalendar asOf="2026-11-14" state="offline" />));
assert.match(host.textContent!, /Offline: bundled snapshot only/);
const select = host.querySelector('select')!;
await act(async () => { select.value = 'missing-case'; select.dispatchEvent(new dom.Event('change', { bubbles:true })); });
assert.equal(host.querySelectorAll('article').length,1);
assert.match(host.querySelector('article')!.textContent!, /Source missing/);
const buttons = [...host.querySelectorAll('button')];
// Native buttons support keyboard activation; real browser/screen-reader QA remains separate.
for (const button of buttons) { button.focus(); assert.equal(dom.document.activeElement,button); }
await act(async () => buttons[0]!.click());
const exported = host.querySelector('textarea')!;
assert.equal(JSON.parse(exported.value).evidence.length,15);
await act(async () => buttons[0]!.click());
assert.equal(host.querySelector('textarea'),null);
await act(async () => buttons[1]!.click());
assert(host.querySelector('textarea'));
await act(async () => { select.value=''; select.dispatchEvent(new dom.Event('change',{bubbles:true})); });
const input = host.querySelector('input')!;
await act(async () => { input.value='2020-01'; input.dispatchEvent(new dom.Event('input',{bubbles:true})); });
// Native month semantics and CSS sizing are contract checked; no network is required.
assert.equal(input.type,'month');
assert.match(host.textContent!, /No dated events this month/);
assert.equal(host.querySelectorAll('ol li').length,0);
assert.match(await Bun.file('src/client/evidence-calendar.css').text(),/min-height:44px/);
assert.match(await Bun.file('src/client/evidence-calendar.css').text(),/@media print/);
await act(async () => root.unmount());
dom.happyDOM.abort();
console.log('PASS calendar filters, focus, offline, export and print preparation');
