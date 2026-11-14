import { expect, test } from 'bun:test';
import { closeDialog } from './dialog-motion';

function fixture({ reduced = false, supported = true } = {}) {
  let resolve!: () => void;
  const finished = new Promise<void>(done => { resolve = done; });
  const events: string[] = [];
  const dialog = {
    open: true, dataset: {} as Record<string, string>,
    ownerDocument: { defaultView: {
      CSS: { supports: () => supported }, matchMedia: () => ({ matches: reduced }),
      getComputedStyle: () => ({ opacity: '1' }),
    } },
    getAnimations: () => [{ finished }],
    close() { this.open = false; events.push('close'); },
  };
  return { dialog: dialog as unknown as HTMLDialogElement, events, resolve };
}

test('modal stays open during exit and focus returns only after it finishes', async () => {
  const { dialog, events, resolve } = fixture();
  closeDialog(dialog, () => events.push('focus'));
  expect(dialog.open).toBe(true);
  expect(dialog.dataset.closing).toBe('');
  expect(events).toEqual([]);
  resolve();
  await new Promise(done => setTimeout(done, 0));
  expect(events).toEqual(['close', 'focus']);
  expect(dialog.dataset.closing).toBeUndefined();
});

test('reopening or unmounting cancels the pending close and focus transfer', async () => {
  const { dialog, events, resolve } = fixture();
  const cancel = closeDialog(dialog, () => events.push('focus'));
  cancel(); resolve();
  await new Promise(done => setTimeout(done, 0));
  expect(events).toEqual([]);
  expect(dialog.open).toBe(true);
  expect(dialog.dataset.closing).toBeUndefined();
});

for (const options of [{ reduced: true }, { supported: false }]) {
  test(`instant close with ${JSON.stringify(options)}`, () => {
    const { dialog, events } = fixture(options);
    closeDialog(dialog, () => events.push('focus'));
    expect(events).toEqual(['close', 'focus']);
  });
}
