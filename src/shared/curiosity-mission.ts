import type { DemoItem } from '../engine/demo';

/** Topic-first rotation avoids giving topics with more proposals extra weight. */
export function curiosityDeck(items: DemoItem[], day: string, familiar = ''): DemoItem[] {
  const ordinal = Math.floor(Date.parse(`${day}T00:00:00Z`) / 86400000);
  if (!Number.isFinite(ordinal)) return [];
  const groups = new Map<string, DemoItem[]>();
  for (const item of items) {
    if (item.topic === familiar) continue;
    groups.set(item.topic, [...(groups.get(item.topic) ?? []), item]);
  }
  const topics = [...groups.keys()].sort();
  if (!topics.length) return [];
  const rotate = <T,>(values: T[], offset: number) => {
    const start = ((offset % values.length) + values.length) % values.length;
    return [...values.slice(start), ...values.slice(0, start)];
  };
  const lanes = rotate(topics, ordinal).map(topic => rotate(groups.get(topic)!.sort((a, b) => a.id.localeCompare(b.id, 'en')), Math.floor(ordinal / topics.length)));
  const deck: DemoItem[] = [];
  for (let round = 0; lanes.some(lane => round < lane.length); round++) {
    for (const lane of lanes) if (lane[round]) deck.push(lane[round]!);
  }
  return deck;
}
