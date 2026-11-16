/** Best-effort content-free reports; never retry or alter the saved action. */
export async function advisoryFetch(path: string, init: RequestInit, send = fetch): Promise<Response> {
  const tracked = ['POST', 'PATCH', 'DELETE', 'PUT'].includes(init.method ?? '') &&
    (/^\/api\/(votes|answers|journal|entries|publish_draft)(\/[^/?]+)?$/.test(path) || /^\/api\/citizen-proposals\/[^/?]+\/vote$/.test(path));
  const report = (outcome: 'saved' | 'failed' | 'blocked') => {
    if (!tracked) return;
    try { void send('/api/save-outcome', { method: 'POST', credentials: 'omit', keepalive: true,
      headers: { 'content-type': 'application/json' }, body: JSON.stringify({ outcome }) }).catch(() => {}); } catch {}
  };
  try {
    const response = await send(path, init);
    report(response.ok ? 'saved' : response.status < 500 || response.headers.get('x-service-outcome') === 'blocked' ? 'blocked' : 'failed');
    return response;
  } catch (error) {
    if (!(error instanceof Error && error.name === 'AbortError')) report('failed');
    throw error;
  }
}
