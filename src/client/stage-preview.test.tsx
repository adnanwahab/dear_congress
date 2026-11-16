import { test, expect } from 'bun:test';
import { stageSummary } from './stage-preview-data';
import { renderToStaticMarkup } from 'react-dom/server';
import { StagePreview } from './StagePreview';

test('preview only admits authored chapter routes, never arbitrary destinations', () => {
  expect(stageSummary('/votes').title).toBe('Votes');
  for (const route of ['https://example.com', '/api/votes', '/votes?proposal=other', '<script>']) {
    expect(() => stageSummary(route)).toThrow('Unknown stage');
  }
});
test('idle preview renders original scoped link and no destination content or eager load', () => {
  let loads = 0;
  const html = renderToStaticMarkup(<StagePreview route="/votes" title="Votes" load={async () => { loads++; throw new Error('offline'); }}>
    <a href="/votes?proposal=source%3Arevision">Votes</a>
  </StagePreview>);
  expect(loads).toBe(0);
  expect(html).toContain('href="/votes?proposal=source%3Arevision"');
  expect(html).toContain('Preview Votes');
  expect(html).not.toContain('stage-peek-window');
});

test('focus loads safely, Escape cancels stale results, and errors leave navigation intact', async () => {
  const { Window } = await import('happy-dom');
  const { createRoot } = await import('react-dom/client');
  const { act } = await import('react');
  const win = new Window();
  const globals = { window: win, document: win.document, IS_REACT_ACT_ENVIRONMENT: true };
  const previous = Object.fromEntries(Object.keys(globals).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { configurable: true, value });
  const host = document.createElement('div'); document.body.append(host);
  const root = createRoot(host);
  let resolve!: (summary: ReturnType<typeof stageSummary>) => void;
  try {
    await act(async () => root.render(<StagePreview route="/votes" title="Votes" load={() => new Promise(done => { resolve = done; })}><a href="/votes?proposal=original">Votes</a></StagePreview>));
    await act(async () => host.querySelector('a')!.focus());
    expect(host.textContent).toContain('Loading destination summary');
    await act(async () => resolve({ ...stageSummary('/votes'), heading: '<script>unsafe</script>' }));
    expect(host.querySelector('script')).toBeNull();
    expect(host.textContent).toContain('<script>unsafe</script>');
    await act(async () => host.querySelector('a')!.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }) as unknown as Event));
    expect(host.querySelector('.stage-peek-window')).toBeNull();
    await act(async () => { host.querySelector('a')!.blur(); host.querySelector('a')!.focus(); });
    await act(async () => host.querySelector('a')!.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }) as unknown as Event));
    await act(async () => resolve(stageSummary('/votes')));
    expect(host.querySelector('.stage-peek-window')).toBeNull();
    await act(async () => root.render(<StagePreview key="failed" route="/votes" title="Votes" load={async () => { throw new Error('offline'); }}><a href="/votes?proposal=original">Votes</a></StagePreview>));
    await act(async () => host.querySelector('a')!.focus());
    expect(host.textContent).toContain('Preview unavailable');
    expect(host.querySelector('a')!.getAttribute('href')).toBe('/votes?proposal=original');
  } finally {
    await act(async () => root.unmount());
    for (const [key, descriptor] of Object.entries(previous)) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key); }
    await win.happyDOM.close();
  }
});
