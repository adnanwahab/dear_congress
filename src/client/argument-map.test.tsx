import { expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { DEMO_ITEMS, demoPayload } from '../engine/demo';
import { ArgumentMap, PILOT_TEXT } from './ArgumentMap';
const item = DEMO_ITEMS.find(item => item.id === 'demo-transit')!;
test('paired fictional trees disclose every unsupported claim and exact clause', () => {
  const html = renderToStaticMarkup(<ArgumentMap item={item} />);
  expect(item.proposedText).toBe(PILOT_TEXT);
  expect(html.match(/unverified assertion/g)).toHaveLength(6);
  expect(html.match(/class="argument-card"/g)).toHaveLength(4);
  expect(html.match(/Claim source:/g)).toHaveLength(4);
  expect(html.match(/Why this matters/g)).toHaveLength(4);
  expect(html.match(/Evidence strength: unassessed/g)).toHaveLength(4);
  expect(html.indexOf('Reasons for')).toBeLessThan(html.indexOf('Concerns'));
  expect(html.match(/What would change my mind/g)).toHaveLength(2);
  expect(html).toContain('not been reviewed as the strongest');
  expect(html).toContain(PILOT_TEXT);
});
test('unknown scope, same ID in another namespace and stale text fail closed', () => {
  for (const props of [ { item: { ...item, proposedText: `${PILOT_TEXT} Changed.` } }, { item: { ...item, id: 'citizen-transit' } }, { item, namespace: 'repository-pr' } ]) {
    const html = renderToStaticMarkup(<ArgumentMap {...props} />);
    expect(html).toContain('No reviewed arguments yet');
    expect(html).not.toContain('More frequent evening');
  }
});
test('rendering never changes proposal fixtures or browser advisory totals', () => {
  const votes = { browser: { 'demo-transit': { stance: -1 } } };
  const before = JSON.stringify({ votes, items: DEMO_ITEMS, payload: demoPayload(votes, 'browser') });
  renderToStaticMarkup(<ArgumentMap item={item} />);
  expect(JSON.stringify({ votes, items: DEMO_ITEMS, payload: demoPayload(votes, 'browser') })).toBe(before);
});

test('personal moves, drag boundaries, reset and revision changes preserve sources and votes', async () => {
  const { Window } = await import('happy-dom');
  const { createRoot } = await import('react-dom/client');
  const { act } = await import('react');
  const win = new Window({ url: 'http://localhost/votes?proposal=demo-transit', width: 390 });
  const globals = { window: win, document: win.document, navigator: win.navigator, IS_REACT_ACT_ENVIRONMENT: true };
  const old = Object.fromEntries(Object.keys(globals).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  const host = document.createElement('div'); document.body.append(host);
  const root = createRoot(host);
  const before = JSON.stringify(DEMO_ITEMS);
  const click = async (label: string) => { await act(async () => host.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)!.click()); };
  const titles = () => Array.from(host.querySelectorAll('.argument-map-sides h5')).map(node => node.textContent);
  try {
    await act(async () => root.render(<ArgumentMap item={item} />));
    expect(host.querySelectorAll('.argument-map-sides summary').length).toBe(4);
    expect(host.querySelector('details > summary')?.textContent).toContain('Read the proposal clause');
    expect(host.querySelectorAll('.argument-card')).toHaveLength(4);
    await click('Move Reasons for claim down');
    expect(titles()).toEqual(['Counterargument', 'Lead claim', 'Lead claim', 'Counterargument']);
    expect(host.querySelector('[aria-live="polite"]')!.textContent).toContain('Personal reading order only');
    // Focus stays on the same keyed card control after moving.
    const button = host.querySelector<HTMLButtonElement>('button[aria-label="Move Reasons for claim up"]')!;
    button.focus();
    await act(async () => button.click());
    expect(document.activeElement).toBe(button);
    expect(titles()[0]).toBe('Lead claim');
    const handles = host.querySelectorAll('.argument-drag');
    const cards = host.querySelectorAll('.argument-card');
    const fireDrag = async (node: Element, type: string) => {
      const event = new win.Event(type, { bubbles: true, cancelable: true });
      Object.defineProperty(event, 'dataTransfer', { value: { effectAllowed: '', setData() {} } });
      await act(async () => { node.dispatchEvent(event as unknown as Event); });
    };
    await fireDrag(handles[0]!, 'dragstart');
    await fireDrag(cards[3]!, 'drop'); // Never change side or another map.
    expect(titles()[0]).toBe('Lead claim');
    await fireDrag(handles[0]!, 'dragstart');
    await fireDrag(cards[1]!, 'drop');
    expect(titles()[0]).toBe('Counterargument');
    await act(async () => host.querySelector<HTMLButtonElement>('button')!.click());
    expect(titles()[0]).toBe('Lead claim');
    await click('Move Reasons for claim down');
    await act(async () => root.render(<ArgumentMap item={{ ...item, proposedText: 'changed' }} />));
    expect(host.textContent).toContain('No reviewed arguments yet');
    await act(async () => root.render(<ArgumentMap item={item} />));
    expect(titles()[0]).toBe('Lead claim');
    expect(JSON.stringify(DEMO_ITEMS)).toBe(before);
    expect(win.localStorage.length).toBe(0);
    expect(win.sessionStorage.length).toBe(0);
  } finally {
    await act(async () => root.unmount());
    for (const key of Object.keys(globals)) { if (old[key]) Object.defineProperty(globalThis, key, old[key]!); else Reflect.deleteProperty(globalThis, key); }
    await win.happyDOM.close();
  }
});
