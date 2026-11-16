import assert from 'node:assert/strict';
import { Window } from 'happy-dom';
import { act } from 'react';
const dom = new Window({ url: 'http://localhost/bills' });
for (const key of ['window', 'document', 'navigator']) Object.defineProperty(globalThis, key, { configurable: true, value: key === 'window' ? dom : (dom as any)[key] });
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
const forbidden = () => { throw new Error('Game may not access requests or storage'); };
globalThis.fetch = forbidden;
for (const key of ['localStorage', 'sessionStorage']) Object.defineProperty(globalThis, key, { configurable: true, get: forbidden });
const { createRoot } = await import('react-dom/client');
const { TownHallGame, HALL_SCENES } = await import('../src/client/TownHallGame');
const container = document.createElement('div'); document.body.append(container);
const root = createRoot(container);
await act(async () => root.render(<TownHallGame />));
const click = async (text: string) => {
  const button = [...container.querySelectorAll('button')].find(b => b.textContent === text);
  assert(button, text); await act(async () => button.click());
};
for (const picks of [[0, 1, 0], [1, 0, 1]]) {
  await click('Start town-hall practice');
  for (const [i, pick] of picks.entries()) {
    assert.equal(document.activeElement, container.querySelector('h3'));
    await click(HALL_SCENES[i]!.choices[pick]![0]);
    assert(container.querySelector('[role=status]')!.textContent!.includes(HALL_SCENES[i]!.choices[pick]![1]));
    await click('Next scene');
  }
  assert(container.textContent!.includes(`${picks[0] === 0 ? 3 : 0} of 3 opportunities`));
  await click('Restart');
  for (let i = 0; i < 3; i++) await click('Skip scene');
  assert(container.textContent!.includes('3 skipped'));
  await click('Exit practice');
  assert.equal(document.activeElement?.textContent, 'Start town-hall practice');
}
await click('Start town-hall practice');
await click(HALL_SCENES[0].choices[0][0]);
await click('Restart');
assert.equal(container.querySelector('[role=status]'), null);
await click('Exit practice');
await act(async () => root.unmount());
await dom.happyDOM.close();
console.log('PASS town hall: all choices, feedback, completion, skips, restart, exit, focus and zero IO');
