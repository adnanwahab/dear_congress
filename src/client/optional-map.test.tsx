import { expect, test } from 'bun:test';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { Window } from 'happy-dom';
import { NeedsGeoMap, JurisdictionMap, NeedsView } from './App';
import { mapAttempt } from './optional-map';

for (const View of [NeedsGeoMap, JurisdictionMap]) {
  test(`${View.name}: missing, configured, invalid tiles, retry and cleanup`, async () => {
    const window = new Window({ width: 320 });
    const globals = { window, document: window.document, IS_REACT_ACT_ENVIRONMENT: true };
    const saved = Object.fromEntries(Object.keys(globals).map(k => [k, Object.getOwnPropertyDescriptor(globalThis, k)]));
    for (const [k, value] of Object.entries(globals)) Object.defineProperty(globalThis, k, { configurable: true, value });
    const host = document.createElement('div');
    const root = createRoot(host);
    const instances: any[] = [];
    class FakeMap {
      handlers: Record<string, () => void> = {};
      sources: Record<string, any> = {};
      removed = false;
      constructor() { instances.push(this); }
      on(event: string, cb: () => void) { this.handlers[event] = cb; }
      addControl() {}
      addLayer() {}
      addSource(id: string, source: any) { this.sources[id] = { ...source, setData(data: any) { this.data = data; } }; }
      getSource(id: string) { return this.sources[id]; }
      remove() { this.removed = true; }
    }
    const loadMap = (async () => ({ Map: FakeMap, NavigationControl: class {} })) as any;
    const props = { cells: [{ lat: 29, lng: -95, real: { count: 3, perNeed: [] }, simulated: { count: 0, perNeed: [] } }], mode: 'real', needFilter: 'all', needs: [], pushingCells: [] } as any;
    try {
      await act(async () => root.render(<View {...props} loadMap={loadMap} />));
      expect(host.textContent).toContain('Map visualization unavailable; explore needs below.');
      expect(instances).toHaveLength(0);
      await act(async () => root.render(<View {...props} styleUrl="https://tiles.invalid/style.json?token=SECRET" loadMap={loadMap} />));
      const map = instances[0];
      await act(async () => { map.handlers.load(); map.handlers.idle(); });
      expect(host.textContent).toContain('Map visualization available.');
      if (View === NeedsGeoMap) expect(map.sources.cells.data.features).toHaveLength(1);
      await act(async () => map.handlers.error({ error: new Error('MAP_STYLE_URL token=SECRET') }));
      expect(map.removed).toBe(true);
      expect(host.querySelector('[data-no-stage-swipe]')!.hasAttribute('hidden')).toBe(true);
      expect(host.innerHTML).not.toMatch(/MAP_STYLE_URL|SECRET|tiles.invalid/);
      await act(async () => (host.querySelector('button') as HTMLButtonElement).click());
      expect(instances).toHaveLength(2);
      expect(host.textContent).toContain('loading');
      await act(async () => { instances[1].handlers.load(); instances[1].handlers.idle(); });
      expect(host.textContent).toContain('Map visualization available.');
      let timedOut: (() => void) | undefined;
      const originalTimer = globalThis.setTimeout;
      globalThis.setTimeout = ((cb: () => void, ms: number) => {
        if (ms === 10_000) { timedOut = cb; return originalTimer(() => {}, 0); }
        return originalTimer(cb, ms);
      }) as typeof setTimeout;
      try {
        await act(async () => root.render(<View key="slow" {...props} styleUrl="https://tiles.invalid/slow" loadMap={loadMap} />));
      } finally { globalThis.setTimeout = originalTimer; }
      expect(timedOut).toBeDefined();
      await act(async () => timedOut!());
      expect(instances.at(-1).removed).toBe(true);
      expect(host.textContent).toContain('unavailable');
      await act(async () => instances.at(-1).handlers.idle());
      expect(host.textContent).toContain('unavailable');
      await act(async () => root.render(<View key="rejected" {...props} styleUrl="bad-url" loadMap={async () => { throw new Error('SECRET'); }} />));
      expect(host.textContent).toContain('unavailable');
      expect(host.innerHTML).not.toContain('SECRET');
    } finally {
      await act(async () => root.unmount());
      if (instances.length) expect(instances.at(-1)?.removed).toBe(true);
      for (const k of Object.keys(globals)) { if (saved[k]) Object.defineProperty(globalThis, k, saved[k]!); else Reflect.deleteProperty(globalThis, k); }
      await window.happyDOM.close();
    }
  });
}

test('slow tiles time out; late completion cannot overwrite fallback; disposed attempts stay silent', async () => {
  const statuses: string[] = [];
  const attempt = mapAttempt(s => statuses.push(s), 5);
  await new Promise(resolve => setTimeout(resolve, 15));
  attempt.ready();
  expect(attempt.active).toBe(false);
  expect(statuses).toEqual(['unavailable']);
  const disposed = mapAttempt(s => statuses.push(s), 5);
  disposed.dispose();
  await new Promise(resolve => setTimeout(resolve, 15));
  disposed.fail('resource');
  expect(statuses).toEqual(['unavailable']);
});

test('rankings and jurisdiction alternatives remain text without a map', () => {
  const need = { id: 'housing', label: 'Housing', value: 'Security', goal: 'Homes', metric: 'Rent' };
  const demand = { housing: { demand: .8, mentions: 3, urgency: .7, points: 0 } };
  const state = { needs: [need], entries: [], proposals: [], stats: {}, demand, changeLevels: [] } as any;
  const html = renderToStaticMarkup(<NeedsView state={state} focusNeedId={null} />);
  expect(html).toContain('Shared needs');
  expect(html).toContain('Housing');
  expect(html).toContain('Constituent priorities by jurisdiction');
  for (const place of ['Houston', 'Harris County', 'Texas', 'United States']) expect(html).toContain(place);
  expect(html).toContain('Real voices');
  expect(html).toContain('Simulated residents');
  expect(html).not.toContain('MAP_STYLE_URL');
});
