# Resend inbound email for Civic Synthesis

This optional integration receives private email feedback without adding an email
message to public journals, proposals, votes, or governance workflows. The endpoint
stores only Resend message IDs and limited metadata in a separate SQLite database;
message text is retrieved from Resend **on authorized admin read**, not persisted
locally. There is no automatic reply, model processing, or proposal publication.

## Resend setup

1. Open Resend -> Emails -> Receiving and choose either the default Resend
   receiving domain (no DNS change) or a custom receiving domain.
2. For a custom domain, enable receiving and install the **exact MX record
   Resend supplies**. Do not repoint a root domain currently used by a
   Google Workspace or other mailbox; use a separate receiving subdomain
   or configure forwarding instead.
3. In Resend -> Webhooks -> Add webhook, subscribe to `email.received`:
   `https://civic-synthesis.fly.dev/api/webhooks/resend`
4. Store the webhook **signing secret** from this endpoint and a Resend API key
   with permission to read received emails as Fly secrets (never Git):
   `fly secrets set -a civic-synthesis RESEND_WEBHOOK_SECRET=... RESEND_API_KEY=...`
5. Set `RESEND_INBOUND_TO` to the exact receiving address(es), comma-separated,
   to ignore unrelated mail on the same receiving domain. Example:
   `fly secrets set -a civic-synthesis RESEND_INBOUND_TO=feedback@civic-synthesis.com`
   This is an example address, not proof that its DNS is configured.
6. Existing `ADMIN_TOKEN` protects both admin inbox endpoints; it must be set.
   Optionally set `RESEND_INBOUND_DB_PATH` (defaults to
   `DB_PATH + ".resend.sqlite"` on the mounted volume).

## Private admin endpoints

- `GET /api/admin/inbound-email` — latest 50 message metadata records.
- `GET /api/admin/inbound-email/:id` — a stored message's plain-text body
  fetched from Resend on demand (no HTML rendered), plus attachment metadata.

Send `Authorization: Bearer <ADMIN_TOKEN>` to both. Responses use
`Cache-Control: private, no-store`. Never put admin tokens in a public browser
script or a URL. Attachment downloads are intentionally not implemented.
Use the Resend dashboard for HTML-only messages and attachments.

## Safety and operations

- Requests require valid Svix signatures over the raw payload and must be
  within five minutes. A unique `email_id` prevents duplicate writes.
- Incoming mail is **untrusted text**, not a command, vote, identity proof,
  verified citizen contribution, or authority to invoke an LLM.
- Local metadata is kept for at most 30 days and pruned on inbox activity.
  Resend provider-side retention is independent and must be managed in Resend.
- Missing webhook secret fails closed with 503. Failed local persistence returns
  503 so Resend can retry; failed admin upstream reads do not expose raw errors.
- Test with a real message to your chosen receiving address and verify it
  appears in the private inbox before advertising the address.
