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
  let writes = 0;
  const records: Record<string, Record<string, { stance: number }>> = {};
  const request = async <T,>(path: string, body?: any): Promise<T> => {
    if (body !== undefined) writes++;
    if (unavailable) throw new Error('Offline');
    if (path === '/api/votes') { records.test ??= {}; for (const vote of body.votes) records.test[vote.proposalId] = vote; return { ok: true } as T; }
    return demoPayload(records, 'test') as T;
  };
  await act(async () => { root.render(<WorkflowScreen stage={stage} request={request} />); });
  assert.match(container.textContent!, /Could not load sample proposals/);
  assert.equal(container.querySelector('.evidence-conditions'), null, 'no evidence editor without loaded proposal');
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
    assert.equal(disclosures.length, stage === 'feed' ? 13 : 12);
    const first = disclosures[0]!;
    const chip = first.querySelector('summary')!;
    await act(async () => { chip.dispatchEvent(new dom.PointerEvent('pointerover', { bubbles: true, pointerType: 'mouse' })); });
    assert(first.hasAttribute('open'), 'mouse hover inspects');
    await act(async () => { dom.document.dispatchEvent(new dom.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); });
    assert(!first.hasAttribute('open'), 'Escape dismisses hover');
    await act(async () => { (chip as any).focus(); });
    assert(first.hasAttribute('open'), 'focus inspects');
    await act(async () => { dom.document.dispatchEvent(new dom.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); });
    assert(!first.hasAttribute('open'), 'Escape dismisses focused inspection');
    assert.equal(dom.document.activeElement, chip);
    await act(async () => { chip.dispatchEvent(new dom.PointerEvent('pointerover', { bubbles: true, pointerType: 'touch' })); });
    assert(!first.hasAttribute('open'), 'touch does not rely on hover');
    await act(async () => { (chip as any).click(); });
    assert(first.hasAttribute('open'), 'tap opens');
    const original = first.querySelector('a')!;
    assert.equal(original.getAttribute('target'), '_blank');
    const params = new URLSearchParams(dom.location.search);
    assert.equal(params.get('proposal'), 'demo-food', 'source inspection never changes the selected proposal');
    if (stage === 'feed') {
      assert.equal(params.get('discover'), null, 'passive feed visits must not rewrite the route URL');
      assert.equal(JSON.parse(dom.localStorage.getItem('civic_sample_discovery_v1') || 'null')?.cursor, 'demo-housing', 'discovery deck independently stores its current card');
    }
    await act(async () => { (first.querySelector('button') as any).click(); });
    assert(!first.hasAttribute('open'), 'close button dismisses');
    await act(async () => { (chip as any).blur(); });
    for (const disclosure of disclosures) {
      assert.equal(disclosure.hasAttribute('open'), false);
      const summary = disclosure.querySelector('summary')!;
      assert.match(summary.textContent!, /Sample scenario \/ not introduced bill/);
      assert.match(summary.textContent!, /Not checked/);
      assert(!summary.querySelector('a'));
      assert(disclosure.querySelector('.workflow-provenance-body a[href^="https:"]'));
      await act(async () => { (summary as any).click(); });
      assert.equal(disclosure.hasAttribute('open'), true);
      await act(async () => { (summary as any).click(); });
      assert.equal(disclosure.hasAttribute('open'), false);
      assert.match(disclosure.querySelector('.workflow-provenance-body')!.textContent!, /Background only/);
    }
  } else assert.equal(disclosures.length, 0);
  if (stage === 'feed') assert(container.querySelector('aside .workflow-provenance:not(details)'));
  const food = sections.find(section => section.textContent!.includes('Food Access Research Atlas'))!;
  assert(food, stage);
  assert.match(food.textContent!, /Scenario jurisdiction: County/);
  assert.match(food.textContent!, /Federal food access data background; not evidence of a county pilot/);
  const layers = food.querySelectorAll('.evidence-layer');
  assert.equal(layers.length, 3);
  assert.equal(layers[0]!.open, true);
  for (const layer of [...layers].slice(1)) {
    assert.equal(layer.open, false);
    (layer.querySelector('summary') as any).click();
    assert.equal(layer.open, true);
  }
  assert.match(food.textContent!, /illustrative inference, not official fact/);
  assert.match(food.textContent!, /not a pinned document revision/);
  assert.equal(writes, 0, 'reading, retry and peeling never submit');
  if (stage === 'votes') {
    const browser = () => container.querySelector('[aria-label="Unverified browser votes — advisory"]')!;
    assert(browser(), 'separate browser counts shown');
    assert.match(browser().textContent!, /Support: 0 · Oppose: 0 · Not sure: 0/);
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
      const nextEvidence = container.querySelector('section[aria-label="Scenario and background source"]')!;
      assert.match(nextEvidence.textContent!, /Metropolitan Transit Authority/);
      assert(!nextEvidence.textContent!.includes('Food Access Research Atlas'));
      assert.equal(nextEvidence.querySelectorAll('.evidence-layer[open]').length, 1, 'new proposal resets nested disclosure state');
    }
    const map = [...container.querySelectorAll('[aria-label="Compare arguments"]')].find(node => node.textContent!.includes('More frequent evening'))!;
    assert(map, 'integrated transit argument map');
    assert.equal(map.querySelectorAll('.argument-map-sides > section > h4').length, 2);
    const evidence = map.querySelector('.evidence-conditions')!;
    assert(evidence, 'private cards appear on the loaded transit revision');
    const beforeCards = JSON.stringify(records);
    evidence.querySelector('details')!.open = true;
    await act(async () => (evidence.querySelector('button') as any).click());
    assert(evidence.querySelector('textarea'));
    assert.equal(JSON.stringify(records), beforeCards, 'using a condition leaves existing advisory votes untouched');
    assert.equal(map.querySelectorAll('.argument-map-sides > section').length, 2);
    assert.equal((map.querySelector('.argument-map-sides')!.textContent!.match(/unverified assertion/g) ?? []).length, 4);
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
  await act(async () => {
    root.unmount();
    // Settle resources requested by the mounted workflow before leaving act.
    // Preserve the loading/retry assertions above and the empty-stderr contract.
    await Promise.all([
      import('../src/client/LawBehaviorExplorer'), import('../src/client/CitizenJury'),
      import('../src/client/ProposalPaper'), import('../src/client/ProposalDuet'),
      import('../src/client/JurisdictionComparison'), import('../src/client/CooperativeMission'),
      import('../src/client/civic-house-return'), import('../src/client/ResponsibilityExplorer'),
      import('../src/client/EvidenceNotebook'), import('../src/client/PolicyMeasurements'),
      import('../src/client/ResponseComposition'), import('../src/client/DataGapsAtlas'),
      import('../src/client/FactCheckGame'),
    ]);
  });
  container.remove();
  console.log(`PASS ${stage}: provenance and API failure recovery`);
}
await dom.happyDOM.close();
