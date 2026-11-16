import { expect, test } from 'bun:test';
import { TRIVIA_TOPICS, validateTopics } from './civic-trivia';
import CivicTrivia from './CivicTrivia';
import { renderToStaticMarkup } from 'react-dom/server';
import { STAGES } from '../shared/civic-stages';

test('initial render announces loading and privacy without requiring a service', () => {
  const html = renderToStaticMarkup(<CivicTrivia />);
  expect(html).toContain('Loading questions…');
  expect(html).toContain('No answers are sent or saved');
});

test('rotating rounds contain five sourced knowledge checks with valid stage links', () => {
  validateTopics(TRIVIA_TOPICS);
  expect(TRIVIA_TOPICS.length).toBeGreaterThan(1);
  const ids = TRIVIA_TOPICS.flatMap(t => t.questions.map(q => q.id));
  expect(new Set(ids).size).toBe(ids.length);
  for (const topic of TRIVIA_TOPICS) for (const q of topic.questions) {
    expect(q.choices.length).toBe(3);
    expect(q.explanation.length).toBeGreaterThan(40);
    expect(new URL(q.source.url).hostname).toBe('www.houstontx.gov');
    expect(STAGES[q.stage]).toBeDefined();
  }
  expect(() => validateTopics([])).toThrow();
});

test('loading, retry, answer feedback, five-question finish, rotation and clearing stay local', async () => {
  const { Window } = await import('happy-dom');
  const { act } = await import('react');
  const { createRoot } = await import('react-dom/client');
  const dom = new Window();
  const globals = { window: dom, document: dom.document, requestAnimationFrame: (cb: () => void) => { cb(); return 1; }, IS_REACT_ACT_ENVIRONMENT: true };
  const previous = Object.fromEntries(Object.keys(globals).map(k => [k, Object.getOwnPropertyDescriptor(globalThis, k)]));
  for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { configurable: true, value });
  document.body.innerHTML = '<div id="root"></div>';
  const root = createRoot(document.getElementById('root')!);
  let tries = 0;
  const load = async () => { if (++tries === 1) throw new Error('offline'); return import('./civic-trivia'); };
  const click = async (text: string) => { const button = Array.from(document.querySelectorAll('button')).find(b => b.textContent === text)!; expect(button).toBeDefined(); await act(async () => button.click()); };
  try {
    await act(async () => root.render(<CivicTrivia load={load} />));
    expect(document.querySelector('[role="alert"]')?.textContent).toContain('could not load');
    await click('Retry questions');
    expect(document.body.textContent).toContain('Question 1 of 5');
    expect(document.querySelector('button')!.disabled).toBe(true);
    for (let i = 0; i < 5; i++) {
      await act(async () => (document.querySelectorAll('input')[TRIVIA_TOPICS[0]!.questions[i]!.answer] as HTMLInputElement).click());
      await click('Check answer');
      expect(document.querySelector('[role="status"]')!.textContent).toContain('Correct.');
      expect(document.querySelector('[role="status"] a')!.getAttribute('href')).toContain('https://www.houstontx.gov/');
      expect(document.querySelector('fieldset')!.disabled).toBe(true);
      await click(i === 4 ? 'Finish round' : 'Next question');
      expect(document.activeElement?.id).toBe('trivia-heading');
    }
    expect(document.body.textContent).toContain('5 of 5 correctly');
    await click('Play next topic');
    expect(document.body.textContent).toContain('Follow the public budget');
    await act(async () => (document.querySelector('input') as HTMLInputElement).click());
    await click('Check answer');
    expect(document.body.textContent).toContain('Keep learning.');
    await click('Clear private progress');
    expect(document.body.textContent).toContain('Question 1 of 5');
    expect(document.querySelector('input:checked')).toBeNull();
    expect(dom.localStorage.length).toBe(0);
    expect(dom.sessionStorage.length).toBe(0);
  } finally {
    await act(async () => root.unmount()); await dom.happyDOM.close();
    for (const [key, descriptor] of Object.entries(previous)) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key); }
  }
});
