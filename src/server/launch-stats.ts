import { validQualitySignal, latencyBucket, type QualitySignal } from "../shared/experience-quality";
import { Database } from "bun:sqlite";
import { createHash, timingSafeEqual } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { escapeHTML } from "./pages";
import { PAGE_TITLES } from "../shared/page-metadata";

export const STATS_ZONE = "America/Chicago";
export type VoteActivity = { identity: string; scope: string; target: string };
export function statsDay(time: number) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: STATS_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(time).map(p => [p.type, p.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}
function yesterday(day: string) {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}
/** No query strings, arbitrary URLs, proposal IDs, headers or IPs are persisted. */
export function statsRoute(path: string) {
  if (Object.hasOwn(PAGE_TITLES, path)) return path;
  if (path === "/vote/") return "/vote";
  if (/^\/proposals\/[^/]{1,200}$/.test(path)) return "/proposals/:id";
  const repo = path.match(/^\/vote\/(happybearlandia|dear_congress|digital_pensieve)(?:\/(pr|issue)\/[1-9]\d*)?\/?$/);
  return repo ? `/vote/${repo[1]}${repo[2] ? `/${repo[2]}/:number` : ""}` : null;
}
export function statsAuthorized(req: Request, token: string) {
  if (!token) return false;
  const authorization = req.headers.get("authorization") ?? "";
  let supplied = authorization.replace(/^Bearer\s+/i, "");
  if (authorization.startsWith("Basic ")) {
    const basic = Buffer.from(authorization.slice(6), "base64").toString();
    supplied = basic.startsWith("admin:") ? basic.slice(6) : "";
  }
  const a = Buffer.from(supplied), b = Buffer.from(token);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Separate durable, single-writer store: never rewrites civic or repository records. */
export class LaunchStats {
  private db: Database;
  private qualityCleanup: ReturnType<typeof setInterval>;
  constructor(path: string, private now = Date.now) {
    if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
    this.db = new Database(path, { create: true });
    this.db.exec(`PRAGMA journal_mode=WAL;
      CREATE TABLE IF NOT EXISTS stats_quality(day TEXT NOT NULL,event TEXT NOT NULL,capability TEXT NOT NULL,bucket TEXT NOT NULL,count INTEGER NOT NULL,PRIMARY KEY(day,event,capability,bucket));
      CREATE TABLE IF NOT EXISTS stats_meta(key TEXT PRIMARY KEY,value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS stats_votes(day TEXT NOT NULL,identity TEXT NOT NULL,scope TEXT NOT NULL,target TEXT NOT NULL,PRIMARY KEY(day,identity,scope,target));
      CREATE TABLE IF NOT EXISTS stats_journals(id TEXT PRIMARY KEY,day TEXT NOT NULL,origin TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS stats_views(day TEXT NOT NULL,route TEXT NOT NULL,count INTEGER NOT NULL,PRIMARY KEY(day,route));`);
    this.db.query("INSERT OR IGNORE INTO stats_meta VALUES('startedAt',?)").run(new Date(now()).toISOString());
    this.pruneQuality();
    this.qualityCleanup = setInterval(() => { try { this.pruneQuality(); } catch { /* Normal metric writes/snapshots surface storage failure. */ } }, 3600000);
    this.qualityCleanup.unref();
  }
  private pruneQuality() {
    this.db.query("DELETE FROM stats_quality WHERE day <= ?").run(new Date(this.now() - 30 * 86400000).toISOString().slice(0, 10));
  }
  quality(signal: QualitySignal) {
    if (!validQualitySignal(signal)) return false;
    this.pruneQuality();
    this.db.query("INSERT INTO stats_quality VALUES(?,?,?,?,1) ON CONFLICT(day,event,capability,bucket) DO UPDATE SET count=count+1").run(new Date(this.now()).toISOString().slice(0, 10), signal.event, signal.capability, signal.duration === undefined ? '—' : latencyBucket(signal.duration));
    return true;
  }
  qualitySnapshot() {
    this.pruneQuality();
    return this.db.query("SELECT event,capability,bucket,sum(count) count FROM stats_quality GROUP BY event,capability,bucket ORDER BY capability,event,bucket").all() as {event:string;capability:string;bucket:string;count:number}[];
  }
  vote(activity: VoteActivity) {
    const identity = createHash("sha256").update(`launch-stats:${activity.identity}`).digest("hex");
    this.db.query("INSERT OR IGNORE INTO stats_votes VALUES(?,?,?,?)").run(statsDay(this.now()), identity, activity.scope, activity.target);
  }
  journal(id: string, origin: "real" | "sample" | "simulated") {
    this.db.query("INSERT OR IGNORE INTO stats_journals VALUES(?,?,?)").run(id, statsDay(this.now()), origin);
  }
  view(route: string) {
    const normalized = statsRoute(route);
    if (!normalized) return false;
    this.db.query("INSERT INTO stats_views VALUES(?,?,1) ON CONFLICT(day,route) DO UPDATE SET count=count+1").run(statsDay(this.now()), normalized);
    return true;
  }
  snapshot() {
    const quality = this.qualitySnapshot();
    const day = statsDay(this.now());
    const counts = this.db.query("SELECT count(*) votes,count(DISTINCT identity) uniqueVoters FROM stats_votes WHERE day=?").get(day) as { votes: number; uniqueVoters: number };
    const returning = this.db.query("SELECT count(DISTINCT identity) count FROM stats_votes WHERE day=? AND identity IN (SELECT identity FROM stats_votes WHERE day=?)").get(day, yesterday(day)) as { count: number };
    return {
      quality, day, timezone: STATS_ZONE, startedAt: (this.db.query("SELECT value FROM stats_meta WHERE key='startedAt'").get() as {value:string}).value,
      ...counts, returningVoters: returning.count,
      votesByScope: this.db.query("SELECT scope,count(*) votes,count(DISTINCT identity) uniqueVoters FROM stats_votes WHERE day=? GROUP BY scope ORDER BY scope").all(day),
      journals: { real: 0, sample: 0, simulated: 0, ...Object.fromEntries((this.db.query("SELECT origin,count(*) count FROM stats_journals WHERE day=? GROUP BY origin").all(day) as {origin:string;count:number}[]).map(r => [r.origin,r.count])) },
      pageViews: this.db.query("SELECT route,count FROM stats_views WHERE day=? ORDER BY count DESC,route").all(day) as {route:string;count:number}[],
    };
  }
  close() { clearInterval(this.qualityCleanup); this.db.close(); }
}
export function statsPage(stats: ReturnType<LaunchStats["snapshot"]>, healthy: boolean) {
  const rows = stats.pageViews.map(r => `<tr><td>${escapeHTML(r.route)}</td><td>${r.count}</td></tr>`).join("");
  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><meta name="robots" content="noindex,nofollow"><title>Launch stats</title><style>body{font:18px/1.5 system-ui;max-width:64rem;margin:3rem auto;padding:1rem}table{border-collapse:collapse}td,th{text-align:left;padding:.5rem 1rem;border-bottom:1px solid #ccc}dt{font-weight:bold}dd{margin:0 0 1rem}</style><main><h1>Launch stats</h1><p>${stats.day} · ${stats.timezone}. Refresh to update.</p>${healthy ? "" : '<p role="alert">Metrics recording failed in this process. Counts may be incomplete.</p>'}<dl><dt>Unique voter identities</dt><dd>${stats.uniqueVoters}</dd><dt>Votes</dt><dd>${stats.votes}</dd><dt>Returning voter identities</dt><dd>${stats.returningVoters}</dd><dt>Real journal posts</dt><dd>${stats.journals.real}</dd><dt>Sample journal posts</dt><dd>${stats.journals.sample}</dd><dt>Simulated journal posts</dt><dd>${stats.journals.simulated}</dd></dl><h2>Page views by route</h2><table><tr><th>Route</th><th>Views</th></tr>${rows || '<tr><td colspan="2">No views recorded today</td></tr>'}</table><h2>Experience quality · last 30 UTC dates</h2><p>Opt-in aggregate observations by browser capability. Route latency includes load/render plus the incoming transition when supported. Failure and abandonment counts indicate friction; demo completion and model completion indicate task outcomes, not understanding or verified people. Demo exits are explicit exits, not a site bounce rate. No cross-page visitor linkage or political segmentation. Missing delivery and consent changes prevent funnel conversion estimates.</p><table><tr><th>Capability</th><th>Signal</th><th>Latency</th><th>Count</th></tr>${stats.quality.map(r => `<tr><td>${escapeHTML(r.capability)}</td><td>${escapeHTML(r.event)}</td><td>${escapeHTML(r.bucket)}</td><td>${r.count}</td></tr>`).join('') || '<tr><td colspan="4">No consenting observations</td></tr>'}</table><h2>Vote sources</h2><pre>${escapeHTML(JSON.stringify(stats.votesByScope, null, 2))}</pre><p>Collection began ${escapeHTML(stats.startedAt)}. Earlier activity is not backfilled: historic votes have no reliable daily provenance.</p><p>Votes count distinct identity + target + revision saved each day, including changed choices once. Withdrawals do not erase participation. Returning means a saved vote yesterday and today. Browser identities are not verified people; clearing cookies or using different voting systems can count a person more than once. Automated submissions cannot be distinguished from human submissions.</p><p>Only new accepted votes and journal publications are counted. Sample fixtures and simulated populations never enter voter counts. Journal simulation flags are preserved. Page views are first-party browser route events, including reloads and back/forward; blocked JavaScript, bots, delivery failures and rate limits affect coverage. No visitor identity is stored with a page view.</p></main></html>`;
}

export async function observePublicResponse(launchStats: LaunchStats, req: Request, response: Response, onError: () => void) {
  if (!response.ok || req.method !== "POST") return response;
  const recordStats = (run: () => unknown) => { try { run(); } catch { onError(); } };
  const path = new URL(req.url).pathname;
  if (!["/api/journal", "/api/entries", "/api/publish_draft", "/api/votes"].includes(path) && !/^\/api\/citizen-proposals\/[^/]+\/vote$/.test(path)) return response;
  try {
    const result = await response.clone().json();
    const voter = `civic:${req.headers.get("x-voter-id")}`;
    if (path === "/api/votes") {
      const body = await req.clone().json();
      recordStats(() => {
        for (const vote of body.votes ?? []) launchStats.vote({ identity: voter, scope: "civic/stance", target: vote.proposalId });
        for (const id of Object.keys(body.goalVotes ?? {})) launchStats.vote({ identity: voter, scope: "civic/goal", target: id });
        if (Object.keys(body.allocation ?? {}).length) launchStats.vote({ identity: voter, scope: "civic/allocation", target: "priority-budget" });
      });
    } else if (path.endsWith("/vote")) {
      if (result.proposal?.ownVote != null) recordStats(() => launchStats.vote({ identity: voter, scope: "citizen/advisory", target: result.proposal.id }));
    } else {
      const entry = path === "/api/journal" ? result : result.entry;
      if (entry?.id) recordStats(() => launchStats.journal(entry.id, entry.synthetic ? "simulated" : entry.seeded ? "sample" : "real"));
    }
  } catch { onError(); }
  return response;
}
