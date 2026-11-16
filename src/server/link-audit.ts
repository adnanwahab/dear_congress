import { PAGE_TITLES } from '../shared/page-metadata';
import { billCollection } from '../shared/bill-catalog';

export const sourceTargets = [
  { url: 'https://api.census.gov/data.html', owner: 'data/outcomes.json' },
  { url: 'https://www.fema.gov/openfema-data-page/fima-nfip-redacted-claims-v2', owner: 'data/outcomes.json' },
  { url: 'https://mycity.houstontx.gov/arcgis/rest/services/wm/', owner: 'data/outcomes.json' },
];
export const missingTargets = ['/link-audit-missing-page', '/proposals/citizen_link_audit_missing', '/bills/HFL-101', '/topics/link-audit-missing', '/live/00000000', '/api/topics/link-audit-missing'];

type Target = { url: string; owner: string; expected: number; external?: boolean };
export async function auditLinks(origin: string, request: typeof fetch = fetch, pause = (ms: number) => Bun.sleep(ms)) {
  const base = new URL(origin);
  const queue: Target[] = [
    ...[...Object.keys(PAGE_TITLES), ...billCollection.bills.map(b => `/bills/${b.id}`), '/sitemap.xml'].map(path => ({ url: new URL(path, base).href, owner: 'src/shared/page-metadata.ts / src/shared/bill-catalog.ts', expected: 200 })),
    ...missingTargets.map(path => ({ url: new URL(path, base).href, owner: 'src/server/pages.ts / server.ts', expected: 404 })),
    ...sourceTargets.map(t => ({ ...t, expected: 200, external: true })),
  ];
  const seen = new Set<string>();
  const results: Array<Target & { status: number | null; problem: string | null }> = [];
  let truncated = false;
  for (let i = 0; i < queue.length; i++) {
    const target = queue[i]!;
    if (seen.has(target.url)) continue;
    if (seen.size >= 400) { truncated = true; break; }
    seen.add(target.url);
    await pause(target.external ? 1500 : 100);
    try {
      // Manual redirects prevent following external links or unreviewed destinations.
      const response = await request(target.url, { redirect: 'manual', signal: AbortSignal.timeout(10_000), headers: { 'User-Agent': 'DearCongress-LinkAudit/1.0 (read-only; bounded weekly audit)' } });
      const problem = response.status !== target.expected ? (target.expected === 404 && response.status === 200 ? 'unexpected-200' : response.status >= 300 && response.status < 400 ? 'redirect-review' : 'unexpected-status') : null;
      results.push({ ...target, status: response.status, problem });
      if (!target.external && target.expected === 200 && response.status === 200) {
        const reader = response.body?.getReader();
        const chunks: ArrayBuffer[] = [];
        let size = 0;
        if (reader) {
          try {
            while (true) {
              const part = await reader.read();
              if (part.done) break;
              size += part.value.byteLength;
              if (size > 2_000_000) { truncated = true; break; }
              chunks.push(Uint8Array.from(part.value).buffer);
            }
          } finally { await reader.cancel(); }
        }
        const text = await new Blob(chunks).text();
        const links: string[] = [];
        if (response.headers.get('content-type')?.includes('text/html')) {
          await new HTMLRewriter().on('a[href]', { element(e) { links.push(e.getAttribute('href')!); } }).transform(new Response(text)).text();
        }
        if (new URL(target.url).pathname === '/sitemap.xml') {
          for (const match of text.matchAll(/<loc>([^<]+)<\/loc>/g)) links.push(match[1]!.replaceAll('&amp;', '&'));
        }
        for (const link of links) {
          try {
            const url = new URL(link, target.url);
            if (url.origin !== base.origin || url.search || url.username || url.password || url.pathname.startsWith('/api/')) continue;
            url.hash = '';
            if (queue.length < 1500) queue.push({ url: url.href, expected: 200, owner: new URL(target.url).pathname });
            else truncated = true;
          } catch { /* Non-URL anchors are not request targets. */ }
        }
      } else await response.body?.cancel();
    } catch { results.push({ ...target, status: null, problem: 'network-or-timeout' }); }
  }
  return { checkedAt: new Date().toISOString(), origin: base.origin, truncated, results, failed: truncated || results.some(r => r.problem) };
}
