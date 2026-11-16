import { expect, test } from 'bun:test';
import { ADVENTURE_KEY, CHAPTERS, CivicAdventure, readAdventure } from './CivicAdventure';

test('progress validates corrupt, unavailable and stale storage', () => {
  for (const value of ['no', 'null', '{"step":5,"samples":false,"complete":false}']) {
    expect(readAdventure({ getItem: () => value }).step).toBe(0);
  }
  expect(readAdventure({ getItem: () => { throw Error(); } }).samples).toBe(false);
  expect(CHAPTERS.map(c => c.title)).toEqual(['Journal', 'Need', 'Comparison', 'Proposal', 'Future']);
});

test('offline chapters, skips, optional samples, resume and equivalent walkthrough require no participation', async () => {
  const { Window } = await import('happy-dom');
  const { act } = await import('react');
  const { createRoot } = await import('react-dom/client');
  const dom = new Window({ url: 'http://localhost/?quest=1' });
  const globals = { window: dom, document: dom.document, localStorage: dom.localStorage, IS_REACT_ACT_ENVIRONMENT: true };
  const previous = Object.fromEntries(Object.keys(globals).map(k => [k, Object.getOwnPropertyDescriptor(globalThis, k)]));
  for (const [k, v] of Object.entries(globals)) Object.defineProperty(globalThis, k, { configurable: true, value: v });
  const container = dom.document.createElement('div'); dom.document.body.append(container);
  let root = createRoot(container as unknown as HTMLElement);
  const click = async (label: string) => { const button = [...container.querySelectorAll('button')].find(b => b.textContent === label)!; expect(button).toBeDefined(); await act(async () => button.click()); };
  try {
    await act(async () => root.render(<CivicAdventure />));
    expect(container.textContent).toContain('Chapter 1 of 5');
    expect(container.querySelector('aside')).toBeNull();
    expect(container.querySelectorAll('textarea, form')).toHaveLength(0);
    await act(async () => (container.querySelector('input') as any).click());
    expect(container.textContent).toContain('Fictional journal');
    await click('Skip chapter');
    expect(dom.document.activeElement?.textContent).toContain('Chapter 2');
    await act(async () => root.unmount()); root = createRoot(container as unknown as HTMLElement);
    await act(async () => root.render(<CivicAdventure />));
    expect(container.textContent).toContain('Chapter 2 of 5');
    expect(container.querySelector('aside')).not.toBeNull();
    await click('Show non-game walkthrough');
    expect(container.querySelectorAll('main.civic-adventure > section')).toHaveLength(5);
    await click('Show chapter view');
    for (let i = 0; i < 4; i++) await click('Skip chapter');
    expect(container.textContent).toContain('You know the path');
    expect(JSON.parse(dom.localStorage.getItem(ADVENTURE_KEY)!).complete).toBe(true);
    expect(container.textContent).toContain('No particular opinion');
    await click('Restart learning');
    expect(container.textContent).toContain('Chapter 1 of 5');
    // Learning has no motion or network dependency, even with storage blocked.
    Object.defineProperty(dom, 'matchMedia', { configurable: true, value: () => ({ matches: true }) });
    Object.defineProperty(dom, 'localStorage', { configurable: true, get: () => { throw Error('blocked'); } });
    await click('Next chapter');
    expect(container.textContent).toContain('Local saving is unavailable');
    expect(container.textContent).toContain('Chapter 2 of 5');
    await click('Show non-game walkthrough');
    expect(container.querySelectorAll('main.civic-adventure > section')).toHaveLength(5);
  } finally {
    await act(async () => root.unmount()); await dom.happyDOM.close();
    for (const [k, d] of Object.entries(previous)) { if (d) Object.defineProperty(globalThis, k, d); else Reflect.deleteProperty(globalThis, k); }
  }
});
