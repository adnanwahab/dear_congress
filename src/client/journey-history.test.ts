import { expect, test } from 'bun:test';
import { Window as DOMWindow } from 'happy-dom';
import { installJourneyHistory, readJourney, restoreJourney, writeJourney, type JourneyEntry } from './journey-history';
const entry = (): JourneyEntry => ({ version: 1, stage: '/feed', direction: null, proposal: 'sample-crossings', filters: { query: 'crossings', topic: 'All topics', outcomes: 'All outcomes', jurisdiction: '' }, scroll: [0, 400], focus: null });

test('entry-local presentation preserves unrelated history and rejects foreign or malformed state', async () => {
  const dom = new DOMWindow({ url: 'https://example.test/feed' });
  const target = dom as unknown as Window;
  try {
    dom.history.replaceState({ other: 'preserve' }, '');
    writeJourney(entry(), target);
    expect(readJourney(target)).toEqual(entry());
    expect((dom.history.state as { other: string }).other).toBe('preserve');
    dom.history.replaceState({ civicJourney: { ...entry(), stage: '/votes' } }, '');
    expect(readJourney(target)).toBeNull();
    dom.history.replaceState({ civicJourney: { ...entry(), scroll: [NaN, 0] } }, '');
    expect(readJourney(target)).toBeNull();
  } finally { await dom.happyDOM.close(); }
});

test('native departure/restoration preserves scroll, keyboard focus and filters without activating a control', async () => {
  const dom = new DOMWindow({ url: 'https://example.test/feed' });
  const target = dom as unknown as Window;
  try {
    dom.document.body.innerHTML = '<header><nav aria-label="Main navigation"><a href="/votes">Votes</a></nav></header><main id="main-content" tabindex="-1"><input type="search"><button>Advisory choice</button></main>';
    let votes = 0;
    dom.document.querySelector('button')!.onclick = () => { votes++; };
    writeJourney(entry(), target);
    installJourneyHistory(target);
    dom.document.querySelector('button')!.focus();
    dom.scrollTo({ top: 280 });
    dom.dispatchEvent(new dom.Event('pagehide'));
    expect(readJourney(target)?.scroll).toEqual([0, 280]);
    dom.document.querySelector('input')!.focus();
    restoreJourney(target);
    expect(dom.document.activeElement?.tagName).toBe('BUTTON');
    expect(readJourney(target)?.filters.query).toBe('crossings');
    expect(votes).toBe(0);
    dom.document.querySelector('button')!.remove();
    restoreJourney(target);
    expect(dom.document.activeElement?.id).toBe('main-content');
    const navigationLink = dom.document.querySelector('a')!;
    navigationLink.focus();
    dom.dispatchEvent(new dom.Event('pagehide'));
    expect(readJourney(target)?.focus).toContain('nav[aria-label="Main navigation"]');
    dom.document.querySelector('input')!.focus();
    restoreJourney(target);
    expect(dom.document.activeElement).toBe(navigationLink);
    expect(votes).toBe(0);
  } finally { await dom.happyDOM.close(); }
});

test('blocked state writes leave native navigation available', () => {
  const target = { history: { state: {}, replaceState() { throw new Error('blocked'); } } } as unknown as Window;
  expect(() => writeJourney(entry(), target)).not.toThrow();
});


test('deferred BFCache restoration does not steal a new keyboard target', async () => {
  const dom = new DOMWindow({ url: 'https://example.test/feed' });
  const target = dom as unknown as Window;
  try {
    dom.document.body.innerHTML = '<nav aria-label="Main navigation"><a href="/votes">Votes</a></nav><main id="main-content" tabindex="-1"><button>Restored</button></main>';
    writeJourney({ ...entry(), focus: '#main-content > button:nth-of-type(1)' }, target);
    let frame: FrameRequestCallback | undefined;
    target.requestAnimationFrame = callback => { frame = callback; return 1; };
    installJourneyHistory(target);
    const pageshow = new dom.Event('pageshow');
    Object.defineProperty(pageshow, 'persisted', { value: true });
    dom.dispatchEvent(pageshow);
    const link = dom.document.querySelector('a')!;
    link.focus();
    expect(frame).toBeDefined();
    frame?.(0);
    expect(dom.document.activeElement).toBe(link);
  } finally { await dom.happyDOM.close(); }
});


test('deferred BFCache restoration respects focus claimed before pageshow', async () => {
  const dom = new DOMWindow({ url: 'https://example.test/feed' });
  const target = dom as unknown as Window;
  try {
    dom.document.body.innerHTML = '<main id="main-content" tabindex="-1"><button id="saved">Saved target</button><button id="new">Visitor target</button></main>';
    writeJourney({ ...entry(), focus: '#saved' }, target);
    let frame: FrameRequestCallback | undefined;
    target.requestAnimationFrame = callback => { frame = callback; return 1; };
    installJourneyHistory(target);
    const visitor = dom.document.querySelectorAll('button')[1]!;
    visitor.focus();
    const event = new dom.Event('pageshow');
    Object.defineProperty(event, 'persisted', { value: true });
    dom.dispatchEvent(event);
    frame?.(0);
    expect(dom.document.activeElement).toBe(visitor);
  } finally { await dom.happyDOM.close(); }
});
