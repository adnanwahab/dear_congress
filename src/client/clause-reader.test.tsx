import { expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import ClauseReader, { clauseReadings } from './ClauseReader';
import { DEMO_ITEMS } from '../engine/demo';
const item = DEMO_ITEMS[0]!;
const source = { kind: 'sample' as const, id: item.id, text: item.proposedText, origin: item.source, title: item.title, jurisdiction: item.jurisdiction };
test('readings bind to exact sample identity and text; no citizen or revision fallback', () => {
  expect(clauseReadings(source)).toHaveLength(1);
  for (const change of [{ kind: 'citizen' as const }, { id: 'other' }, { text: source.text + ' Except on Tuesdays.' }, { text: '' }]) {
    expect(clauseReadings({ ...source, ...change })).toEqual([]);
  }
});
test('source remains readable without scripting and all limits accompany the pane', () => {
  const html = renderToStaticMarkup(<ClauseReader source={source} revision="fixture-v1" />);
  for (const text of ['not legal text', 'never law', 'Not interpreted:', 'fixture-v1', 'Text-only reading', 'aria-controls', 'aria-pressed="false"']) expect(html).toContain(text);
  expect(html).not.toContain('href="https:');
});
