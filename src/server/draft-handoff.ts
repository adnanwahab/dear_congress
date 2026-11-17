import { randomBytes } from 'node:crypto';
import { boundedJson, PublicInputError } from './public-security';

/** Single-process ephemeral relay. No application records or plaintext enter this store. */
export function createDraftHandoff(now = Date.now, capacity = 100) {
  const rows = new Map<string, { ciphertext: string; iv: string; revoke: string; expiresAt: number; timer: ReturnType<typeof setTimeout> }>();
  const token = () => randomBytes(32).toString('base64url');
  const valid = (v: unknown, length: number) => typeof v === 'string' && v.length === length && /^[A-Za-z0-9_-]+$/.test(v);
  return async (req: Request) => {
    for (const [id, row] of rows) if (row.expiresAt <= now()) { clearTimeout(row.timer); rows.delete(id); }
    const body = await boundedJson(req, 65536);
    if (body.action === 'create') {
      if (!valid(body.iv, 16) || typeof body.ciphertext !== 'string' || body.ciphertext.length < 22 || body.ciphertext.length > 60000 || !/^[A-Za-z0-9_-]+$/.test(body.ciphertext)) throw new PublicInputError('Invalid encrypted draft.');
      if (rows.size >= capacity) return Response.json({ error: 'Handoff unavailable. Keep your original draft and try later.' }, { status: 503 });
      const id = token(), revoke = token(), expiresAt = now() + 15 * 60 * 1000;
      const timer = setTimeout(() => rows.delete(id), 15 * 60 * 1000);
      timer.unref();
      rows.set(id, { ciphertext: body.ciphertext, iv: body.iv as string, revoke, expiresAt, timer });
      return Response.json({ id, revoke, expiresAt });
    }
    if (!valid(body.id, 43)) throw new PublicInputError('Invalid handoff.');
    const row = rows.get(body.id as string);
    if (!row || (body.action === 'revoke' && body.revoke !== row.revoke)) return Response.json({ error: 'Handoff unavailable: expired, revoked, already opened, or service restarted. Your original draft is unchanged.' }, { status: 410 });
    if (body.action !== 'claim' && body.action !== 'revoke') throw new PublicInputError('Invalid handoff action.');
    // No await between lookup and deletion: exactly one claimant in this writer process.
    clearTimeout(row.timer);
    rows.delete(body.id as string);
    return Response.json(body.action === 'claim' ? { ciphertext: row.ciphertext, iv: row.iv } : { ok: true });
  };
}
