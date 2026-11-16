import type { QualityEvent, QualityCapability } from '../shared/experience-quality';
const KEY = 'civic-experience-metrics-v1';
export function qualityAllowed(target: Window = window) {
  try { return target.localStorage.getItem(KEY) === 'yes' && target.navigator.doNotTrack !== '1' && !(target.navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl && !(target.document as Document & { prerendering?: boolean }).prerendering; }
  catch { return false; }
}
export function setQualityConsent(enabled: boolean) {
  try { window.localStorage.setItem(KEY, enabled ? 'yes' : 'no'); } catch { /* Fail closed when storage is unavailable. */ }
  window.dispatchEvent(new Event('quality-consent'));
}
export function qualityCapability(target: Window = window): QualityCapability {
  if (target.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return 'reduced-motion';
  return typeof target.document.startViewTransition === 'function' ? 'enhanced' : 'basic';
}
export function recordQuality(event: QualityEvent, duration?: number, target: Window = window, send: typeof fetch = fetch) {
  if (!qualityAllowed(target)) return;
  try {
    const body = { event, capability: qualityCapability(target), ...(event === 'route_ready' ? { duration: Math.min(120000, Math.max(0, Math.round(duration ?? 0))) } : {}) };
    void send('/api/experience-quality', { method: 'POST', credentials: 'omit', referrerPolicy: 'no-referrer', keepalive: true, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }).catch(() => {});
  } catch { /* Observation failure must never interrupt a civic interaction. */ }
}
