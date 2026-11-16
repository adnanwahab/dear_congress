import { expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { Window } from 'happy-dom';
import { DEMO_ITEMS } from '../engine/demo';
import { explainerCues, ProposalExplainer } from './ProposalExplainer';

test('every sample has five sourced passages without background claims or tallies', () => {
  for (const item of DEMO_ITEMS) {
    const cues = explainerCues(item)!;
    expect(cues.map(c => c.heading)).toEqual(['Goal', 'Proposed mechanism', 'Jurisdiction', 'Tradeoffs', 'Major uncertainty']);
    const html = renderToStaticMarkup(<ProposalExplainer item={item} />);
    expect(html).toContain('Synthetic audio');
    expect(html).toContain('Transcript and passage sources');
    expect(html).not.toContain(item.sourceUrl);
    expect(cues.map(c => c.text).join(' ')).not.toContain(String(item.support));
    expect(explainerCues({ ...item, proposedText: '' })).toBeNull();
  }
});

test('voice is click-only, captions follow passages, failures retry and unmount cancels', async () => {
  const dom = new Window();
  const keys = ['window', 'document', 'navigator', 'HTMLElement', 'Node', 'IS_REACT_ACT_ENVIRONMENT'];
  const prior = keys.map(key => Object.getOwnPropertyDescriptor(globalThis, key));
  keys.forEach(key => Object.defineProperty(globalThis, key, { configurable: true, value: key === 'IS_REACT_ACT_ENVIRONMENT' ? true : key === 'window' ? dom : (dom as any)[key] }));
  const spoken: any[] = [];
  let cancelled = 0;
  class Utterance { constructor(public text: string) {} }
  Object.defineProperty(dom, 'SpeechSynthesisUtterance', { value: Utterance });
  Object.defineProperty(dom, 'speechSynthesis', { value: { speak: (u: any) => spoken.push(u), cancel: () => cancelled++, speaking: false, pending: false } });
  const container = dom.document.createElement('div'); dom.document.body.append(container);
  const root = createRoot(container as unknown as HTMLElement);
  try {
    await act(async () => root.render(<ProposalExplainer item={DEMO_ITEMS[0]!} />));
    expect(spoken).toHaveLength(0);
    const buttons = container.querySelectorAll('button');
    await act(async () => (buttons[0] as any).click());
    expect(container.textContent).toContain('Preparing voice');
    await act(async () => spoken[0].onstart());
    expect(container.querySelector('[aria-label="Subtitles"]')!.textContent).toContain(DEMO_ITEMS[0]!.summary);
    await act(async () => spoken[0].onend());
    expect(spoken).toHaveLength(2);
    await act(async () => spoken[1].onerror());
    expect(container.textContent).toContain('Voice unavailable');
    await act(async () => (buttons[0] as any).click());
    expect(spoken).toHaveLength(3);
    await act(async () => (buttons[1] as any).click());
    expect(cancelled).toBe(1);
    await act(async () => spoken[2].onend());
    expect(spoken).toHaveLength(3);
    await act(async () => (buttons[0] as any).click());
    await act(async () => root.unmount());
    expect(cancelled).toBe(2);
  } finally {
    keys.forEach((key, i) => { if (prior[i]) Object.defineProperty(globalThis, key, prior[i]!); else Reflect.deleteProperty(globalThis, key); });
    await dom.happyDOM.close();
  }
});
