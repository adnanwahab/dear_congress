import { test, expect } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import Presenter from './Presenter';
import { CIVIC_STAGES } from '../shared/civic-stages';

test('all presenter chapters retain selection and source scope with separate exit', () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'window');
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { location: { search: '?presenter=1&proposal=demo-shade&topic=climate' } } });
  try {
    for (const stage of ['published', 'feed', 'votes', 'draft', 'sponsors', 'outcomes'] as const) {
      const html = renderToStaticMarkup(<Presenter stage={stage} />);
      expect(html).toContain('Synthetic demonstration');
      expect(html).toContain('proposal=demo-shade');
      expect(html).toContain('topic=climate');
      expect(html).toContain('Exit presentation');
      expect(html).not.toContain('autoFocus');
      expect(html).not.toContain('Support</button>');
      expect(html).toContain(`Slide ${CIVIC_STAGES.findIndex(s => s.route === `/${stage}`) + 1} of 6`);
    }
  } finally { if (previous) Object.defineProperty(globalThis, 'window', previous); else Reflect.deleteProperty(globalThis, 'window'); }
});

test('presenter recovers from read failure and fullscreen denial; blackout remains reversible', async () => {
  const { Window } = await import('happy-dom');
  const { act } = await import('react');
  const { createRoot } = await import('react-dom/client');
  const { demoPayload } = await import('../engine/demo');
  const dom = new Window({ url: 'http://localhost/feed?presenter=1' });
  const calls: string[] = [];
  let fail = true;
  const globals = { window: dom, document: dom.document, IS_REACT_ACT_ENVIRONMENT: true,
    fetch: async (url: string) => { calls.push(url); return { ok: !fail, json: async () => demoPayload({}, 'test') }; } };
  const previous = Object.fromEntries(Object.keys(globals).map(k => [k, Object.getOwnPropertyDescriptor(globalThis, k)]));
  for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { configurable: true, value });
  document.body.innerHTML = '<div id="root"></div>';
  const root = createRoot(document.getElementById('root')!);
  const button = (name: string) => [...document.querySelectorAll('button')].find(b => b.textContent === name)!;
  try {
    await act(async () => root.render(<Presenter stage="feed" />));
    expect(document.querySelector('[role=alert]')?.textContent).toContain('Sample proposals unavailable');
    fail = false;
    await act(async () => button('Retry').click());
    expect(document.querySelector('h3')?.textContent).toBe(demoPayload({}, 'test').items[0]!.title);
    await act(async () => button('Blackout').click());
    expect(document.querySelector('.presenter-screen > div')?.hasAttribute('hidden')).toBe(true);
    await act(async () => button('Reveal slide').click());
    expect(document.querySelector('.presenter-screen > div')?.hasAttribute('hidden')).toBe(false);
    await act(async () => button('Fullscreen').click());
    expect(document.querySelector('[role=alert]')?.textContent).toContain('Fullscreen unavailable');
    expect(calls).toEqual(['/api/demo', '/api/demo']);
  } finally {
    await act(async () => root.unmount());
    await dom.happyDOM.close();
    for (const [key, descriptor] of Object.entries(previous)) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key); }
  }
});
