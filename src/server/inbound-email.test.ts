import { expect, test } from "bun:test";
import { createHmac } from "node:crypto";
import { createResendInbound, verifyResendWebhook } from "./inbound-email";

const instant = Date.parse("2026-11-18T18:00:00Z");
const secret = "whsec_" + Buffer.from("test signing secret longer than sixteen bytes").toString("base64");
const emailId = "550e8400-e29b-41d4-a716-446655440000";
const endpoint = "https://civic-synthesis.fly.dev/api/webhooks/resend";

function event(overrides: Record<string, unknown> = {}) {
  return {
    type: "email.received",
    data: {
      email_id: emailId,
      from: "Jane <jane@example.org>",
      to: ["feedback@civic-synthesis.com"],
      subject: "Civic feedback",
      attachments: [{ id: "att_123", filename: "note.txt", content_type: "text/plain", download_url: "SECRET_LINK" }],
      ...overrides,
    },
  };
}
function request(data: unknown = event(), timestamp = Math.floor(instant / 1000), id = "msg_123") {
  const body = JSON.stringify(data);
  const sig = createHmac("sha256", Buffer.from(secret.slice(6), "base64"))
    .update(id + "." + timestamp + "." + body).digest("base64");
  return new Request(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json", "svix-id": id,
      "svix-timestamp": String(timestamp), "svix-signature": "v1," + sig },
    body,
  });
}
function receiver(overrides: Record<string, unknown> = {}) {
  return createResendInbound({
    dbPath: ":memory:",
    webhookSecret: secret,
    adminToken: "admin-secret",
    apiKey: "test-api-key",
    allowedRecipients: "feedback@civic-synthesis.com",
    now: () => instant,
    ...overrides,
  });
}
function admin(path = "/api/admin/inbound-email", token = "admin-secret") {
  return new Request("https://civic-synthesis.fly.dev" + path, {
    headers: { authorization: "Bearer " + token },
  });
}

test("rejects unsigned, altered and expired Svix requests before storage", async () => {
  const handler = receiver();
  const valid = request();
  expect((await handler.webhook(valid)).status).toBe(200);
  const wrong = new Request(endpoint, { method: "POST", body: JSON.stringify(event({ subject: "forged" })),
    headers: { "svix-id": "msg_123", "svix-timestamp": String(instant / 1000), "svix-signature": "v1,FAKE" } });
  expect((await handler.webhook(wrong)).status).toBe(401);
  expect((await handler.webhook(request(event(), instant / 1000 - 301))).status).toBe(401);
  const rows = await handler.list(admin());
  expect((await rows.json()).messages).toHaveLength(1);
  handler.close();
});

test("validates raw signature including multiple signatures without reparsing the body", () => {
  const req = request();
  const raw = Buffer.from(JSON.stringify(event()));
  expect(verifyResendWebhook(req, raw, secret, () => instant).type).toBe("email.received");
  expect(() => verifyResendWebhook(req, Buffer.from("{}"), secret, () => instant)).toThrow("invalid_signature");
});

test("deduplicates deliveries and keeps unrelated events and recipients out", async () => {
  const handler = receiver();
  expect((await handler.webhook(request())).status).toBe(200);
  expect((await handler.webhook(request(event(), instant / 1000, "msg_456"))).status).toBe(200);
  expect((await handler.webhook(request({ type: "email.delivered", data: {} }))).status).toBe(200);
  expect((await handler.webhook(request(event({ to: ["private@example.com"] })))).status).toBe(200);
  const list = await handler.list(admin());
  const data = await list.json();
  expect(data.messages).toHaveLength(1);
  expect(data.messages[0].attachments[0]).toEqual({
    id: "att_123", filename: "note.txt", contentType: "text/plain",
  });
  expect(JSON.stringify(data)).not.toContain("SECRET_LINK");
  expect(list.headers.get("cache-control")).toContain("no-store");
  handler.close();
});

test("blocks unauthenticated access and fetches body only for an authorized stored message", async () => {
  const calls: string[] = [];
  const handler = receiver({ fetch: (async (url: string, init: RequestInit) => {
    calls.push(url);
    expect(init.headers).toEqual({ authorization: "Bearer test-api-key", accept: "application/json" });
    return Response.json({ id: emailId, text: "A private suggestion", html: "<script>unsafe()</script>" });
  }) as typeof fetch });
  expect((await handler.webhook(request())).status).toBe(200);
  expect((await handler.list(admin(undefined, "wrong"))).status).toBe(401);
  expect((await handler.detail(admin(), emailId)).status).toBe(200);
  expect((await handler.detail(admin(undefined, "wrong"), emailId)).status).toBe(401);
  expect((await handler.detail(admin(), "unknown-id")).status).toBe(404);
  expect(calls).toHaveLength(1);
  const response = await handler.detail(admin(), emailId);
  const data = await response.json();
  expect(data.text).toBe("A private suggestion");
  expect(data.hasHtml).toBe(true);
  expect(JSON.stringify(data)).not.toContain("unsafe()");
  expect(response.headers.get("cache-control")).toContain("no-store");
  handler.close();
});

test("refuses oversized events and never accepts webhooks without signing secret", async () => {
  const handler = receiver();
  const large = request({ type: "email.received", data: { ...event().data, subject: "x".repeat(140_000) } });
  expect((await handler.webhook(large)).status).toBe(413);
  expect((await handler.list(admin()).json()).messages).toHaveLength(0);
  handler.close();
  const disabled = receiver({ webhookSecret: "" });
  expect((await disabled.webhook(request())).status).toBe(503);
  disabled.close();
});

test("admin detail does not expose Resend upstream failures or body HTML", async () => {
  const handler = receiver({ fetch: (async () => new Response("down", { status: 503 })) as typeof fetch });
  await handler.webhook(request());
  const detail = await handler.detail(admin(), emailId);
  expect(detail.status).toBe(502);
  expect(await detail.json()).toEqual({ error: "resend_api_unavailable" });
  handler.close();
});
