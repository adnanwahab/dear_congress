import { expect, test } from 'bun:test';
import { DEMO_ITEMS } from '../engine/demo';
import { curiosityDeck } from './curiosity-mission';

test('daily selection is stable across API ordering and ignores popularity', () => {
  const deck = curiosityDeck(DEMO_ITEMS, '2026-11-14');
  expect(curiosityDeck([...DEMO_ITEMS].reverse().map(i => ({ ...i, support: 999999, oppose: 0 })), '2026-11-14')).toEqual(deck.map(i => ({ ...i, support: 999999, oppose: 0 })));
  expect(new Set(deck.map(i => i.id)).size).toBe(DEMO_ITEMS.length);
});
test('every topic gets equal daily turns and shuffle explores all proposals', () => {
  const topics = new Set(DEMO_ITEMS.map(i => i.topic));
  const seen = new Set<string>();
  for (let d = 1; d <= topics.size; d++) {
    const deck = curiosityDeck(DEMO_ITEMS, `2026-11-${String(d).padStart(2, '0')}`);
    seen.add(deck[0]!.topic);
    expect(new Set(deck.slice(0, topics.size).map(i => i.topic)).size).toBe(topics.size);
  }
  expect(seen.size).toBe(topics.size);
  expect(curiosityDeck(DEMO_ITEMS, '2026-11-14', 'Housing').every(i => i.topic !== 'Housing')).toBe(true);
  expect(curiosityDeck([], '2026-11-14')).toEqual([]);
  expect(curiosityDeck(DEMO_ITEMS, 'invalid')).toEqual([]);
});
