import { expect, test } from 'bun:test';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { Window } from 'happy-dom';
import { JourneyRibbon } from './JourneyRibbon';
import { demoPayload } from '../engine/demo';
import { stageRoute, type Stage } from '../shared/civic-stages';
const data = demoPayload({}, 'test');
const props = { stage: 'feed' as Stage, item: data.items[0]!, data, loading: false, failed: false, cards: [], route: stageRoute };

test('loading, failure and empty states do not expose stale artifacts', () => {
  for (const [override, text] of [
    [{ loading: true }, 'Loading journey artifact'],
    [{ failed: true }, 'Journey artifact unavailable'],
    [{ item: undefined }, 'No sample proposal available'],
  ] as const) {
    const html = renderToStaticMarkup(<JourneyRibbon {...props} {...override} />);
    expect(html).toContain(text);
    expect(html).not.toContain(props.item.summary);
    expect(html).toContain('Open Feed');
  }
});

test('stage taps and native range input preview without navigation, storage or requests, including reduced motion', async () => {
  const win = new Window({ url: 'http://localhost/feed?proposal=demo-housing' });
  win.matchMedia = (() => ({ matches: true })) as unknown as typeof win.matchMedia;
  const globals = { window: win, document: win.document, IS_REACT_ACT_ENVIRONMENT: true };
  const saved = Object.fromEntries(Object.keys(globals).map(k => [k, Object.getOwnPropertyDescriptor(globalThis, k)]));
  for (const [k, value] of Object.entries(globals)) Object.defineProperty(globalThis, k, { configurable: true, value });
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  try {
    await act(async () => root.render(<JourneyRibbon {...props} />));
    const expected = [props.item.background!.publisher, props.item.summary, 'Unverified browser votes', props.item.proposedText, 'Possible offices', 'No simulated outcome'];
    const buttons = [...host.querySelectorAll('button')];
    for (let i = 0; i < 6; i++) {
      await act(async () => buttons[i]!.click());
      expect(host.querySelector('[aria-live]')!.textContent).toContain(expected[i]!);
      expect(buttons[i]!.getAttribute('aria-pressed')).toBe('true');
      expect(host.querySelector('input')!.getAttribute('aria-valuetext')).toStartWith(`${i + 1} of 6`);
    }
    // Native range semantics provide browser keyboard and touch behavior; simulate its input contract.
    const range = host.querySelector('input')!;
    expect(range.type).toBe('range');
    expect(range.min).toBe('1'); expect(range.max).toBe('6'); expect(range.step).toBe('1');
    await act(async () => {
      Object.getOwnPropertyDescriptor(win.HTMLInputElement.prototype, 'value')!.set!.call(range, '4');
      range.dispatchEvent(new win.Event('input', { bubbles: true }) as unknown as Event);
    });
    expect(host.querySelector('[aria-live]')!.textContent).toContain(props.item.proposedText);
    expect(host.querySelector('a')!.getAttribute('href')).toBe('/draft?proposal=demo-housing');
    expect(win.location.href).toBe('http://localhost/feed?proposal=demo-housing');
    expect(win.localStorage.length).toBe(0); expect(win.sessionStorage.length).toBe(0);
    expect(host.querySelectorAll('a').length).toBe(1);
  } finally {
    await act(async () => root.unmount());
    host.remove();
    for (const k of Object.keys(globals)) { if (saved[k]) Object.defineProperty(globalThis, k, saved[k]!); else Reflect.deleteProperty(globalThis, k); }
    await win.happyDOM.close();
  }
});
