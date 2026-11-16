import { AsyncLocalStorage } from 'node:async_hooks';
import type { DB } from '../engine/types';

export interface MutationReceipt { fingerprint: string; status: number; body: string }
const digest = (value: string) => new Bun.CryptoHasher('sha256').update(value).digest('hex');
const canonical = (value: unknown): string => JSON.stringify(value && typeof value === 'object'
  ? Array.isArray(value) ? value.map(v => JSON.parse(canonical(v))) : Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, JSON.parse(canonical(v))]))
  : value);

/** Single-process JSON writer: receipts and mutations share one atomic snapshot. */
export function mutationRetries(getDB: () => DB, persist: () => Promise<unknown>, restore: (db: DB) => void) {
  const context = new AsyncLocalStorage<{ active: boolean; effects: (() => void)[] }>();
  let queue: Promise<unknown> = Promise.resolve();
  return {
    effect(effect: () => void) { const current = context.getStore(); if (current?.active) current.effects.push(effect); else effect(); },
    deferred: () => context.getStore()?.active === true,
    run(req: Request, path: string, method: string, handler: () => Promise<Response>): Promise<Response> {
      if (!['POST', 'PATCH', 'PUT', 'DELETE'].includes(method)) return handler();
      const execute = async () => {
        const supported = method === 'POST' && ['/api/journal', '/api/entries', '/api/publish_draft', '/api/votes'].includes(path);
        const key = supported ? req.headers.get('idempotency-key') : null;
        if (key === null) return handler();
        if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(key)) return Response.json({ error: 'Idempotency-Key must be a random UUID v4.' }, { status: 400 });
        const scope = digest(`${req.headers.get('x-voter-id')}\n${path}\n${key}`);
        const fingerprint = digest(canonical(await req.clone().json()));
        const receipt = getDB().mutationReceipts?.[scope];
        if (receipt) return receipt.fingerprint === fingerprint
          ? new Response(receipt.body, { status: receipt.status, headers: { 'content-type': 'application/json' } })
          : Response.json({ error: 'Idempotency key already used with different content.' }, { status: 409 });
        const before = structuredClone(getDB());
        const transaction = { active: true, effects: [] as (() => void)[] };
        try {
          const response = await context.run(transaction, handler);
          transaction.active = false;
          if (!response.ok) { restore(before); return response; }
          const body = await response.clone().text();
          (getDB().mutationReceipts ??= {})[scope] = { fingerprint, status: response.status, body };
          await persist();
          for (const effect of transaction.effects) { try { effect(); } catch { /* Committed writes must remain successful. */ } }
          return response;
        } catch (error) { transaction.active = false; restore(before); throw error; }
      };
      const result = queue.then(execute);
      queue = result.catch(() => {});
      return result;
    },
  };
}
