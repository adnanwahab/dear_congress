import { expect, test } from 'bun:test';
import { DEFAULT_WEIGHTS } from '../engine/engine';

test('all eight controls debounce previews, abort stale requests, and Synthesize commits', async () => {
  const { Window } = await import('happy-dom');
  const window = new Window({ url: 'http://localhost/synth' });
  const globals = { window, document: window.document, navigator: window.navigator, location: window.location, IS_REACT_ACT_ENVIRONMENT: true };
  const previous = Object.fromEntries(Object.keys(globals).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  const originalFetch = globalThis.fetch;
  for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  // Load React's event system after installing the DOM.
  const { createRoot } = await import('react-dom/client');
  const { act } = await import('react');
  const { SynthView } = await import('./App');
  const requests: { body: Record<string, unknown>; signal: AbortSignal; resolve: (response: Response) => void }[] = [];
  globalThis.fetch = ((_path: unknown, init: RequestInit) => new Promise<Response>(resolve => requests.push({ body: JSON.parse(init.body as string), signal: init.signal!, resolve }))) as typeof fetch;
  const host = document.createElement('div'); document.body.append(host);
  const root = createRoot(host);
  const settle = async (index: number, error = false) => { await act(async () => requests[index]!.resolve(Response.json(error ? { error: 'obsolete failure' } : { real: [], blended: [], diff: {} }, { status: error ? 500 : 200 }))); };
  try {
    await act(async () => root.render(<SynthView state={{ defaultWeights: DEFAULT_WEIGHTS, entries: [], proposals: [] } as any} refresh={async () => {}} />));
    expect(requests[0]!.body.preview).toBe(true);
    await settle(0);
    expect(host.textContent).toContain('Live preview · not saved');
    const sliders = [...host.querySelectorAll<HTMLInputElement>('input[type=range]')];
    expect(sliders.length).toBe(8);
    for (const slider of sliders) {
      const before = requests.length;
      await act(async () => {
        Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!.call(slider, String(Number(slider.value) + Number(slider.step)));
        slider.dispatchEvent(new window.Event('input', { bubbles: true }) as unknown as Event);
        slider.dispatchEvent(new window.Event('change', { bubbles: true }) as unknown as Event);
      });
      expect(requests.length).toBe(before);
      await act(async () => { await Bun.sleep(210); });
      expect(requests.length).toBe(before + 1);
      expect(requests.at(-1)!.body.preview).toBe(true);
    }
    expect(requests[1]!.signal.aborted).toBe(true);
    await settle(1, true);
    expect(host.textContent).not.toContain('obsolete failure');
    const commit = [...host.querySelectorAll('button')].find(button => button.textContent === 'Synthesize')!;
    await act(async () => commit.click());
    expect(requests.at(-1)!.body.preview).toBe(false);
    await settle(requests.length - 1);
    expect(host.textContent).not.toContain('Live preview · not saved');
    await settle(requests.length - 2);
    expect(host.textContent).not.toContain('Live preview · not saved');
  } finally {
    await act(async () => root.unmount()); host.remove(); globalThis.fetch = originalFetch;
    for (const key of Object.keys(globals)) { if (previous[key]) Object.defineProperty(globalThis, key, previous[key]!); else Reflect.deleteProperty(globalThis, key); }
    await window.happyDOM.close();
  }
});
