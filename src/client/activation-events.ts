import type { ActivationEvent } from '../shared/activation-events';
/** Best effort only; no cookies, storage, content, identifiers or retries. */
export function recordActivation(event: ActivationEvent, send: typeof fetch = fetch) {
  try {
    void send('/api/activation-event', {
      method: 'POST', credentials: 'omit', keepalive: true,
      headers: { 'content-type': 'application/json' }, body: JSON.stringify({ event }),
    }).catch(() => {});
  } catch { /* Analytics must never block participation. */ }
}
