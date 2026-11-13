import assert from 'node:assert/strict';
import { Window } from 'happy-dom';
import { act } from 'react';
import { Dashboard } from '../src/client/Dashboard';
import WorkflowScreen from '../src/client/WorkflowScreen';
import { demoPayload } from '../src/engine/demo';
const dom = new Window({ url: 'http://localhost/feed' });
for (const key of ['window', 'document', 'navigator', 'localStorage', 'sessionStorage']) Object.defineProperty(globalThis, key, { configurable: true, value: key === 'window' ? dom : (dom as any)[key] });
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
const { createRoot } = await import('react-dom/client');
const payload = demoPayload({}, 'test');
const request = async <T,>(): Promise<T> => payload as T;
for (const stage of ['home', 'feed', 'published', 'votes', 'draft', 'sponsors', 'outcomes'] as const) {
  dom.history.replaceState(null, '', `/${stage}?proposal=demo-housing`);
  const container = dom.document.createElement('div'); dom.document.body.append(container);
  const root = createRoot(container as any);
  await act(async () => root.render(stage === 'home' ? <Dashboard request={request} /> : <WorkflowScreen stage={stage} request={request} />));
  assert(container.querySelector('[data-topic="housing"]'), `${stage} selected topic`);
  if (['home', 'feed', 'published'].includes(stage)) {
    for (const topic of new Set(payload.items.map(i => i.topic))) assert([...container.querySelectorAll('.topic-filters .topic-chip')].some(c => c.textContent === topic));
    await act(async () => (container.querySelector('.topic-filters button[aria-label="Transit"]') as any).click());
    const cards = container.querySelectorAll(stage === 'home' ? '.entry-item' : stage === 'feed' ? '.workflow-feed-item' : '.workflow-source');
    assert.equal(cards.length, payload.items.filter(i => i.topic === 'Transit').length);
    for (const card of cards) assert(card.querySelector('[data-topic="transit"]'));
  }
  if (stage === 'sponsors' || stage === 'home') assert(container.querySelector('.tracked-draft [data-topic="climate"]'));
  if (stage === 'outcomes') assert(container.querySelector('.workflow-outcome-list [data-topic="food-access"]'));
  await act(async () => root.unmount()); container.remove();
}
console.log('PASS topic chips: seven pages, filter selection and legacy tracker identities');
await dom.happyDOM.close();
