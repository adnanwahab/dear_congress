import { expect, test } from 'bun:test';
import { swipeDestination } from './stage-swipe';

test('swipes follow stage order and retain the selected proposal', () => {
  expect(swipeDestination('/feed', -100, 10, 'a&b')).toBe('/votes?proposal=a%26b');
  expect(swipeDestination('/vote', 100, 10, 'a&b')).toBe('/feed?proposal=a%26b');
  expect(swipeDestination('/sponsors/', -80, 0, null)).toBe('/outcomes');
});
test('short, vertical, unrelated and boundary gestures do not navigate', () => {
  for (const [path, x, y] of [['/feed', -59, 0], ['/feed', -80, 60], ['/map', -100, 0], ['/published', 100, 0], ['/outcomes', -100, 0]] as const) {
    expect(swipeDestination(path, x, y, null)).toBeNull();
  }
});

test('pointer gestures leave maps, controls, horizontal scrollers, and cancellation alone', async () => {
  const { Window } = await import('happy-dom');
  const { installStageSwipe } = await import('./stage-swipe');
  const dom = new Window({ url: 'https://example.test/feed?proposal=selected' });
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'Element');
  Object.defineProperty(globalThis, 'Element', { configurable: true, value: dom.Element });
  const handlers: Record<string, (event: any) => void> = {};
  const destinations: string[] = [];
  const target = {
    document: dom.document, matchMedia: () => ({ matches: true }),
    getComputedStyle: dom.getComputedStyle.bind(dom),
    location: { pathname: '/feed', search: '?proposal=selected', assign: (href: string) => destinations.push(href) },
    addEventListener: (type: string, listener: any) => { handlers[type] = listener; },
  };
  try {
    installStageSwipe(target as unknown as Window);
    dom.document.body.innerHTML = '<main class="workflow-main"><p>Safe surface</p><button>Vote</button><div class="maplibregl-map"><canvas></canvas></div><div style="overflow-x:auto"><table><tr><td>Wide table</td></tr></table></div></main>';
    const scroller = dom.document.querySelector('div[style]')!;
    Object.defineProperties(scroller, { scrollWidth: { value: 800 }, clientWidth: { value: 300 } });
    const gesture = (selector: string, cancel = false) => {
      handlers.pointerdown!({ target: dom.document.querySelector(selector), pointerId: 1, pointerType: 'touch', isPrimary: true, clientX: 250, clientY: 100 });
      if (cancel) handlers.pointercancel!({});
      handlers.pointerup!({ pointerId: 1, clientX: 100, clientY: 105 });
    };
    gesture('button'); gesture('canvas'); gesture('td'); gesture('p', true);
    expect(destinations).toEqual([]);
    gesture('p');
    expect(destinations).toEqual(['/votes?proposal=selected']);
  } finally {
    if (previous) Object.defineProperty(globalThis, 'Element', previous);
    else Reflect.deleteProperty(globalThis, 'Element');
    await dom.happyDOM.close();
  }
});
