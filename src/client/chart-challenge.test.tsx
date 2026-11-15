import { expect, test } from 'bun:test';
import { Window } from 'happy-dom';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { ChartChallenge } from './ChartChallenge';

test('challenge reveals all fictional data, allows mistakes, skip/restart/exit, and never writes', async () => {
  const dom = new Window({ url: 'https://example.test/bills' });
  const globals = { window: dom, document: dom.document, IS_REACT_ACT_ENVIRONMENT: true };
  const previous = Object.fromEntries(Object.keys(globals).map(k => [k, Object.getOwnPropertyDescriptor(globalThis, k)]));
  for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { configurable: true, value });
  const container = dom.document.createElement('div'); dom.document.body.append(container);
  const root = createRoot(container as unknown as HTMLElement);
  let starts = 0;
  const click = async (name: string) => act(async () => { const b = [...container.querySelectorAll('button')].find(b => b.textContent === name); expect(b).toBeDefined(); b!.click(); });
  try {
    await act(async () => root.render(<ChartChallenge onStart={() => starts++} />));
    expect(container.querySelector('table')).toBeNull();
    await click('Catch the misleading chart · Play (optional)');
    expect(starts).toBe(1);
    expect(container.querySelector('h2') === dom.document.activeElement).toBe(true);
    expect(container.textContent).toContain('Fictional / hypothetical');
    expect(container.querySelector('details')!.textContent).toContain('20 percentage points');
    for (const [index, text] of ['+10 (10%)', '80%', '50%'].entries()) {
      await click(index === 0 ? 'Selection bias' : 'Reveal explanation');
      expect(container.querySelector('table')!.textContent).toContain(text);
      expect(container.querySelector('[role="status"]')!.textContent).toContain(index === 0 ? 'Another framing issue' : index === 1 ? 'Denominator shift' : 'Selection bias');
      expect(container.querySelectorAll('[role="img"]')).toHaveLength(2);
      await click('Next scene');
    }
    expect(container.querySelector('h2')!.textContent).toBe('Challenge complete');
    await click('Restart');
    expect(container.querySelector('h2')!.textContent).toContain('1 / 3');
    expect(container.querySelector('table')).toBeNull();
    await click('Skip scene');
    expect(container.querySelector('h2')!.textContent).toContain('2 / 3');
    await click('Exit challenge');
    expect(container.querySelectorAll('button')).toHaveLength(1);
    expect(dom.document.activeElement === container.querySelector('button')).toBe(true);
    expect(dom.localStorage.length).toBe(0); expect(dom.sessionStorage.length).toBe(0);
  } finally {
    await act(async () => root.unmount()); await dom.happyDOM.close();
    for (const [key, descriptor] of Object.entries(previous)) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key); }
  }
});
