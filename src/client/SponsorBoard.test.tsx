import { expect, test } from 'bun:test';
import { SponsorBoard, OutcomeTotal, moveWithMotion } from './SponsorBoard';

test('dropdown and pointer moves share saved stages; cancelled drags and reduced motion are safe', async () => {
  const { Window } = await import('happy-dom');
  const { createRoot } = await import('react-dom/client');
  const { act } = await import('react');
  const { useState } = await import('react');
  const win = new Window({ url: 'http://localhost/' });
  let reduced = false;
  let frames: FrameRequestCallback[] = [];
  const globals = { window: win, document: win.document, navigator: win.navigator, IS_REACT_ACT_ENVIRONMENT: true,
    requestAnimationFrame: (fn: FrameRequestCallback) => { frames.push(fn); return frames.length; }, cancelAnimationFrame: () => {} };
  const old = Object.fromEntries(Object.keys(globals).map(k => [k, Object.getOwnPropertyDescriptor(globalThis, k)]));
  for (const [k, v] of Object.entries(globals)) Object.defineProperty(globalThis, k, { configurable: true, writable: true, value: v });
  win.requestAnimationFrame = globals.requestAnimationFrame as any;
  win.cancelAnimationFrame = globals.cancelAnimationFrame;
  win.matchMedia = (() => ({ matches: reduced, addEventListener() {}, removeEventListener() {} })) as any;
  const host = document.createElement('div'); document.body.append(host);
  const root = createRoot(host);
  const saved: number[] = [];
  function Fixture() {
    const [cards, setCards] = useState([{ id: 'sample', title: 'Sample', office: 'Office', stage: 1, updatedAt: 'Original' }]);
    return <><SponsorBoard cards={cards} className="board" save={next => { saved.push(next[0]!.stage); setCards(next); return true; }} /><OutcomeTotal value={cards.filter(c => c.stage === 2).length} /></>;
  }
  try {
    await act(async () => root.render(<Fixture />));
    const select = host.querySelector('select')!;
    await act(async () => { select.value = '2'; select.dispatchEvent(new win.Event('change', { bubbles: true }) as unknown as Event); });
    expect(saved).toEqual([2]);
    expect(host.querySelector('[data-sponsor-lane="2"] article')).not.toBeNull();
    expect(host.querySelector('[aria-live="polite"]')!.textContent).toContain('Saved in this browser');
    await act(async () => { const pending = frames; frames = []; pending.forEach(f => f(performance.now() + 1000)); });
    expect(host.querySelector('strong[aria-label="1"]')!.textContent).toBe('1');
    const handle = host.querySelector('button')!;
    handle.setPointerCapture = () => {};
    document.elementFromPoint = () => host.querySelector('[data-sponsor-lane="3"]');
    const pointer = (type: string) => handle.dispatchEvent(new win.PointerEvent(type, { bubbles: true, button: 0, pointerId: 1, clientX: 20, clientY: 20 }) as unknown as Event);
    await act(async () => { pointer('pointerdown'); });
    await act(async () => { pointer('pointermove'); });
    await act(async () => { pointer('pointercancel'); });
    expect(saved).toEqual([2]);
    await act(async () => { pointer('pointerdown'); });
    await act(async () => { pointer('pointermove'); });
    await act(async () => { pointer('pointerup'); });
    expect(saved).toEqual([2, 3]);
    let snapshots = 0;
    document.startViewTransition = ((options: { update: () => void; types: string[] }) => { expect(options.types).toEqual(['sponsor-move']); snapshots++; options.update(); return { ready: Promise.resolve() }; }) as any;
    let updates = 0;
    moveWithMotion(() => updates++);
    expect(snapshots).toBe(1);
    reduced = true;
    moveWithMotion(() => updates++);
    expect(snapshots).toBe(1);
    expect(updates).toBe(2);
    await act(async () => root.render(<OutcomeTotal value={8} />));
    expect(host.textContent).toBe('8');
  } finally {
    await act(async () => root.unmount());
    for (const key of Object.keys(globals)) { if (old[key]) Object.defineProperty(globalThis, key, old[key]!); else Reflect.deleteProperty(globalThis, key); }
    await win.happyDOM.close();
  }
});
