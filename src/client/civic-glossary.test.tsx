import { expect, test } from 'bun:test';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { Window } from 'happy-dom';
import { CIVIC_GLOSSARY, GlossaryText } from './CivicGlossary';
import { DocumentBody } from './Documentation';
import { PatchChange } from './PatchChange';

test('typed editorial definitions cover required terms and preserve source text and links', () => {
  expect(Object.keys(CIVIC_GLOSSARY)).toEqual(['appropriation', 'committee', 'quorum', 'amendment', 'effective date']);
  for (const definition of Object.values(CIVIC_GLOSSARY)) {
    expect(definition.meaning.length).toBeGreaterThan(30);
    expect(definition.example.length).toBeGreaterThan(30);
    expect(definition.editorial).toContain('Editorial');
  }
  const dom = new Window();
  dom.document.body.innerHTML = renderToStaticMarkup(<DocumentBody text={'An APPROPRIATION, committees, quorum, amendments and effective dates. Not subcommittee. [committee source](https://example.test/amendment) <script>bad</script>'} />);
  expect(dom.document.querySelectorAll('.civic-term-trigger').length).toBe(5);
  expect(dom.document.querySelector('a')!.textContent).toBe('committee source');
  expect(dom.document.querySelector('a')!.getAttribute('href')).toBe('https://example.test/amendment');
  expect(dom.document.querySelector('script')).toBeNull();
  expect(dom.document.body.textContent).toContain('Not subcommittee.');
  dom.document.body.innerHTML = renderToStaticMarkup(<PatchChange item={{ id: 'sample', currentText: 'No appropriation.', proposedText: 'An amendment.', summary: 'Review by committee.' }} />);
  expect(dom.document.querySelectorAll('.civic-term-trigger').length).toBe(3);
  dom.happyDOM.abort();
});

test('help opens offline, closes with Escape and preserves reading focus and form state', async () => {
  const dom = new Window();
  const keys = ['window', 'document', 'navigator', 'HTMLElement', 'Node', 'IS_REACT_ACT_ENVIRONMENT'];
  const previous = keys.map(key => Object.getOwnPropertyDescriptor(globalThis, key));
  keys.forEach(key => Object.defineProperty(globalThis, key, { configurable: true, value: key === 'IS_REACT_ACT_ENVIRONMENT' ? true : key === 'window' ? dom : (dom as any)[key] }));
  const container = dom.document.createElement('div'); dom.document.body.append(container);
  const root = createRoot(container as unknown as HTMLElement);
  let submissions = 0;
  try {
    await act(async () => root.render(<form onSubmit={event => { event.preventDefault(); submissions++; }}><GlossaryText text="An effective date and quorum." /><textarea defaultValue="Private draft" /><button type="button" id="next">Next reading control</button></form>));
    const trigger = container.querySelector('button')!;
    trigger.focus();
    await act(async () => trigger.click());
    const panel = container.querySelector('[role="dialog"]')!;
    expect(panel.id).toBe(trigger.getAttribute('aria-controls')!);
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(panel.textContent).toContain('Example:');
    expect(panel.textContent).toContain('Editorial');
    const close = panel.querySelector('button')!; close.focus();
    await act(async () => close.dispatchEvent(new dom.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
    expect(container.querySelector('[role="dialog"]')).toBeNull();
    expect(dom.document.activeElement).toBe(trigger);
    await act(async () => trigger.click());
    await act(async () => container.querySelector('[role="dialog"] button')!.dispatchEvent(new dom.MouseEvent('click', { bubbles: true })));
    expect(dom.document.activeElement).toBe(trigger);
    await act(async () => trigger.click());
    await act(async () => container.querySelector('#next')!.dispatchEvent(new dom.PointerEvent('pointerdown', { bubbles: true })));
    expect(container.querySelector('[role="dialog"]')).toBeNull();
    expect(container.querySelector('textarea')!.value).toBe('Private draft');
    expect(submissions).toBe(0);
  } finally {
    await act(async () => root.unmount());
    keys.forEach((key, i) => { if (previous[i]) Object.defineProperty(globalThis, key, previous[i]!); else Reflect.deleteProperty(globalThis, key); });
    await dom.happyDOM.close();
  }
});
