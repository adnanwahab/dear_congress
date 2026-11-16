import { expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { Window } from 'happy-dom';
import { AdvisoryVoteBars } from './AdvisoryVoteBars';
import { DEMO_ITEMS } from '../engine/demo';

// Compare actual rendered controls, including their presentation, under a stance swap.
// New reward surfaces must extend this suite and the SHE-544 checklist.
for (const busy of [false, true]) test(`stance swap preserves presentation and explicit-only callbacks (busy=${busy})`, () => {
  const dom = new Window();
  try {
    const controls = [1, -1, 0].map(choice => {
      dom.document.body.innerHTML = renderToStaticMarkup(<AdvisoryVoteBars
        item={{ ...DEMO_ITEMS[0]!, support: 0, oppose: 0, unsure: 0 }} choice={choice}
        busy={busy} confirmation={0} live pulses={[0, 0, 0]}
        onVote={() => { throw Error('Reading must never vote'); }} />);
      expect(dom.document.querySelectorAll('audio,video')).toHaveLength(0);
      return [...dom.document.querySelectorAll('button')].map(button => ({
        selected: button.getAttribute('aria-pressed'), disabled: button.disabled,
        class: button.className, style: button.getAttribute('style'),
        pulse: button.querySelector('.live-pulse-marker')?.outerHTML,
        track: button.querySelector('.advisory-track')?.outerHTML,
      }));
    });
    expect(controls[0]![0]).toEqual(controls[1]![1]);
    expect(controls[1]![1]).toEqual(controls[2]![2]);
    expect(controls[0]![1]).toEqual(controls[1]![0]);
    expect(controls.flat().every(control => control.disabled === busy)).toBe(true);
  } finally { void dom.happyDOM.close(); }
});

test('acknowledged Support, Oppose and Not sure receive the same confirmation; clicks alone do not celebrate', async () => {
  const { act } = await import('react');
  const { createRoot } = await import('react-dom/client');
  const dom = new Window({ url: 'http://localhost/votes' });
  const globals = { window: dom, document: dom.document, IS_REACT_ACT_ENVIRONMENT: true };
  const previous = Object.fromEntries(Object.keys(globals).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { configurable: true, value });
  document.body.innerHTML = '<div id="root"></div>';
  const root = createRoot(document.getElementById('root')!);
  const clicks: number[] = [];
  try {
    for (const [index, choice] of [1, -1, 0].entries()) {
      const render = (confirmation: number) => <AdvisoryVoteBars key={choice} item={DEMO_ITEMS[0]!} choice={choice} busy={false} confirmation={confirmation} onVote={stance => clicks.push(stance)} />;
      await act(async () => root.render(render(0)));
      expect(document.querySelectorAll('.vote-confirmed')).toHaveLength(0);
      const skip = document.querySelector<HTMLAnchorElement>('.advisory-skip')!;
      expect(skip.getAttribute('href')).toBe(`/draft?proposal=${encodeURIComponent(DEMO_ITEMS[0]!.id)}`);
      const beforeSkip = clicks.length;
      await act(async () => skip.click());
      expect(clicks.length).toBe(beforeSkip);
      expect(document.querySelectorAll('[aria-pressed="true"]')).toHaveLength(1);
      await act(async () => (document.querySelectorAll('button')[index] as HTMLButtonElement).click());
      expect(clicks.at(-1)).toBe(choice);
      expect(document.querySelectorAll('.vote-confirmed')).toHaveLength(0);
      await act(async () => root.render(render(1)));
      const confirmed = document.querySelectorAll('.vote-confirmed');
      expect(confirmed).toHaveLength(1);
      expect(confirmed[0]?.getAttribute('aria-pressed')).toBe('true');
      expect(confirmed[0]?.className).toBe('vote-confirmed');
    }
  } finally {
    await act(async () => root.unmount());
    await dom.happyDOM.close();
    for (const [key, descriptor] of Object.entries(previous)) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key); }
  }
});

test('reading starts with no default stance and an ordinary keyboard reachable skip link', () => {
  const dom = new Window();
  try {
    dom.document.body.innerHTML = renderToStaticMarkup(<AdvisoryVoteBars item={DEMO_ITEMS[0]!} busy={false} confirmation={0} onVote={() => { throw Error('Reading must never vote'); }} />);
    expect(dom.document.querySelectorAll('[aria-pressed="true"]')).toHaveLength(0);
    const controls = dom.document.querySelectorAll('.advisory-bars > button, .advisory-bars > a');
    expect(controls).toHaveLength(4);
    for (const control of controls) {
      expect(control.hasAttribute('autofocus')).toBe(false);
      expect(control.hasAttribute('tabindex')).toBe(false);
    }
    expect(controls[3]?.textContent).toBe('Skip — read without voting');
  } finally { void dom.happyDOM.close(); }
});
