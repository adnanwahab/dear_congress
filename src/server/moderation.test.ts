import { expect, test } from "bun:test";
import { contactReasons, moderate, moderationAuthorized, moderationPage } from "./moderation";
import { buildContext, countedEntries, emptyDB, extract } from "../engine/engine";
import { isPublicEntry, publicEntry } from "../shared/moderation";

test("contact detail detection includes author checks, common phone and street formats", () => {
  for (const text of ["Email me a+b@example.com", "(713) 555-1212", "+1 713 555 1212", "7135551212", "+44 20 7946 0958", "555-1212", "123 Main St", "42 North Oak Avenue", "1234 W. 12th Rd."]) expect(contactReasons(text).length).toBeGreaterThan(0);
  expect(contactReasons("Rent is $1500 and I take bus 42.")).toEqual([]);
});

test("admin authentication fails closed and accepts a server secret only", () => {
  const req = (authorization?: string) => new Request("https://example.com/admin/moderation", { headers: authorization ? { authorization } : {} });
  expect(moderationAuthorized(req(), "")).toBe(false);
  expect(moderationAuthorized(req("Bearer wrong"), "secret")).toBe(false);
  expect(moderationAuthorized(req("Bearer secret"), "secret")).toBe(true);
  expect(moderationAuthorized(req(`Basic ${Buffer.from("adnan:secret").toString("base64")}`), "secret")).toBe(true);
});

test("hide and approval persist decisions, preserve original source and exclude from engine contexts", async () => {
  const db = emptyDB();
  db.entries.push({ id: "entry", author: "<script>alert(1)</script>", text: "Rent is too high.", createdAt: new Date().toISOString(), extraction: extract("Rent is too high."), corrected: false, source: "original-client" });
  const original = JSON.stringify(db.entries[0]);
  let saves = 0, updates = 0;
  const decide = (action: string, reason: string) => moderate(new Request("https://example.com/api/admin/moderation", { method: "POST", body: JSON.stringify({ entryId: "entry", action, reason }) }), db, async () => { saves++; }, () => { updates++; });
  await expect(decide("hide", " ")).rejects.toThrow();
  await decide("hide", "Doxxing report");
  expect(db.entries.filter(isPublicEntry)).toHaveLength(0);
  expect(countedEntries(db)).toHaveLength(0);
  expect(buildContext(db).entries).toHaveLength(0);
  expect(buildContext(db, undefined, { includeSynthetic: true }).entries).toHaveLength(0);
  expect(db.journalModerationLog).toHaveLength(1);
  const { moderation, ...retained } = db.entries[0]!;
  expect(JSON.stringify(retained)).toBe(original);
  await expect(decide("approve", "test")).rejects.toThrow();
  db.entries[0]!.moderation!.status = "pending";
  await decide("approve", "Reviewed and safe");
  expect(countedEntries(db)).toHaveLength(1);
  expect(publicEntry(db.entries[0]!)).not.toHaveProperty("moderation");
  expect(saves).toBe(2); expect(updates).toBe(2);
  const html = await moderationPage(db).text();
  expect(html).toContain("&lt;script&gt;");
  expect(html).not.toContain("<script>alert");
});
