import { escapeHTML } from './pages';

export const SLO_WINDOW_MS = 600_000;
type Event = { at: number; route: string; ms: number; failed: boolean; blocked: boolean; client: boolean };
/** Process-local, bounded, content-free operational signals. Never civic records. */
export class ServiceSLOs {
  private events: Event[] = [];
  private overflowAt = -Infinity;
  readonly startedAt: number;
  constructor(private now = Date.now, private capacity = 100_000) { this.startedAt = now(); }
  private prune() {
    const cutoff = this.now() - SLO_WINDOW_MS;
    if (this.events[0] && this.events[0].at <= cutoff) {
      const first = this.events.findIndex(e => e.at > cutoff);
      this.events = first < 0 ? [] : this.events.slice(first);
    }
  }
  private add(event: Omit<Event, 'at'>) {
    this.prune();
    if (this.events.length >= this.capacity) { this.overflowAt = this.now(); return; }
    this.events.push({ ...event, at: this.now() });
  }
  response(route: string, ms: number, status: number, blocked = false) {
    this.add({ route, ms: Math.max(0, ms), failed: status >= 500 && !blocked, blocked, client: false });
  }
  save(outcome: 'saved' | 'failed' | 'blocked') {
    this.add({ route: 'advisory saves', ms: 0, failed: outcome === 'failed', blocked: outcome === 'blocked', client: true });
  }
  snapshot() {
    this.prune();
    const groups = new Map<string, Event[]>();
    for (const e of this.events) { const key = e.route; const group = groups.get(key) ?? []; group.push(e); groups.set(key, group); }
    return { complete: this.now() - this.startedAt >= SLO_WINDOW_MS && this.overflowAt <= this.now() - SLO_WINDOW_MS,
      rows: [...groups].map(([route, events]) => {
        const eligible = events.filter(e => !e.blocked), failures = eligible.filter(e => e.failed).length;
        const durations = eligible.map(e => e.ms).sort((a, b) => a - b);
        return { route, client: events[0]!.client, count: eligible.length, blocked: events.length - eligible.length, failures,
          failureRate: eligible.length ? failures / eligible.length : null,
          p95: durations.length ? durations[Math.ceil(durations.length * .95) - 1]! : null };
      }).sort((a, b) => a.route.localeCompare(b.route)) };
  }
  html() {
    const snapshot = this.snapshot();
    const rows = snapshot.rows.map(r => `<tr><td>${escapeHTML(r.route)}</td><td>${r.count}</td><td>${r.blocked}</td><td>${r.client || r.p95 === null ? 'n/a' : r.p95.toFixed(1) + ' ms'}</td><td>${r.failures}</td><td>${r.failureRate === null ? 'unknown' : (100 * r.failureRate).toFixed(2) + '%'}</td><td>${r.count === 0 ? 'unknown' : (r.failureRate! > .01 || (!r.client && r.p95! > 1000)) ? 'BREACH' : 'within target'}</td></tr>`).join('');
    return `<section><h2>Service SLOs · trailing 10 minutes</h2><p>Proposed owner: Adnan (acceptance and backup pending). Route p95 ≤ 1000 ms; server 5xx ≤ 1% (request availability ≥ 99%); client advisory save failures ≤ 1%. Any threshold exceeded is a breach. No samples means unknown. Refresh to update; no notification delivery is configured.</p><p>${snapshot.complete ? 'Full process window available.' : 'Incomplete window: process warming up or collection capacity exceeded; do not infer compliance.'} Process-local data resets on restart. Latency ends at response headers, excluding SSE lifetime and body transfer. Request availability excludes intentional blocked writes; it does not measure external uptime.</p><table><tr><th>Route / signal</th><th>Eligible</th><th>Blocked</th><th>p95</th><th>Failures</th><th>Failure rate</th><th>Threshold</th></tr>${rows || '<tr><td colspan="7">No samples — unknown</td></tr>'}</table><p>Client signals cover the main civic advisory save helper only, are unverified browser reports, and may be missing or forged. No content, IDs, cookies or query strings are collected by this signal.</p></section>`;
  }
}

/** Record the final security-classified response, or an exception before Bun handles it. */
export function observeServiceHandler(slos: ServiceSLOs, route: string | ((req: Request) => string), handler: Function) {
  return async (...args: unknown[]) => {
    const start = performance.now();
    const label = typeof route === 'string' ? route : route(args[0] as Request);
    // Observability must never alter application responses or exception identity.
    const record = (status: number, blocked = false) => {
      try { slos.response(label, performance.now() - start, status, blocked); } catch {}
    };
    try {
      const response = await handler(...args) as Response;
      record(response.status, response.headers.get('x-service-outcome') === 'blocked');
      return response;
    } catch (error) { record(500); throw error; }
  };
}
