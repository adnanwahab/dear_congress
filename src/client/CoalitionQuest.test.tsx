import { expect, test } from 'bun:test';
import { Window } from 'happy-dom';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { CoalitionQuest } from './CoalitionQuest';
import { COALITION_OPTIONS, DEFAULT_COALITION_ASSUMPTIONS as defaults, evaluateCoalition, type CoalitionOption } from './coalition-scenario';

test('budget, public constraints and tradeoff accuracy jointly determine completion', () => {
  const compromise: CoalitionOption[] = ['access', 'evening', 'quiet'];
  expect(evaluateCoalition(compromise, defaults, []).feasible).toBe(true);
  expect(evaluateCoalition(compromise, defaults, []).won).toBe(false);
  expect(evaluateCoalition(compromise, defaults, compromise)).toMatchObject({ cost: 12, won: true });
  const everything = COALITION_OPTIONS.map(option => option.id);
  expect(evaluateCoalition(everything, defaults, everything)).toMatchObject({ cost: 16, feasible: false, won: false });
  expect(evaluateCoalition(['access', 'evening'], defaults, compromise).feasible).toBe(false);
  expect(evaluateCoalition(['access', 'garden'], { ...defaults, eveningRequired: false }, ['access', 'garden']).won).toBe(true);
  expect(evaluateCoalition([], { accessRequired: false, eveningRequired: false, quietRequired: false }, []).won).toBe(false);
  // Exhaust the small package space: never award completion over budget or with unmet constraints.
  for (let mask = 0; mask < 16; mask++) {
    const selected = everything.filter((_, index) => mask & (1 << index));
    const result = evaluateCoalition(selected, defaults, selected);
    if (result.won) { expect(result.cost).toBeLessThanOrEqual(12); expect(result.constraints.every(c => c.met)).toBe(true); }
  }
});

test('native controls give retry feedback, clear stale success on edits and reset without persistence', async () => {
  const win = new Window();
  const globals = { window: win, document: win.document, IS_REACT_ACT_ENVIRONMENT: true };
  const previous = Object.fromEntries(Object.keys(globals).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { configurable: true, value });
  const host = document.createElement('div'); document.body.append(host);
  const root = createRoot(host);
  const click = async (element: any) => { await act(async () => element.click()); };
  const check = () => host.querySelector('button')!;
  try {
    await act(async () => root.render(<CoalitionQuest />));
    expect(host.textContent).toContain('Fictional sandbox');
    await click(check()); expect(host.textContent).toContain('Choose at least one option.');
    const options = host.querySelectorAll('fieldset')[0]!.querySelectorAll('input');
    for (const option of Array.from(options).slice(0, 3)) await click(option);
    await click(check()); expect(host.textContent).toContain('Identify each selected option');
    for (const select of Array.from(host.querySelectorAll('select'))) {
      await act(async () => { select.value = 'none'; select.dispatchEvent(new win.Event('change', { bubbles: true }) as unknown as Event); });
    }
    await click(check()); expect(host.textContent).not.toContain('Exercise complete:');
    for (const select of Array.from(host.querySelectorAll('select'))) {
      await act(async () => { select.value = 'actual'; select.dispatchEvent(new win.Event('change', { bubbles: true }) as unknown as Event); });
    }
    await click(check()); expect(host.textContent).toContain('Exercise complete:');
    await click(options[3]); expect(host.textContent).not.toContain('Exercise complete:');
    await click(check()); expect(host.textContent).toContain('Try again:');
    await click(host.querySelector('details input')); expect(host.textContent).not.toContain('Try again:');
    expect(Array.from(host.querySelectorAll('select')).every(select => select.value === '')).toBe(true);
    await click(host.querySelectorAll('button')[1]);
    expect(host.textContent).toContain('Budget: 0 / 12');
    expect(host.querySelectorAll('select')).toHaveLength(0);
    expect(host.querySelectorAll('details input:checked')).toHaveLength(3);
  } finally {
    await act(async () => root.unmount());
    for (const key of Object.keys(globals)) { if (previous[key]) Object.defineProperty(globalThis, key, previous[key]!); else Reflect.deleteProperty(globalThis, key); }
    await win.happyDOM.close();
  }
});
