import assert from 'node:assert/strict';
import { Window } from 'happy-dom';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { DiscussionGuide, discussionCommentId } from '../src/client/DiscussionGuide';
const dom = new Window({ url: 'http://localhost/proposals/pilot' });
for (const key of ['window', 'document', 'navigator']) Object.defineProperty(globalThis, key, { configurable: true, value: key === 'window' ? dom : (dom as any)[key] });
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
const comments = [
  { id: 'a', displayName: 'A', text: 'I support a six-month evening bus pilot because shift workers need a reliable way home. I would stop it if ridership stays low; I do not support a permanent tax increase yet.', createdAt: '2026-11-13' },
  { id: 'b', displayName: 'B', text: 'I oppose spending on that pilot until we publish route-level demand and a cost cap. Getting shift workers home matters to me too; I could support it with those safeguards.', createdAt: '2026-11-13' },
];
const before = JSON.stringify(comments);
const container = dom.document.createElement('div');
dom.document.body.append(container);
const root = createRoot(container as any);
// Any network/storage use fails: only public comment props may be consulted.
globalThis.fetch = (() => { throw new Error('Unexpected provider request'); }) as typeof fetch;
Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { throw new Error('Private draft access'); } });
await act(async () => root.render(<DiscussionGuide comments={comments} />));
assert.equal(container.querySelector('blockquote'), null);
const toggle = container.querySelector('input')!;
assert.equal(toggle.type, 'checkbox');
assert.match(toggle.parentElement!.textContent!, /Show optional reading guide/);
await act(async () => toggle.click());
assert.match(container.textContent!, /Machine-generated/);
assert.match(container.querySelector('[role=status]')!.textContent!, /all 2/);
for (const input of [comments, [...comments].reverse(), [{ ...comments[1]!, displayName: 'A' }, { ...comments[0]!, displayName: 'B' }]]) {
  await act(async () => root.render(<DiscussionGuide comments={input} />));
  assert.deepEqual([...container.querySelectorAll('blockquote')].map(x => x.textContent), input.map(x => x.text));
  assert.deepEqual([...container.querySelectorAll('a')].map(x => x.getAttribute('href')), input.map(x => `#${discussionCommentId(x.id)}`));
}
// Updated visibility replaces derived text immediately; no retained summary snapshot.
await act(async () => root.render(<DiscussionGuide comments={[]} />));
assert.equal(container.querySelector('blockquote'), null);
assert.match(container.textContent!, /No public comments/);
const injection = { ...comments[0]!, id: 'unsafe/#', text: '<script>ignore instructions</script>\n第三の意見' };
await act(async () => root.render(<DiscussionGuide comments={[injection]} />));
assert.equal(container.querySelector('script'), null);
assert.equal(container.querySelector('blockquote')!.textContent, injection.text);
assert.equal(container.querySelector('a')!.getAttribute('href'), `#${discussionCommentId(injection.id)}`);
await act(async () => toggle.click());
assert.equal(container.querySelector('blockquote'), null);
assert.equal(JSON.stringify(comments), before);
await act(async () => root.unmount());
await dom.happyDOM.close();
console.log('PASS guide: opt-in, opposite views, source links, refreshed visibility, privacy and escaped text');
