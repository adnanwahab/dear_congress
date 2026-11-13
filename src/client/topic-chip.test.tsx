import { expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { Window } from 'happy-dom';
import { TOPICS, getTopic, topicForNeed, topicForProposal } from '../shared/topics';
import { DEMO_ITEMS } from '../engine/demo';
import { TopicChip, NeedTopicChip } from './TopicChip';
import { SponsorBoard } from './SponsorBoard';

function luminance(hex: string) {
  const c = hex.slice(1).match(/../g)!.map(v => parseInt(v, 16) / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4);
  return c[0]! * .2126 + c[1]! * .7152 + c[2]! * .0722;
}
test('all demo topics have distinct shared icons/colors and safe explicit mappings', () => {
  expect(TOPICS).toHaveLength(8);
  for (const field of ['id', 'label', 'color', 'icon'] as const) expect(new Set(TOPICS.map(t => t[field])).size).toBe(8);
  for (const item of DEMO_ITEMS) expect(getTopic(item.topic)).toBeDefined();
  expect(topicForNeed('Affordable childcare')).toBe('Childcare');
  expect(topicForNeed('Housing affordability')).toBe('Housing');
  expect(topicForNeed('Reliable transit')).toBe('Transit');
  expect(topicForNeed('Food access')).toBe('Food access');
  expect(topicForNeed('Unknown need')).toBeUndefined();
  expect(topicForProposal('sample-drainage', [])).toBe('Climate');
  expect(topicForProposal('unknown', DEMO_ITEMS)).toBeUndefined();
  expect(renderToStaticMarkup(<NeedTopicChip label="Unknown need" />)).toBe('');
});
const css = (await Promise.all(['styles.css', 'workflow.css', 'sponsor-board.css', 'topic-chip.css'].map(f => Bun.file(new URL(f, import.meta.url)).text()))).join('\n');
for (const theme of ['light', 'dark']) test(`topic text keeps AA contrast through page cascades (${theme})`, () => {
  const window = new Window({ settings: { device: { prefersColorScheme: theme } } });
  try {
    window.document.head.innerHTML = `<style>${css}</style>`;
    window.document.body.innerHTML = ['entry-source', 'workflow-detail-meta', 'tracked-draft', 'need-top', 'topic-filters'].map(context => `<div class="${context}">${TOPICS.map(t => renderToStaticMarkup(<TopicChip topic={t.label} />)).join('')}</div>`).join('');
    for (const chip of window.document.querySelectorAll('.topic-chip')) {
      expect(chip.querySelector('svg[aria-hidden="true"] path')?.getAttribute('d')).toBeTruthy();
      const style = window.getComputedStyle(chip);
      expect(style.color).toBe('#fff');
      expect(window.getComputedStyle(chip.querySelector('span')!).color).toBe('#fff');
      const bg = style.backgroundColor;
      expect(1.05 / (luminance(bg) + .05)).toBeGreaterThanOrEqual(4.5);
    }
  } finally { window.happyDOM.abort(); window.close(); }
});
test('sponsor topics resolve from stable IDs without mutating stored cards', () => {
  const cards = [{ id: 'demo-housing', title: 'Saved title', office: 'Office', stage: 2, updatedAt: 'Saved' }, { id: 'sample-food', title: 'Legacy', office: 'Office', stage: 0, updatedAt: 'Saved' }];
  const before = JSON.stringify(cards);
  const html = renderToStaticMarkup(<SponsorBoard cards={cards} items={DEMO_ITEMS} save={() => true} className="workflow-board" />);
  expect(html).toContain('data-topic="housing"'); expect(html).toContain('data-topic="food-access"');
  expect(JSON.stringify(cards)).toBe(before);
});
test('topic identity appears across all demo pages and chip filters work', async () => {
  const child = Bun.spawn([process.execPath, 'scripts/verify-topic-chips-ui.tsx'], { stdout: 'pipe', stderr: 'pipe' });
  const [code, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()]);
  expect({ code, stderr }).toEqual({ code: 0, stderr: '' });
  expect(stdout).toContain('PASS topic chips');
});
