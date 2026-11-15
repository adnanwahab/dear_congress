import { expect, test } from 'bun:test';
import { Window } from 'happy-dom';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { ArgumentMap } from './ArgumentMap';
import { DEMO_ITEMS, demoPayload } from '../engine/demo';

test('steelman is optional, local, revision-bound and gives only self-review feedback', async () => {
  const dom = new Window({ url: "https://example.test/proposals/fixture" });
  const originalFetch = globalThis.fetch;
  const keys = ["window", "document", "navigator", "HTMLElement", "Node", "IS_REACT_ACT_ENVIRONMENT"];
  const previous = keys.map(key => Object.getOwnPropertyDescriptor(globalThis, key));
  for (const key of keys) Object.defineProperty(globalThis, key, {
    configurable: true, value: key === "IS_REACT_ACT_ENVIRONMENT" ? true : key === "window" ? dom : (dom as any)[key],
  });
  const container = dom.document.createElement("div");
  dom.document.body.append(container);
  const root = createRoot(container as unknown as HTMLElement);
  const item = DEMO_ITEMS.find(i => i.id === 'demo-transit')!;
  const votes = { browser: { [item.id]: { stance: -1 } } };
  const before = JSON.stringify(demoPayload(votes, 'browser'));
  let requests = 0;
  globalThis.fetch = (async () => { requests++; throw new Error('No requests permitted'); }) as unknown as typeof fetch;
  const click = async (text: string) => {
    const button = [...container.querySelectorAll('button')].find(b => b.textContent === text)!;
    expect(button).toBeDefined();
    expect(button.type).toBe('button');
    await act(async () => { button.click(); });
  };
  try {
    await act(async () => { root.render(<ArgumentMap item={item} />); });
    expect(container.querySelector('textarea')).toBeNull();
    await click('Try the challenge');
    await click('Review my coverage');
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('Add a summary');
    for (const [index, textarea] of [...container.querySelectorAll('textarea')].entries()) {
      expect(container.querySelector(`label[for="${textarea.id}"]`)).not.toBeNull();
      // React's controlled input handler reads the current native value.
      await act(async () => {
        Object.getOwnPropertyDescriptor(dom.HTMLTextAreaElement.prototype, 'value')!.set!.call(textarea, ['Opponents worry about diverting funds from essential routes.', 'Budget report, page 7', 'Page 7 compares operating costs; corridor evidence is missing.'][index]);
        textarea.dispatchEvent(new dom.Event('input', { bubbles: true }));
        textarea.dispatchEvent(new dom.Event('change', { bubbles: true }));
      });
    }
    await click('Review my coverage');
    expect(container.querySelector('.steelman-challenge [role="status"]')?.textContent).toContain('Practice complete');
    expect(container.querySelector('.steelman-challenge [role="status"]')?.textContent).toContain('Revisit:');
    expect(container.textContent).toContain('Source supplied, not verified');
    await click('Clear and skip challenge');
    expect(container.querySelector('textarea')).toBeNull();
    await click('Try the challenge');
    expect(container.querySelector('textarea')?.value).toBe('');
    await act(async () => { root.render(<ArgumentMap item={{ ...item, proposedText: item.proposedText + ' Revised.' }} />); });
    expect(container.querySelector('textarea')).toBeNull();
    expect(container.textContent).not.toContain('Try the challenge');
    expect(requests).toBe(0);
    expect(JSON.stringify(demoPayload(votes, 'browser'))).toBe(before);
  } finally {
    globalThis.fetch = originalFetch;
    await act(async () => { root.unmount(); });
    keys.forEach((key, index) => {
      const descriptor = previous[index];
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    });
    await dom.happyDOM.close();
  }
});
