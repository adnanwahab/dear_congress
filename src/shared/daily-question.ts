import type { DemoPayload } from '../engine/demo';

export function chicagoDate(now: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Chicago', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

/** Find the next local date boundary without assuming a 24-hour DST day. */
export function nextChicagoDay(now: Date): number {
  const key = chicagoDate(now);
  let low = now.getTime(), high = low + 27 * 60 * 60 * 1000;
  while (high - low > 1) {
    const middle = Math.floor((low + high) / 2);
    if (chicagoDate(new Date(middle)) === key) low = middle; else high = middle;
  }
  return high;
}

export function dailyQuestion(data: DemoPayload, now: Date) {
  // Unknown or expired windows fail closed. Never invent a new deadline.
  if (!(Date.parse(data.closesAt) > now.getTime())) return undefined;
  const items = [...data.items].sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  const day = chicagoDate(now);
  const index = [...day].reduce((hash, char) => (hash * 31 + char.charCodeAt(0)) >>> 0, 0);
  return items[index % items.length];
}
