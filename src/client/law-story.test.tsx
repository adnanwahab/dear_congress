import { expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { LawStory } from './LawStory';
import { LAW_CHAPTERS } from './law-story';
import { CIVIC_STAGES } from '../shared/civic-stages';

test('six chapters connect every product stage with explicit reality boundaries', () => {
  expect(LAW_CHAPTERS).toHaveLength(6);
  expect(new Set(LAW_CHAPTERS.map(c => `/${c.stage}`))).toEqual(new Set(CIVIC_STAGES.map(c => c.route)));
  expect(LAW_CHAPTERS.every(c => /hypothetical/i.test(c.boundary))).toBe(true);
  const html = renderToStaticMarkup(<LawStory />);
  expect(html).toContain('demo-transit');
  expect(html).toContain('https://www.ridemetro.org/');
  expect(html).toContain('no illustration downloads or live data');
});

test('reader controls navigate without writes; text edition contains all chapters and links', async () => {
  const { Window } = await import('happy-dom');
  const { act } = await import('react');
  const { createRoot } = await import('react-dom/client');
  const dom = new Window({ url: 'http://localhost/' });
  const globals = { window: dom, document: dom.document, IS_REACT_ACT_ENVIRONMENT: true };
  const previous = Object.fromEntries(Object.keys(globals).map(k => [k, Object.getOwnPropertyDescriptor(globalThis, k)]));
  for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { configurable: true, value });
  document.body.innerHTML = '<div id="root"></div>';
  const root = createRoot(document.getElementById('root')!);
  const click = async (text: string) => {
    const button = Array.from(document.querySelectorAll('button')).find(b => b.textContent === text)!;
    await act(async () => button.click());
  };
  try {
    await act(async () => root.render(<LawStory />));
    expect(document.querySelector('button[disabled]')?.textContent).toBe('Previous chapter');
    await click('Next chapter');
    expect(document.querySelector('article h3')?.textContent).toContain('Follow the source');
    await click('Pause illustration motion');
    expect(document.querySelector('.law-story-motion')).toBeNull();
    await click('6. Ask what actually changed');
    expect(document.querySelector('article')?.textContent).toContain('No verified implemented policy');
    expect(Array.from(document.querySelectorAll('button')).find(b => b.textContent === 'Next chapter')?.disabled).toBe(true);
    await click('Skip illustrations · complete text edition');
    expect(document.querySelector('svg')).toBeNull();
    expect(document.querySelectorAll('.law-story-edition li')).toHaveLength(6);
    for (const chapter of LAW_CHAPTERS) {
      expect(document.querySelector('.law-story-edition')?.textContent).toContain(chapter.narration);
      expect(document.querySelector(`a[href="/${chapter.stage}?proposal=demo-transit"]`)).not.toBeNull();
    }
    await click('Return to illustrated chapters');
    expect(document.querySelector('article h3')?.textContent).toContain('Ask what actually changed');
    expect(dom.localStorage.length).toBe(0);
    expect(dom.sessionStorage.length).toBe(0);
    expect(dom.location.href).toBe('http://localhost/');
  } finally {
    await act(async () => root.unmount());
    await dom.happyDOM.close();
    for (const [key, descriptor] of Object.entries(previous)) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key); }
  }
});
