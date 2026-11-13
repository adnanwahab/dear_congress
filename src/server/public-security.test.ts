import { describe, expect, test } from "bun:test";
import { boundedJson, createPublicSecurity, CSP, publicHandler, validateJournal, validateVotes } from "./public-security";
import { readFileSync } from "node:fs";
import { createCitizenProposalHandlers } from "./citizen-proposals";

const secret = "isolated-test-secret-with-at-least-32-characters";
const request = (path = "/api/votes", body: unknown = {}, headers: Record<string,string> = {}) => new Request(`http://localhost${path}`, { method: "POST", headers, body: JSON.stringify(body) });
const cookie = (security: ReturnType<typeof createPublicSecurity>) => security.identity(request()).cookie!.split(";")[0]!;
const guard = (security: ReturnType<typeof createPublicSecurity>, req: Request, peer = "192.0.2.1", handler: () => Response | Promise<Response> = () => Response.json({ ok: true })) => publicHandler(security, new URL(req.url).pathname, req.method, req, peer, handler);

describe("public write security", () => {
  test("signed cookie resists tampering and x-voter-id never chooses the identity", async () => {
    const security = createPublicSecurity({ ANON_COOKIE_SECRET: secret });
    const first = security.identity(request());
    expect(first.cookie).toContain("HttpOnly; Secure; SameSite=Lax");
    const token = first.cookie!.split(";")[0]!;
    expect(security.identity(request("/", {}, { cookie: token, "x-voter-id": "attacker" })).id).toBe(first.id);
    expect(security.identity(request("/", {}, { cookie: token + "0" })).id).not.toBe(first.id);
    expect(security.identity(request("/", {}, { cookie: token + ".extra" })).id).not.toBe(first.id);
    expect(security.identity(request("/", {}, { "x-voter-id": first.id })).id).not.toBe(first.id);
    const req = request("/api/votes", {}, { cookie: token, "x-voter-id": "attacker" });
    await guard(security, req, undefined, () => { expect(req.headers.get("x-voter-id")).toBe(first.id); return Response.json({}); });
    expect(() => createPublicSecurity({ NODE_ENV: "production" })).toThrow("ANON_COOKIE_SECRET");
  });
  test("IP limit ignores arbitrary forwarding headers and cookie rotation", async () => {
    let time = 1000;
    const security = createPublicSecurity({ ANON_COOKIE_SECRET: secret, PUBLIC_IP_LIMIT: "2" }, () => time);
    for (let n = 0; n < 2; n++) expect((await guard(security, request("/api/votes", {}, { "fly-client-ip": `192.0.2.${n}`, "x-forwarded-for": `192.0.2.${n}` }))).status).toBe(200);
    const blocked = await guard(security, request());
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get("retry-after")).toBe("600");
    expect(await blocked.text()).toContain("try again");
    time += 600000;
    expect((await guard(security, request())).status).toBe(200);
  });
  test("ID limit survives IP changes; aliases share a journal cooldown", async () => {
    const security = createPublicSecurity({ ANON_COOKIE_SECRET: secret, PUBLIC_ID_LIMIT: "2", PUBLIC_JOURNAL_LIMIT: "2" });
    const headers = { cookie: cookie(security) };
    expect((await guard(security, request("/api/journal", { text: "Hello" }, headers))).status).toBe(200);
    expect((await guard(security, request("/api/entries", { text: "Hello" }, headers), "192.0.2.2")).status).toBe(200);
    expect((await guard(security, request("/api/publish_draft", { text: "Hello" }, headers), "192.0.2.3")).status).toBe(429);
  });
  test("Fly proxy source ignores x-forwarded-for; same origin uses public HTTPS", async () => {
    const security = createPublicSecurity({ ANON_COOKIE_SECRET: secret, TRUST_FLY_PROXY: "1", PUBLIC_IP_LIMIT: "1" });
    expect((await guard(security, request("/api/votes", {}, { origin: "https://localhost", "fly-client-ip": "192.0.2.9" })) ).status).toBe(200);
    expect((await guard(security, request("/api/votes", {}, { "fly-client-ip": "192.0.2.9", "x-forwarded-for": "192.0.2.99" })) ).status).toBe(429);
  });
  test("paused submissions, cross-origin writes and unauthorized edits never run handler", async () => {
    const security = createPublicSecurity({ ANON_COOKIE_SECRET: secret, PUBLIC_SUBMISSIONS_ENABLED: "0" });
    const unexpected = () => { throw new Error("must not write"); };
    expect((await guard(security, request("/api/journal", { text: "hello" }), undefined, unexpected)).status).toBe(503);
    for (const path of ["/api/publish_labels", "/api/journal/:id"]) expect((await guard(security, request(path), undefined, unexpected)).status).toBe(403);
    expect((await guard(security, request("/api/votes", {}, { origin: "https://evil.example" }), undefined, unexpected)).status).toBe(403);
  });
  test("bounded parser rejects malformed, scalar, declared and streamed oversized JSON", async () => {
    for (const body of ["{broken", "null", "[]", '"hello"']) await expect(boundedJson(new Request("http://localhost", { method: "POST", body }))).rejects.toThrow();
    await expect(boundedJson(request("/", {}, { "content-length": "999999" }))).rejects.toThrow("too large");
    await expect(boundedJson(request("/", { text: "x".repeat(66000) }))).rejects.toThrow("too large");
    const req = request("/api/entries", { text: "x".repeat(66000) });
    expect((await guard(createPublicSecurity({}), req)).status).toBe(413);
  });
  test("journal cap, type and honeypot validation runs before handler", async () => {
    const security = createPublicSecurity({});
    for (const body of [{ text: " " }, { text: 7 }, { text: "x".repeat(10001) }, { text: "hello", website: "spam" }, { text: "hello", author: {} }, { text: "hello", labels: "bad" }]) {
      expect(() => validateJournal(body)).toThrow();
      expect((await guard(security, request("/api/entries", body), undefined, () => { throw new Error("must not write"); })).status).toBe(400);
    }
    expect(() => validateJournal({ text: "x".repeat(10000) })).not.toThrow();
  });
  test("vote validation rejects unknown IDs, enum values and invalid allocations atomically", () => {
    const v = { proposalId: "known", stance: 1, importance: 0.5, acceptCompromise: true, concern: "", changeMind: "" };
    const valid = (body: Record<string, unknown>) => validateVotes(body, ["known"], ["housing"]);
    expect(() => valid({ votes: [v] })).not.toThrow();
    for (const body of [{ votes: [{ ...v, proposalId: "__proto__" }] }, { votes: [{ ...v, stance: "yes" }] }, { votes: [{ ...v, stance: 9 }] }, { votes: [{ ...v, importance: NaN }] }, { allocation: { housing: -1 } }, { allocation: { housing: 101 } }, { goalVotes: { unknown: true } }, { goalVotes: { housing: 1 } }]) expect(() => valid(body)).toThrow();
  });
  test("cookie identity replaces an existing advisory choice even with tampered client IDs", async () => {
    const store = { entries: [], citizenProposals: [] };
    const handlers = createCitizenProposalHandlers({ getStore: () => store, save: async () => {} });
    const security = createPublicSecurity({});
    const headers = { cookie: cookie(security), "x-voter-id": "forged-first" };
    const body = { title: "A proposal", problem: "A problem", proposedChange: "A solution", jurisdiction: "city", confirmedPublic: true, idempotencyKey: crypto.randomUUID() };
    const req = request("/api/citizen-proposals", body, headers);
    const published = await (await guard(security, req, undefined, () => handlers.publish(req))).json() as any;
    const id = published.proposal.id;
    for (const choice of ["support", "oppose"]) {
      const vote = request(`/api/citizen-proposals/${id}/vote`, { choice }, { ...headers, "x-voter-id": choice });
      const response = await publicHandler(security, "/api/citizen-proposals/:id/vote", "POST", vote, "192.0.2.1", () => handlers.vote(vote, id));
      const result = await response.json() as any;
      expect(result.proposal.countTotal).toBe(1);
      expect(result.proposal.ownVote).toBe(choice);
    }
  });
  test("CSP matches Fly HTML policy and permits configured map/worker/error reporting sources", async () => {
    const fly = readFileSync(new URL("../../fly.toml", import.meta.url), "utf8");
    expect(fly).toContain(`Content-Security-Policy = "${CSP}"`);
    expect(CSP).toContain("worker-src 'self' blob:");
    expect(CSP).toContain("https://basemaps.cartocdn.com");
    expect(CSP).toContain("https://*.bugsnag.com");
    expect(CSP).toContain("frame-ancestors 'self'");
    expect(CSP).not.toContain("unsafe-eval");
    const response = await guard(createPublicSecurity({}), request());
    expect(response.headers.get("content-security-policy")).toBe(CSP);
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("strict-transport-security")).toContain("31536000");
  });
});
