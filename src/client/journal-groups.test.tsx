import { expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import type { JournalEntry } from '../engine/types';
import { groupJournalEntries } from './journal-groups';
import { SharedJournalFeed } from './SharedJournalFeed';

function entry(id: string, text: string, need = 'food', extra: Partial<JournalEntry> = {}): JournalEntry {
  return { id, text, author: `Resident ${id}`, createdAt: '2026-11-13T12:00:00Z', synthetic: true, source: 'happybearlandia-world', extraction: { needs: [{ id: need, evidence: text }], importance: .5, concerns: [], constraints: [], proposalIds: [] }, ...extra } as JournalEntry;
}
const food = [
  entry('1', 'I came home to an empty fridge and struggled to get basic groceries. I need a practical fix soon.'),
  entry('2', "Our fridge was empty tonight and it was hard to find groceries nearby. I'm sharing this because it keeps happening."),
  entry('3', 'We ran out at home and finding groceries nearby was difficult. This keeps disrupting my daily life.'),
  entry('4', 'I came home to an empty fridge and struggled to get basic groceries.'),
];
test('world paraphrases collapse, retain originals and expose varied needs next', () => {
  const entries = [...food, entry('5', 'The bus commute takes too long.', 'transit'), entry('6', 'Rent is too expensive.', 'housing')];
  const before = JSON.stringify(entries);
  const groups = groupJournalEntries(entries);
  expect(groups.map(g => g.map(e => e.id))).toEqual([['1', '2', '3', '4'], ['5'], ['6']]);
  expect(JSON.stringify(entries)).toBe(before);
  const html = renderToStaticMarkup(<SharedJournalFeed entries={entries} needs={[]} loading={false} />);
  expect(html).toContain('6 loaded');
  expect(html).toContain('+3 similar stories from simulated residents');
  expect(html).toContain('<details class="journal-similar"><summary>');
  expect(html).not.toContain('<details open');
  for (const e of entries) expect(html).toContain(e.text.replaceAll("'", '&#x27;'));
  expect(html.indexOf('</details>')).toBeLessThan(html.indexOf('The bus commute'));
});
test('real, unflagged and seeded-only entries break runs and remain visible', () => {
  for (const flags of [{ synthetic: false }, { synthetic: undefined }, { synthetic: undefined, seeded: true }]) {
    const real = entry('real', food[0]!.text, 'food', flags);
    const groups = groupJournalEntries([food[0]!, real, food[1]!]);
    expect(groups.map(g => g.length)).toEqual([1, 1, 1]);
    const html = renderToStaticMarkup(<SharedJournalFeed entries={[food[0]!, real, food[1]!]} needs={[]} loading={false} />);
    expect(html).not.toContain('<details');
    expect(html).toContain('data-entry-id="real"');
  }
});
test('same need alone is insufficient; sources, needs, and unlabeled entries stay separate', () => {
  for (const other of [entry('different', 'The food bank closes before my shift ends.'),
    entry('need', food[0]!.text, 'housing'), entry('source', food[0]!.text, 'food', { source: 'other' }),
    entry('no-label', food[0]!.text, 'food', { extraction: { ...food[0]!.extraction, needs: [] } })]) {
    expect(groupJournalEntries([food[0]!, other]).length).toBe(2);
  }
});
test('normalizes case, punctuation and whitespace without transitive chaining', () => {
  const a = entry('a', 'One two three four five six');
  const b = entry('b', 'ONE, two three four five six seven eight!');
  const c = entry('c', 'three four five six seven eight');
  expect(groupJournalEntries([a, b, c]).map(g => g.length)).toEqual([2, 1]);
  expect(groupJournalEntries([entry('a', ''), entry('b', '')]).length).toBe(2);
});
test('appended pages can extend the last run without changing the loaded count', () => {
  expect(groupJournalEntries(food.slice(0, 2))[0]!.length).toBe(2);
  expect(groupJournalEntries(food)[0]!.length).toBe(4);
  const html = renderToStaticMarkup(<SharedJournalFeed entries={food.slice(0, 2)} needs={[]} loading={false} />);
  expect(html).toContain('+1 similar story from simulated residents');
  expect(html).toContain('2 loaded');
});
