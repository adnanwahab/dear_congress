import type { DemoItem } from '../engine/demo';

export interface Discovery {
  id: string; proposalId: string; kind: 'sample' | 'background';
  title: string; topic: string; jurisdiction: string; description: string; href: string;
}
// Only links already present in the typed demo catalog; never synthesize a source URL.
export function discoveryPool(items: DemoItem[]): Discovery[] {
  return items.flatMap(item => {
    const sample: Discovery = { id: `sample:${item.id}`, proposalId: item.id, kind: 'sample', title: item.title,
      topic: item.topic, jurisdiction: item.jurisdiction, description: item.summary,
      href: `/feed?proposal=${encodeURIComponent(item.id)}` };
    const background = item.background;
    if (!background || !/^https:\/\//.test(item.sourceUrl)) return [sample];
    return [sample, { ...sample, id: `background:${item.id}`, kind: 'background' as const,
      title: background.name, jurisdiction: background.publisher, description: background.scope, href: item.sourceUrl }];
  });
}

export function nextDiscovery(pool: Discovery[], seen: string[], previous?: Discovery, random = Math.random): Discovery | undefined {
  let available = pool.filter(item => !seen.includes(item.id));
  if (!available.length) available = pool.filter(item => item.id !== previous?.id);
  if (!available.length) return pool[0];
  const score = (item: Discovery) => previous ? Number(item.topic !== previous.topic) + Number(item.kind !== previous.kind) + Number(item.jurisdiction !== previous.jurisdiction) + Number(item.proposalId !== previous.proposalId) : 0;
  const best = Math.max(...available.map(score));
  const candidates = available.filter(item => score(item) === best);
  return candidates[Math.floor(random() * candidates.length)];
}
