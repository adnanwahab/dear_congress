import { escapeHTML } from './pages';
import { browserErrorRoutes } from '../shared/error-route';
import { securityHeaders } from './public-security';
import { buildIdentity } from './build-identity';

/** Only registered templates may become labels. Never store request URLs or errors. */
export function createErrorTelemetry(templates: string[], emit: (record: object) => void = record => console.error('[PUBLIC_ERROR]', JSON.stringify(record))) {
  const allowed = new Set(templates);
  const counts = new Map<string, number>();
  const browserCounts = new Map<string, number>();
  const browserVersions = new Set<string>();
  function browserReport(value: unknown) {
    if (!value || typeof value !== 'object') return false;
    const input = value as Record<string, unknown>;
    if (Object.keys(input).sort().join(',') !== 'buildSha,category,routeTemplate') return false;
    if (input.buildSha !== null && (typeof input.buildSha !== 'string' || !/^[a-f0-9]{40}$/.test(input.buildSha))) return false;
    if (typeof input.routeTemplate !== 'string' || !browserErrorRoutes.has(input.routeTemplate)) return false;
    if (input.category !== 'error' && input.category !== 'unhandledrejection') return false;
    const version = input.buildSha as string | null;
    if (!browserVersions.has(version ?? 'unknown') && browserVersions.size >= 20) return false;
    browserVersions.add(version ?? 'unknown');
    const key = JSON.stringify([version, input.routeTemplate, input.category]);
    browserCounts.set(key, (browserCounts.get(key) ?? 0) + 1);
    try { emit({ source: 'unverified-browser', buildSha: version, routeTemplate: input.routeTemplate, category: input.category }); } catch {}
    return true;
  }
  function report(route: string, status: number) {
    if (status < 400) return;
    const template = allowed.has(route) ? route : 'unmatched';
    const key = `${template}|${status}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
    try { emit({ buildSha: buildIdentity.commit, routeTemplate: template, status }); } catch { /* Observability must not fail a request. */ }
  }
  return {
    report, browserReport,
    page() {
      const rows = [...browserCounts].map(([key, count]) => {
        const [sha, route, category] = JSON.parse(key);
        return `<tr><td>${sha ?? 'unknown'}</td><td>${escapeHTML(route)}</td><td>${category}</td><td>${count}</td></tr>`;
      }).join('');
      const serverRows = [...counts].map(([key, count]) => {
        const [route, status] = key.split('|');
        return `<tr><td>${escapeHTML(route!)}</td><td>${status}</td><td>${count}</td></tr>`;
      }).join('');
      return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Deployment diagnostics</title><body><main><h1>Deployment diagnostics</h1><p>This process since startup. Counts reset on restart; these are not fleet totals or affected people.</p><h2>Server build ${buildIdentity.commit ?? 'unknown'}</h2><table><caption>Server HTTP failures</caption><tr><th>Route template</th><th>Status</th><th>Count</th></tr>${serverRows}</table><h2>Browser version split</h2><p>Unverified client reports; SHAs are labels, not proof of deployment. At most 20 versions; unknown builds remain visible.</p><table><caption>Browser failures by asset revision</caption><tr><th>Build SHA</th><th>Route template</th><th>Category</th><th>Count</th></tr>${rows}</table></main></body></html>`;
    },
    snapshot: () => ({ scope: 'this process since startup', browserFailures: [...browserCounts].map(([key, count]) => { const [buildSha, routeTemplate, category] = JSON.parse(key); return { source: 'unverified-browser', buildSha, routeTemplate, category, count }; }), buildSha: buildIdentity.commit, failures: [...counts].map(([key, count]) => { const [routeTemplate, status] = key.split('|'); return { routeTemplate, status: Number(status), count }; }) }),
    async observe(route: string, run: () => Response | Promise<Response>) {
      let response: Response;
      try { response = await run(); }
      catch { response = securityHeaders(new Response('Internal Server Error', { status: 500 })); }
      report(route, response.status);
      response.headers.set('x-build-sha', buildIdentity.commit ?? 'unknown');
      response.headers.set('x-route-template', allowed.has(route) ? route : 'unmatched');
      return response;
    },
  };
}
