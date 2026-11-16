import { expect, test } from 'bun:test';
import { MissingVoice, voiceScenes } from './MissingVoice';

test('missing-voice puzzle completes all scenes, explanation, restart, skip and exit in page memory', async () => {
  const { Window } = await import('happy-dom');
  const { act } = await import('react');
  const { createRoot } = await import('react-dom/client');
  const dom = new Window({ url: 'http://localhost/bills' });
  const globals = { window: dom, document: dom.document, IS_REACT_ACT_ENVIRONMENT: true };
  const previous = Object.fromEntries(Object.keys(globals).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const [key, value] of Object.entries(globals))
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  document.body.innerHTML = '<main id="test-root"></main>';
  const root = createRoot(document.getElementById('test-root')!);
  const changes: boolean[] = [];
  const click = (button: HTMLButtonElement | null | undefined) => {
    expect(button).toBeTruthy();
    act(() => button!.click());
  };
  const button = (label: string) => [...document.querySelectorAll<HTMLButtonElement>('.missing-voice button')].find(x => x.textContent === label);
  try {
    act(() => root.render(<MissingVoice onOpenChange={open => changes.push(open)} />));
    const launcher = document.querySelector<HTMLButtonElement>('.missing-voice > button')!;
    click(launcher);
    expect(changes).toEqual([true]);
    for (let scene = 0; scene < voiceScenes.length; scene++) {
      expect(document.querySelector('.missing-voice h2')?.textContent).toContain(`${scene + 1} / 3`);
      const choices = document.querySelectorAll<HTMLInputElement>('.missing-voice input[type=radio]');
      expect(choices.length).toBe(2);
      act(() => choices[scene % 2]!.click());
      click(button('Reveal explanation'));
      const explanation = document.querySelector('.missing-voice [role=status]');
      expect(explanation?.textContent).toContain(voiceScenes[scene]!.explanation);
      expect(explanation?.textContent).toContain(voiceScenes[scene]!.outreach);
      click(button('Next scene'));
    }
    expect(document.querySelector('.missing-voice h2')?.textContent).toBe('Reflection complete');
    click(button('Restart puzzle'));
    expect(document.querySelector('.missing-voice h2')?.textContent).toContain('1 / 3');
    click(button('Skip scene'));
    expect(document.querySelector('.missing-voice h2')?.textContent).toContain('2 / 3');
    click(button('Exit puzzle'));
    expect(launcher.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(launcher);
    expect(changes).toEqual([true, false]);
  } finally {
    act(() => root.unmount());
    await dom.happyDOM.close();
    for (const [key, descriptor] of Object.entries(previous)) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
});
