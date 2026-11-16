import { statsAuthorized } from './launch-stats';
import { securityHeaders } from './public-security';
import { buildIdentity } from './build-identity';

const escape = (value: unknown) => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
/** Bounded process-local counters; route keys come exclusively from the router registry. */
export class OperatorHealth {
  private minutes = new Map<number, Map<string, { requests: number; failures: number }>>();
  readonly started: number;
  constructor(private now = Date.now) { this.started = now(); }
  private prune() {
    const minute = Math.floor(this.now() / 60000);
    for (const key of this.minutes.keys()) if (key < minute - 4) this.minutes.delete(key);
    return minute;
  }
  record(route: string, status: number) {
    const minute = this.prune();
    const bucket = this.minutes.get(minute) ?? new Map();
    const counts = bucket.get(route) ?? { requests: 0, failures: 0 };
    counts.requests++; if (status >= 500) counts.failures++;
    bucket.set(route, counts); this.minutes.set(minute, bucket);
  }
  snapshot() {
    const minute = this.prune();
    return Array.from({length: 5}, (_, i) => {
      const time = (minute - 4 + i) * 60000;
      return { time, observed: time + 60000 > this.started, routes: [...(this.minutes.get(minute - 4 + i) ?? [])] };
    });
  }
  handle(req: Request, token: string, queues: { writes: number; designs: number; writeFailures: number }) {
    const headers = { 'cache-control': 'no-store', 'x-robots-tag': 'noindex, nofollow', 'vary': 'Authorization' };
    const response = (body: string | null, status = 200, extra = {}) => securityHeaders(new Response(body, {status, headers: {...headers, ...extra}}));
    if (!statsAuthorized(req, token)) return response('Operator authentication required', 401, {'www-authenticate':'Basic realm="Operator health", charset="UTF-8"'});
    if (!['GET','HEAD'].includes(req.method)) return response('Method not allowed',405,{allow:'GET, HEAD'});
    if (req.method === 'HEAD') return response(null);
    const trend = this.snapshot();
    const failures = new Map<string, number>();
    for (const bucket of trend) for (const [route, counts] of bucket.routes) if (counts.failures) failures.set(route, (failures.get(route) ?? 0) + counts.failures);
    return response(`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Operator health</title><style>body{font:16px system-ui;background:#101924;color:#eef4fc;margin:0;padding:24px}main{max-width:1100px;margin:auto}a{color:#9ddaff}section{border:1px solid #64748b;border-radius:12px;padding:16px} .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:16px}table{width:100%;text-align:left}th,td{padding:6px}code{overflow-wrap:anywhere}p{line-height:1.5}</style><main><h1>Launch operator health</h1><p>Read-only · this process only · generated ${escape(new Date(this.now()).toISOString())}. <a href="/admin/health">Refresh observations</a>. Stale after 60 seconds; refresh before acting.</p><div class="grid"><section><h2>Release</h2><code>${escape(buildIdentity.commit ?? 'Unknown SHA — source checkout')}</code><p>${escape(buildIdentity.environment)} · ${escape(buildIdentity.flyRelease ?? 'Fly release unknown')}</p><p>Process started ${escape(new Date(this.started).toISOString())}. History resets on restart.</p></section><section><h2>Storage & queues</h2><p>JSON snapshot writes pending/active: <strong>${queues.writes}</strong><br>Idea designs in flight: <strong>${queues.designs}</strong><br>Write failures since start: <strong>${queues.writeFailures}</strong></p><p>DB saturation: unknown. Single-writer JSON storage has no connection pool; queue depth is pressure evidence, not capacity. Governance outbox depth: unknown (not initialized by this page).</p></section><section><h2>Five-minute API trend</h2><table><caption>UTC minute buckets; current minute partial</caption><tr><th>Minute</th><th>Requests</th><th>5xx</th></tr>${trend.map(b => `<tr><td>${new Date(b.time).toISOString().slice(11,16)}</td><td>${b.observed ? b.routes.reduce((s,[,c])=>s+c.requests,0) : '—'}</td><td>${b.observed ? b.routes.reduce((s,[,c])=>s+c.failures,0) : '—'}</td></tr>`).join('')}</table><p>Registered API handlers only; counts end at response headers, excluding stream-body/proxy failures.</p></section><section><h2>Failing API routes · 5xx</h2>${failures.size ? `<ul>${[...failures].map(([r,n])=>`<li><code>${escape(r)}</code>: ${n}</li>`).join('')}</ul>` : '<p>No observed 5xx in retained buckets. This does not prove availability.</p>'}<h2>External dependencies</h2><p>GitHub, LLM providers and Fly: unknown — no active probes or provider health feed. Configuration is not health evidence.</p><a href="https://fly.io/apps/civic-synthesis/monitoring" target="_blank" rel="noopener noreferrer">Open Fly logs (Fly login required)</a></section></div><section><h2>Rollback procedure · human release owner</h2><p>Confirm impact, release SHA and Fly target in logs. Pause rollout; retain the single writer and volume. Identify the previously validated image and confirm its compatibility with current data using an isolated restore. Do not delete, reset or overwrite production records.</p><p>A human maintainer must review checks and authorize a human-published tagged release under <code>docs/launch-merge-policy.md</code>. Deploy only the validated compatible image through the existing release gate; then verify /version, /healthz, read-only routes and logs. If compatibility is unknown, stop and escalate. This panel performs no rollback.</p></section></main></html>`,200,{'content-type':'text/html; charset=utf-8'});
  }
}
