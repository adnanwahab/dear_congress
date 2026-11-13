import { Database } from "bun:sqlite";
import { createHash, randomUUID } from "node:crypto";
import { validateJournal } from "../server/public-security";
import { contactReasons } from "../server/moderation";
import { extract } from "../engine/engine";

// Local synthetic spike only. No HTTP listener, provider calls or application DB.
export type Scope = { tenant: string; region: string; subject: string };
export type SyntheticEvent = { key: string; sourceId: string; generation: number; text: string; synthetic: true };
type Receipt = { receipt: string; digest: string; status: string };
export class IngestError extends Error {
  constructor(readonly status: number, message: string, readonly retryAfter?: number) { super(message); }
}
const scopeKey = (scope: Scope) => {
  if (![scope.tenant, scope.region, scope.subject].every(x => typeof x === "string" && /^synthetic-[a-z0-9-]{1,80}$/.test(x))) throw new IngestError(403, "Synthetic scope required");
  return JSON.stringify([scope.tenant, scope.region, scope.subject]);
};

/** Trusted caller supplies scope; never expose directly as a public authenticated API. */
export class SyntheticPipeline {
  private db: Database;
  constructor(path: string, private limits = { pendingPerScope: 100, oldestMs: 60_000 }, private now = Date.now) {
    if (!Number.isSafeInteger(limits.pendingPerScope) || limits.pendingPerScope < 1 || !Number.isSafeInteger(limits.oldestMs) || limits.oldestMs < 1) throw new Error("Invalid queue limits");
    this.db = new Database(path, { create: true });
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL;
      CREATE TABLE IF NOT EXISTS consent(scope TEXT PRIMARY KEY,generation INTEGER NOT NULL,enabled INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS events(receipt TEXT PRIMARY KEY,scope TEXT NOT NULL,key TEXT NOT NULL,sourceId TEXT NOT NULL,generation INTEGER NOT NULL,digest TEXT NOT NULL,text TEXT,status TEXT NOT NULL,created INTEGER NOT NULL,UNIQUE(scope,key));
      CREATE INDEX IF NOT EXISTS queue_scope ON events(scope,status,created);
      CREATE TABLE IF NOT EXISTS contributions(receipt TEXT NOT NULL,scope TEXT NOT NULL,need TEXT NOT NULL,PRIMARY KEY(receipt,need));
      CREATE TABLE IF NOT EXISTS audit(sequence INTEGER PRIMARY KEY,scope TEXT NOT NULL,action TEXT NOT NULL,generation INTEGER NOT NULL,created INTEGER NOT NULL);`);
  }
  private consent(scope: string) {
    return this.db.query("SELECT generation,enabled FROM consent WHERE scope=?").get(scope) as { generation: number; enabled: number } | null;
  }
  private audit(scope: string, action: string, generation: number) {
    this.db.query("INSERT INTO audit(scope,action,generation,created) VALUES(?,?,?,?)").run(scope, action, generation, this.now());
  }
  /** Grant only through the local harness. Each regrant advances the replay fence. */
  grant(scope: Scope) {
    const key = scopeKey(scope);
    return this.db.transaction(() => {
      const generation = (this.consent(key)?.generation ?? 0) + 1;
      this.db.query("INSERT INTO consent VALUES(?,?,1) ON CONFLICT(scope) DO UPDATE SET generation=excluded.generation,enabled=1").run(key, generation);
      this.audit(key, "grant", generation);
      return generation;
    }).immediate();
  }
  enqueue(scope: Scope, event: SyntheticEvent) {
    const key = scopeKey(scope);
    if (event.synthetic !== true || !Number.isSafeInteger(event.generation) || event.generation < 1 || ![event.key, event.sourceId].every(x => typeof x === "string" && /^[a-zA-Z0-9-]{1,128}$/.test(x))) throw new IngestError(400, "Invalid synthetic envelope");
    validateJournal({ text: event.text });
    const digest = createHash("sha256").update(JSON.stringify([event.sourceId, event.generation, event.text])).digest("hex");
    return this.db.transaction(() => {
      const consent = this.consent(key);
      if (!consent?.enabled || consent.generation !== event.generation) throw new IngestError(403, "Current explicit consent required");
      const prior = this.db.query("SELECT receipt,digest,status FROM events WHERE scope=? AND key=?").get(key, event.key) as Receipt | null;
      if (prior) {
        if (prior.digest !== digest) throw new IngestError(409, "Idempotency conflict");
        return { receipt: prior.receipt, duplicate: true };
      }
      const pending = this.db.query("SELECT count(*) count,min(created) oldest FROM events WHERE scope=? AND status='queued'").get(key) as { count: number; oldest: number | null };
      if (pending.count >= this.limits.pendingPerScope || (pending.oldest !== null && this.now() - pending.oldest >= this.limits.oldestMs)) throw new IngestError(429, "Queue backpressure", 1);
      const receipt = randomUUID();
      this.db.query("INSERT INTO events VALUES(?,?,?,?,?,?,?,'queued',?)").run(receipt, key, event.key, event.sourceId, event.generation, digest, event.text, this.now());
      this.audit(key, "accepted", event.generation);
      return { receipt, duplicate: false };
    }).immediate();
  }
  /** Atomic local worker: output and processed marker commit together; text is discarded. */
  processOne(scope: Scope) {
    const key = scopeKey(scope);
    return this.db.transaction(() => {
      const event = this.db.query("SELECT receipt,generation,text FROM events WHERE scope=? AND status='queued' ORDER BY created,rowid LIMIT 1").get(key) as { receipt: string; generation: number; text: string } | null;
      if (!event) return false;
      const consent = this.consent(key);
      let status = "deleted";
      if (consent?.enabled && consent.generation === event.generation) {
        status = contactReasons(event.text).length ? "held" : "processed";
        if (status === "processed") for (const need of extract(event.text).needs) this.db.query("INSERT INTO contributions VALUES(?,?,?)").run(event.receipt, key, need.id);
      }
      this.db.query("UPDATE events SET status=?,text=NULL WHERE receipt=?").run(status, event.receipt);
      this.audit(key, status, event.generation);
      return true;
    }).immediate();
  }
  /** Logical deletion across every active store in this spike, including queued payloads. */
  withdraw(scope: Scope) {
    const key = scopeKey(scope);
    return this.db.transaction(() => {
      const generation = (this.consent(key)?.generation ?? 0) + 1;
      this.db.query("INSERT INTO consent VALUES(?,?,0) ON CONFLICT(scope) DO UPDATE SET generation=excluded.generation,enabled=0").run(key, generation);
      this.db.query("DELETE FROM contributions WHERE scope=?").run(key);
      this.db.query("UPDATE events SET status='deleted',text=NULL WHERE scope=?").run(key);
      this.audit(key, "withdrawn", generation);
      return generation;
    }).immediate();
  }
  snapshot(scope: Scope) {
    const key = scopeKey(scope);
    return {
      states: this.db.query("SELECT status,count(*) count FROM events WHERE scope=? GROUP BY status ORDER BY status").all(key) as { status: string; count: number }[],
      aggregates: this.db.query("SELECT need,count(*) count FROM contributions WHERE scope=? GROUP BY need ORDER BY need").all(key) as { need: string; count: number }[],
      payloads: (this.db.query("SELECT count(*) count FROM events WHERE scope=? AND text IS NOT NULL").get(key) as { count: number }).count,
      audit: this.db.query("SELECT action,generation FROM audit WHERE scope=? ORDER BY sequence").all(key),
    };
  }
  close() { this.db.close(); }
}
