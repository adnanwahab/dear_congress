/** Availability observations never verify content, legal status, or editorial review. */
export interface CitationCheck {
  itemId: string; url: string; attemptedAt: string; operator: string;
  status: number | null; reason: 'http' | 'network-error';
}
export const CITATION_LIMIT = 'Link availability only; policy substance and legal status remain unverified.';
export function citationAvailability(item: { id: string; sourceUrl: string }, checks: readonly CitationCheck[], now = Date.now()): string | null {
  const check = checks.filter(c => c.itemId === item.id && c.url === item.sourceUrl).at(-1);
  if (!check) return null;
  const at = Date.parse(check.attemptedAt);
  if (!Number.isFinite(at) || at > now || !check.operator.trim()) return 'Link check date or operator invalid — availability unknown';
  const reason = check.reason === 'network-error' ? 'Network error or timeout — availability unknown'
    : check.status !== null && check.status >= 200 && check.status < 300 ? `Responded HTTP ${check.status}`
    : check.status !== null && check.status >= 300 && check.status < 400 ? `Redirect HTTP ${check.status} — destination not checked`
    : check.status !== null && check.status >= 400 && check.status < 600 ? `Unavailable HTTP ${check.status}`
    : 'Unrecognized response — availability unknown';
  return `${reason} · Last availability check: ${check.attemptedAt}${now - at > 30 * 86400000 ? ' · Stale check (over 30 days); recheck needed' : ''}`;
}
