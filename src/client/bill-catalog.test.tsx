import { test, expect } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { billCollection, searchBills } from '../shared/bill-catalog';
import { LegislativeMarkdown } from './BillCatalog';
import { renderPage, sitemap } from '../server/pages';
test('search covers every catalog field and combines category with all terms', () => {
  for (const category of billCollection.categories) expect(searchBills('', category)).toHaveLength(10);
  expect(searchBills('hfl-051', '')[0]?.title).toBe('Third Places for Everyone Act');
  expect(searchBills('welcoming buying', '')[0]?.id).toBe('HFL-051');
  expect(searchBills('stable operating budgets', '')[0]?.id).toBe('HFL-051');
  expect(searchBills('repeat attendance', '')[0]?.id).toBe('HFL-051');
  expect(searchBills('hfl-051', billCollection.categories[0]!)).toHaveLength(0);
  expect(searchBills('no-such-draft', '')).toHaveLength(0);
});
test('supplemental Markdown is structural text and escapes hostile content', () => {
  const html = renderToStaticMarkup(<LegislativeMarkdown source={'# Title\n\n## Funding\n\n- First\n- Second\n\n<script>alert(1)</script>\n\n[click](javascript:alert(1))'} />);
  expect(html).toContain('<h2>Title</h2>');
  expect(html).toContain('<h3>Funding</h3>');
  expect(html).toContain('<ul><li>First</li><li>Second</li></ul>');
  expect(html).not.toContain('<script>');
  expect(html).not.toContain('href=');
  expect(html).toContain('&lt;script&gt;');
});
test('all detail routes resolve with correct source metadata, unknown IDs remain 404', async () => {
  for (const bill of billCollection.bills) {
    const response = renderPage('<html><head><title>App</title></head><body><div id="root"></div></body></html>', `/bills/${bill.id}`, []);
    expect(response.status).toBe(200);
    expect(await response.text()).toContain(bill.id);
    expect(sitemap([])).toContain(`/bills/${bill.id}`);
  }
  expect(renderPage('', '/bills/HFL-101', []).status).toBe(404);
});
test('catalog UI controls, restored URL and expanded detail are isolated from APIs', async () => {
  const child = Bun.spawn([process.execPath, 'scripts/verify-bill-catalog-ui.tsx'], { stdout: 'pipe', stderr: 'pipe' });
  const [code, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()]);
  expect({ code, stderr }).toEqual({ code: 0, stderr: '' });
  expect(stdout).toContain('PASS catalog:');
});
