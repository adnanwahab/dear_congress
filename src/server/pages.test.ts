import { expect, test } from "bun:test";
import { renderPage, sitemap } from "./pages";
import { PAGE_TITLES, SITE_URL } from "../shared/page-metadata";
import type { CitizenProposalRecord } from "../shared/citizen-proposals";

const shell = '<html><head><title>Old</title></head><body><div id="root"></div><script src="/app.js"></script></body></html>';
const proposal = { id: 'citizen_1', title: '\"><script>alert(1)</script> & homes', problem: 'A "public" problem <here>' } as CitizenProposalRecord;

test("all existing pages expose full crawler metadata in the initial HTML", async () => {
  for (const path of Object.keys(PAGE_TITLES)) {
    const response = renderPage(shell, path, []);
    expect(response.status).toBe(200);
    const html = await response.text();
    for (const key of ['name="description"', 'property="og:title"', 'property="og:description"', 'property="og:url"', 'property="og:image"', 'content="1200"', 'content="630"', 'name="twitter:card"', 'name="twitter:title"', 'name="twitter:description"', 'name="twitter:image"']) expect(html).toContain(key);
    expect(html).toContain(SITE_URL + path);
    if (path === "/privacy") {
      expect(html).not.toContain("<script");
      expect(html).toContain("<h1>Privacy &amp; removal</h1>");
      expect(html).toContain("no automatic expiry");
    } else expect(html).toContain('<script src="/app.js">');
  }
});

test("proposal-specific previews escape public text", async () => {
  const html = await renderPage(shell, '/proposals/citizen_1', [proposal]).text();
  expect(html).toContain('&quot;&gt;&lt;script&gt;alert(1)&lt;/script&gt; &amp; homes');
  expect(html).toContain('A &quot;public&quot; problem &lt;here&gt;');
  expect(html).not.toContain('<script>alert');
});

test("unknown routes and missing proposals are useful HTTP 404s without mounting React", async () => {
  for (const path of ['/unknown', '/proposals/missing', '/<script>']) {
    const response = renderPage(shell, path, []);
    expect(response.status).toBe(404);
    const html = await response.text();
    expect(html).toContain('href="/feed"');
    expect(html).toContain('href="/votes"');
    expect(html).not.toContain('<script');
    expect(html).toContain('<title>Page not found');
  }
});

test("sitemap includes public proposal addresses and omits internal/form routes", () => {
  const xml = sitemap([proposal]);
  expect(xml).toContain(`${SITE_URL}/proposals/citizen_1`);
  expect(xml).not.toContain('/embed');
  expect(xml).not.toContain('/proposals/new');
  expect(xml).toContain('/documentation');
});

test("production HTML build retains executable assets and the social PNG has its advertised dimensions", async () => {
  const build = await Bun.build({ entrypoints: [new URL('../../index.html', import.meta.url).pathname], target: 'browser', publicPath: '/', naming: '[name]-[hash].[ext]', minify: true });
  expect(build.success).toBe(true);
  const output = build.outputs.find((item) => item.type.startsWith('text/html'))!;
  const html = await renderPage(await output.text(), '/votes', []).text();
  const assets = [...html.matchAll(/(?:src|href)="(\/[^"?#]+\.(?:js|css))"/g)];
  expect(assets.length).toBeGreaterThanOrEqual(2);
  for (const match of assets) expect(build.outputs.some((item) => '/' + item.path.split('/').pop() === match[1])).toBe(true);
  const png = new DataView(await Bun.file(new URL('../../public/social-preview.png', import.meta.url)).arrayBuffer());
  expect(png.getUint32(0)).toBe(0x89504e47);
  expect(png.getUint32(16)).toBe(1200);
  expect(png.getUint32(20)).toBe(630);
});

test("recovered product routes resolve, including trailing slash, while privacy remains static", async () => {
  for (const path of ["/map", "/published", "/draft", "/sponsors", "/outcomes", "/documentation", "/map/"]) {
    expect(renderPage(shell, path, []).status).toBe(200);
  }
});

test('speculation is limited to same-origin navigation routes and prioritizes the next stage', async () => {
  const { speculationRules } = await import('./pages');
  const { CIVIC_STAGES, STAGES } = await import('../shared/civic-stages');
  const { securityHeaders } = await import('./public-security');
  for (const stage of CIVIC_STAGES) {
    const response = securityHeaders(renderPage(shell, stage.route, []));
    expect(response.headers.get('cache-control')).toBe('no-cache');
    expect(response.headers.get('content-security-policy')).toContain("'inline-speculation-rules'");
    expect(response.headers.get('content-security-policy')).not.toContain("script-src 'self' 'unsafe-inline'");
    const html = await response.text();
    const rules = JSON.parse(html.match(/<script type="speculationrules">(.*?)<\/script>/)![1]!);
    expect(rules).toEqual(speculationRules(stage.route));
    expect(rules.prerender.map((r: { eagerness: string }) => r.eagerness)).toEqual(['moderate', 'eager']);
    expect(rules.prerender[0].where.and[0].href_matches).toEqual(
      [...CIVIC_STAGES.map(s => s.route), '/map', '/journal'].flatMap(path => [path, `${path}?*`])
    );
    expect(rules.prerender[1].where.and[0].href_matches).toEqual([STAGES[stage.next].route, `${STAGES[stage.next].route}?*`]);
  }
});
