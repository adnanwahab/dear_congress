import { expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { DEMO_ITEMS, demoPayload } from '../engine/demo';
import { ArgumentMap, PILOT_TEXT } from './ArgumentMap';
const item = DEMO_ITEMS.find(item => item.id === 'demo-transit')!;
test('paired fictional trees disclose every unsupported claim and exact clause', () => {
  const html = renderToStaticMarkup(<ArgumentMap item={item} />);
  expect(item.proposedText).toBe(PILOT_TEXT);
  expect(html.match(/unverified assertion/g)).toHaveLength(4);
  expect(html.match(/Evidence strength: unassessed/g)).toHaveLength(4);
  expect(html.indexOf('Reasons for')).toBeLessThan(html.indexOf('Concerns'));
  expect(html.match(/What would change my mind/g)).toHaveLength(2);
  expect(html).toContain('not been reviewed as the strongest');
  expect(html).toContain(PILOT_TEXT);
});
test('unknown scope, same ID in another namespace and stale text fail closed', () => {
  for (const props of [ { item: { ...item, proposedText: `${PILOT_TEXT} Changed.` } }, { item: { ...item, id: 'citizen-transit' } }, { item, namespace: 'repository-pr' } ]) {
    const html = renderToStaticMarkup(<ArgumentMap {...props} />);
    expect(html).toContain('No reviewed arguments yet');
    expect(html).not.toContain('More frequent evening');
  }
});
test('rendering never changes proposal fixtures or browser advisory totals', () => {
  const votes = { browser: { 'demo-transit': { stance: -1 } } };
  const before = JSON.stringify({ votes, items: DEMO_ITEMS, payload: demoPayload(votes, 'browser') });
  renderToStaticMarkup(<ArgumentMap item={item} />);
  expect(JSON.stringify({ votes, items: DEMO_ITEMS, payload: demoPayload(votes, 'browser') })).toBe(before);
});
