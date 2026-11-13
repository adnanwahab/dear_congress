import { timingSafeEqual } from "node:crypto";
import type { DB } from "../engine/types";
import { boundedJson, PublicInputError } from "./public-security";
import { escapeHTML } from "./pages";

export { isPublicEntry } from "../shared/moderation";

/** Conservative launch heuristic, not a guarantee that all personal information is detected. */
export function contactReasons(text: string): string[] {
  const reasons: string[] = [];
  if (/[\w.+-]+@[\w.-]+\.[a-z]{2,}/i.test(text)) reasons.push("email address");
  if (/(?:\+\d[\d () .-]{6,}\d\b)|(?:\b\d{3}[-.]\d{4}\b)|(?:(?:\(\d{3}\)|\b\d{3})[ .-]?\d{3}[ .-]?\d{4}\b)/.test(text)) reasons.push("phone number");
  if (/\b\d{1,6}\s+(?:(?:north|south|east|west|n|s|e|w)\.?\s+)?(?:[a-z0-9'-]+\s+){1,6}(?:street|st|avenue|ave|road|rd|drive|dr|lane|ln|court|ct|boulevard|blvd|way|place|pl|terrace|ter|circle|cir|parkway|pkwy)\b/i.test(text)) reasons.push("street address");
  return reasons;
}

export function moderationAuthorized(req: Request, secret: string) {
  if (!secret) return false;
  const auth = req.headers.get("authorization") ?? "";
  let token = auth.replace(/^Bearer\s+/i, "");
  if (auth.startsWith("Basic ")) {
    const decoded = Buffer.from(auth.slice(6), "base64").toString();
    token = decoded.slice(decoded.indexOf(":") + 1);
  }
  const a = Buffer.from(token), b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

export const moderationScript = `document.querySelectorAll('form').forEach(form => form.addEventListener('submit', async event => {
 event.preventDefault(); const button = form.querySelector('button'); button.disabled = true;
 try { const body = Object.fromEntries(new FormData(form)); const res = await fetch('/api/admin/moderation', {method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)}); const data = await res.json(); if (!res.ok) throw Error(data.error); location.reload(); }
 catch(error) { document.getElementById('status').textContent = error.message; button.disabled = false; }
}));`;

export function moderationPage(db: DB) {
  const entries = db.entries.slice().reverse();
  const reportList = db.journalReports ?? [];
  const html = entries.map(entry => {
    const reports = reportList.filter(r => r.entryId === entry.id);
    const e = escapeHTML;
    return `<article><h2>${e(entry.author)}</h2><p>${e(entry.text)}</p><p>ID: ${e(entry.id)} · ${e(entry.moderation?.status ?? "published")} · ${e(entry.moderation?.reason ?? "")}</p>${reports.map(r => `<p>Report (${e(r.createdAt)}): ${e(r.reason)}</p>`).join("")}<form><input type="hidden" name="entryId" value="${e(entry.id)}"><label>Decision reason <input name="reason" required maxlength="1000"></label> <button name="hide">Hide entry</button><input type="hidden" name="action" value="hide"></form>${entry.moderation?.status === "pending" ? `<form><input type="hidden" name="entryId" value="${e(entry.id)}"><input type="hidden" name="action" value="approve"><label>Approval reason <input name="reason" required maxlength="1000"></label><button>Approve journal publication</button></form>` : ""}</article>`;
  }).join("");
  return new Response(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Journal moderation</title></head><body><main><h1>Journal moderation</h1><p>Pending entries and reports are retained privately. Hide keeps the original record. Approval publishes held submissions as journal entries only.</p><p id="status" role="alert"></p>${html}</main><script src="/admin/moderation.js" defer></script></body></html>`, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
}

export async function moderate(req: Request, db: DB, save: () => Promise<void>, update: () => void) {
  const body = await boundedJson(req);
  const entry = db.entries.find(e => e.id === body.entryId);
  if (!entry) throw new PublicInputError("Entry not found", 404);
  if (typeof body.reason !== "string" || !body.reason.trim() || body.reason.length > 1000) throw new PublicInputError("A reason of 1–1000 characters is required.");
  if (body.action !== "hide" && body.action !== "approve") throw new PublicInputError("Unknown decision.");
  if (body.action === "approve" && entry.moderation?.status !== "pending") throw new PublicInputError("Only pending entries can be approved.");
  const decision = { status: body.action === "hide" ? "hidden" as const : "published" as const, reason: body.reason.trim(), decidedAt: new Date().toISOString() };
  entry.moderation = decision;
  (db.journalModerationLog ??= []).push({ entryId: entry.id, ...decision });
  await save(); update();
  return Response.json({ ok: true });
}
