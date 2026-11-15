import { expect, test } from 'bun:test';
import { OutcomeMetricPuzzle } from './OutcomeMetricPuzzle';

test('full metric review, skipped components, restart and exit stay in memory', async () => {
  const { Window } = await import('happy-dom');
  const { act } = await import('react');
  const { createRoot } = await import('react-dom/client');
  const dom = new Window({ url: 'http://localhost/bills' });
  const globals = { window: dom, document: dom.document, IS_REACT_ACT_ENVIRONMENT: true };
  const previous = Object.fromEntries(Object.keys(globals).map(k => [k, Object.getOwnPropertyDescriptor(globalThis, k)]));
  for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { configurable: true, value });
  const root = createRoot(document.body.appendChild(document.createElement('div')));
  const activity: boolean[] = [];
  async function click(name: string) {
    const button = Array.from(document.querySelectorAll('button')).find(b => b.textContent === name)!;
    expect(button).toBeDefined();
    await act(async () => button.click());
  }
  try {
    dom.localStorage.setItem('existing-vote', 'preserved');
    await act(async () => root.render(<OutcomeMetricPuzzle onActiveChange={v => activity.push(v)} />));
    await click('Try the metric puzzle');
    for (let step = 0; step < 5; step++) {
      expect(document.activeElement?.textContent).toContain(`${step + 1} / 5`);
      const select = document.querySelector('select')!;
      await act(async () => { select.value = String(step % 2); select.dispatchEvent(new dom.Event('change', { bubbles: true }) as any); });
      await click('Continue');
    }
    expect(document.activeElement?.textContent).toBe('Your metric review');
    expect(document.querySelectorAll('dt').length).toBe(5);
    expect(document.querySelector('dl')!.textContent).toContain('An average is practical');
    await click('Restart');
    expect(document.querySelector('select')!.value).toBe('');
    for (let i = 0; i < 5; i++) await click('Skip');
    expect(document.querySelectorAll('dd').length).toBe(5);
    expect(document.querySelector('dl')!.textContent).not.toContain('All library requests');
    await click('Exit puzzle');
    expect(document.activeElement?.textContent).toBe('Try the metric puzzle');
    await click('Try the metric puzzle');
    expect(document.querySelector('select')!.value).toBe('');
    expect(dom.localStorage.getItem('existing-vote')).toBe('preserved');
    expect(dom.localStorage.length).toBe(1);
    expect(dom.sessionStorage.length).toBe(0);
    expect(activity).toEqual([true, false, true]);
    expect(document.querySelector('details')!.textContent).toContain('failure criteria');
  } finally {
    await act(async () => root.unmount());
    await dom.happyDOM.close();
    for (const [key, descriptor] of Object.entries(previous)) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key); }
  }
});
