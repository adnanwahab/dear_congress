import { expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import Playground, { SAMPLE_STATES, SampleCard } from './Playground';
import { renderPage } from '../server/pages';

test('fixture markup and accessibility contract for every sample state', () => {
  for (const sample of SAMPLE_STATES) {
    expect(renderToStaticMarkup(<SampleCard sample={sample} />)).toMatchSnapshot(sample.id);
  }
  const html = renderToStaticMarkup(<Playground />);
  expect(html).toContain('aria-live="polite"');
  expect(html).toContain('All states · static fallback');
  expect(html).not.toContain('<form');
  expect(html).not.toContain('<textarea');
  expect(renderPage('<title>App</title><div id="root"></div>', '/playground', []).status).toBe(200);
});

test('state changes preserve fixtures, use immediate fallback and never write data', async () => {
  const { Window } = await import('happy-dom');
  const { createRoot } = await import('react-dom/client');
  const { act } = await import('react');
  const win = new Window();
  const globals = { window: win, document: win.document, IS_REACT_ACT_ENVIRONMENT: true };
  const saved = Object.fromEntries(Object.keys(globals).map(k => [k, Object.getOwnPropertyDescriptor(globalThis, k)]));
  for (const [k, value] of Object.entries(globals)) Object.defineProperty(globalThis, k, { configurable: true, value });
  const host = document.createElement('div'); document.body.append(host);
  const root = createRoot(host);
  const originalFetch = globalThis.fetch;
  let requests = 0;
  globalThis.fetch = (() => { requests++; throw new Error('No requests allowed'); }) as unknown as typeof fetch;
  try {
    await act(async () => root.render(<Playground />));
    const gallery = host.querySelector('.playground-grid')!.innerHTML;
    const buttons = [...host.querySelectorAll<HTMLButtonElement>('[aria-pressed]')];
    for (const button of buttons) {
      await act(async () => button.click());
      expect(button.getAttribute('aria-pressed')).toBe('true');
      expect(host.querySelector('[role="status"] h3')!.textContent).toBe(button.textContent);
      expect(host.querySelector('.playground-grid')!.innerHTML).toBe(gallery);
    }
    const toggle = host.querySelector<HTMLInputElement>('input')!;
    await act(async () => toggle.click());
    expect(host.querySelector('[data-static="true"]')).not.toBeNull();
    // Unsupported dialog: equivalent inline content, dismiss and focus return.
    const dialog = host.querySelector('dialog')!;
    Object.defineProperty(dialog, 'showModal', { value: undefined });
    const open = [...host.querySelectorAll('button')].find(b => b.textContent === 'Open sample sheet')!;
    await act(async () => open.click());
    const fallback = host.querySelector('[aria-label="Sample sheet fallback"]')!;
    expect(fallback.textContent).toContain(SAMPLE_STATES[5].text);
    await act(async () => fallback.querySelector('button')!.click());
    expect(host.querySelector('[aria-label="Sample sheet fallback"]')).toBeNull();
    expect(document.activeElement).toBe(open);
    expect(requests).toBe(0);
    expect(win.localStorage.length).toBe(0);
    expect(win.sessionStorage.length).toBe(0);
  } finally {
    globalThis.fetch = originalFetch;
    await act(async () => root.unmount());
    for (const k of Object.keys(globals)) { if (saved[k]) Object.defineProperty(globalThis, k, saved[k]!); else Reflect.deleteProperty(globalThis, k); }
    await win.happyDOM.close();
  }
});
