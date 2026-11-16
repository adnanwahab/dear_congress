/** Closed vocabulary: no content, route IDs, opinions, errors or user attributes. */
export const QUALITY_EVENTS = ['route_ready', 'route_failed', 'route_abandoned', 'demo_started', 'demo_completed', 'demo_exited', 'compare_opened', 'model_failed', 'model_completed', 'model_recovered', 'accessibility_fallback'] as const;
export const QUALITY_CAPABILITIES = ['enhanced', 'basic', 'reduced-motion'] as const;
export type QualityEvent = typeof QUALITY_EVENTS[number];
export type QualityCapability = typeof QUALITY_CAPABILITIES[number];
export type QualitySignal = { event: QualityEvent; capability: QualityCapability; duration?: number };
export function validQualitySignal(value: unknown): value is QualitySignal {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const v = value as Record<string, unknown>;
  return Object.keys(v).every(k => ['event', 'capability', 'duration'].includes(k)) &&
    QUALITY_EVENTS.includes(v.event as QualityEvent) && QUALITY_CAPABILITIES.includes(v.capability as QualityCapability) &&
    (v.event === 'route_ready' ? typeof v.duration === 'number' && Number.isFinite(v.duration) && v.duration >= 0 && v.duration <= 120000 : v.duration === undefined);
}
export function latencyBucket(ms: number) { return ms <= 100 ? '0–100 ms' : ms <= 500 ? '101–500 ms' : ms <= 2000 ? '501–2000 ms' : '>2000 ms'; }
