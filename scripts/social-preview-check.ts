import { strict as assert } from 'node:assert';
import { Window } from 'happy-dom';
import { billCollection } from '../src/shared/bill-catalog';
import { SITE_URL } from '../src/shared/page-metadata';
import type { CitizenProposalRecord } from '../src/shared/citizen-proposals';

// Synthetic public records only; installed in the smoke runner's disposable DB.
export const previewProposals: CitizenProposalRecord[] = [
  ['preview-housing', 'Sample housing & access', 'A fictional housing problem.'],
  ['preview-transit', 'Sample "night" buses', 'A fictional transit problem.'],
  ['preview-care', 'Sample <care> proposal', 'A fictional care problem.'],
].map(([id, title, problem]) => ({
  id: id!, title: title!, problem: problem!, proposedChange: 'Synthetic regression fixture only.',
  jurisdiction: 'unsure', createdAt: '2026-11-16T00:00:00Z', publishedAt: '2026-11-16T00:00:00Z',
  ownerHash: 'fixture', publishKeyHash: id!, bodyHash: id!, votesByVoterHash: {}, comments: [],
}));

export async function checkSocialPreviews(get: (path: string) => Promise<Response>) {
  const cases = [
    { path: '/', status: 200, title: 'Overview | Civic Synthesis', description: 'Share everyday needs, discuss citizen proposals, and explore advisory votes and illustrative civic plans.' },
    ...previewProposals.map(p => ({ path: `/proposals/${p.id}`, status: 200, title: `${p.title} | Civic Synthesis`, description: `${p.problem} Citizen-submitted advisory proposal; not enacted law.` })),
    ...['HFL-001', 'HFL-051'].map(id => {
      const bill = billCollection.bills.find(b => b.id === id)!;
      return { path: `/bills/${id}`, status: 200, title: `${id}: ${bill.title} | Civic Synthesis`, description: `${bill.proposedChange} Unreviewed editorial draft concept; not introduced legislation.` };
    }),
    ...['/missing-preview', '/proposals/missing-preview', '/bills/HFL-101'].map(path => ({ path, status: 404, title: 'Page not found | Civic Synthesis', description: 'This page could not be found. Explore the proposal feed or citizen votes.' })),
  ];
  for (const item of cases) {
    // Queries must not leak into the canonical address or crawler previews.
    const response = await get(item.path + '?utm_source=preview-test');
    assert.equal(response.status, item.status, item.path);
    assert.match(response.headers.get('content-type') ?? '', /text\/html/, item.path);
    const window = new Window();
    try {
      window.document.write(await response.text());
      const one = (selector: string, attribute?: string) => {
        const nodes = window.document.querySelectorAll(selector);
        assert.equal(nodes.length, 1, `${item.path}: exactly one ${selector}`);
        return attribute ? nodes[0]!.getAttribute(attribute) : nodes[0]!.textContent;
      };
      assert.equal(one('title'), item.title);
      assert.equal(one('link[rel="canonical"]', 'href'), SITE_URL + item.path);
      assert.equal(one('meta[property="og:url"]', 'content'), SITE_URL + item.path);
      assert.equal(one('meta[name="twitter:card"]', 'content'), 'summary_large_image');
      for (const selector of ['meta[property="og:title"]', 'meta[name="twitter:title"]']) assert.equal(one(selector, 'content'), item.title);
      for (const selector of ['meta[name="description"]', 'meta[property="og:description"]', 'meta[name="twitter:description"]']) assert.equal(one(selector, 'content'), item.description);
      for (const selector of ['meta[property="og:image"]', 'meta[name="twitter:image"]']) {
        const url = new URL(one(selector, 'content')!);
        assert.equal(url.href, `${SITE_URL}/social-preview.png`);
        // Fetch locally through the real asset route; never probe production.
        const image = await get(url.pathname);
        assert.equal(image.status, 200, `${item.path}: ${selector}`);
        assert.match(image.headers.get('content-type') ?? '', /^image\/png/);
        const bytes = new Uint8Array(await image.arrayBuffer());
        assert.deepEqual([...bytes.slice(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
        const png = new DataView(bytes.buffer);
        assert.equal(png.getUint32(16), 1200);
        assert.equal(png.getUint32(20), 630);
      }
      assert.equal(one('meta[property="og:image:width"]', 'content'), '1200');
      assert.equal(one('meta[property="og:image:height"]', 'content'), '630');
    } finally {
      await window.happyDOM.close();
    }
  }
  console.log('Social previews passed: Home, 3 synthetic proposals, 2 curated drafts, and 3 missing routes.');
}
