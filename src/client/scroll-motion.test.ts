import { expect, test } from 'bun:test';
import { Window } from 'happy-dom';
import { installScrollReveals, trackDocumentSections } from './scroll-motion';

test('reveals enroll only offscreen content, retire once, and disconnect', async () => {
  const window = new Window({ url: 'http://localhost/' }) as unknown as typeof globalThis.window;
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'window');
  Object.defineProperty(globalThis, 'window', { configurable: true, value: window });
  try {
    let callback: IntersectionObserverCallback = () => {};
    const watched = new Set<Element>();
    let disconnected = false;
    window.CSS.supports = () => true;
    window.IntersectionObserver = class {
      constructor(cb: IntersectionObserverCallback) { callback = cb; }
      observe(el: Element) { watched.add(el); }
      unobserve(el: Element) { watched.delete(el); }
      disconnect() { disconnected = true; }
    } as unknown as typeof window.IntersectionObserver;
    const root = window.document.createElement('div');
    root.innerHTML = '<div class="stage-card">First screen</div><div class="stage-card">Below</div>';
    const [first, below] = [...root.children] as unknown as HTMLElement[];
    below!.getBoundingClientRect = () => ({ top: 2000 }) as DOMRect;
    const cleanup = installScrollReveals(root as unknown as HTMLElement);
    expect(first!.classList.contains('scroll-reveal')).toBe(false);
    expect(below!.classList.contains('scroll-reveal')).toBe(true);
    below!.getAnimations = () => [];
    callback([{ target: below, isIntersecting: true }] as unknown as IntersectionObserverEntry[], {} as IntersectionObserver);
    await Promise.resolve();
    expect(below!.classList.contains('scroll-reveal')).toBe(false);
    expect(watched.size).toBe(0);
    cleanup();
    expect(disconnected).toBe(true);
  } finally {
    if (previous) Object.defineProperty(globalThis, 'window', previous); else Reflect.deleteProperty(globalThis, 'window');
  }
});

test('document tracking handles long sections, reverse movement and cleanup', () => {
  const window = new Window() as unknown as typeof globalThis.window;
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'window');
  Object.defineProperty(globalThis, 'window', { configurable: true, value: window });
  try {
    let callback = () => {};
    let disconnected = false;
    window.IntersectionObserver = class {
      constructor(cb: () => void) { callback = cb; }
      observe() {}
      disconnect() { disconnected = true; }
    } as unknown as typeof window.IntersectionObserver;
    const article = window.document.createElement('article');
    article.innerHTML = '<h3 id="one">One</h3><p>Long section</p><h3 id="two">Two</h3><p>End</p>';
    let secondTop = 1500;
    article.querySelector('#one')!.getBoundingClientRect = () => ({ top: -100 }) as DOMRect;
    article.querySelector('#two')!.getBoundingClientRect = () => ({ top: secondTop }) as DOMRect;
    let active = '';
    const cleanup = trackDocumentSections(article as unknown as HTMLElement, id => { active = id; });
    expect(active).toBe('one');
    secondTop = 0; callback(); expect(active).toBe('two');
    secondTop = 1500; callback(); expect(active).toBe('one');
    cleanup(); expect(disconnected).toBe(true);
  } finally {
    if (previous) Object.defineProperty(globalThis, 'window', previous); else Reflect.deleteProperty(globalThis, 'window');
  }
});
