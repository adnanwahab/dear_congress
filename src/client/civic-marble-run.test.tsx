import { expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { CivicMarbleRun, marblePath } from './CivicMarbleRun';
import type { DemoItem } from '../engine/demo';

test('invented constraints stop at distinct institutional gates', () => {
  expect(marblePath('clear')).toEqual([0, 1, 2, 3, 4, 8]);
  expect(marblePath('review')).toEqual([0, 1, 5]);
  expect(marblePath('votes')).toEqual([0, 1, 2, 6]);
  expect(marblePath('capacity')).toEqual([0, 1, 2, 3, 4, 7]);
});
test('sandbox retains static alternatives, source identity and separate status links before playback', () => {
  const item = { id: 'sample&one', title: 'Fictional crossing', jurisdiction: 'City', sourceUrl: 'https://example.org/background', background: { publisher: 'Example', name: 'Background' } } as DemoItem;
  const html = renderToStaticMarkup(<CivicMarbleRun item={item} />);
  for (const text of ['Educational sandbox', 'Static decision diagram', 'Revise draft', 'Proposal stalls', 'Delivery waits', 'Reduced motion uses manual steps', 'not vote counts', 'role="status"', 'https://www.congress.gov/legislative-process', '/published?proposal=sample%26one']) expect(html).toContain(text);
  expect(html).toContain('Previous stage</button>');
  expect(html).toContain('https://example.org/background');
});

test('manual motion-off controls traverse, branch, reset and clean up without network', async () => {
  const { Window } = await import('happy-dom');
  const { act } = await import('react');
  const { createRoot } = await import('react-dom/client');
  const dom = new Window();
  const globals = { window: dom, document: dom.document, IS_REACT_ACT_ENVIRONMENT: true };
  const previous = Object.fromEntries(Object.keys(globals).map(k => [k, Object.getOwnPropertyDescriptor(globalThis, k)]));
  for (const [k, value] of Object.entries(globals)) Object.defineProperty(globalThis, k, { configurable: true, value });
  document.documentElement.dataset.motion = 'off';
  const host = document.createElement('div'); document.body.append(host);
  const root = createRoot(host);
  // Target only the marble controls: the provenance panel also offers buttons.
  const click = async (index: number) => act(async () => { (host.querySelectorAll('.marble-controls button')[index] as HTMLButtonElement).click(); });
  try {
    await act(async () => root.render(<CivicMarbleRun item={{ id: 'sample', title: 'Sample' } as DemoItem} />));
    await click(0);
    expect(host.querySelector('[role=status]')!.textContent).toContain('Committee review');
    await act(async () => { const select = host.querySelector('select')!; select.value = 'review'; select.dispatchEvent(new dom.Event('change', { bubbles: true }) as any); });
    expect(host.querySelector('[role=status]')!.textContent).toContain('Step 1');
    await click(2); await click(2);
    expect(host.querySelector('[role=status]')!.textContent).toContain('Revise draft');
    expect((host.querySelectorAll('.marble-controls button')[2] as HTMLButtonElement).disabled).toBe(true);
    await click(1); expect(host.querySelector('[role=status]')!.textContent).toContain('Committee review');
    await click(3); expect(host.querySelector('[role=status]')!.textContent).toContain('Step 1');
  } finally {
    await act(async () => root.unmount()); await dom.happyDOM.close();
    for (const [key, descriptor] of Object.entries(previous)) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key); }
  }
});
