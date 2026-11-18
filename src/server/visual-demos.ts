import { securityHeaders } from './public-security';

/** Fixed allowlist: user-supplied demo content must never become an arbitrary file-read endpoint. */
export const VISUAL_DEMOS = {
  latency: 'latency.html',
  constitutions: 'constitutions.html',
  world: 'world.html',
  helios: 'helios.html',
  clocks: 'clocks.html',
  why: 'why.html',
} as const;

/**
 * Each full HTML demo runs with an opaque origin, including when opened directly.
 * In particular: no allow-same-origin, no form submissions, no parent navigation,
 * and no access to the Civic Synthesis session or authenticated voting endpoints.
 */
export const VISUAL_DEMO_CSP =
  "sandbox allow-scripts; default-src 'none'; script-src 'unsafe-inline' https:; style-src 'unsafe-inline' https:; font-src https: data:; img-src https: data: blob:; connect-src https:; worker-src blob:; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'self'";

export function serveVisualDemo(id: string, method = 'GET'): Response {
  const filename = Object.hasOwn(VISUAL_DEMOS, id) ? VISUAL_DEMOS[id as keyof typeof VISUAL_DEMOS] : null;
  if (!filename) return securityHeaders(new Response('Demo not found', { status: 404 }));
  if (method !== 'GET' && method !== 'HEAD') return securityHeaders(new Response('Method not allowed', { status: 405, headers: { Allow: 'GET, HEAD' } }));
  const content = method === 'HEAD' ? null : Bun.file(new URL(`../../public/civic-visual-stories/${filename}`, import.meta.url));
  const response = securityHeaders(new Response(content, {
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=3600' },
  }));
  response.headers.set('content-security-policy', VISUAL_DEMO_CSP);
  response.headers.set('x-frame-options', 'SAMEORIGIN');
  return response;
}
