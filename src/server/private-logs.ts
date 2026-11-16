import { securityHeaders } from "./public-security";
import { AsyncLocalStorage } from 'node:async_hooks';

const requests = new AsyncLocalStorage<string>();
/** Random per-request correlation, never an incoming header or browser identity. */
export async function withRequestLogContext(run: () => Response | Promise<Response>): Promise<Response> {
  const requestId = crypto.randomUUID();
  return requests.run(requestId, async () => {
    try {
      const response = await run();
      const headers = new Headers(response.headers);
      headers.set('x-request-id', requestId);
      return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
    } catch {
      reportPrivateError();
      return securityHeaders(new Response('Internal Server Error', { status: 500, headers: { 'x-request-id': requestId } }));
    }
  });
}

/** No exception properties are safe, including name, cause and custom fields. */
export function reportPrivateError() {
  const requestId = requests.getStore() ?? crypto.randomUUID();
  console.error('[SERVER_ERROR]', JSON.stringify({ requestId, category: 'internal_error' }));
  return requestId;
}

const events = new Set(['request', 'response', 'EXTRACT_PROVIDER', 'PUBLISH_LABELS_PREFLIGHT', 'PUBLISH_LABELS_HIT', 'PUBLISH_LABELS_REJECTED', 'PUBLISH_LABELS_OK']);
/** Deliberately discard payloads: label IDs, parser errors and headers are untrusted. */
export function logPrivateEvent(event: string, _payload?: unknown) {
  console.log('[EVENT]', JSON.stringify({ event: events.has(event) ? event : 'other', requestId: requests.getStore() ?? null }));
}
