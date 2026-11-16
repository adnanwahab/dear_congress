import { createHash } from 'node:crypto';

// Exact routes only: every producer must be independent of request identity and DB ownership.
const PUBLIC_READS = new Set(['/api/sample-proposals', '/api/legislation', '/api/audit-samples']);
export function createPublicReadCache(mode = process.env.PUBLIC_READ_CACHE_MODE ?? 'validate', now = Date.now) {
  if (!['off', 'validate', 'short'].includes(mode)) throw new Error('Invalid PUBLIC_READ_CACHE_MODE');
  type Entry = { bytes: Uint8Array<ArrayBuffer>; headers: Headers; etag: string; created: number };
  const entries = new Map<string, Entry>();
  const pending = new Map<string, Promise<Entry | Response>>();
  return {
    eligible(path: string, method: string) { return mode !== 'off' && method === 'GET' && PUBLIC_READS.has(path); },
    async respond(req: Request, produce: () => Response | Promise<Response>): Promise<Response> {
      const key = new URL(req.url).pathname;
      if (!PUBLIC_READS.has(key) || req.method !== 'GET' || mode === 'off') throw new Error('Public cache route not allowed');
      let entry = entries.get(key);
      const noStore = /(?:^|,)\s*no-store\s*(?:,|$)/i.test(req.headers.get('cache-control') ?? '');
      const revalidate = /(?:no-cache|no-store|max-age=0)/i.test(req.headers.get('cache-control') ?? '');
      if (mode !== 'short' || !entry || now() - entry.created >= 15000 || revalidate) {
        let work = noStore ? undefined : pending.get(key);
        if (!work) {
          work = (async (): Promise<Entry | Response> => {
            const res = await produce();
            // Errors and accidental identity-setting producers never enter public storage.
            if (res.status !== 200 || res.headers.has('set-cookie')) {
              res.headers.set('cache-control', 'private, no-store');
              entries.delete(key);
              return res;
            }
            const bytes = new Uint8Array(await res.arrayBuffer());
            const headers = new Headers(res.headers);
            if (bytes.length > 1024 * 1024) {
              headers.set('cache-control', 'no-store');
              entries.delete(key);
              return new Response(bytes, { headers });
            }
            headers.delete('content-length');
            const result = { bytes, headers, etag: `W/"${createHash('sha256').update(bytes).digest('hex')}"`, created: now() };
            if (mode === 'short' && !noStore) entries.set(key, result);
            return result;
          })();
          if (!noStore) pending.set(key, work);
        }
        try {
          const result = await work;
          if (result instanceof Response) return result.clone();
          entry = result;
        } finally { if (pending.get(key) === work) pending.delete(key); }
      }
      const headers = new Headers(entry!.headers);
      headers.set('etag', entry!.etag);
      headers.set('cache-control', noStore ? 'no-store' : mode === 'short' ? 'public, max-age=15, s-maxage=15, must-revalidate' : 'public, no-cache');
      headers.set('age', String(Math.max(0, Math.floor((now() - entry!.created) / 1000))));
      // Representations never vary by cookies, auth, origin, query or browser identity.
      // Weak validators remain valid if the HTTP server compresses the same representation.
      headers.set('vary', 'Accept-Encoding');
      const tags = req.headers.get('if-none-match') ?? '';
      const matches = tags.trim() === '*' || tags.split(',').some(tag => tag.trim().replace(/^W\//, '') === entry!.etag.replace(/^W\//, ''));
      return new Response(matches ? null : entry!.bytes, { status: matches ? 304 : 200, headers });
    },
  };
}
