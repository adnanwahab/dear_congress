import { expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { DEMO_ITEMS } from '../engine/demo';
import { LocalChallenges } from './LocalChallenges';
import { JURISDICTION_KEY } from './JurisdictionPicker';

test('discovery states keep examples, provenance and participation limits explicit', () => {
  const render = (items = DEMO_ITEMS, loading = false, failed = false) => renderToStaticMarkup(<LocalChallenges items={items} loading={loading} failed={failed} />);
  const html = render();
  expect(html).toContain('No verified local challenge feed');
  expect(html).toContain('not residency verification or voting eligibility');
  expect(html).toContain('Discussion prompt:');
  expect(html).toContain('Background only;');
  expect(html).toContain('/feed?proposal=demo-housing');
  expect(render([], true)).toContain('Loading policy examples');
  expect(render([], false, true)).toContain('Could not refresh policy examples');
  expect(render([])).toContain('No examples match this scope');
});

test('locality and category changes preserve source identity and never request writes', async () => {
  const { Window } = await import('happy-dom');
  const { createRoot } = await import('react-dom/client');
  const { act } = await import('react');
  const window = new Window({ url: 'http://localhost/' });
  const globals = { window, document: window.document, navigator: window.navigator, localStorage: window.localStorage, IS_REACT_ACT_ENVIRONMENT: true };
  const previous = Object.fromEntries(Object.keys(globals).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  const host = document.createElement('div'); document.body.append(host);
  const root = createRoot(host);
  const before = JSON.stringify(DEMO_ITEMS);
  try {
    await act(async () => root.render(<LocalChallenges items={DEMO_ITEMS} loading={false} failed={false} />));
    const choose = async (selector: string, value: string) => act(async () => { const select = host.querySelector(selector) as HTMLSelectElement; select.value = value; select.dispatchEvent(new window.Event('change', { bubbles: true }) as unknown as Event); });
    await choose('.jurisdiction-picker select', 'Houston');
    expect(localStorage.getItem(JURISDICTION_KEY)).toBe('Houston');
    expect(host.querySelector('a[href="/feed?proposal=demo-transit"]')).toBeNull();
    expect(host.querySelector('a[href="/feed?proposal=demo-streets"]')).not.toBeNull();
    await choose('.local-category select', 'Small business');
    expect(host.querySelectorAll('li')).toHaveLength(1);
    expect(host.textContent).toContain('permit checklist');
    await choose('.jurisdiction-picker select', 'Texas');
    expect(host.querySelectorAll('li')).toHaveLength(2);
    expect(host.textContent).not.toContain('permit checklist');
    expect(host.textContent).toContain('in Texas');
    await act(async () => (host.querySelector('button') as HTMLButtonElement).click());
    expect(localStorage.getItem(JURISDICTION_KEY)).toBeNull();
    expect(host.querySelectorAll('li')).toHaveLength(DEMO_ITEMS.length);
    expect(JSON.stringify(DEMO_ITEMS)).toBe(before);
  } finally {
    await act(async () => root.unmount());
    for (const key of Object.keys(globals)) { if (previous[key]) Object.defineProperty(globalThis, key, previous[key]!); else Reflect.deleteProperty(globalThis, key); }
    await window.happyDOM.close();
  }
});
