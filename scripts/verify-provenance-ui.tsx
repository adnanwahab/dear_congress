/** DOM integration with fixture API failures; no production writes or native visual QA. */
import assert from 'node:assert/strict';
import { Window } from 'happy-dom';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import WorkflowScreen from '../src/client/WorkflowScreen';
import { demoPayload } from '../src/engine/demo';
const dom = new Window({ url: 'http://localhost/feed?proposal=demo-food' });
for (const key of ['window', 'document', 'navigator', 'localStorage']) {
  Object.defineProperty(globalThis, key, { configurable: true, value: key === 'window' ? dom : (dom as any)[key] });
}
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
for (const stage of ['published', 'feed', 'votes', 'draft'] as const) {
  dom.happyDOM.setURL(`http://localhost/${stage}?proposal=demo-food`);
  const container = dom.document.createElement('div');
  dom.document.body.append(container);
  const root = createRoot(container as any);
  let unavailable = true;
  const records: Record<string, Record<string, { stance: number }>> = {};
  const request = async <T,>(path: string, body?: any): Promise<T> => {
    if (unavailable) throw new Error('Offline');
    if (path === '/api/votes') { records.test ??= {}; for (const vote of body.votes) records.test[vote.proposalId] = vote; return { ok: true } as T; }
    return demoPayload(records, 'test') as T;
  };
  await act(async () => { root.render(<WorkflowScreen stage={stage} request={request} />); });
  assert.match(container.textContent!, /Could not load sample proposals/);
  unavailable = false;
  await act(async () => { (container.querySelector('[role=alert] button') as any).click(); });
  const sections = [...container.querySelectorAll('[aria-label="Scenario and background source"]')];
  assert(sections.length > 0, stage);
  for (const section of sections) {
    assert.match(section.textContent!, /Sample scenario \/ not introduced bill/);
    assert.match(section.textContent!, /Source not available \/ not checked/);
    const link = section.querySelector('a')!;
    assert.equal(link.getAttribute('rel'), 'noopener noreferrer');
    assert.match(link.textContent!, /—/);
  }
  const food = sections.find(section => section.textContent!.includes('Food Access Research Atlas'))!;
  assert(food, stage);
  assert.match(food.textContent!, /Scenario jurisdiction: County/);
  assert.match(food.textContent!, /Federal food access data background; not evidence of a county pilot/);
  if (stage === 'votes') {
    const browser = () => container.querySelector('[aria-label="Unverified browser votes — advisory"]')!;
    assert.match(browser().textContent!, /Support: 0 · Oppose: 0 · Not sure: 0/);
    assert.match(container.textContent!, /No verified participant count is reported/);
    for (const [label, expected] of [['Support', /Support: 1 · Oppose: 0/], ['Oppose', /Support: 0 · Oppose: 1/]] as const) {
      const button = [...container.querySelectorAll('button')].find(b => b.textContent!.includes(`Cast advisory vote: ${label}`))!;
      await act(async () => { (button as any).click(); });
      assert.match(browser().textContent!, expected);
      assert.equal(button.getAttribute('aria-pressed'), 'true');
      assert.match(container.textContent!, /1,080 synthetic demo responses/);
      assert.match(container.querySelector('[role="status"]')!.textContent!, /saved/);
    }
    assert.match(container.textContent!, /Not available/);
    assert.equal(container.querySelector('a[href="/account"]')?.textContent, 'Participation & privacy');
  }
  await act(async () => { root.unmount(); });
  container.remove();
  console.log(`PASS ${stage}: provenance and API failure recovery`);
}
await dom.happyDOM.close();
