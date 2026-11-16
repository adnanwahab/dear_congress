import { expect, test } from 'bun:test';
import { Window } from 'happy-dom';
import { renderToStaticMarkup } from 'react-dom/server';
import { SharedJournalFeed } from './SharedJournalFeed';
import { publicExcerpt } from './JournalSharing';
import { cardSvg } from './advisory-share';
import { renderPage } from '../server/pages';
import { createCitizenProposalHandlers, type CitizenProposalStore } from '../server/citizen-proposals';
import { parseBill } from '../server/legislation/import';
import { handlePublishDraftPost } from '../server/publish-draft-handler';
import type { JournalEntry } from '../engine/types';

// Fixed corpus plus seeded composition: failures reproduce without a fuzz service.
const atoms = [
  '<script>globalThis.xss=1</script>', '<img src=x onerror="globalThis.xss=1">',
  '</title><svg onload="globalThis.xss=1">', '</text><a href="javascript:alert(1)">x</a>',
  '<iframe srcdoc="<script>alert(1)</script>"></iframe>', '<math><mtext><img src=x onerror=alert(1)>',
  '&lt;script&gt;alert(1)&lt;/script&gt;', '&#x3c;img src=x onerror=alert(1)>',
  '" autofocus onfocus="alert(1)', "' onmouseover='alert(1)", '$&', '$`', "$'", '$$',
  'javascript:alert(1)', 'data:text/html,<script>alert(1)</script>', '漢字 🏠 & < >',
];
let seed = 947;
const next = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0);
const payloads = [...atoms, ...Array.from({ length: 64 }, () =>
  Array.from({ length: 1 + next() % 4 }, () => atoms[next() % atoms.length]!).join(' · '))];
const shell = '<html><head><title>Old</title></head><body><div id="root"></div></body></html>';
const req = (body?: unknown) => new Request('https://local.test/api/citizen-proposals', {
  method: body ? 'POST' : 'GET', headers: { 'content-type': 'application/json', 'x-voter-id': 'local-test-browser' },
  ...(body ? { body: JSON.stringify(body) } : {}),
});
function inert(root: Pick<Window['document'], 'querySelector' | 'querySelectorAll'>) {
  expect(root.querySelector('script:not([type="speculationrules"]),img,iframe,object,embed,foreignObject,math')).toBeNull();
  for (const element of root.querySelectorAll('*')) for (const attribute of element.attributes) {
    expect(attribute.name.toLowerCase().startsWith('on')).toBe(false);
    if (['href', 'src', 'xlink:href'].includes(attribute.name)) expect(attribute.value).not.toMatch(/^\s*(?:javascript|data|vbscript):/i);
  }
}

test('seed 947: submit/read JSON, journal HTML, imported metadata, rich preview and SVG card preserve inert text', async () => {
  const dom = new Window();
  try {
    for (const text of payloads) {
      const excerpt = publicExcerpt(text, 'Public fixture');
      const entry: JournalEntry = { id: 'source-947', text: excerpt.text, author: excerpt.author,
        createdAt: '2026-11-15T00:00:00Z', corrected: true, extraction: { needs: [], importance: .5, concerns: [], constraints: [], proposalIds: [] } };
      const store: CitizenProposalStore = { entries: [entry] };
      const unexpectedInference = () => { throw new Error('No inference authorized'); };
      const published = await handlePublishDraftPost({ ...excerpt, labels: [...excerpt.labels] }, {
        defaultKind: 'journal', currentNeeds: () => [],
        normalizeNeedIds: () => ({ submitted: [], valid: [], ignored: [] }),
        buildContext: unexpectedInference, extractWithLLM: unexpectedInference,
        ensureNeedCoverage: unexpectedInference, recordAnswer: unexpectedInference,
        createJournalEntry: input => ({ ...entry, ...input }), save: async () => {},
      });
      expect(published.mode).toBe('journal');
      if (published.mode === 'journal') expect(published.entry.text).toBe(text);
      const handlers = createCitizenProposalHandlers({ getStore: () => store, save: async () => {} });
      const submitted = await handlers.publish(req({ title: 'Fixture', problem: text, proposedChange: text,
        jurisdiction: 'city', sourceEntryId: entry.id, confirmedPublic: true, idempotencyKey: crypto.randomUUID() }));
      expect(submitted.status).toBe(200);
      expect(submitted.headers.get('content-type')).toContain('application/json');
      const record = store.citizenProposals![0]!;
      await handlers.comment(req({ text, displayName: 'Fixture', idempotencyKey: crypto.randomUUID() }), record.id);
      const detail = await (await handlers.detail(req(), record.id)).json();
      expect(detail.proposal.problem).toBe(text);
      expect(detail.proposal.comments[0].text).toBe(text);
      expect(detail.proposal.countTotal).toBe(0);
      expect((await (await handlers.journal(req(), entry.id)).json()).entry.text).toBe(text);

      dom.document.body.innerHTML = renderToStaticMarkup(<SharedJournalFeed entries={[entry]} needs={[]} loading={false} />);
      inert(dom.document.body);
      expect(dom.document.querySelector('article p')!.textContent).toBe(text);

      const imported = parseBill(JSON.stringify({ bill: { congress: 119, type: 'HR', number: '1', originChamber: 'House',
        title: text, sponsors: [{ fullName: text }], introducedDate: '2026-01-01', latestAction: { actionDate: '2026-01-01', text } } }), 119, 'hr', 1);
      expect(imported.title).toBe(text);
      expect(imported.id).toBe('congress-gov:119:hr:1');
      // Exercise imported/public strings in the actual crawler metadata sink.
      record.title = imported.title;
      const html = await renderPage(shell, `/proposals/${record.id}`, [record]).text();
      dom.document.documentElement.innerHTML = html;
      inert(dom.document);
      expect(dom.document.querySelector('meta[property="og:title"]')!.getAttribute('content')).toBe(`${text} | Civic Synthesis`);
      expect(dom.document.querySelector('meta[property="og:description"]')!.getAttribute('content')).toBe(text.slice(0, 240));
      const svg = new dom.DOMParser().parseFromString(cardSvg(text), 'image/svg+xml');
      inert(svg);
      expect(svg.querySelector('desc')!.textContent).toBe(text);
    }
  } finally { await dom.happyDOM.close(); }
});
