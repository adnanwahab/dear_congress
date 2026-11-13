import { expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import WorkflowScreen from './WorkflowScreen';
import { Dashboard } from './Dashboard';
import { demoPayload } from '../engine/demo';
import { proposalTitleName, updateProposal } from './proposal-motion';

test('proposal identity is CSS safe and collision free', () => {
  const names = ['', 'empty', '1', 'a:b', 'a-b', 'a_3a_b', '水', '💬'].map(proposalTitleName);
  expect(new Set(names).size).toBe(names.length);
  for (const name of names) expect(name).toMatch(/^proposal-title-[a-z0-9-]+$/);
});

test('selected title exists before API refresh and has exactly one shared name on each page', () => {
  const data = demoPayload({}, 'test');
  const previous = Object.fromEntries(['window', 'sessionStorage', 'localStorage'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { location: { search: `?proposal=${data.items[1]!.id}` } } });
  Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: { getItem: (key: string) => key.includes('snapshot') ? JSON.stringify(data) : null } });
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: () => null } });
  const request = async <T,>() => data as T;
  try {
    for (const stage of ['feed', 'votes', 'draft'] as const) {
      const html = renderToStaticMarkup(<WorkflowScreen stage={stage} request={request} />);
      expect(html.match(/view-transition-name:proposal-title-/g)?.length).toBe(1);
      expect(html).toContain(`view-transition-name:${proposalTitleName(data.items[1]!.id)}`);
      if (stage === 'feed') expect(html).toContain(`<h3 style="view-transition-name:${proposalTitleName(data.items[1]!.id)}"`);
    }
    const html = renderToStaticMarkup(<Dashboard request={request} />);
    expect(html.match(/view-transition-name:proposal-title-/g)?.length).toBe(1);
  } finally {
    for (const [key, descriptor] of Object.entries(previous)) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key);
    }
  }
});

test('updates run inside transition callback; reduced motion and missing API update immediately', async () => {
  const previous = Object.fromEntries(['window', 'document'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  let reduced = false, updates = 0, starts = 0;
  let callback: (() => void) | undefined;
  const doc: { startViewTransition?: (update: () => void) => unknown } = {
    startViewTransition(update) { starts++; callback = update; return { ready: Promise.reject(Error('skipped')), finished: Promise.resolve() }; },
  };
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { matchMedia: () => ({ matches: reduced }) } });
  Object.defineProperty(globalThis, 'document', { configurable: true, value: doc });
  try {
    updateProposal(() => updates++);
    expect(updates).toBe(0); callback!(); expect(updates).toBe(1);
    reduced = true; updateProposal(() => updates++); expect(updates).toBe(2);
    reduced = false; delete doc.startViewTransition;
    updateProposal(() => updates++); expect(updates).toBe(3); expect(starts).toBe(1);
    await Promise.resolve();
  } finally {
    for (const [key, descriptor] of Object.entries(previous)) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key);
    }
  }
});
