import { DEMO_ITEMS, type DemoItem } from '../engine/demo';
import { SITE_URL } from '../shared/page-metadata';
import { securityHeaders } from './public-security';

const escape = (value: string) => value.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
export const PROPOSAL_EMBED_CSP = "default-src 'none'; script-src 'none'; style-src 'unsafe-inline'; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors http: https:; sandbox allow-popups allow-popups-to-escape-sandbox";

/** Public, anonymous, static projection of sample content. Never reads resident data. */
export function proposalEmbed(req: Request, items: readonly DemoItem[] = DEMO_ITEMS): Response {
  const url = new URL(req.url);
  let status = 200;
  const id = url.searchParams.get('proposal');
  const item = id ? items.find(item => item.id === id) : undefined;
  let content: string;
  if (!id) {
    content = '<h1>Explore a sample proposal</h1><p>Choose a fictional learning scenario.</p><ul>' + items.map(item => `<li><a href="?proposal=${encodeURIComponent(item.id)}">${escape(item.title)}</a></li>`).join('') + '</ul>';
    if (!items.length) content = '<h1>No sample proposals available</h1><p>Please check again later.</p>';
  } else if (!item) {
    status = 404;
    content = '<h1>Proposal unavailable</h1><p>This sample link is unavailable.</p><a href="/embed/v1">Explore available samples</a>';
  } else {
    let source: URL | undefined;
    try { const parsed = new URL(item.sourceUrl); if (parsed.protocol === 'https:' && !parsed.username && !parsed.password) source = parsed; } catch {}
    content = `<h1>${escape(item.title)}</h1><p>${escape(item.summary)}</p><p><strong>Scenario jurisdiction:</strong> ${escape(item.jurisdiction)}</p><h2>Background sources</h2><p>${escape(item.background?.publisher ?? 'Publisher unavailable')} — ${escape(item.background?.name ?? 'Source unavailable')}</p>${source ? `<a target="_blank" rel="noopener noreferrer" href="${escape(source.href)}">Open background source (new tab)</a>` : '<p>Source unavailable</p>'}<p>Source review date: ${escape(item.background?.checkedAt ?? 'Not checked')}. ${escape(item.background?.scope ?? 'Background scope not documented.')}. Background only; does not verify this scenario or proposed text as official law.</p><a target="_blank" rel="noopener noreferrer" href="${SITE_URL}/feed?proposal=${encodeURIComponent(item.id)}">Read more about this sample (new tab)</a>`;
  }
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Sample proposal explorer · v1</title><style>body{font:1rem/1.6 system-ui,sans-serif;margin:0;padding:1rem;background:#fff;color:#172333;overflow-wrap:anywhere}main{max-width:46rem;margin:auto}h1{font-size:1.5rem;line-height:1.3}h2{font-size:1.15rem}a{color:#0645ad;display:inline-block;padding:.6rem .2rem}a:focus-visible{outline:3px solid currentColor;outline-offset:3px}li{margin:.4rem 0}footer{border-top:1px solid;padding-top:1rem}</style></head><body><main><p><strong>Fictional demo · read-only · Embed v1</strong></p>${content}<footer>No votes or model simulations are included. This card runs no scripts, uses no browser storage, and sends no analytics. The hosting service receives the normal page request.</footer></main></body></html>`;
  const response = securityHeaders(new Response(req.method === 'HEAD' ? null : html, { status, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } }));
  response.headers.set('content-security-policy', PROPOSAL_EMBED_CSP);
  response.headers.set('permissions-policy', 'camera=(), microphone=(), geolocation=(), payment=()');
  return response;
}
