import assert from 'node:assert/strict';
import { Window } from 'happy-dom';
const dom = new Window({ url: 'http://localhost/' });
for (const key of ['location', 'window', 'document', 'navigator', 'HTMLElement', 'Element', 'Node', 'Event', 'MouseEvent', 'localStorage', 'sessionStorage']) {
  Object.defineProperty(globalThis, key, { configurable: true, value: key === 'window' ? dom : (dom as any)[key] });
}
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
const { act } = await import('react');
const { createRoot } = await import('react-dom/client');
const { within, fireEvent } = await import('@testing-library/dom');
const { Dashboard } = await import('../src/client/Dashboard');
const { default: WorkflowScreen } = await import('../src/client/WorkflowScreen');
const { default: JournalScreen } = await import('../src/client/JournalScreen');
const { demoPayload } = await import('../src/engine/demo');
const calls: string[] = [];
const request = async <T,>(path: string, body?: unknown): Promise<T> => {
  calls.push(path);
  assert.equal(body, undefined, 'navigation must not write');
  throw new Error('offline');
};
const host = document.createElement('div'); document.body.append(host);
const root = createRoot(host);
const q = () => within(host);
for (const search of ['', '?proposal=sample%26one']) {
  dom.happyDOM.setURL(`http://localhost/${search}`);
  await act(async () => root.render(<Dashboard key={search} request={request} />));
  const start = q().getByRole('region', { name: 'Where would you like to start?' });
  const links = within(start).getAllByRole('link');
  assert.equal(links.length, 2);
  assert.equal(links[0]!.textContent, 'Explore a proposal & advisory vote');
  assert.equal(links[0]!.getAttribute('href'), `/votes${search}`);
  assert.equal(links[1]!.textContent, 'Tell us what needs fixing');
  assert.equal(links[1]!.getAttribute('href'), '/journal');
  assert.equal(links[0]!.className, links[1]!.className);
  assert.match(start.textContent!, /No account is needed/);
  assert.match(start.textContent!, /shared publicly/);
  assert(q().getAllByRole('alert').length >= 1);
  const details = host.querySelector('details')!;
  assert.equal(details.open, false);
  assert.equal(details.querySelector('summary')!.textContent, 'How it works');
  assert.equal(details.querySelectorAll('li').length, 6);
  assert(q().getByRole('heading', { name: 'Sponsor tracker' }));
}
assert(calls.every(path => path === '/api/demo'));
// Follow the default vote destination: no chooser or additional navigation is needed.
dom.happyDOM.setURL('http://localhost/votes');
await act(async () => root.render(<WorkflowScreen stage="votes" request={async <T,>() => demoPayload({}, 'test') as T} />));
assert(q().getByRole('button', { name: /^Cast advisory vote: Support/ }));
// A failed save remains a failure, never a success notice.
await act(async () => root.render(<WorkflowScreen key="offline" stage="votes" request={async <T,>(path: string, body?: unknown) => { if (body) throw new Error('Save unavailable'); return demoPayload({}, 'test') as T; }} />));
await act(async () => fireEvent.click(q().getByRole('button', { name: /^Cast advisory vote: Support/ })));
assert.match(host.textContent!, /Save unavailable/);
assert(!host.textContent!.includes('Your advisory vote is saved'));
dom.happyDOM.setURL('http://localhost/journal');
await act(async () => root.render(<JournalScreen request={async () => { throw new Error('Journal unavailable'); }} />));
assert(host.querySelector('textarea#journal-text'));
await act(async () => fireEvent.click(q().getByRole('button', { name: 'Use a sample experience' })));
await act(async () => fireEvent.submit(host.querySelector('form')!));
assert.match(host.textContent!, /Journal unavailable/);
assert(!host.textContent!.includes('Connected to shared needs'));
assert((host.querySelector('textarea') as HTMLTextAreaElement).value.length > 0);
await act(async () => root.unmount());
await dom.happyDOM.close();
console.log('Home start: offline links, context, disclosure, read-only load and actionable destinations passed');
