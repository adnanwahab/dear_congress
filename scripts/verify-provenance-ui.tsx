/** DOM integration with fixture API failures; no production writes or native visual QA. */
import assert from 'node:assert/strict';
import { Window } from 'happy-dom';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import WorkflowScreen from '../src/client/WorkflowScreen';
import { demoPayload } from '../src/engine/demo';
const dom = new Window({ url: 'http://localhost/feed?proposal=demo-food' });
for (const key of ['window', 'document', 'navigator', 'localStorage', 'sessionStorage']) {
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
    if (section.tagName !== 'DETAILS') assert.match(link.textContent!, /—/);
  }
  const disclosures = [...container.querySelectorAll('details.workflow-provenance-compact')];
  if (stage === 'feed' || stage === 'published') {
    assert.equal(disclosures.length, 12);
    for (const disclosure of disclosures) {
      assert.equal(disclosure.hasAttribute('open'), false);
      const summary = disclosure.querySelector('summary')!;
      assert.match(summary.textContent!, /Sample scenario \/ not introduced bill/);
      assert.match(summary.textContent!, /Not checked/);
      assert(summary.querySelector('a[href^="https:"]'));
      (summary as any).click();
      assert.equal(disclosure.hasAttribute('open'), true);
      (summary as any).click();
      assert.equal(disclosure.hasAttribute('open'), false);
      assert.match(disclosure.querySelector('.workflow-provenance-body')!.textContent!, /Background only/);
    }
  } else assert.equal(disclosures.length, 0);
  if (stage === 'feed') assert(container.querySelector('aside .workflow-provenance:not(details)'));
  const food = sections.find(section => section.textContent!.includes('Food Access Research Atlas'))!;
  assert(food, stage);
  assert.match(food.textContent!, /Scenario jurisdiction: County/);
  assert.match(food.textContent!, /Federal food access data background; not evidence of a county pilot/);
  if (stage === 'votes') {
    const browser = () => container.querySelector('[aria-label="Unverified browser votes — advisory"]')!;
    assert(browser, 'separate browser counts shown');
    assert.match(browser.textContent!, /Support: 0 · Oppose: 0 · Not sure: 0/);
    assert.match(container.textContent!, /No verified participant count is reported/);
    assert.match(container.textContent!, /Synthetic demo data — illustrative/);
    for (const [label, expected] of [['Support', /Support: 1 · Oppose: 0/], ['Oppose', /Support: 0 · Oppose: 1/]] as const) {
      const button = [...container.querySelectorAll('.vote-options button')].find(b => b.textContent!.includes(`Cast advisory vote: ${label}`))!;
      assert(button, 'voting action available');
      await act(async () => { (button as any).click(); });
      assert.match(browser().textContent!, expected);
      assert.match(container.textContent!, /Server confirmed advisory choice/);
      assert.equal(button.getAttribute('aria-pressed'), 'true');
    }
    assert.equal(container.querySelector('a[href="/account"]')?.textContent, 'Participation & privacy');
  }
  if (stage === 'published' || stage === 'votes') {
    if (stage === 'votes') {
      const select = container.querySelector('.workflow-select select')!;
      await act(async () => { select.value = 'demo-transit'; select.dispatchEvent(new dom.Event('change', { bubbles: true })); });
    }
    const map = [...container.querySelectorAll('[aria-label="Compare arguments"]')].find(node => node.textContent!.includes('More frequent evening'))!;
    assert(map, 'integrated transit argument map');
    assert.equal(map.querySelectorAll('h4').length, 2);
    assert.equal(map.querySelectorAll('.argument-map-sides > section').length, 2);
    assert.equal((map.textContent!.match(/unverified assertion/g) ?? []).length, 4);
    assert.match(map.textContent!, /Evidence strength: unassessed/);
    const clauseLink = map.querySelector('a')!;
    await act(async () => { (clauseLink as any).click(); });
    assert(map.querySelector('details')!.open, 'clause link opens its target');
    if (stage === 'votes') {
      const buttons = [...container.querySelectorAll('.vote-options button')];
      assert.equal(buttons.length, 3);
      assert(map.compareDocumentPosition(buttons[0]!) & 4, 'arguments precede voting');
    }
  }
  await act(async () => { root.unmount(); });
  container.remove();
  console.log(`PASS ${stage}: provenance and API failure recovery`);
}
await dom.happyDOM.close();
