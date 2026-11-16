/** Operator-reviewed official notices only. No inference from proposal/demo activity. */
export interface PublicMeeting {
  id: string; title: string; jurisdiction: string; topics: string[];
  organizer: string; sourceUrl: string; verifiedBy: string; checkedAt: string;
  startsAt: string | null; agenda: { text: string; sourceUrl: string } | null;
}
export interface MeetingsResponse { meetings: PublicMeeting[] }
const text = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0 && v.length <= 10000;
const https = (v: unknown): v is string => {
  try { if (typeof v !== 'string' || /[\u0000-\u0020\u007f]/.test(v)) return false; const u = new URL(v); return u.protocol === 'https:' && !u.username && !u.password; } catch { return false; }
};
const instant = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?(?:Z|[+-]\d\d:\d\d)$/.test(v) && Number.isFinite(Date.parse(v));
export function parseMeetings(value: unknown): PublicMeeting[] {
  if (!Array.isArray(value) || value.length > 1000) throw new Error('Invalid meeting snapshot');
  const ids = new Set<string>();
  return value.map(m => {
    if (!m || !text(m.id) || ids.has(m.id) || !text(m.title) || !text(m.jurisdiction) ||
      !text(m.organizer) || !text(m.verifiedBy) || !https(m.sourceUrl) || !instant(m.checkedAt) ||
      !Array.isArray(m.topics) || !m.topics.every(text) ||
      !(m.startsAt === null || instant(m.startsAt)) ||
      !(m.agenda === null || (text(m.agenda?.text) && https(m.agenda?.sourceUrl)))) throw new Error('Invalid meeting snapshot');
    ids.add(m.id);
    return { id: m.id, title: m.title, jurisdiction: m.jurisdiction, topics: m.topics,
      organizer: m.organizer, sourceUrl: m.sourceUrl, verifiedBy: m.verifiedBy,
      checkedAt: m.checkedAt, startsAt: m.startsAt, agenda: m.agenda };
  });
}
export function meetingFreshness(m: PublicMeeting, now = Date.now()) {
  const age = now - Date.parse(m.checkedAt);
  return !Number.isFinite(age) || age < 0 ? 'Source check unavailable' : age >= 86400000 ? 'Source is stale — recheck the organizer notice' : 'Source checked within 24 hours — schedules can change';
}
const escape = (v: string) => v.replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/;/g, '\\;').replace(/,/g, '\\,');
const stamp = (v: string) => new Date(v).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
export function meetingCalendar(m: PublicMeeting, reminder = false): string {
  if (!m.startsAt) throw new Error('Meeting time unavailable');
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Civic Synthesis//Public Meetings//EN', 'BEGIN:VEVENT',
    `UID:${escape(encodeURIComponent(m.id))}@civic-synthesis`, `DTSTAMP:${stamp(m.checkedAt)}`, `DTSTART:${stamp(m.startsAt)}`,
    `SUMMARY:${escape(m.title)}`, `URL:${m.sourceUrl}`, `DESCRIPTION:${escape(`Organizer: ${m.organizer}. Source checked ${m.checkedAt}. Recheck source; this export does not update automatically. ${m.agenda?.text ?? 'Agenda unavailable.'}`)}`];
  if (reminder) lines.push('BEGIN:VALARM', 'TRIGGER:-PT30M', 'ACTION:DISPLAY', 'DESCRIPTION:Recheck public meeting source', 'END:VALARM');
  lines.push('END:VEVENT', 'END:VCALENDAR');
  // Fold by UTF-8 octets, including continuation space (RFC 5545).
  return lines.map(line => { let out = '', column = 0; for (const ch of line) { const size = new TextEncoder().encode(ch).length; if (column + size > 75) { out += '\r\n '; column = 1; } out += ch; column += size; } return out; }).join('\r\n') + '\r\n';
}
