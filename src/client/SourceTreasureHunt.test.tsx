import { expect, test } from 'bun:test';
import SourceTreasureHunt, { HUNT_SOURCES } from './SourceTreasureHunt';

test('learning requires opening a source; unavailable sources pause and clear completion without affecting other sources', async () => {
  const { Window } = await import('happy-dom');
  const window = new Window({ url: 'http://localhost/documentation' });
  const globals = { window, document: window.document, navigator: window.navigator, IS_REACT_ACT_ENVIRONMENT: true };
  const previous = Object.fromEntries(Object.keys(globals).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  const { createRoot } = await import('react-dom/client'); const { act } = await import('react');
  const host = document.createElement('div'); document.body.append(host); const root = createRoot(host);
  try {
    await act(async () => root.render(<SourceTreasureHunt />));
    const rows = host.querySelectorAll('li');
    expect(rows.length).toBe(3);
    for (const [i, row] of Array.from(rows).entries()) {
      const link = row.querySelector('a')!;
      expect(link.href).toBe(HUNT_SOURCES[i]!.url);
      expect(link.rel).toBe('noopener noreferrer');
      expect(row.textContent).toContain(HUNT_SOURCES[i]!.date);
    }
    const [unavailable, learned] = rows[0]!.querySelectorAll('input');
    expect(learned!.disabled).toBe(true);
    await act(async () => rows[0]!.querySelector('a')!.click());
    expect(learned!.disabled).toBe(false);
    expect(host.querySelector('[role=status]')!.textContent).toContain('0 of 3');
    await act(async () => learned!.click());
    expect(host.querySelector('[role=status]')!.textContent).toContain('1 of 3');
    expect(rows[1]!.querySelectorAll('input')[1]!.disabled).toBe(true);
    await act(async () => unavailable!.click());
    expect(learned!.disabled).toBe(true);
    expect(learned!.checked).toBe(false);
    expect(rows[0]!.textContent).toContain('completion paused');
    expect(host.querySelector('[role=status]')!.textContent).toContain('0 of 3');
    await act(async () => unavailable!.click());
    await act(async () => learned!.click());
    await act(async () => learned!.click());
    expect(host.querySelector('[role=status]')!.textContent).toContain('0 of 3');
  } finally {
    await act(async () => root.unmount()); host.remove();
    for (const key of Object.keys(globals)) { const descriptor = previous[key]; if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key); }
    window.happyDOM.abort();
  }
});
