import { expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { NeedMentionCount, needTransitionName, needUrl } from './journal-motion';

test('need links round-trip identities and transition names cannot collide', () => {
  const ids = ['housing', 'a-b', 'a:b', '水', 'a&entry=other'];
  expect(new Set(ids.map(needTransitionName)).size).toBe(ids.length);
  for (const id of ids) {
    const url = new URL(needUrl(id, 'entry&1'), 'https://example.test');
    expect(url.pathname).toBe('/needs');
    expect(url.searchParams.get('need')).toBe(id);
    expect(url.searchParams.get('entry')).toBe('entry&1');
    // Shared with NeedRow so the journal chip and the Needs row morph as one element.
    expect(needTransitionName(id)).toMatch(/^need-[a-f0-9-]+$/);
  }
});
test('count replay exposes the actual aggregate; ordinary and empty counts never decrement', () => {
  const replay = renderToStaticMarkup(<NeedMentionCount count={8} added />);
  expect(replay).toContain('aria-label="8"');
  expect(replay).toContain('aria-hidden="true">7');
  expect(replay).toContain('aria-hidden="true">8');
  expect(renderToStaticMarkup(<NeedMentionCount count={8} added={false} />)).not.toContain('need-count-before');
  expect(renderToStaticMarkup(<NeedMentionCount count={0} added />)).not.toContain('need-count-before');
});
