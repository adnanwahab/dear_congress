export type GraphicsTier = 'lite' | 'standard' | 'cinematic';
export type GraphicsMode = 'auto' | GraphicsTier;
export const GRAPHICS_KEY = 'civic:graphics';
export const GRAPHICS_EVENT = 'civic:graphics-change';
export const GRAPHICS_BUDGETS = {
  lite: { pixelRatio: 1, particles: 0 },
  standard: { pixelRatio: 1.5, particles: 0 },
  cinematic: { pixelRatio: 2, particles: 0 },
} as const;
export function graphicsMode(target: Window): GraphicsMode {
  try { const mode = target.localStorage.getItem(GRAPHICS_KEY); if (mode === 'lite' || mode === 'standard' || mode === 'cinematic') return mode; } catch {}
  const mode = target.document.documentElement.dataset.graphics;
  return mode === 'lite' || mode === 'standard' || mode === 'cinematic' ? mode : 'auto';
}
export function setGraphicsMode(target: Window, mode: GraphicsMode) {
  target.document.documentElement.dataset.graphics = mode;
  try { target.localStorage.setItem(GRAPHICS_KEY, mode); } catch {}
  const event = target.document.createEvent('Event');
  event.initEvent(GRAPHICS_EVENT, false, false);
  target.dispatchEvent(event);
}
/** Consecutive active-render samples only; idle/background gaps are not slow frames. */
export function measuredTier(tier: GraphicsTier, frameMs: number): GraphicsTier {
  if (frameMs > 24) return tier === 'cinematic' ? 'standard' : 'lite';
  if (frameMs < 18) return tier === 'lite' ? 'standard' : 'cinematic';
  return tier;
}
interface QualityMap {
  on(type: string, callback: () => void): unknown;
  off?(type: string, callback: () => void): unknown;
  setPixelRatio?(ratio: number): unknown;
}
export interface GraphicsStats { tier: GraphicsTier; frameMs: number | null; pixelRatio: number }
export function attachGraphics(map: QualityMap, target: Window, report: (stats: GraphicsStats) => void = () => {}) {
  let tier: GraphicsTier = 'standard';
  let previous = 0, samples: number[] = [], windows = 0;
  const apply = (frameMs: number | null = null) => {
    const mode = graphicsMode(target);
    if (mode !== 'auto') tier = mode;
    const pixelRatio = Math.min(target.devicePixelRatio || 1, GRAPHICS_BUDGETS[tier].pixelRatio);
    map.setPixelRatio?.(pixelRatio);
    report({ tier, frameMs, pixelRatio });
  };
  const reset = () => { previous = 0; samples = []; windows = 0; tier = 'standard'; apply(); };
  const render = () => {
    const now = target.performance.now();
    const delta = now - previous; previous = now;
    if (target.document.hidden || delta <= 0 || delta > 100) { samples = []; return; }
    samples.push(delta);
    if (samples.length < 60) return;
    const average = samples.reduce((a, b) => a + b, 0) / samples.length;
    samples = [];
    // Slowdown reacts after one window; recovery requires three windows.
    windows++;
    if (graphicsMode(target) === 'auto' && (average > 24 || windows >= 3)) { tier = measuredTier(tier, average); windows = 0; }
    apply(average);
  };
  apply(); map.on('render', render);
  target.addEventListener(GRAPHICS_EVENT, reset);
  target.addEventListener('storage', reset);
  target.document.addEventListener('visibilitychange', reset);
  return () => { map.off?.('render', render); target.removeEventListener(GRAPHICS_EVENT, reset); target.removeEventListener('storage', reset); target.document.removeEventListener('visibilitychange', reset); };
}
