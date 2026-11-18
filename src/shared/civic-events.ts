/** Reviewed event records only. Catalog drafts and sample voting deadlines are not meetings. */
export interface CivicEvent {
  id: string;
  title: string;
  institution: string;
  committee: string;
  date: string; // ISO instant with explicit zone
  status: 'confirmed' | 'canceled' | 'unverified';
  source: { url: string; publisher: string; checkedAt: string };
  topicIds: string[];
  billIds: string[];
}
// No reviewed date sources are registered. Do not populate from sample timelines.
export const civicEvents: readonly CivicEvent[] = [];
export function eventSource(event: CivicEvent): string | null {
  try {
    const url = new URL(event.source.url);
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}
function instant(value: string) {
  return /T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value) ? Date.parse(value) : NaN;
}
export function eventState(event: CivicEvent, now: number): string {
  if (event.status === 'canceled') return 'Canceled';
  const date = instant(event.date), checked = instant(event.source.checkedAt);
  if (event.status !== 'confirmed' || !eventSource(event) || !event.source.publisher || !event.institution || !event.committee || !Number.isFinite(date) || !Number.isFinite(checked) || checked > now) return 'Unverified';
  if (date < now) return 'Expired';
  if (now - checked > 86400000) return 'Stale evidence';
  return 'Confirmed';
}
export function eventDate(event: CivicEvent) {
  return Number.isFinite(instant(event.date)) ? new Date(event.date).toISOString().replace('T', ' ').replace('.000Z', ' UTC') : 'Date unavailable';
}
