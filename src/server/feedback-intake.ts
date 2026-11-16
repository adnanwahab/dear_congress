import { Database } from 'bun:sqlite';
import { mkdirSync, chmodSync } from 'node:fs';
import { dirname } from 'node:path';
import { boundedJson, PublicInputError } from './public-security';
import { moderationAuthorized } from './moderation';

export const feedbackTriage = {
  bug: { owner: 'Engineering maintainer', hours: 72 },
  'misleading-claim': { owner: 'Content and safety maintainer', hours: 48 },
  privacy: { owner: 'Privacy and safety maintainer', hours: 24 },
  accessibility: { owner: 'Accessibility maintainer', hours: 48 },
  idea: { owner: 'Product maintainer', hours: 168 },
} as const;

/** Separate private storage: never part of public state, synthesis, exports or reset. */
export function createFeedbackIntake(path: string, secret: () => string) {
  mkdirSync(dirname(path), { recursive: true });
  const db = new Database(path, { create: true });
  if (path !== ':memory:') chmodSync(path, 0o600);
  db.exec('CREATE TABLE IF NOT EXISTS feedback (id TEXT PRIMARY KEY, category TEXT NOT NULL, text TEXT NOT NULL, owner TEXT NOT NULL, createdAt TEXT NOT NULL, responseDueAt TEXT NOT NULL)');
  return {
    close: () => db.close(),
    async submit(req: Request) {
      // Fail closed until an operator can actually read the protected queue.
      if (!secret()) return Response.json({ error: 'Private feedback intake is unavailable. Please try later.' }, { status: 503 });
      const body = await boundedJson(req, 12000);
      if (typeof body.category !== 'string' || !Object.hasOwn(feedbackTriage, body.category)) throw new PublicInputError('Choose a feedback category.');
      if (typeof body.text !== 'string' || !body.text.trim() || body.text.length > 4000 || body.consent !== true || body.website) throw new PublicInputError('Enter 1–4000 characters and confirm private review.');
      const triage = feedbackTriage[body.category as keyof typeof feedbackTriage];
      const id = crypto.randomUUID(), now = Date.now();
      db.query('INSERT INTO feedback VALUES (?, ?, ?, ?, ?, ?)').run(id, body.category, body.text.trim(), triage.owner, new Date(now).toISOString(), new Date(now + triage.hours * 3600000).toISOString());
      return Response.json({ id, status: 'pending-private-review', owner: triage.owner, responseDueAt: new Date(now + triage.hours * 3600000).toISOString() }, { status: 201 });
    },
    queue(req: Request) {
      if (!moderationAuthorized(req, secret())) return new Response('Not found', { status: 404 });
      // JSON only: untrusted text is never inserted into HTML or public content.
      return Response.json({ feedback: db.query('SELECT rowid AS cursor, * FROM feedback WHERE rowid < ? ORDER BY rowid DESC LIMIT 200').all(Number(new URL(req.url).searchParams.get('before')) || Number.MAX_SAFE_INTEGER) }, { headers: { 'cache-control': 'no-store' } });
    },
  };
}

export const feedbackPage = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Private feedback · Civic Synthesis</title></head><body><main style="max-width:44rem;margin:2rem auto;padding:1rem;font:1.1rem system-ui"><h1>Send private feedback</h1><p>Independent advisory beta, not election infrastructure or an official government service. Reports go only to authorized maintainers. Nothing is automatically posted publicly.</p><p>Do not include passwords, cookie identifiers, private journal text, addresses or other sensitive details. This is not an emergency service. No contact information is collected; keep your receipt ID. There is no automatic email reply or public status lookup.</p><form><p><label>Category <select name="category">${Object.entries(feedbackTriage).map(([tag, value]) => `<option value="${tag}">${tag} · ${value.hours}-hour review target</option>`).join('')}</select></label></p><p><label>What happened, where, and what would help?<br><textarea name="text" required maxlength="4000" rows="8" style="width:100%;box-sizing:border-box"></textarea></label></p><p><label><input type="checkbox" name="consent" required> I agree to private storage and maintainer review of this report.</label></p><button>Send private feedback</button></form><p id="status" role="status" aria-live="polite"></p><p>Targets are for initial human review, not guaranteed fixes. Reports are retained until manual deletion by an authorized operator; backups may remain. Abusive content stays private. Maintainers may create a separately reviewed, redacted task; original text is never automatically copied to public issues.</p><a href="/documentation">Return to public guide</a></main><script src="/feedback.js" defer></script></body></html>`;
export const feedbackScript = `document.querySelector('form').addEventListener('submit', async event => {
 event.preventDefault(); const form = event.currentTarget, button = form.querySelector('button'), status = document.getElementById('status'); button.disabled = true; status.textContent = 'Sending…';
 try { const values = new FormData(form); const res = await fetch('/api/feedback', {method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({category:values.get('category'),text:values.get('text'),consent:values.has('consent')})}); const data = await res.json(); if (!res.ok) throw Error(data.error || 'Unable to send.'); status.textContent = 'Saved privately. Receipt: ' + data.id + '. Initial review target: ' + data.responseDueAt + '. Owner: ' + data.owner; form.reset(); }
 catch(error) { status.textContent = error.message + ' Your draft remains here. If delivery is uncertain, retrying may create a duplicate.'; } finally { button.disabled = false; }
});`;
