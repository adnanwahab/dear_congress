export const TIME_SCALES = ['day', 'month', 'year', 'decade'] as const;
export type TimeScale = typeof TIME_SCALES[number];
export interface TimeRange { center: number; scale: TimeScale }
const DAY = 86400000;
export const spans: Record<TimeScale, number> = { day: DAY, month: 30 * DAY, year: 365 * DAY, decade: 3652 * DAY };
export const DEFAULT_RANGE: TimeRange = { center: Date.UTC(2026, 10, 14), scale: 'year' };
const MIN = Date.UTC(1900, 0, 1), MAX = Date.UTC(2100, 0, 1);
export function normalizeRange(range: TimeRange): TimeRange {
  return { scale: range.scale, center: Math.max(MIN, Math.min(MAX, range.center)) };
}
export function readTimeRange(search: string): TimeRange {
  const params = new URLSearchParams(search), scale = params.get('timeScale');
  const date = params.get('timeCenter') ?? '';
  const center = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(date) ? Date.parse(date) : NaN;
  return normalizeRange({ scale: TIME_SCALES.includes(scale as TimeScale) ? scale as TimeScale : DEFAULT_RANGE.scale, center: Number.isFinite(center) ? center : DEFAULT_RANGE.center });
}
export function changeScale(range: TimeRange, direction: number): TimeRange {
  return { ...range, scale: TIME_SCALES[Math.max(0, Math.min(3, TIME_SCALES.indexOf(range.scale) + direction))]! };
}
export function panRange(range: TimeRange, direction: number): TimeRange {
  return normalizeRange({ ...range, center: range.center + direction * spans[range.scale] / 2 });
}
export function rangeURL(href: string, range: TimeRange) {
  const url = new URL(href);
  url.searchParams.set('timeScale', range.scale);
  url.searchParams.set('timeCenter', new Date(range.center).toISOString());
  return url;
}
