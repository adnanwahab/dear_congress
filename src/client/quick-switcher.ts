import { CIVIC_STAGES, stageRoute } from '../shared/civic-stages';
import { PAGE_TITLES } from '../shared/page-metadata';
import { DEMO_ITEMS } from '../engine/demo';
import { NEEDS } from '../engine/catalog';

export interface SwitchResult { id: string; title: string; type: string; href?: string; keywords?: string; run?: () => void }
export const SWITCH_DESTINATIONS: SwitchResult[] = [
  ...CIVIC_STAGES.map(s => ({ id: s.route, title: s.title, type: 'Stage', href: s.route })),
  ...['/', '/map', '/journal', '/needs', '/synth', '/documentation', '/api-docs'].map(href => ({ id: href, title: PAGE_TITLES[href]!, type: 'Page', href, keywords: href === '/synth' ? 'Synthesis' : href === '/map' ? 'Map' : href === '/needs' ? 'Needs' : '' })),
  ...DEMO_ITEMS.flatMap(p => (['votes', 'feed', 'draft'] as const).map(stage => ({ id: `${p.id}-${stage}`, title: `${p.title} · ${stage === 'votes' ? 'Votes' : stage === 'feed' ? 'Feed' : 'Draft'}`, type: 'Proposal', href: stageRoute(stage, p.id), keywords: p.topic }))),
  ...NEEDS.map(n => ({ id: `need-${n.id}`, title: n.label, type: 'Need', href: `/needs?need=${encodeURIComponent(n.id)}`, keywords: n.keywords.join(' ') })),
];
export function matchDestinations(query: string, items = SWITCH_DESTINATIONS) {
  const words = query.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
  return items.filter(item => words.every(word => `${item.title} ${item.type} ${item.keywords ?? ''}`.toLocaleLowerCase().includes(word)))
    .sort((a, b) => Number(b.title.toLocaleLowerCase().startsWith(query.toLocaleLowerCase().trim())) - Number(a.title.toLocaleLowerCase().startsWith(query.toLocaleLowerCase().trim())));
}
export function ownsShortcut(target: EventTarget | null) {
  return target instanceof Element && !!target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"], [role="combobox"], [data-own-command-k]');
}
