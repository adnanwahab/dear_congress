import type { CitationCheck } from '../shared/citation-availability';
/** Called only by the local operator tool with a repository-curated citation. No redirects or body ingestion. */
export async function checkCitation(item: { id: string; sourceUrl: string }, operator: string, request: (url: string, init: RequestInit) => Promise<Response> = fetch, now = new Date()): Promise<CitationCheck> {
  const url = new URL(item.sourceUrl);
  if (url.protocol !== 'https:' || url.username || url.password || !operator.trim()) throw new Error('Safe HTTPS citation and named operator required');
  const base = { itemId: item.id, url: item.sourceUrl, attemptedAt: now.toISOString(), operator: operator.trim() };
  try {
    const response = await request(url.href, { method: 'GET', redirect: 'manual', signal: AbortSignal.timeout(10000), credentials: 'omit', headers: { 'User-Agent': 'DearCongress-CitationAvailability/1.0' } });
    await response.body?.cancel();
    return { ...base, status: response.status, reason: 'http' };
  } catch { return { ...base, status: null, reason: 'network-error' }; }
}
