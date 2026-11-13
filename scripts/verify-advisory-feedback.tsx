import assert from 'node:assert/strict';
import { Window } from 'happy-dom';
const dom = new Window({ url: 'http://localhost/votes' });
for (const key of ['window', 'document', 'navigator', 'HTMLElement', 'Element', 'Node', 'Event', 'MouseEvent', 'localStorage', 'sessionStorage']) Object.defineProperty(globalThis, key, { configurable: true, value: key === 'window' ? dom : (dom as any)[key] });
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
const { act } = await import('react');
const { createRoot } = await import('react-dom/client');
const { within, fireEvent } = await import('@testing-library/dom');
const { default: WorkflowScreen } = await import('../src/client/WorkflowScreen');
const { demoPayload } = await import('../src/engine/demo');
const payload = demoPayload({}, 'test');
const q = () => within(document.body);
let root: ReturnType<typeof createRoot>;
let posts = 0; let reads = 0; const bodies: any[] = [];
let resolve!: (v: any) => void; let reject!: (e: any) => void;
let pending = new Promise<any>((a, b) => { resolve = a; reject = b; });
const request: any = async (path: string, body: any) => {
  if (path === '/api/demo') { if (++reads > 1) throw new Error('refresh failed'); return payload; }
  posts++; bodies.push(body); return pending;
};
async function mount() {
  document.body.innerHTML = '<div id="root"></div>';
  root = createRoot(document.getElementById('root')!);
  await act(async () => root.render(<WorkflowScreen stage="votes" request={request} />));
}
await mount();
await act(async () => {
  const support = q().getByRole('button', { name: /Cast advisory vote: Support/ });
  fireEvent.click(support); fireEvent.click(support);
});
assert.equal(posts, 1);
assert.equal((q().getByRole('button', { name: /Cast advisory vote: Oppose/ }) as HTMLButtonElement).disabled, true);
assert.ok(!document.body.textContent!.includes('Server confirmed'));
await act(async () => reject(new TypeError('offline')));
assert.ok(q().getByRole('alert').textContent!.includes('could not confirm whether'));
await act(async () => root.unmount());
reads = 0;
await mount();
assert.equal(posts, 1);
assert.ok(q().getByRole('button', { name: 'Retry exact advisory choice' }));
await act(async () => fireEvent.change(q().getByRole('combobox', { name: 'Proposal' }), { target: { value: 'demo-transit' } }));
pending = new Promise<any>(a => { resolve = a; });
await act(async () => fireEvent.click(q().getByRole('button', { name: 'Retry exact advisory choice' })));
assert.equal(posts, 2); assert.deepEqual(bodies[1], bodies[0]);
await act(async () => resolve({ ok: true }));
assert.ok(document.body.textContent!.includes('Server confirmed advisory choice for'));
assert.ok(q().getByRole('alert').textContent!.includes('Updated proposal counts could not be loaded'));
assert.equal(q().queryByRole('button', { name: 'Retry exact advisory choice' }), null);
await act(async () => root.unmount());
reads = 0;
await mount();
assert.equal(posts, 2);
assert.ok(document.body.textContent!.includes('Previous server acknowledgement'));
await act(async () => root.unmount());
await dom.happyDOM.close();
console.log('Advisory feedback: duplicate guard, offline, exact retry, reload receipt and failed refresh passed');
