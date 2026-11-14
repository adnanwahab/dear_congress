import { expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { Window } from 'happy-dom';
import { ArgumentMap } from './ArgumentMap';
import { BRIEFING_CHAPTERS } from './AudioBriefing';
import { DEMO_ITEMS } from '../engine/demo';
const item = DEMO_ITEMS.find(i => i.id === 'demo-transit')!;

test('briefing is readable without speech, symmetric, cited and bound to source revision', () => {
  const html = renderToStaticMarkup(<ArgumentMap item={item} />);
  for (const chapter of BRIEFING_CHAPTERS) expect(html).toContain(chapter.text);
  const words = (text: string) => text.split(/\s+/).length;
  expect(Math.abs(words(BRIEFING_CHAPTERS[1].text) - words(BRIEFING_CHAPTERS[2].text))).toBeLessThan(5);
  expect(words(BRIEFING_CHAPTERS.map(p => p.text).join(' '))).toBeGreaterThan(250);
  expect(html).toContain('Synthetic voice');
  expect(html).toContain('agency background only');
  expect(html).toContain('href="#argument-demo-transit-clause"');
  for (const patch of [{ sourceUrl: 'https://other.test' }, { currentText: 'Changed' }, { title: 'Changed' }, { jurisdiction: 'Federal' }, { proposedText: 'Changed' }]) {
    expect(renderToStaticMarkup(<ArgumentMap item={{ ...item, ...patch }} />)).not.toContain('Play briefing');
  }
  expect(renderToStaticMarkup(<ArgumentMap item={item} namespace="citizen" />)).not.toContain('Play briefing');
  expect(renderToStaticMarkup(<ArgumentMap item={{ ...item, support: 9 }} />)).toContain('Play briefing');
});

test('explicit play, chapter order, pause, speed, failure, unsupported and revision cleanup', async () => {
  const dom = new Window({ url: 'https://example.test/votes' });
  const keys = ['window', 'document', 'navigator', 'HTMLElement', 'Node', 'Event', 'IS_REACT_ACT_ENVIRONMENT'];
  const previous = keys.map(k => Object.getOwnPropertyDescriptor(globalThis, k));
  for (const key of keys) Object.defineProperty(globalThis, key, { configurable: true, value: key === 'IS_REACT_ACT_ENVIRONMENT' ? true : key === 'window' ? dom : (dom as any)[key] });
  let utterances: any[] = [], canceled = 0, pauses = 0, resumes = 0, submits = 0;
  const speech = { speaking: false, pending: false, speak: (u: any) => utterances.push(u), cancel: () => canceled++, pause: () => pauses++, resume: () => resumes++ };
  Object.assign(dom, { speechSynthesis: speech, SpeechSynthesisUtterance: class { constructor(public text: string) {} } });
  const container = dom.document.createElement('div'); dom.document.body.append(container);
  const root = createRoot(container as unknown as HTMLElement);
  const button = (name: string) => [...container.querySelectorAll('button')].find(b => b.textContent === name)!;
  const click = async (name: string) => act(async () => button(name).click());
  try {
    await act(async () => root.render(<form onSubmit={e => { e.preventDefault(); submits++; }}><ArgumentMap item={item} /></form>));
    expect(utterances).toHaveLength(0);
    await click('Play briefing'); expect(container.textContent).toContain('Loading synthetic voice');
    expect(utterances[0].text).toBe(`Proposal and scope. ${BRIEFING_CHAPTERS[0].text}`);
    await act(async () => utterances[0].onstart());
    await click('Pause'); expect(pauses).toBe(1); expect(container.textContent).toContain('Paused:');
    await click('Resume'); expect(resumes).toBe(1);
    await act(async () => utterances[0].onend());
    expect(utterances[1].text).toBe(`Reasons for. ${BRIEFING_CHAPTERS[1].text}`);
    const stale = utterances[1];
    const select = container.querySelector('select')!;
    await act(async () => { select.value = '1.5'; select.dispatchEvent(new dom.Event('change', { bubbles: true })); });
    expect(canceled).toBe(1);
    await act(async () => stale.onend()); expect(utterances).toHaveLength(2);
    await click('Listen from chapter 3'); expect(utterances[2].rate).toBe(1.5);
    await act(async () => utterances[2].onerror()); expect(container.textContent).toContain('Audio could not play');
    await click('Play briefing');
    const latest = utterances.at(-1);
    await act(async () => root.render(<ArgumentMap item={{ ...item, sourceUrl: 'https://other.test' }} />));
    const count = utterances.length;
    await act(async () => latest.onend()); expect(utterances).toHaveLength(count);
    expect(container.textContent).toContain('No briefing is available'); expect(submits).toBe(0);
    Object.assign(dom, { speechSynthesis: undefined });
    await act(async () => root.render(<ArgumentMap item={item} />));
    expect(container.textContent).toContain('Audio unavailable');
    expect(button('Play briefing').disabled).toBe(true);
    expect(container.textContent).toContain(BRIEFING_CHAPTERS[2].text);
  } finally {
    await act(async () => root.unmount());
    keys.forEach((k, i) => { if (previous[i]) Object.defineProperty(globalThis, k, previous[i]!); else delete (globalThis as any)[k]; });
    await dom.happyDOM.close();
  }
});
