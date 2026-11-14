/** Isolated DOM regression checks; viewport layout still needs browser QA. */
import assert from 'node:assert/strict';
import { Window } from 'happy-dom';
const dom = new Window({ url: 'http://localhost/draft' });
for (const key of ['window', 'document', 'navigator', 'HTMLElement', 'Element', 'Node', 'Event', 'MouseEvent', 'localStorage', 'sessionStorage']) {
  Object.defineProperty(globalThis, key, { configurable: true, value: key === 'window' ? dom : (dom as any)[key] });
}
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
const { act } = await import('react');
const { createRoot } = await import('react-dom/client');
const { within, fireEvent } = await import('@testing-library/dom');
const { DailyQuestion } = await import('../src/client/DailyQuestion');
const { demoPayload } = await import('../src/engine/demo');
const { dailyQuestion } = await import('../src/shared/daily-question');
const payload = demoPayload({}, 'test');
const featured = dailyQuestion(payload, new Date())!;
let calls: string[] = [];
let fail = false;
const request: any = async (path: string, body?: unknown) => {
  assert.equal(body, undefined, 'Daily completion must never write a vote');
  calls.push(path);
  if (fail) throw new Error('offline');
  return payload;
};
const root = createRoot(document.body.appendChild(document.createElement('div')));
await act(async () => root.render(<DailyQuestion request={request} />));
const q = () => within(document.body);
assert.ok(q().getByRole('heading', { name: featured.title }));
assert.equal(q().getByRole('link', { name: 'Make an advisory choice' }).getAttribute('href'), `/votes?proposal=${featured.id}#advisory-choice`);
assert.ok(document.body.textContent?.includes('Fictional demo proposal'));
payload.votes[featured.id] = 0;
await act(async () => window.dispatchEvent(new Event('advisory-vote:saved')));
assert.ok(q().getByRole('status').textContent?.includes('Not sure'));
assert.ok(q().getByRole('link', { name: 'Change your advisory choice' }));
await act(async () => root.unmount());
const reload = createRoot(document.body.appendChild(document.createElement('div')));
await act(async () => reload.render(<DailyQuestion request={request} />));
assert.ok(q().getByRole('status').textContent?.includes('Not sure'));
fail = true;
await act(async () => window.dispatchEvent(new Event('focus')));
assert.ok(q().getByRole('alert'));
assert.equal(q().queryByRole('link', { name: 'Change your advisory choice' }), null);
fail = false; payload.closesAt = new Date(0).toISOString();
await act(async () => fireEvent.click(q().getByRole('button', { name: "Retry today's question" })));
assert.ok(document.body.textContent?.includes('No open question'));
assert.ok(calls.every(p => p === '/api/demo'));
await act(async () => reload.unmount());
await dom.happyDOM.close();
console.log('Daily question: persistence, completion without writes, links, failure and expiry passed');
