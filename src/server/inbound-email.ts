/**
 * Private Resend inbound mailbox. The webhook stores only metadata and an email ID;
 * email bodies stay with Resend and are fetched only for an authorized admin read.
 * No incoming email is a public proposal, ballot, or authorization to send replies.
 */
import { Database } from "bun:sqlite";
import { createHmac, timingSafeEqual } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

const WEBHOOK_LIMIT = 128 * 1024;
const UPSTREAM_LIMIT = 2 * 1024 * 1024;
const RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
const privateHeaders = { "cache-control": "private, no-store", "x-content-type-options": "nosniff" };

class InboundFailure extends Error {
  constructor(public status: number, public code: string) { super(code); }
}

function reply(value: Record<string, unknown>, status = 200) {
  return Response.json(value, { status, headers: privateHeaders });
}

async function limitedBody(source: Request | Response, max: number): Promise<Buffer> {
  const length = Number(source.headers.get("content-length"));
  if (Number.isFinite(length) && length > max) throw new InboundFailure(413, "payload_too_large");
  const reader = source.body?.getReader();
  if (!reader) return Buffer.alloc(0);
  const chunks: Buffer[] = [];
  let total = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > max) {
      await reader.cancel().catch(() => {});
      throw new InboundFailure(413, "payload_too_large");
    }
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks);
}

function equal(a: string, b: string) {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** Verify the Svix signature over raw bytes, with a five-minute replay window. */
export function verifyResendWebhook(req: Request, raw: Buffer, secret: string, now = Date.now) {
  if (!secret) throw new InboundFailure(503, "webhook_unconfigured");
  if (!secret.startsWith("whsec_")) throw new InboundFailure(503, "webhook_unconfigured");
  const key = Buffer.from(secret.slice(6), "base64");
  if (key.length < 16) throw new InboundFailure(503, "webhook_unconfigured");

  const id = req.headers.get("svix-id") ?? "";
  const timestamp = req.headers.get("svix-timestamp") ?? "";
  const signature = req.headers.get("svix-signature") ?? "";
  if (!id || id.length > 255 || !/^\d{10,12}$/.test(timestamp) ||
      !signature || signature.length > 1024) throw new InboundFailure(401, "invalid_signature");
  if (Math.abs(now() - Number(timestamp) * 1000) > 300_000) {
    throw new InboundFailure(401, "expired_signature");
  }
  const digest = createHmac("sha256", key)
    .update(id).update(".").update(timestamp).update(".").update(raw).digest();
  const valid = signature.split(/\s+/).some(part => {
    if (!/^v1,[A-Za-z0-9+/=]{40,100}$/.test(part)) return false;
    const actual = Buffer.from(part.slice(3), "base64");
    return actual.length === digest.length && timingSafeEqual(actual, digest);
  });
  if (!valid) throw new InboundFailure(401, "invalid_signature");

  let event: unknown;
  try { event = JSON.parse(raw.toString("utf8")); }
  catch { throw new InboundFailure(400, "invalid_json"); }
  if (!event || typeof event !== "object" || Array.isArray(event)) {
    throw new InboundFailure(400, "invalid_event");
  }
  return event as Record<string, unknown>;
}

function stringArray(value: unknown, max = 25) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
      .slice(0, max).map(item => item.trim().slice(0, 320)).filter(Boolean)
    : [];
}

function attachmentMetadata(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 50).filter(a => a && typeof a === "object").map(a => ({
    id: typeof a.id === "string" ? a.id.slice(0, 128) : "",
    filename: typeof a.filename === "string" ? a.filename.slice(0, 255) : "",
    contentType: typeof a.content_type === "string" ? a.content_type.slice(0, 100) : "",
  }));
}

type ReceiverOptions = {
  dbPath: string;
  webhookSecret: string;
  apiKey?: string;
  adminToken?: string;
  allowedRecipients?: string;
  fetch?: typeof fetch;
  now?: () => number;
};

type Row = {
  email_id: string;
  webhook_id: string;
  sender: string;
  recipients: string;
  subject: string;
  attachments: string;
  received_at: string;
};

export function createResendInbound(options: ReceiverOptions) {
  const now = options.now ?? Date.now;
  const fetchEmail = options.fetch ?? fetch;
  const allow = new Set((options.allowedRecipients ?? "")
    .split(",").map(s => s.trim().toLowerCase()).filter(Boolean));
  let database: Database | undefined;

  function store() {
    if (!database) {
      if (options.dbPath !== ":memory:") mkdirSync(dirname(options.dbPath), { recursive: true });
      database = new Database(options.dbPath, { create: true });
      database.exec("PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS inbound_emails (" +
        "email_id TEXT PRIMARY KEY, webhook_id TEXT NOT NULL, sender TEXT NOT NULL, " +
        "recipients TEXT NOT NULL, subject TEXT NOT NULL, attachments TEXT NOT NULL, " +
        "received_at TEXT NOT NULL);");
    }
    // Retain only 30 days of *local metadata*. Resend's own retention is separate.
    database.query("DELETE FROM inbound_emails WHERE received_at < ?")
      .run(new Date(now() - RETENTION_MS).toISOString());
    return database;
  }

  function authorized(req: Request) {
    const token = options.adminToken ?? "";
    const match = /^Bearer ([^\s]+)$/i.exec(req.headers.get("authorization") ?? "");
    return !!token && !!match && equal(match[1]!, token);
  }

  async function webhook(req: Request): Promise<Response> {
    if (!options.webhookSecret) return reply({ error: "webhook_unconfigured" }, 503);
    try {
      const raw = await limitedBody(req, WEBHOOK_LIMIT);
      const event = verifyResendWebhook(req, raw, options.webhookSecret, now);
      if (event.type !== "email.received") return reply({ received: true, ignored: true });
      const data = event.data;
      if (!data || typeof data !== "object" || Array.isArray(data)) {
        throw new InboundFailure(400, "invalid_event");
      }
      const value = data as Record<string, unknown>;
      const id = value.email_id;
      if (typeof id !== "string" || !/^[A-Za-z0-9_-]{6,128}$/.test(id)) {
        throw new InboundFailure(400, "invalid_email_id");
      }
      const recipients = stringArray(value.to);
      if (!recipients.length) throw new InboundFailure(400, "invalid_recipient");
      if (allow.size && !recipients.some(to => allow.has(to.toLowerCase()))) {
        return reply({ received: true, ignored: true });
      }
      const sentAt = typeof value.created_at === "string" && !Number.isNaN(Date.parse(value.created_at))
        ? new Date(value.created_at).toISOString() : new Date(now()).toISOString();
      const sender = typeof value.from === "string" ? value.from.trim().slice(0, 320) : "";
      const subject = typeof value.subject === "string" ? value.subject.slice(0, 998) : "";
      store().query("INSERT OR IGNORE INTO inbound_emails " +
        "(email_id,webhook_id,sender,recipients,subject,attachments,received_at) VALUES (?,?,?,?,?,?,?)")
        .run(id, req.headers.get("svix-id")!, sender, JSON.stringify(recipients),
          subject, JSON.stringify(attachmentMetadata(value.attachments)), sentAt);
      return reply({ received: true });
    } catch (error) {
      if (error instanceof InboundFailure) return reply({ error: error.code }, error.status);
      // Preserve 5xx so Resend retries. Never log a sender, body, secret or payload.
      console.error("[RESEND_INBOUND] metadata persistence failed");
      return reply({ error: "storage_unavailable" }, 503);
    }
  }

  function list(req: Request): Response {
    if (!authorized(req)) return reply({ error: "unauthorized" }, 401);
    try {
      const rows = store().query("SELECT * FROM inbound_emails ORDER BY received_at DESC, email_id DESC LIMIT 50").all() as Row[];
      return reply({ messages: rows.map(row => ({
        id: row.email_id,
        from: row.sender,
        to: JSON.parse(row.recipients) as string[],
        subject: row.subject,
        attachments: JSON.parse(row.attachments) as object[],
        receivedAt: row.received_at,
      })) });
    } catch {
      return reply({ error: "storage_unavailable" }, 503);
    }
  }

  async function detail(req: Request, id: string): Promise<Response> {
    if (!authorized(req)) return reply({ error: "unauthorized" }, 401);
    if (!/^[A-Za-z0-9_-]{6,128}$/.test(id)) return reply({ error: "not_found" }, 404);
    let row: Row | null;
    try {
      row = (store().query("SELECT * FROM inbound_emails WHERE email_id=?").get(id) as Row | null);
    } catch {
      return reply({ error: "storage_unavailable" }, 503);
    }
    if (!row) return reply({ error: "not_found" }, 404);
    if (!options.apiKey) return reply({ error: "resend_api_unconfigured" }, 503);
    try {
      const upstream = await fetchEmail("https://api.resend.com/emails/receiving/" + encodeURIComponent(id), {
        method: "GET",
        headers: { authorization: "Bearer " + options.apiKey, accept: "application/json" },
        signal: AbortSignal.timeout(8000),
      });
      if (!upstream.ok) return reply({ error: "resend_api_unavailable" }, 502);
      const payload = JSON.parse((await limitedBody(upstream, UPSTREAM_LIMIT)).toString("utf8")) as Record<string, unknown>;
      if (payload.id !== id) return reply({ error: "resend_api_unavailable" }, 502);
      // Never return or render untrusted HTML, headers, or attachment download URLs.
      return reply({
        id,
        from: row.sender,
        to: JSON.parse(row.recipients) as string[],
        subject: row.subject,
        receivedAt: row.received_at,
        text: typeof payload.text === "string" ? payload.text.slice(0, 100_000) : null,
        hasHtml: typeof payload.html === "string" && payload.html.length > 0,
        attachments: JSON.parse(row.attachments) as object[],
      });
    } catch {
      return reply({ error: "resend_api_unavailable" }, 502);
    }
  }

  return { webhook, list, detail, close: () => { database?.close(); database = undefined; } };
}
