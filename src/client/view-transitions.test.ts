import { describe, expect, test } from 'bun:test';
import { installViewTransitions, transitionDirection } from './view-transitions';
function eventTarget() {
  const listeners = new Map<string, (event: Event) => void>();
  return {
    addEventListener(name: string, handler: (event: Event) => void) { listeners.set(name, handler); },
    dispatchEvent(event: Event) { listeners.get(event.type)?.(event); return true; },
  };
}
const url = (path: string) => `https://example.test${path}`;
describe('stage navigation motion', () => {
  test('stage order, aliases, query strings and utility fallback', () => {
    expect(transitionDirection(url('/feed'), url('/votes?proposal=one'))).toBe('forward');
    expect(transitionDirection(url('/votes'), url('/draft'))).toBe('forward');
    expect(transitionDirection(url('/draft'), url('/vote/'))).toBe('backward');
    expect(transitionDirection(url('/votes'), url('/votes?proposal=two'))).toBeNull();
    expect(transitionDirection(url('/map'), url('/feed'))).toBeNull();
    expect(transitionDirection(url('/feed'), 'https://other.test/draft')).toBeNull();
  });
  test('both lifecycle events and unsupported APIs are safe', () => {
    const target = eventTarget();
    installViewTransitions(target as unknown as Window);
    target.dispatchEvent(new Event('pagereveal'));
    for (const name of ['pageswap', 'pagereveal']) {
      const types = new Set(['backward']);
      const event = Object.assign(new Event(name), {
        viewTransition: { types },
        activation: { from: { url: url('/feed') }, entry: { url: url('/votes') } },
      });
      target.dispatchEvent(event);
      expect([...types]).toEqual(['forward']);
    }
  });
  test('incoming activation handles history and clears stale direction', () => {
    const target = Object.assign(eventTarget(), { navigation: { activation: {
      from: { url: url('/draft') }, entry: { url: url('/feed') },
    } } });
    installViewTransitions(target as unknown as Window);
    const types = new Set(['forward']);
    target.dispatchEvent(Object.assign(new Event('pagereveal'), { viewTransition: { types } }));
    expect([...types]).toEqual(['backward']);
    target.navigation.activation.entry.url = url('/map');
    target.dispatchEvent(Object.assign(new Event('pagereveal'), { viewTransition: { types } }));
    expect(types.size).toBe(0);
  });
});

test('journey morph names only ordinary navigation and clears on BFCache restore', async () => {
  const { prepareStageMorph } = await import('./view-transitions');
  const card = { style: { viewTransitionName: '' } };
  let restore: (() => void) | undefined;
  const link = {
    closest: () => card,
    ownerDocument: { defaultView: { addEventListener(name: string, callback: () => void) {
      expect(name).toBe('pageshow'); restore = callback;
    } } },
  } as unknown as HTMLAnchorElement;
  const event = { defaultPrevented: false, button: 0, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false, currentTarget: link };
  for (const modifier of ['metaKey', 'ctrlKey', 'shiftKey', 'altKey', 'defaultPrevented']) {
    prepareStageMorph({ ...event, [modifier]: true }, 3);
    expect(card.style.viewTransitionName).toBe('');
  }
  prepareStageMorph({ ...event, button: 1 }, 3);
  expect(card.style.viewTransitionName).toBe('');
  prepareStageMorph(event, 3);
  expect(card.style.viewTransitionName).toBe('journey-stage-3');
  restore!();
  expect(card.style.viewTransitionName).toBe('');
});

test('missing or hidden navigation URLs safely omit optional transition',()=>{
 expect(transitionDirection('',url('/synth'))).toBeNull();
 expect(transitionDirection(url('/synth'),'')).toBeNull();
});

test('rapid native navigations skip obsolete visuals and focus the committed page even on snapshot failure', async () => {
  const { Window } = await import('happy-dom');
  const win = new Window({ url: url('/votes') });
  const main = win.document.createElement('main');
  main.id = 'main-content'; main.tabIndex = -1; win.document.body.append(main);
  installViewTransitions(win as unknown as Window);
  let skipped = 0;
  const transition = () => ({ types: new Set<string>(), skipTransition() { skipped++; },
    ready: Promise.reject(new Error('snapshot failed')), finished: Promise.reject(new Error('interrupted')) });
  const reveal = () => win.dispatchEvent(Object.assign(new win.Event('pagereveal'), {
    activation: { from: { url: url('/feed') }, entry: { url: url('/votes') } }, viewTransition: transition(),
  }));
  reveal();
  expect(win.document.activeElement).toBe(main);
  const a = win.document.createElement('a'); a.href = '/draft'; win.document.body.append(a);
  a.dispatchEvent(new win.MouseEvent('click', { bubbles: true, button: 0 }));
  expect(skipped).toBe(1);
  reveal(); reveal();
  expect(skipped).toBe(2);
  await Promise.resolve(); await Promise.resolve();
  expect(win.location.pathname).toBe('/draft');
  await win.happyDOM.close();
});
