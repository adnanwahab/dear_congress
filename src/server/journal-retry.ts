import { createHash } from 'node:crypto';
import type { DB } from '../engine/types';
import { publicJournal } from './journal-privacy';
const hash = (value: string) => createHash('sha256').update(value).digest('hex');
export type JournalRetryRecord = { bodyHash: string; status?: number; result?: Record<string, unknown>; entryId?: string; direct?: boolean };
/** A durable claim precedes creation. Uncertain/crashed claims fail closed rather than duplicate. */
export function journalRetries(getDB: () => DB, save: () => Promise<unknown>) {
  const active = new Map<string, Promise<Response>>();
  return async (req: Request, owner: string, run: () => Promise<Response>): Promise<Response> => {
    const db = getDB();
    const body = await req.clone().json();
    if (body.idempotencyKey === undefined) return run(); // Legacy clients remain compatible.
    if (typeof body.idempotencyKey !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.idempotencyKey)) return Response.json({ error: 'A UUID v4 idempotencyKey is required.' }, { status: 400 });
    const key = hash(JSON.stringify([owner, new URL(req.url).pathname, body.idempotencyKey.toLowerCase()]));
    const bodyHash = hash(JSON.stringify(body));
    const records = db.journalRetries ??= {};
    const existing = records[key];
    if (existing) {
      if (existing.bodyHash !== bodyHash) return Response.json({ error: 'This retry key belongs to a different excerpt. Review a new submission.' }, { status: 409 });
      if (active.has(key)) return (await active.get(key)!).clone();
      if (!existing.result) return Response.json({ error: 'Publication outcome is uncertain after an interrupted request. Keep your text and check the feed; this key will not create another post.' }, { status: 409 });
      const entry = db.entries.find(e => e.id === existing.entryId);
      if (existing.entryId && (!entry || (entry.moderation && entry.moderation.status !== 'published' && existing.result.status !== 'pending'))) return Response.json({ error: 'The original entry is no longer available. Retry will not recreate it.' }, { status: 409 });
      if (existing.direct && entry) return Response.json(publicJournal(entry), { status: existing.status });
      return Response.json({ ...existing.result, ...(entry && existing.result.status !== 'pending' ? { entry: publicJournal(entry) } : {}) }, { status: existing.status });
    }
    records[key] = { bodyHash };
    const work = (async () => {
      await save();
      const response = await run();
      if (response.ok) {
        const payload = await response.clone().json();
        const { entry, ...result } = payload;
        const direct = typeof payload.id === 'string' && typeof payload.text === 'string';
        records[key] = { bodyHash, status: response.status, result: direct ? {} : result, direct, entryId: direct ? payload.id : entry?.id ?? result.entryId ?? result.entry_id };
      } else if (response.status < 500) delete records[key];
      await save();
      return response;
    })();
    active.set(key, work);
    try { return (await work).clone(); } finally { active.delete(key); }
  };
}
