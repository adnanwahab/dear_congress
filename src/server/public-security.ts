import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { isIP } from "node:net";

export class PublicInputError extends Error {
  constructor(message: string, readonly status = 400) { super(message); }
}
export const CSP = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://basemaps.cartocdn.com https://*.basemaps.cartocdn.com; connect-src 'self' https://basemaps.cartocdn.com https://*.basemaps.cartocdn.com https://*.bugsnag.com; worker-src 'self' blob:; font-src 'self' data: https://basemaps.cartocdn.com https://*.basemaps.cartocdn.com; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'self'";
export function securityHeaders(res: Response) {
  const headers = new Headers(res.headers);
  headers.set("content-security-policy", CSP);
  headers.set("strict-transport-security", "max-age=31536000");
  headers.set("x-content-type-options", "nosniff");
  headers.set("referrer-policy", "no-referrer");
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
}
export async function boundedJson(req: Request, max = 65536): Promise<Record<string, unknown>> {
  if (Number(req.headers.get("content-length")) > max) throw new PublicInputError("Request is too large.", 413);
  const reader = req.body?.getReader();
  if (!reader) throw new PublicInputError("A JSON object is required.");
  const chunks: Uint8Array[] = []; let length = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.length;
    if (length > max) { void reader.cancel(); throw new PublicInputError("Request is too large.", 413); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(length); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  let body;
  try { body = JSON.parse(new TextDecoder().decode(bytes)); } catch { throw new PublicInputError("Malformed JSON. Please check your submission."); }
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new PublicInputError("A JSON object is required.");
  return body;
}
export function validateJournal(body: Record<string, unknown>) {
  if (typeof body.text !== "string" || !body.text.trim()) throw new PublicInputError("Journal text is required.");
  if (body.text.length > 10000) throw new PublicInputError("Journal text must be 10,000 characters or fewer.");
  if (body.author !== undefined && (typeof body.author !== "string" || body.author.length > 120)) throw new PublicInputError("Author must be text of 120 characters or fewer.");
  if (body.website) throw new PublicInputError("Please leave the website field empty.");
  for (const field of ["labels", "needs"]) if (body[field] !== undefined && (!Array.isArray(body[field]) || !(body[field] as unknown[]).every(x => typeof x === "string"))) throw new PublicInputError(`${field} must be an array of IDs.`);
}
export function validateVotes(body: Record<string, unknown>, proposals: string[], needs: string[]) {
  if (!Object.keys(body).some(k => ["votes", "allocation", "goalVotes"].includes(k))) throw new PublicInputError("Votes, allocation, or goalVotes are required.");
  if (body.votes !== undefined) {
    if (!Array.isArray(body.votes)) throw new PublicInputError("votes must be an array.");
    for (const v of body.votes) {
      if (!v || !proposals.includes(v.proposalId) || ![-2,-1,0,1,2].includes(v.stance) || typeof v.importance !== "number" || !Number.isFinite(v.importance) || v.importance < 0 || v.importance > 1 || typeof v.acceptCompromise !== "boolean" || typeof v.concern !== "string" || v.concern.length > 2000 || typeof v.changeMind !== "string" || v.changeMind.length > 2000) throw new PublicInputError("Invalid proposal ID or vote values.");
    }
  }
  for (const field of ["allocation", "goalVotes"]) {
    const value = body[field]; if (value === undefined) continue;
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new PublicInputError(`Invalid ${field}.`);
    for (const [id, v] of Object.entries(value)) if (!needs.includes(id) || (field === "goalVotes" ? typeof v !== "boolean" : typeof v !== "number" || !Number.isFinite(v) || v < 0 || v > 100)) throw new PublicInputError(`Invalid ${field} ID or value.`);
    if (field === "allocation" && Object.values(value).reduce<number>((s,v) => s + Number(v), 0) > 100) throw new PublicInputError("allocation exceeds 100 points");
  }
}
const positive = (env: Record<string, string | undefined>, name: string, fallback: number) => {
  const n = Number(env[name] ?? fallback);
  if (!Number.isSafeInteger(n) || n < 1) throw new Error(`${name} must be a positive integer`);
  return n;
};
export function createPublicSecurity(env: Record<string, string | undefined> = process.env, now = Date.now) {
  const secret = env.ANON_COOKIE_SECRET || randomUUID();
  if (env.NODE_ENV === "production" && (!env.ANON_COOKIE_SECRET || secret.length < 32)) throw new Error("Set ANON_COOKIE_SECRET to at least 32 random characters.");
  const sign = (id: string) => createHmac("sha256", secret).update(id).digest("hex");
  const buckets = new Map<string, { count: number; until: number }>();
  const windowMs = positive(env, "PUBLIC_RATE_WINDOW_SECONDS", 600) * 1000;
  const ipLimit = positive(env, "PUBLIC_IP_LIMIT", 60);
  const idLimit = positive(env, "PUBLIC_ID_LIMIT", 30);
  const journalLimit = positive(env, "PUBLIC_JOURNAL_LIMIT", 3);
  return {
    origin(req: Request) {
      const url = new URL(req.url);
      if (env.TRUST_FLY_PROXY === "1") url.protocol = "https:";
      return url.origin;
    },
    identity(req: Request) {
      const token = req.headers.get("cookie")?.match(/(?:^|;\s*)__Host-dc_anon=([^;]+)/)?.[1];
      const [id = "", signature = ""] = token?.split(".") ?? [];
      if (token === `${id}.${signature}` && /^[0-9a-f-]{36}$/.test(id) && /^[0-9a-f]{64}$/.test(signature) && timingSafeEqual(Buffer.from(sign(id)), Buffer.from(signature))) return { id };
      const issued = randomUUID();
      return { id: issued, cookie: `__Host-dc_anon=${issued}.${sign(issued)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=31536000` };
    },
    check(req: Request, peer: string, id: string, journal: boolean): Response | undefined {
      // Fly's HTTP proxy overwrites Fly-Client-IP. Never use X-Forwarded-For.
      const forwarded = env.TRUST_FLY_PROXY === "1" ? req.headers.get("fly-client-ip") : null;
      const ip = forwarded && isIP(forwarded) ? forwarded : peer;
      const time = now();
      for (const [key, bucket] of buckets) if (bucket.until <= time) buckets.delete(key);
      const keys: [string, number][] = [[`ip:${sign(ip)}`, ipLimit], [`id:${sign(id)}`, idLimit]];
      if (journal) keys.push([`journal:${sign(id)}`, journalLimit]);
      let retry = 0;
      for (const [key, limit] of keys) {
        let bucket = buckets.get(key);
        if (!bucket && buckets.size >= 100000) return Response.json({ error: "Submissions are busy. Please try again later." }, { status: 429, headers: { "retry-after": String(Math.ceil(windowMs / 1000)) } });
        if (!bucket) { bucket = { count: 0, until: time + windowMs }; buckets.set(key, bucket); }
        bucket.count++;
        if (bucket.count > limit) retry = Math.max(retry, Math.ceil((bucket.until - time) / 1000));
      }
      if (retry) return Response.json({ error: `Too many submissions. Please try again in ${retry} seconds.` }, { status: 429, headers: { "retry-after": String(retry) } });
      if (journal && env.PUBLIC_SUBMISSIONS_ENABLED === "0") return Response.json({ error: "Public journal submissions are temporarily paused." }, { status: 503 });
    },
  };
}

/** Shared boundary for all public API aliases; handler only runs after validation. */
export async function publicHandler(publicSecurity: ReturnType<typeof createPublicSecurity>, path: string, method: string, req: Request, peer: string, handler: () => Response | Promise<Response>, validateVoteBody: (body: Record<string, unknown>) => void = () => {}) {
  const identity = publicSecurity.identity(req);
  const finish = (res: Response) => {
    const secured = securityHeaders(res);
    if (identity.cookie) secured.headers.append("set-cookie", identity.cookie);
    secured.headers.set("cache-control", "no-store");
    return secured;
  };
  const write = ["POST", "PATCH", "PUT", "DELETE"].includes(method);
  const journal = ["/api/journal", "/api/entries", "/api/publish_draft"].includes(path);
  const protectedWrite = write && (journal || path === "/api/answers" || path === "/api/votes" || path.startsWith("/api/citizen-proposals") || path === "/api/publish_labels" || path === "/api/journal/:id");
  try {
    if (protectedWrite) {
      const limited = publicSecurity.check(req, peer, identity.id, journal);
      if (limited) return finish(limited);
      const origin = req.headers.get("origin");
      const expected = publicSecurity.origin(req);
      if (origin && origin !== expected) return finish(Response.json({ error: "Use a same-origin submission or a cookie-aware API client." }, { status: 403 }));
      if (path === "/api/publish_labels" || path === "/api/journal/:id") return finish(Response.json({ error: "Public label editing is disabled until ownership authorization is available." }, { status: 403 }));
      const body = await boundedJson(req.clone());
      if (journal || path === "/api/answers") validateJournal(body);
      if (path === "/api/votes") validateVoteBody(body);
    }
    // The header becomes an internal adapter for existing handlers, never a credential.
    req.headers.set("x-voter-id", identity.id);
    return finish(await handler());
  } catch (error) {
    if (error instanceof PublicInputError) return finish(Response.json({ error: error.message }, { status: error.status }));
    throw error;
  }
}
