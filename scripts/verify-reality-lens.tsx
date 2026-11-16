import assert from 'node:assert/strict';
import { Window } from 'happy-dom';
const dom = new Window({ url: 'http://localhost/votes' });
for (const key of ['window', 'document', 'navigator', 'HTMLElement', 'Element', 'Node', 'Event', 'MouseEvent', 'localStorage', 'sessionStorage']) {
  Object.defineProperty(globalThis, key, { configurable: true, value: key === 'window' ? dom : (dom as any)[key] });
}
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
const { act } = await import('react');
const { createRoot } = await import('react-dom/client');
const { within, fireEvent } = await import('@testing-library/dom');
const { RealityLens, REALITY_LENS_KEY } = await import('../src/client/RealityLens');
const { default: WorkflowScreen } = await import('../src/client/WorkflowScreen');
const { Dashboard } = await import('../src/client/Dashboard');
const { default: MapScreen } = await import('../src/client/MapScreen');
const { PageSkeleton } = await import('../src/client/LoadingSkeleton');
const { demoPayload } = await import('../src/engine/demo');
let root: ReturnType<typeof createRoot> | undefined;
const q = () => within(document.body);
async function render(node: React.ReactNode, path = '/votes') {
  if (root) await act(async () => root!.unmount());
  sessionStorage.clear();
  dom.happyDOM.setURL(`http://localhost${path}`);
  document.body.innerHTML = '<div id="root"></div>';
  root = createRoot(document.getElementById('root')!);
  await act(async () => root!.render(node));
  assert.equal(q().getAllByRole('region', { name: 'Reality lens' }).length, 1);
}
async function toggle() {
  const button = q().getByRole('button', { name: /Explain data|Less detail/ });
  button.focus();
  assert.equal(document.activeElement, button);
  await act(async () => fireEvent.click(button));
  assert.equal(document.activeElement, button);
  const content = document.getElementById(button.getAttribute('aria-controls')!)!;
  assert.equal(content.hidden, button.getAttribute('aria-expanded') !== 'true');
}
// Every required destination shares the legend, even before data arrives.
const pending = async <T,>(): Promise<T> => new Promise(() => {});
await render(<Dashboard request={pending} />, '/');
await toggle();
assert.equal(localStorage.getItem(REALITY_LENS_KEY), 'expanded');
for (const stage of ['feed', 'votes', 'outcomes'] as const) {
  await render(<WorkflowScreen stage={stage} request={pending} />, `/${stage}`);
  assert.ok(q().getByRole('button', { name: 'Less detail' }));
}
await render(<MapScreen />, '/map');
for (const path of ['/needs', '/synth']) {
  await render(<PageSkeleton path={path} />, path);
  assert.ok(q().getByRole('button', { name: 'Less detail' }));
}
// Mixed actual/browser and illustrative counts stay separate and unchanged.
const payload = demoPayload({}, 'lens-test');
payload.browserCounts = { [payload.items[0]!.id]: { support: 7, oppose: 2, unsure: 1 } };
const before = JSON.stringify(payload);
let reads = 0;
const request = async <T,>(path: string): Promise<T> => {
  assert.ok(path.startsWith('/api/')); reads++;
  return (path.startsWith('/api/legislation') ? { bills: [] } : payload) as T;
};
await render(<WorkflowScreen stage="votes" request={request} />);
assert.ok(document.body.textContent!.includes('Support: 7 · Oppose: 2 · Not sure: 1'));
const actual = q().getByRole('region', { name: 'Unverified browser votes — advisory' }).textContent;
const calls = reads;
await toggle(); await toggle();
assert.equal(q().getByRole('region', { name: 'Unverified browser votes — advisory' }).textContent, actual);
assert.equal(JSON.stringify(payload), before);
assert.equal(reads, calls);
assert.ok(document.body.textContent!.includes('Synthetic demo data — illustrative'));
// Missing counts, empty and failed requests do not remove the independent legend.
for (const data of [{ ...payload, browserCounts: undefined }, { ...payload, items: [] }]) {
  await render(<WorkflowScreen stage="votes" request={async <T,>() => data as T} />);
  assert.ok(q().getByRole('button', { name: 'Less detail' }));
  assert.ok(document.body.textContent!.includes('Missing provenance or unavailable counts mean unknown'));
  if (data.items.length) assert.ok(document.body.textContent!.includes('Browser counts unavailable'));
}
await render(<WorkflowScreen stage="feed" request={async () => { throw Error('offline'); }} />);
assert.ok(q().getAllByRole('alert').length > 0);
assert.ok(q().getByRole('button', { name: 'Less detail' }));
// Invalid preferences, cross-tab updates and optional storage.
localStorage.setItem(REALITY_LENS_KEY, 'invalid');
await render(<RealityLens />);
assert.ok(q().getByRole('button', { name: 'Explain data' }));
localStorage.setItem(REALITY_LENS_KEY, 'expanded');
await act(async () => dom.dispatchEvent(new dom.StorageEvent('storage', { key: REALITY_LENS_KEY })));
assert.ok(q().getByRole('button', { name: 'Less detail' }));
Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { throw Error('blocked'); } });
await render(<RealityLens />);
await toggle();
assert.ok(q().getByRole('button', { name: 'Less detail' }));
await act(async () => root!.unmount());
await dom.happyDOM.close();
console.log('Reality lens: route states, mixed/missing data, stable tallies, persistence and storage fallback passed');
